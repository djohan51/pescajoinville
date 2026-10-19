import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import type { Forecast } from '../core/forecast';
import { pressureAt } from '../core/forecast';
import { SPECIES } from '../core/especies';
import { localDateKey, localHour, weekday, WD, WDL, fmtH, HOUR_MS } from '../core/time';
import { useTheme, vColor, vText, MONO } from './theme';
import { Card, Chip, Gauge, Label, Segmented } from './common';
import { ActivityChart, WeatherChart, PressureSpark } from './charts';

type Props = {
  f: Forecast; mode: 'site' | 'spec'; setMode: (m: 'site' | 'spec') => void; sp: string; goSpecies: () => void;
  sel: number; setSel: (i: number) => void; refreshing: boolean; onRefresh: () => void; notice: string | null;
};
const DIRS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];

export default function Previsao({ f, mode, setMode, sp, goSpecies, sel, setSel, refreshing, onRefresh, notice }: Props) {
  const t = useTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(id); }, []);
  const d = f.days[Math.min(sel, f.days.length - 1)];
  const ev = mode === 'site' ? d.site : d.species[sp];
  const today = localDateKey(now);
  const nowH = d.date === today ? localHour(now) : null;
  const p = pressureAt(f, now), tr = p - pressureAt(f, now - 3 * HOUR_MS);
  const st = tr > 0.7 ? { lab: '↑ Subindo', sig: 'MUITO BOM', c: t.good } : tr < -0.7 ? { lab: '↓ Caindo', sig: 'RUIM', c: t.bad } : { lab: '→ Estável', sig: 'BOM', c: t.ok };
  const c = f.current;
  const sunWin = mode === 'site' ? d.site.windows.filter(w => w.sun) : [];
  const windows = mode === 'site'
    ? d.site.windows.map(w => `${fmtH(w.start)}–${fmtH(w.end)} · ${w.major ? 'Maior' : 'Menor'} · ${w.label}${w.sun ? ' ☀' : ''}`)
    : d.species[sp].best.map(w => `${fmtH(w.start)}–${fmtH(w.end)}`);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.sea} />}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: t.ink, paddingBottom: 6 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: t.ink }}>Pesca <Text style={{ color: t.sea }}>Joinville</Text></Text>
        <Text style={{ color: t.muted, fontSize: 11 }}>Baía da Babitonga</Text>
      </View>

      {notice && <Text style={{ backgroundColor: t.okBg, color: t.ok, padding: 10, borderRadius: 6, fontSize: 13 }}>{notice}</Text>}

      {/* Barômetro */}
      <View style={{ backgroundColor: t.ink, borderRadius: 10, padding: 16, gap: 6 }}>
        <Text style={{ color: t.paper, opacity: 0.7, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>PRESSÃO ATMOSFÉRICA AGORA</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={[{ color: t.paper, fontSize: 52, fontWeight: '600' }, MONO]}>{p.toFixed(1)}</Text>
          <Text style={{ color: t.paper, opacity: 0.7, fontSize: 18 }}>hPa</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Text style={{ color: t.paper, fontWeight: '700', fontSize: 16 }}>{st.lab} {tr >= 0 ? '+' : ''}{tr.toFixed(1)} hPa em 3 h</Text>
          <Text style={{ backgroundColor: st.c, color: t.paper, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', fontSize: 12 }}>PESCA: {st.sig}</Text>
        </View>
        <PressureSpark f={f} now={now} color={t.paper} accent={st.c} />
        <Text style={{ color: t.paper, opacity: 0.65, fontSize: 11 }}>Previsão Open-Meteo de {f.weatherTime.slice(11, 16)}, recalculada a cada minuto</Text>
      </View>

      {/* Agora */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[['Ar', `${c.temperature_2m.toFixed(1)} °C`, c.sky], ['Água', `${c.sst.toFixed(1)} °C`, 'mar'], ['Vento', `${Math.round(c.wind_speed_10m)} km/h`, `de ${DIRS[Math.round(c.wind_direction_10m / 45) % 8]}`], ['Umidade', `${c.relative_humidity_2m}%`, 'relativa']].map(([l, v, sub]) => (
          <View key={l} style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: t.paper, borderColor: t.line, borderWidth: 1, borderRadius: 8, padding: 10 }}>
            <Label>{l}</Label>
            <Text style={[{ color: t.ink, fontSize: 20, fontWeight: '600' }, MONO]}>{v}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>{sub}</Text>
          </View>))}
      </View>

      {/* Modo */}
      <View style={{ gap: 8 }}>
        <Label>Como avaliar a pesca</Label>
        <Segmented value={mode} onChange={setMode} options={[{ key: 'site', label: 'Tábua de Marés' }, { key: 'spec', label: 'Por espécie' }]} />
        {mode === 'spec' && (
          <Pressable onPress={goSpecies} accessibilityRole="button" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.seaSoft, padding: 12, borderRadius: 8 }}>
            <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{SPECIES[sp].nome}</Text>
            <Text style={{ color: t.sea, fontWeight: '700' }}>Trocar peixe ›</Text>
          </Pressable>
        )}
      </View>

      {/* Semana */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {f.days.map((x, i) => {
          const v = (mode === 'site' ? x.site : x.species[sp]).verdict, on = i === sel;
          return (
            <Pressable key={x.date} onPress={() => setSel(i)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ width: 74, alignItems: 'center', gap: 4, paddingVertical: 10, backgroundColor: t.paper, borderRadius: 8, borderWidth: on ? 2 : 1, borderColor: on ? t.ink : t.line }}>
              <Text style={{ fontWeight: '800', color: t.ink }}>{x.date === today ? 'HOJE' : WD[weekday(x.date)].toUpperCase()}</Text>
              <Text style={{ color: t.muted, fontSize: 11 }}>{x.date.slice(8, 10)}/{x.date.slice(5, 7)}</Text>
              <Chip v={v} small />
            </Pressable>);
        })}
      </ScrollView>

      {/* Veredito */}
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Gauge score={ev.score} t={t} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: t.muted, fontSize: 12 }}>{WDL[weekday(d.date)]}, {d.date.slice(8, 10)}/{d.date.slice(5, 7)} · {d.sky.toLowerCase()} · {Math.round(d.tmin)}–{Math.round(d.tmax)} °C</Text>
            <Text style={{ color: vColor(t, ev.verdict), fontSize: 26, fontWeight: '800' }}>{vText(ev.verdict)}</Text>
            {mode === 'site' && <Text style={{ color: t.ink, fontSize: 13 }}>Atividade {d.site.activity.toLowerCase()} · Barômetro {d.site.baro.toLowerCase()}</Text>}
          </View>
        </View>
        {ev.reasons.map(r => <Text key={r} style={{ color: t.ink, fontSize: 14 }}>• {r}</Text>)}
        <Label>{mode === 'site' ? 'Períodos solunares' : `Melhores horários para ${SPECIES[sp].nome.toLowerCase()}`}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {windows.map(w => <Text key={w} style={{ borderWidth: 1, borderColor: t.act, color: t.act, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12 }}>{w}</Text>)}
        </View>
        {mode === 'spec' && <Text style={{ color: t.muted, fontSize: 13 }}>{SPECIES[sp].dica}</Text>}
      </Card>

      {/* Atividade + maré */}
      <Card>
        <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700' }}>Horário de atividade dos peixes</Text>
        <ActivityChart d={d} slots={ev.slots} sunWindows={sunWin} nowH={nowH} t={t} />
        <Text style={{ color: t.muted, fontSize: 11 }}>Curva azul: maré (m). Barras verdes: atividade, de baixa a muito alta{mode === 'site' ? '; verde forte = período com nascer/pôr do sol' : ''}.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {d.tides.map((x, i, a) => {
            const n = a[i + 1]?.h, pv = a[i - 1]?.h; const hi = n !== undefined ? x.h > n : pv !== undefined ? x.h > pv : true;
            return (<View key={i} style={{ borderLeftWidth: 3, borderLeftColor: hi ? t.sea : t.brass, paddingLeft: 8, minWidth: 78 }}>
              <Text style={{ color: t.muted, fontSize: 11 }}>{hi ? 'Preia-mar' : 'Baixa-mar'}</Text>
              <Text style={[{ color: t.ink, fontSize: 17 }, MONO]}>{x.t}</Text>
              <Text style={{ color: t.muted, fontSize: 11 }}>{x.h.toFixed(1)} m</Text>
            </View>);
          })}
          <View style={{ borderLeftWidth: 3, borderLeftColor: t.act, paddingLeft: 8 }}>
            <Text style={{ color: t.muted, fontSize: 11 }}>Coeficiente</Text>
            <Text style={[{ color: t.ink, fontSize: 17 }, MONO]}>{d.coef}</Text>
            <Text style={{ color: t.muted, fontSize: 11 }}>{d.moon}, {d.illum}%</Text>
          </View>
        </View>
        {d.tideSource === 'calculo' && <Text style={{ color: t.ok, fontSize: 12 }}>Marés deste dia calculadas pelo app (o site não tinha este dia). Pode haver diferença de até ~1 h.</Text>}
      </Card>

      <Card>
        <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700' }}>Pressão, temperatura e chuva</Text>
        <WeatherChart d={d} nowH={nowH} t={t} />
        <Text style={{ color: t.muted, fontSize: 11 }}>Linha escura: pressão (hPa). Dourada: ar. Azul tracejada: água. Barras: chance de chuva.</Text>
      </Card>

      <Text style={{ color: t.muted, fontSize: 11, lineHeight: 16 }}>
        Marés e atividade: tabuademares.com (com cálculo próprio de reserva). Tempo e água: Open-Meteo. Puxe para baixo para atualizar. Não serve para navegação.
      </Text>
    </ScrollView>
  );
}
