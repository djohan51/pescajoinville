import { Body, Observer, SearchRiseSet, SearchHourAngle, MoonPhase, Illumination } from 'astronomy-engine';
import { localMidnight, localHour, HOUR_MS } from './time';

const OBS = new Observer(-26.29, -48.72, 0);

export type MoonEvent = { kind: 'transito' | 'transito_oposto' | 'nascer' | 'por'; h: number };

/** Eventos da lua no dia local: passagem pelo meridiano (alto/embaixo), nascer e pôr. */
export function moonEvents(dayKey: string): MoonEvent[] {
  const t0 = localMidnight(dayKey), t1 = t0 + 24 * HOUR_MS;
  const start = new Date(t0);
  const out: MoonEvent[] = [];
  const push = (kind: MoonEvent['kind'], d: Date | undefined | null) => {
    if (d && d.getTime() >= t0 && d.getTime() < t1) out.push({ kind, h: localHour(d.getTime()) });
  };
  try { push('transito', SearchHourAngle(Body.Moon, OBS, 0, start).time.date); } catch { /* sem evento */ }
  try { push('transito_oposto', SearchHourAngle(Body.Moon, OBS, 12, start).time.date); } catch { /* sem evento */ }
  try { push('nascer', SearchRiseSet(Body.Moon, OBS, +1, start, 1)?.date); } catch { /* sem evento */ }
  try { push('por', SearchRiseSet(Body.Moon, OBS, -1, start, 1)?.date); } catch { /* sem evento */ }
  return out.sort((a, b) => a.h - b.h);
}

/** Nome da fase, iluminação (%) e idade (dias desde a lua nova). */
export function moonInfo(dayKey: string): { name: string; illum: number; age: number } {
  const d = new Date(localMidnight(dayKey) + 15 * HOUR_MS);
  const ang = MoonPhase(d); // 0 = nova, 180 = cheia
  const illum = Math.round(Illumination(Body.Moon, d).phase_fraction * 100);
  const age = (ang / 360) * 29.530588;
  const waxing = ang < 180;
  let name: string;
  if (illum < 3) name = 'Lua nova';
  else if (illum > 97) name = 'Lua cheia';
  else if (illum >= 45 && illum <= 55) name = waxing ? 'Quarto crescente' : 'Quarto minguante';
  else if (illum < 45) name = waxing ? 'Crescente' : 'Minguante';
  else name = waxing ? 'Crescente gibosa' : 'Minguante gibosa';
  return { name, illum, age };
}

/** Atividade diária estimada (0–3) quando o site não está disponível: maior perto de lua nova/cheia. */
export function estimatedFish(age: number): number {
  const d = Math.min(age, Math.abs(age - 14.77), 29.53 - age);
  return d <= 2.5 ? 3 : d <= 4 ? 2 : 1;
}
