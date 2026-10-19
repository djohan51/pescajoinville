// Regras dos avisos (sem dependência de plataforma: usado no celular e no servidor do PWA).
import type { Forecast, Verdict } from './forecast';
import { SPECIES } from './especies';
import { localMidnight, weekday, WDL, fmtH, HOUR_MS } from './time';

export type Criterio = 'muito_bom' | 'bom' | 'sempre';
export type AlertSettings = {
  ativo: boolean;
  dias: number[]; // 0 = domingo
  quando: 'manha' | 'vespera';
  criterio: Criterio;
  base: 'site' | 'spec';
  especie: string;
};
export const DEFAULT_SETTINGS: AlertSettings = { ativo: false, dias: [0, 6], quando: 'manha', criterio: 'bom', base: 'site', especie: 'robalo-flecha' };

export const passa = (v: Verdict, c: Criterio) => c === 'sempre' || (c === 'muito_bom' ? v === 'MUITO BOM' : v !== 'MAU');
const vText = (v: Verdict) => (v === 'MAU' ? 'Ruim para pescar' : v === 'BOM' ? 'Bom para pescar' : 'Muito bom para pescar');

export type PlannedAlert = { date: string; fireAt: number; verdict: Verdict; title: string; body: string };

/** Avisos que a configuração gera com a previsão (horário: 6h do dia ou 19h da véspera). */
export function planAlerts(f: Forecast, s: AlertSettings, now = Date.now()): PlannedAlert[] {
  if (!s.ativo) return [];
  const out: PlannedAlert[] = [];
  for (const d of f.days) {
    if (!s.dias.includes(weekday(d.date))) continue;
    const ev = s.base === 'site' ? d.site : d.species[s.especie];
    if (!ev || !passa(ev.verdict, s.criterio)) continue;
    const t0 = localMidnight(d.date);
    const fireAt = s.quando === 'manha' ? t0 + 6 * HOUR_MS : t0 - 5 * HOUR_MS;
    if (fireAt <= now) continue;
    const quem = s.base === 'site' ? 'Tábua de Marés' : SPECIES[s.especie]?.nome ?? '';
    const dia = s.quando === 'manha' ? 'hoje' : 'amanhã';
    const janelas = s.base === 'site'
      ? d.site.windows.filter(x => x.major).map(x => `${fmtH(x.start)}–${fmtH(x.end)}`)
      : d.species[s.especie].best.map(x => `${fmtH(x.start)}–${fmtH(x.end)}`);
    out.push({
      date: d.date, fireAt, verdict: ev.verdict,
      title: `${vText(ev.verdict)} ${dia} (${WDL[weekday(d.date)].toLowerCase()})`,
      body: `${quem} · índice ${ev.score}. ${d.sky}, ${Math.round(d.tmin)}–${Math.round(d.tmax)} °C, coeficiente ${d.coef}.${janelas.length ? ` Melhores horários: ${janelas.join(', ')}.` : ''}`,
    });
  }
  return out;
}

/** Aviso a enviar AGORA pelo servidor (rodada das 6h → dia de hoje; rodada das 19h → amanhã). */
export function alertForRun(f: Forecast, s: AlertSettings, run: 'manha' | 'vespera', now = Date.now()): PlannedAlert | null {
  if (!s.ativo || s.quando !== run) return null;
  const all = planAlerts(f, s, now - 3 * HOUR_MS); // tolera atraso do agendador
  return all.find(a => Math.abs(a.fireAt - now) < 3 * HOUR_MS) ?? null;
}
