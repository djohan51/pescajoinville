import { TIDE_Z0, TIDE_CONS } from './tideConstants';
import type { Tabua, TideExtreme } from './tabua';
import { localMidnight, localHour, localDateKey, hm, fmtH, HOUR_MS } from './time';

const EPOCH = Date.UTC(2026, 0, 1);
const RAD = Math.PI / 180;

/** Altura prevista pelas constantes harmônicas (reserva), em metros. */
export function harmonicHeight(ms: number): number {
  const t = (ms - EPOCH) / HOUR_MS;
  let h = TIDE_Z0;
  for (const [, w, a, b] of TIDE_CONS) { const x = w * RAD * t; h += a * Math.cos(x) + b * Math.sin(x); }
  return h;
}

/** Extremos (preia-mar/baixa-mar) calculados num intervalo, passo de 2 min. */
export function harmonicExtremes(fromMs: number, toMs: number): { ms: number; h: number }[] {
  const step = 2 * 60_000, out: { ms: number; h: number }[] = [];
  let prev = harmonicHeight(fromMs - step), cur = harmonicHeight(fromMs);
  for (let ms = fromMs; ms <= toMs; ms += step) {
    const next = harmonicHeight(ms + step);
    if ((cur - prev) * (next - cur) < 0) out.push({ ms, h: cur });
    prev = cur; cur = next;
  }
  return out;
}

export type TideSource = 'site' | 'calculo';

/** Lista contínua de extremos (ms, m), do site quando há, senão calculada. */
export function buildExtremes(tabua: Tabua | null, fromKey: string, days: number): { ext: { ms: number; h: number }[]; bySource: Record<string, TideSource>; perDay: Record<string, TideExtreme[]> } {
  const ext: { ms: number; h: number }[] = [];
  const bySource: Record<string, TideSource> = {}, perDay: Record<string, TideExtreme[]> = {};
  for (let i = -1; i <= days; i++) {
    const key = localDateKey(localMidnight(fromKey) + (i * 24 + 12) * HOUR_MS);
    const t0 = localMidnight(key);
    const site = tabua?.[key];
    if (site && site.tides.length) {
      bySource[key] = 'site';
      perDay[key] = site.tides;
      for (const x of site.tides) ext.push({ ms: t0 + hm(x.t) * HOUR_MS, h: x.h });
    } else {
      bySource[key] = 'calculo';
      const list = harmonicExtremes(t0, t0 + 24 * HOUR_MS - 60_000);
      perDay[key] = list.map(e => ({ t: fmtH(localHour(e.ms)), h: Math.round(e.h * 10) / 10 }));
      ext.push(...list);
    }
  }
  ext.sort((a, b) => a.ms - b.ms);
  return { ext, bySource, perDay };
}

/** Altura por interpolação cosseno entre extremos. */
export function tideAt(ext: { ms: number; h: number }[], ms: number): number {
  if (!ext.length) return harmonicHeight(ms);
  if (ms <= ext[0].ms) return ext[0].h;
  if (ms >= ext[ext.length - 1].ms) return ext[ext.length - 1].h;
  let lo = 0, hi = ext.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ext[mid].ms <= ms) lo = mid; else hi = mid; }
  const a = ext[lo], b = ext[hi];
  const f = (1 - Math.cos(Math.PI * (ms - a.ms) / Math.max(1, b.ms - a.ms))) / 2;
  return a.h + (b.h - a.h) * f;
}

/** Coeficiente aproximado (0–120) a partir da amplitude do dia, quando o site não está disponível. */
export function estimatedCoef(perDay: TideExtreme[]): number {
  if (perDay.length < 2) return 50;
  const hs = perDay.map(x => x.h);
  const range = Math.max(...hs) - Math.min(...hs);
  return Math.max(20, Math.min(120, Math.round(range * 80)));
}
