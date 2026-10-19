// Teste da lógica de previsão com dados reais de 19/10/2026. Rodar: npx tsx test/forecast.test.ts
import assert from 'node:assert/strict';
import tabua from './tabua.fixture.json';
import weather from './weather.fixture.json';
import marine from './marine.fixture.json';
import { buildForecast, pressureAt } from '../src/core/forecast';
import { harmonicExtremes } from '../src/core/tides';
import { moonEvents } from '../src/core/moon';
import { localMidnight, fmtH, localHour } from '../src/core/time';

const NOW = Date.parse('2026-10-19T15:00:00Z'); // 12:00 em Joinville
const f = buildForecast(tabua as any, weather as any, marine as any, NOW);

console.log('dias:', f.days.length, 'fonte marés:', f.tideSource);
for (const d of f.days) {
  const top = Object.entries(d.species).sort((a, b) => b[1].score - a[1].score).slice(0, 3).map(([k, v]) => `${k}:${v.score}`).join(' ');
  console.log(d.date, d.tideSource, 'coef', d.coef, '| site:', d.site.verdict, d.site.activity, '|', top);
}
// O painel web (Python) deu: 19 BOM, 20 MAU, 21 MAU, 22 MAU, 23 MAU, 24 BOM, 25 BOM
assert.deepEqual(f.days.map(d => d.site.verdict), ['BOM', 'MAU', 'MAU', 'MAU', 'MAU', 'BOM', 'BOM']);
// períodos solunares de hoje batem com o site (5:53–7:53, 18:11–20:11, 0:57–1:57, 11:50–12:50)
const ev = moonEvents('2026-10-19').map(e => `${e.kind}@${fmtH(e.h)}`);
console.log('lua 19/10:', ev.join(', '));
const tr = moonEvents('2026-10-19').find(e => e.kind === 'transito')!;
assert.ok(Math.abs(tr.h - (19 + 11 / 60)) < 0.1, 'trânsito lunar perto de 19:11');
// barômetro
console.log('pressão 12:00 =', pressureAt(f, NOW).toFixed(1));
assert.ok(Math.abs(pressureAt(f, NOW) - 1018.2) < 0.2);
// reserva: marés calculadas de 1/11 (fora da tábua de outubro)
const nov = harmonicExtremes(localMidnight('2026-11-01'), localMidnight('2026-11-02'));
console.log('reserva 01/11:', nov.map(e => `${fmtH(localHour(e.ms))}=${e.h.toFixed(2)}`).join(' '));
// sem site: tudo calculado
const g = buildForecast(null, weather as any, marine as any, NOW);
console.log('sem site:', g.tideSource, g.days.map(d => `${d.date.slice(8)}:${d.site.verdict}/${d.coef}`).join(' '));
assert.equal(g.tideSource, 'calculo');
console.log('OK');
