// Teste do servidor sem rede: KV em memória, fetch simulado. Rodar: npx tsx test/worker.test.ts
import assert from 'node:assert/strict';
import tabua from './tabua.fixture.json';
import weather from './weather.fixture.json';
import marine from './marine.fixture.json';
import worker from '../server/worker';

// Sábado, 24/10/2026, 6h em Joinville (09:00 UTC)
const NOW = Date.parse('2026-10-24T09:00:00Z');
Date.now = () => NOW;

const kv = new Map<string, string>();
const KV = {
  get: async (k: string, t?: string) => { const v = kv.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; },
  put: async (k: string, v: string) => { kv.set(k, v); },
  delete: async (k: string) => { kv.delete(k); },
  list: async ({ prefix }: { prefix: string }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true, cursor: '' }),
};
kv.set('tabua', JSON.stringify({ tabua, updated: NOW }));

(async () => {
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = Buffer.from(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))).toString('base64url');
const env = { PESCA: KV, ASSETS: { fetch: async () => new Response('site') }, VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey)), VAPID_SUBJECT: 'mailto:teste@example.com' } as any;

const W = weather as any, M = marine as any;
const pushes: { url: string; headers: Headers }[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith('https://api.open-meteo.com')) return Response.json({ current: W.current, hourly: { time: Array.from({ length: W.p.length }, (_, i) => new Date(Date.parse(W.t0 + ':00Z') + i * 3600_000).toISOString().slice(0, 16)), pressure_msl: W.p, temperature_2m: W.temp, wind_speed_10m: W.w, precipitation_probability: W.pp, weather_code: W.wc } });
  if (url.includes('marine-api')) return Response.json({ hourly: { time: Array.from({ length: M.sst.length }, (_, i) => new Date(Date.parse(M.t0 + ':00Z') + i * 3600_000).toISOString().slice(0, 16)), sea_surface_temperature: M.sst, wave_height: [] } });
  if (url.startsWith('https://push.example')) { pushes.push({ url, headers: new Headers(init?.headers) }); return new Response(null, { status: 201 }); }
  throw new Error('fetch inesperado: ' + url);
}) as typeof fetch;

const call = (path: string, body?: unknown) => worker.fetch(new Request('https://pesca.test' + path, body ? { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}), env);

// 1) tábua pelo servidor
const t = await (await call('/api/tabua')).json() as any;
assert.equal(t.tabua['2026-10-24'].coef, 93);
// 2) inscrições: uma para sábado de manhã (deve receber) e uma para domingo (não deve)
const ep1 = 'https://push.example/sub/sabado', ep2 = 'https://push.example/sub/domingo';
assert.equal((await call('/api/push/subscribe', { subscription: { endpoint: ep1 }, settings: { ativo: true, dias: [6], quando: 'manha', criterio: 'sempre', base: 'site', especie: 'robalo-flecha' } })).status, 200);
assert.equal((await call('/api/push/subscribe', { subscription: { endpoint: ep2 }, settings: { ativo: true, dias: [0], quando: 'manha', criterio: 'sempre', base: 'site', especie: 'robalo-flecha' } })).status, 200);
assert.equal((await call('/api/push/subscribe', { subscription: { endpoint: 'http://ruim' }, settings: {} })).status, 400);
// 3) rodada das 6h
let pending: Promise<unknown> | undefined;
await worker.scheduled({ cron: '0 9 * * *' } as any, env, { waitUntil: (p: Promise<unknown>) => { pending = p; } } as any);
await pending;
assert.equal(pushes.length, 1, 'só a inscrição de sábado recebe');
assert.equal(pushes[0].url, ep1);
// 4) assinatura VAPID válida
const auth = pushes[0].headers.get('Authorization')!;
const jwt = auth.match(/t=([^,]+)/)![1], [h, b, s] = jwt.split('.');
const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, Buffer.from(s, 'base64url'), new TextEncoder().encode(`${h}.${b}`));
assert.ok(ok, 'assinatura VAPID confere');
assert.equal(JSON.parse(Buffer.from(b, 'base64url').toString()).aud, 'https://push.example');
// 5) o service worker busca o texto do aviso
const last = await (await call('/api/push/last?endpoint=' + encodeURIComponent(ep1))).json() as any;
console.log('Aviso enviado:', last.title, '—', last.body);
assert.match(last.title, /sábado/);
console.log('OK servidor');
})().catch(e => { console.error(e); process.exit(1); });
