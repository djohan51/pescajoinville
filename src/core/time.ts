// Joinville usa UTC-3 o ano todo (o Brasil não tem horário de verão desde 2019).
export const TZ_OFFSET_H = -3;
const H = 3600_000;

/** "2026-10-19" do dia local de um instante. */
export function localDateKey(ms: number): string {
  const d = new Date(ms + TZ_OFFSET_H * H);
  return d.toISOString().slice(0, 10);
}
/** Instante (ms UTC) da meia-noite local do dia "2026-10-19". */
export function localMidnight(key: string): number {
  return Date.parse(key + 'T00:00:00Z') - TZ_OFFSET_H * H;
}
/** Hora local decimal (0–24) de um instante. */
export function localHour(ms: number): number {
  const d = new Date(ms + TZ_OFFSET_H * H);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}
/** "6:09" -> 6.15 */
export function hm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h + m / 60;
}
/** 6.15 -> "6:09" */
export function fmtH(x: number): string {
  let h = Math.floor(x), m = Math.round((x - h) * 60);
  if (m === 60) { h++; m = 0; }
  return `${h}:${String(m).padStart(2, '0')}`;
}
/** Dia da semana (0 = domingo) de "2026-10-19". */
export function weekday(key: string): number {
  return new Date(key + 'T12:00:00Z').getUTCDay();
}
export function addDays(key: string, n: number): string {
  return new Date(Date.parse(key + 'T12:00:00Z') + n * 24 * H).toISOString().slice(0, 10);
}
export const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WDL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const HOUR_MS = H;
