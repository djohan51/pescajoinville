// Monta a previsão de pesca de 7 dias: modo Tábua de Marés e modo por espécie.
import { Body, Observer, SearchRiseSet } from 'astronomy-engine';
import type { Tabua } from './tabua';
import type { Weather, Marine } from './weather';
import { WMO } from './weather';
import { moonEvents, moonInfo, estimatedFish } from './moon';
import { buildExtremes, tideAt, estimatedCoef } from './tides';
import { SPECIES } from './especies';
import { localDateKey, localMidnight, localHour, addDays, hm, fmtH, HOUR_MS, TZ_OFFSET_H } from './time';

export type Verdict = 'MUITO BOM' | 'BOM' | 'MAU';
export type Hour = { h: number; tide: number; p: number; tr: number; temp: number; wind: number; rain: number; wc: number; sst: number };
export type Window = { start: number; end: number; major: boolean; sun: boolean; label: string };
export type SiteEval = { verdict: Verdict; score: number; activity: string; fish: number; fishSource: 'site' | 'estimativa'; baro: string; reasons: string[]; slots: number[]; windows: Window[] };
export type SpeciesEval = { verdict: Verdict; score: number; slots: number[]; best: { start: number; end: number }[]; reasons: string[] };
export type DayForecast = {
  date: string; coef: number; tides: { t: string; h: number }[]; tideSource: 'site' | 'calculo';
  sunrise: string; sunset: string; moon: string; illum: number;
  tmin: number; tmax: number; rain: number; wind: number; sky: string;
  site: SiteEval; species: Record<string, SpeciesEval>; hours: Hour[];
};
export type Forecast = {
  generatedAt: number; weatherTime: string; tideSource: 'site' | 'calculo' | 'misto';
  current: Weather['current'] & { sky: string; sst: number };
  pressure: { t0: string; p: number[] };
  days: DayForecast[];
};

const ACT_NAME = ['BAIXA', 'MÉDIA', 'ALTA', 'MUITO ALTA'];
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const bell = (x: number, lo: number, hi: number, soft: number) => {
  if (x >= lo && x <= hi) return 1;
  const d = x < lo ? lo - x : x - hi;
  return clamp(1 - 0.8 * d / soft, 0.1, 1);
};
const lvl = (v: number) => (v >= 0.8 ? 3 : v >= 0.6 ? 2 : v >= 0.4 ? 1 : 0);
const PTXT: Record<string, string> = { subindo: 'subindo', caindo: 'caindo', estavel: 'estável' };
type Periodo = 'madrugada' | 'amanhecer' | 'manha' | 'meio_dia' | 'tarde' | 'entardecer' | 'noite';
function period(x: number, sr: number, ss: number): Periodo {
  if (Math.abs(x - sr) <= 1) return 'amanhecer';
  if (Math.abs(x - ss) <= 1) return 'entardecer';
  if (x < sr - 1) return x >= 2 ? 'madrugada' : 'noite';
  if (x > ss + 1) return 'noite';
  if (x < 10.5) return 'manha';
  if (x < 14) return 'meio_dia';
  return 'tarde';
}

const SUN_OBS = new Observer(-26.29, -48.72, 0);
function sunTimes(key: string): [string, string] {
  const start = new Date(localMidnight(key));
  const r = SearchRiseSet(Body.Sun, SUN_OBS, +1, start, 1), s = SearchRiseSet(Body.Sun, SUN_OBS, -1, start, 1);
  return [r ? fmtH(localHour(r.date.getTime())) : '5:30', s ? fmtH(localHour(s.date.getTime())) : '18:30'];
}

