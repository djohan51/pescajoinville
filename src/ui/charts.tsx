import React from 'react';
import Svg, { Path, Rect, Line, Circle, Text as T } from 'react-native-svg';
import type { DayForecast, Forecast } from '../core/forecast';
import { pressureAt } from '../core/forecast';
import { hm, HOUR_MS } from '../core/time';
import { SVG_FONT, type Theme } from './theme';

const W = 360; // largura lógica do desenho (escala para a tela)

function NightBands({ d, X, y0, y1, t }: { d: DayForecast; X: (h: number) => number; y0: number; y1: number; t: Theme }) {
  const sr = hm(d.sunrise), ss = hm(d.sunset);
  return (<>
    <Rect x={X(0)} y={y0} width={X(sr) - X(0)} height={y1 - y0} fill={t.brass} opacity={0.08} />
    <Rect x={X(ss)} y={y0} width={X(24) - X(ss)} height={y1 - y0} fill={t.brass} opacity={0.08} />
  </>);
}
function AxisX({ X, y0, y1, t }: { X: (h: number) => number; y0: number; y1: number; t: Theme }) {
  return (<>{[0, 6, 12, 18, 24].map(h => (
    <React.Fragment key={h}>
      <Line x1={X(h)} x2={X(h)} y1={y0} y2={y1} stroke={t.line} strokeWidth={0.6} />
      <T fontFamily={SVG_FONT} x={X(h)} y={y1 + 11} fontSize={9} fill={t.muted} textAnchor="middle">{String(h).padStart(2, '0')}h</T>
    </React.Fragment>))}</>);
}

/** Maré (curva) + atividade dos peixes em blocos de 30 min (barras de 4 níveis). */
export function ActivityChart({ d, slots, sunWindows, nowH, t }: { d: DayForecast; slots: number[]; sunWindows: { start: number; end: number }[]; nowH: number | null; t: Theme }) {
  const L = 28, R = W - 6, T0 = 10, B = 84, A0 = 98, A1 = 158;
  const X = (h: number) => L + (R - L) * h / 24;
  const Y = (v: number) => B - (B - T0) * (v + 0.2) / 1.7;
  const pts = [...d.hours.map(h => [h.h, h.tide] as [number, number]), ...d.tides.map(x => [hm(x.t), x.h] as [number, number])].sort((a, b) => a[0] - b[0]);
  pts.push([24, d.hours[23].tide]);
  const line = 'M' + pts.map(([h, v]) => `${X(h).toFixed(1)} ${Y(v).toFixed(1)}`).join(' L');
  const bw = (R - L) / 48;
  const colors = [t.line, t.act, t.act, t.act], ops = [1, 0.35, 0.65, 1];
  return (
    <Svg width="100%" height={undefined} viewBox={`0 0 ${W} 172`} style={{ aspectRatio: W / 172 }}>
      <NightBands d={d} X={X} y0={T0} y1={A1} t={t} />
      <AxisX X={X} y0={T0} y1={A1} t={t} />
      {[0, 0.5, 1, 1.5].map(v => (<React.Fragment key={v}>
        <Line x1={L} x2={R} y1={Y(v)} y2={Y(v)} stroke={t.line} strokeDasharray="2 3" strokeWidth={0.6} />
        <T fontFamily={SVG_FONT} x={L - 3} y={Y(v) + 3} fontSize={8} fill={t.muted} textAnchor="end">{v.toFixed(1)}</T>
      </React.Fragment>))}
      <Path d={`${line} L${X(24)} ${B} L${X(0)} ${B} Z`} fill={t.seaSoft} />
      <Path d={line} fill="none" stroke={t.sea} strokeWidth={1.8} />
      {d.tides.map((x, i, a) => {
        const n = a[i + 1]?.h, p = a[i - 1]?.h; const hi = n !== undefined ? x.h > n : p !== undefined ? x.h > p : true;
        return <Circle key={i} cx={X(hm(x.t))} cy={Y(x.h)} r={2.5} fill={hi ? t.sea : t.brass} />;
      })}
      {slots.map((lv, k) => {
        const x = k / 2 + 0.25, hgt = (A1 - A0) * (lv + 1) / 4;
        const sun = sunWindows.some(w => x >= w.start && x <= w.end);
        return <Rect key={k} x={X(k / 2) + 0.6} y={A1 - hgt} width={bw - 1.2} height={hgt} rx={0.8} fill={sun ? t.good : colors[lv]} opacity={sun ? 1 : ops[lv]} />;
      })}
      <T fontFamily={SVG_FONT} x={L - 3} y={A0 + 8} fontSize={8} fill={t.muted} textAnchor="end">peixe</T>
      {nowH != null && <Line x1={X(nowH)} x2={X(nowH)} y1={T0} y2={A1} stroke={t.bad} strokeWidth={1.2} strokeDasharray="3 2" />}
    </Svg>
  );
}

/** Pressão (linha), ar e água (°C) e chance de chuva (barras). */
export function WeatherChart({ d, nowH, t }: { d: DayForecast; nowH: number | null; t: Theme }) {
  const L = 30, R = W - 24, T0 = 8, B = 120;
  const X = (h: number) => L + (R - L) * (h + 0.5) / 24, XA = (h: number) => L + (R - L) * h / 24;
  const ps = d.hours.map(h => h.p), ts = [...d.hours.map(h => h.temp), ...d.hours.map(h => h.sst)];
  let pmin = Math.floor(Math.min(...ps) - 1), pmax = Math.ceil(Math.max(...ps) + 1);
  if (pmax - pmin < 6) { const m = (pmax + pmin) / 2; pmin = Math.floor(m - 3); pmax = Math.ceil(m + 3); }
  const tmin = Math.floor(Math.min(...ts) - 1), tmax = Math.ceil(Math.max(...ts) + 1);
  const YP = (v: number) => B - (B - T0) * (v - pmin) / (pmax - pmin), YT = (v: number) => B - (B - T0) * (v - tmin) / (tmax - tmin);
  const path = (f: (h: DayForecast['hours'][number]) => number, Y: (v: number) => number) => 'M' + d.hours.map(h => `${X(h.h).toFixed(1)} ${Y(f(h)).toFixed(1)}`).join(' L');
  const step = Math.max(1, Math.round((pmax - pmin) / 3));
  const pl: number[] = []; for (let v = pmin; v <= pmax; v += step) pl.push(v);
  return (
    <Svg width="100%" height={undefined} viewBox={`0 0 ${W} 134`} style={{ aspectRatio: W / 134 }}>
      <NightBands d={d} X={XA} y0={T0} y1={B} t={t} />
      <AxisX X={XA} y0={T0} y1={B} t={t} />
      {d.hours.map(h => h.rain > 0 ? <Rect key={h.h} x={XA(h.h) + 1.5} y={B - (B - T0) * h.rain / 200} width={(R - L) / 24 - 3} height={(B - T0) * h.rain / 200} fill={t.sea} opacity={0.3} /> : null)}
      {pl.map(v => (<React.Fragment key={v}>
        <Line x1={L} x2={R} y1={YP(v)} y2={YP(v)} stroke={t.line} strokeDasharray="2 3" strokeWidth={0.6} />
        <T fontFamily={SVG_FONT} x={L - 3} y={YP(v) + 3} fontSize={8} fill={t.muted} textAnchor="end">{v}</T>
      </React.Fragment>))}
      {[tmin, Math.round((tmin + tmax) / 2), tmax].map(v => <T fontFamily={SVG_FONT} key={v} x={R + 4} y={YT(v) + 3} fontSize={8} fill={t.brass}>{v}°</T>)}
      <Path d={path(h => h.sst, YT)} fill="none" stroke={t.sea} strokeWidth={1.4} strokeDasharray="4 2" />
      <Path d={path(h => h.temp, YT)} fill="none" stroke={t.brass} strokeWidth={1.4} />
      <Path d={path(h => h.p, YP)} fill="none" stroke={t.ink} strokeWidth={1.8} />
      {d.hours.filter(h => h.h % 3 === 1).map(h => <Circle key={h.h} cx={X(h.h)} cy={YP(h.p)} r={2.4} fill={h.tr > 0.7 ? t.good : h.tr < -0.7 ? t.bad : t.muted} />)}
      {nowH != null && <Line x1={XA(nowH)} x2={XA(nowH)} y1={T0} y2={B} stroke={t.bad} strokeWidth={1.2} strokeDasharray="3 2" />}
    </Svg>
  );
}

/** Pressão das últimas 12 h e próximas 12 h, para o barômetro do topo. */
export function PressureSpark({ f, now, color, accent }: { f: Forecast; now: number; color: string; accent: string }) {
  const L = 26, R = 236, T0 = 6, B = 62;
  const pts: [number, number][] = []; for (let k = -12; k <= 12; k += 0.5) pts.push([k, pressureAt(f, now + k * HOUR_MS)]);
  let lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1]));
  if (hi - lo < 4) { const m = (hi + lo) / 2; lo = m - 2; hi = m + 2; }
  lo = Math.floor(lo); hi = Math.ceil(hi);
  const X = (k: number) => L + (R - L) * (k + 12) / 24, Y = (v: number) => B - (B - T0) * (v - lo) / (hi - lo);
  const dd = (a: [number, number][]) => 'M' + a.map(q => `${X(q[0]).toFixed(1)} ${Y(q[1]).toFixed(1)}`).join(' L');
  const past = pts.filter(q => q[0] <= 0), fut = pts.filter(q => q[0] >= 0);
  return (
    <Svg width="100%" height={undefined} viewBox="0 0 240 78" style={{ aspectRatio: 240 / 78 }}>
      {[lo, hi].map(v => <T fontFamily={SVG_FONT} key={v} x={L - 3} y={Y(v) + 3} fontSize={8} fill={color} opacity={0.7} textAnchor="end">{v}</T>)}
      <Path d={`${dd(past)} L${X(0)} ${B} L${X(-12)} ${B} Z`} fill={color} opacity={0.12} />
      <Path d={dd(past)} fill="none" stroke={color} strokeWidth={2} />
      <Path d={dd(fut)} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
      <Line x1={X(0)} x2={X(0)} y1={T0} y2={B} stroke={accent} strokeWidth={1.2} />
      <Circle cx={X(0)} cy={Y(pressureAt(f, now))} r={3.5} fill={accent} />
      {[-12, 0, 12].map(k => <T fontFamily={SVG_FONT} key={k} x={X(k)} y={B + 12} fontSize={8} fill={color} opacity={0.7} textAnchor="middle">{k === 0 ? 'agora' : `${k > 0 ? '+' : ''}${k}h`}</T>)}
    </Svg>
  );
}