/** opts.days / opts.species limitam o cálculo (o servidor só precisa do dia do aviso e das espécies escolhidas). */
export type BuildOpts = { days?: string[]; species?: string[] };
export function buildForecast(tabua: Tabua | null, W: Weather, M: Marine | null, now = Date.now(), opts: BuildOpts = {}): Forecast {
  const today = localDateKey(now);
  const wT0 = Date.parse(W.t0 + ':00Z') - TZ_OFFSET_H * HOUR_MS;
  const mT0 = M ? Date.parse(M.t0 + ':00Z') - TZ_OFFSET_H * HOUR_MS : 0;
  const idx = (ms: number) => Math.max(0, Math.min(W.p.length - 1, Math.round((ms - wT0) / HOUR_MS)));
  const sstAt = (ms: number) => {
    if (!M) return 21;
    const i = Math.max(0, Math.min(M.sst.length - 1, Math.round((ms - mT0) / HOUR_MS)));
    return M.sst[i] ?? M.sst.find(v => v != null) ?? 21;
  };
  const { ext, bySource, perDay } = buildExtremes(tabua, today, 7);

  const days: DayForecast[] = [];
  for (let i = 0; i < 7; i++) {
    const key = addDays(today, i);
    if (opts.days && !opts.days.includes(key)) continue;
    const t0 = localMidnight(key);
    if (idx(t0 + 23 * HOUR_MS) >= W.p.length - 1 && i > 0) break;
    const site = tabua?.[key];
    const [sunR, sunS] = site ? [site.sunrise, site.sunset] : sunTimes(key);
    const sr = hm(sunR), ss = hm(sunS);
    const tides = perDay[key] || [];
    const coef = site ? site.coef : estimatedCoef(tides);
    const events = moonEvents(key);
    const mi = moonInfo(key);

    const hours: Hour[] = [];
    for (let h = 0; h < 24; h++) {
      const ms = t0 + h * HOUR_MS, j = idx(ms);
      const tr = j >= 3 ? W.p[j] - W.p[j - 3] : W.p[j + 3] - W.p[j];
      hours.push({ h, tide: Math.round(tideAt(ext, ms) * 100) / 100, p: W.p[j], tr: Math.round(tr * 10) / 10, temp: W.temp[j], wind: W.w[j], rain: W.pp[j] ?? 0, wc: W.wc[j], sst: sstAt(ms) });
    }
    const dayH = hours.slice(5, 20);
    const rain = Math.max(...dayH.map(x => x.rain)), wind = Math.max(...dayH.map(x => x.wind));
    const storm = hours.some(x => x.wc >= 95);
    const dp = W.p[idx(t0 + 20 * HOUR_MS)] - W.p[idx(t0 + 5 * HOUR_MS)];
    const ptrend = dp > 1.5 ? 'subindo' : dp < -1.5 ? 'caindo' : 'estavel';

    // ----- Modo Tábua de Marés -----
    const windows: Window[] = events.map(e => {
      const major = e.kind.startsWith('transito'), w = major ? 1 : 0.5;
      const s0 = Math.max(0, e.h - w), s1 = Math.min(24, e.h + w);
      const sun = [sr, ss].some(z => z >= s0 - 0.5 && z <= s1 + 0.5);
      const label = { transito: 'Lua no alto', transito_oposto: 'Lua embaixo', nascer: 'Nascer da lua', por: 'Pôr da lua' }[e.kind];
      return { start: s0, end: s1, major, sun, label };
    });
    const slots: number[] = [];
    for (let k = 0; k < 48; k++) {
      const x = k / 2 + 0.25; let lv = 0;
      for (const w of windows) if (x >= w.start && x <= w.end) { lv = Math.max(lv, w.major ? 3 : 2); if (w.sun) lv = 3; }
      if (lv === 0 && (Math.abs(x - sr) < 0.75 || Math.abs(x - ss) < 0.75)) lv = 1;
      slots.push(lv);
    }
    const fishSource = site && site.fish != null ? 'site' : 'estimativa';
    const a = site && site.fish != null ? site.fish : estimatedFish(mi.age);
    const pmod = { subindo: 1, estavel: 0, caindo: -1 }[ptrend];
    const baro = { subindo: 'MUITO BOM', estavel: 'BOM', caindo: 'MAU' }[ptrend];
    const tot = a + pmod;
    const siteEval: SiteEval = {
      verdict: tot >= 3 ? 'MUITO BOM' : tot >= 1 ? 'BOM' : 'MAU', score: Math.round(100 * clamp((tot + 1) / 5)),
      activity: ACT_NAME[a], fish: a, fishSource, baro,
      reasons: [
        fishSource === 'site' ? `Atividade do dia segundo o site: ${ACT_NAME[a].toLowerCase()}` : `Atividade estimada pela lua: ${ACT_NAME[a].toLowerCase()} (site indisponível)`,
        `Barômetro: pressão ${PTXT[ptrend]} (${dp >= 0 ? '+' : ''}${dp.toFixed(1)} hPa), sinal ${baro.toLowerCase()}`,
        `Coeficiente de maré ${coef}${site ? '' : ' (estimado)'}`, `${mi.name}, ${mi.illum}% iluminada`,
      ], slots, windows,
    };

    // ----- Modo por espécie -----
    const species: Record<string, SpeciesEval> = {};
    const month = new Date(t0 + 12 * HOUR_MS).getUTCMonth() + 1;
    const sstDay = hours.reduce((s, x) => s + x.sst, 0) / 24;
    for (const [sk, s] of Object.entries(SPECIES)) {
      if (opts.species && !opts.species.includes(sk)) continue;
      let sl: number[] = [];
      for (let k = 0; k < 48; k++) {
        const x = k / 2 + 0.25, ms = t0 + x * HOUR_MS;
        const d = (tideAt(ext, ms + 15 * 60_000) - tideAt(ext, ms - 15 * 60_000)) * 2;
        const phase = Math.abs(d) < 0.04 ? 'parada' : d > 0 ? 'enchente' : 'vazante';
        const hh = hours[Math.floor(x)];
        const ptr = hh.tr > 0.7 ? 'subindo' : hh.tr < -0.7 ? 'caindo' : 'estavel';
        let v = s.tempo[period(x, sr, ss)] * s.mare[phase] * (0.6 + 0.4 * clamp(coef / 80))
          * bell(hh.sst, s.temp[0], s.temp[1], s.soft) * s.pressao[ptr]
          * (hh.wind <= s.vento_max ? 1 : clamp(1 - (hh.wind - s.vento_max) / 15, 0.3))
          * (s.chuva_ok || hh.rain < 60 ? 1 : 0.7) * (hh.wc >= 95 ? 0.5 : 1)
          * (s.meses.includes(month) ? 1 : 0.75);
        sl.push(v);
      }
      if (storm) sl = sl.map(v => v * 0.8);
      const top = [...sl].sort((p, q) => q - p).slice(0, 6);
      const score = Math.round(100 * (0.55 * top.reduce((p, q) => p + q, 0) / 6 + 0.45 * sl.reduce((p, q) => p + q, 0) / 48));
      const mx = Math.max(...sl);
      const best: { start: number; end: number }[] = [];
      for (let k = 0; k < 48;) {
        if (sl[k] >= 0.8 * mx) { let j = k; while (j + 1 < 48 && sl[j + 1] >= 0.8 * mx) j++; best.push({ start: k / 2, end: (j + 1) / 2 }); k = j + 1; } else k++;
      }
      const tf = bell(sstDay, s.temp[0], s.temp[1], s.soft), pf = s.pressao[ptrend];
      const reasons = [
        `Água a ${sstDay.toFixed(1)} °C (${tf === 1 ? 'na faixa ideal' : tf > 0.6 ? 'um pouco fora do ideal' : 'fora do ideal'}: ${s.temp[0]}–${s.temp[1]} °C)`,
        `Pressão ${PTXT[ptrend]} (${dp >= 0 ? '+' : ''}${dp.toFixed(1)} hPa): ${pf >= 0.9 ? 'favorável' : pf >= 0.7 ? 'neutra' : 'desfavorável'}`,
        `Coeficiente ${coef}, maré ${coef >= 70 ? 'forte' : coef >= 45 ? 'média' : 'fraca'}`,
        s.meses.includes(month) ? 'Dentro da temporada' : `Fora da temporada principal (${s.temporada})`,
      ];
      if (storm) reasons.push('Risco de trovoada');
      else if (rain >= 60) reasons.push(`Chuva provável (${rain}%)${s.chuva_ok ? '' : ' — atrapalha'}`);
      if (wind > s.vento_max) reasons.push(`Vento até ${Math.round(wind)} km/h`);
      species[sk] = { verdict: score >= 55 ? 'MUITO BOM' : score >= 38 ? 'BOM' : 'MAU', score, slots: sl.map(v => (mx > 0 ? lvl(v / mx) : 0)), best: best.slice(0, 3), reasons };
    }

    const wcs = dayH.map(x => x.wc);
    const wc = wcs.sort((p, q) => wcs.filter(v => v === q).length - wcs.filter(v => v === p).length)[0];
    days.push({
      date: key, coef, tides, tideSource: bySource[key], sunrise: sunR, sunset: sunS, moon: mi.name, illum: mi.illum,
      tmin: Math.min(...hours.map(x => x.temp)), tmax: Math.max(...hours.map(x => x.temp)), rain, wind: Math.round(wind),
      sky: WMO[wc] ?? '—', site: siteEval, species, hours,
    });
  }
  const srcs = new Set(days.map(d => d.tideSource));
  return {
    generatedAt: now, weatherTime: W.current.time,
    tideSource: srcs.size > 1 ? 'misto' : (days[0]?.tideSource ?? 'calculo'),
    current: { ...W.current, sky: WMO[W.current.weather_code] ?? '—', sst: sstAt(now) },
    pressure: { t0: W.t0, p: W.p }, days,
  };
}

/** Pressão interpolada para um instante (para o barômetro "agora"). */
export function pressureAt(f: Forecast, ms: number): number {
  const t0 = Date.parse(f.pressure.t0 + ':00Z') - TZ_OFFSET_H * HOUR_MS;
  const x = (ms - t0) / HOUR_MS, i = Math.floor(x), P = f.pressure.p;
  if (i < 0) return P[0];
  if (i >= P.length - 1) return P[P.length - 1];
  return P[i] + (P[i + 1] - P[i]) * (x - i);
}
