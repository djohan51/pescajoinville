/// <reference types="@cloudflare/workers-types" />
// Servidor do Pesca Joinville (Cloudflare Worker).
// - Serve o site/PWA (pasta dist gerada pelo `npx expo export --platform web`).
// - /api/tabua: lê o tabuademares (o navegador não pode, por CORS) com cache de 3 h.
// - /api/push/*: guarda as inscrições de aviso e envia o Web Push às 6h e 19h de Joinville.
import { parseTabua, TABUA_URL, type Tabua } from '../src/core/tabua';
import { fetchWeather, fetchMarine } from '../src/core/weather';
import { buildForecast } from '../src/core/forecast';
import { localDateKey } from '../src/core/time';
import { alertForRun, type AlertSettings, type PlannedAlert } from '../src/core/alerts';
import { sendPush, type PushSub } from './webpush';

export interface Env {
  ASSETS: Fetcher;
  PESCA: KVNamespace;
  VAPID_PUBLIC_KEY: string;   // base64url, igual ao EXPO_PUBLIC_VAPID_PUBLIC_KEY do app
  VAPID_PRIVATE_JWK: string;  // segredo: `npx wrangler secret put VAPID_PRIVATE_JWK`
  VAPID_SUBJECT: string;      // ex.: mailto:seu-email@exemplo.com
}

const TABUA_TTL_MS = 3 * 3600_000;
// CORS liberado: o site pode estar em outro endereço (ex.: GitHub Pages) e usar esta API.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
});

async function sha(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function getTabua(env: Env, force = false): Promise<{ tabua: Tabua; updated: number }> {
  const cached = await env.PESCA.get<{ tabua: Tabua; updated: number }>('tabua', 'json');
  if (cached && !force && Date.now() - cached.updated < TABUA_TTL_MS) return cached;
  try {
    const r = await fetch(TABUA_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PescaJoinville/1.0)', 'Accept-Language': 'pt-BR' } });
    if (!r.ok) throw new Error('http_' + r.status);
    const fresh = parseTabua(await r.text());
    if (Object.keys(fresh).length < 5) throw new Error('formato');
    const merged = { tabua: { ...(cached?.tabua ?? {}), ...fresh }, updated: Date.now() };
    // guarda só ~45 dias para não crescer sem limite
    const keys = Object.keys(merged.tabua).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 45))) delete merged.tabua[k];
    await env.PESCA.put('tabua', JSON.stringify(merged));
    return merged;
  } catch (e) {
    if (cached) return cached; // site fora do ar: devolve a última tábua boa
    throw e;
  }
}

function validSettings(s: unknown): s is AlertSettings {
  const x = s as AlertSettings;
  return !!x && typeof x.ativo === 'boolean' && Array.isArray(x.dias) && x.dias.every(d => Number.isInteger(d) && d >= 0 && d <= 6)
    && ['manha', 'vespera'].includes(x.quando) && ['muito_bom', 'bom', 'sempre'].includes(x.criterio) && ['site', 'spec'].includes(x.base) && typeof x.especie === 'string';
}

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === '/api/tabua' && req.method === 'GET') {
    try { return json(await getTabua(env)); } catch { return json({ error: 'Não foi possível ler a tábua agora.' }, 502); }
  }
  if (url.pathname === '/api/push/subscribe' && req.method === 'POST') {
    const body = await req.json().catch(() => null) as { subscription?: PushSub; settings?: unknown } | null;
    const sub = body?.subscription;
    if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !validSettings(body?.settings)) return json({ error: 'Dados inválidos.' }, 400);
    const id = await sha(sub.endpoint);
    await env.PESCA.put('sub:' + id, JSON.stringify({ subscription: { endpoint: sub.endpoint }, settings: body!.settings, created: Date.now() }));
    return json({ ok: true });
  }
  if (url.pathname === '/api/push/unsubscribe' && req.method === 'POST') {
    const body = await req.json().catch(() => null) as { endpoint?: string } | null;
    if (body?.endpoint) await env.PESCA.delete('sub:' + await sha(body.endpoint));
    return json({ ok: true });
  }
  if (url.pathname === '/api/push/last' && req.method === 'GET') {
    const ep = url.searchParams.get('endpoint') || '';
    const msg = ep ? await env.PESCA.get('last:' + await sha(ep), 'json') : null;
    return msg ? json(msg) : json({ error: 'sem aviso' }, 404);
  }
  if (url.pathname === '/api/push/test' && req.method === 'POST') {
    const body = await req.json().catch(() => null) as { endpoint?: string } | null;
    if (!body?.endpoint) return json({ error: 'Dados inválidos.' }, 400);
    const id = await sha(body.endpoint);
    if (!(await env.PESCA.get('sub:' + id))) return json({ error: 'Salve os avisos antes de testar.' }, 404);
    await env.PESCA.put('last:' + id, JSON.stringify({ title: 'Teste do Pesca Joinville', body: 'Os avisos estão funcionando neste aparelho.', date: 'teste' }), { expirationTtl: 3600 });
    const st = await sendPush(env, { endpoint: body.endpoint });
    return st < 300 ? json({ ok: true }) : json({ error: 'O serviço de push recusou (' + st + ').' }, 502);
  }
  return json({ error: 'não encontrado' }, 404);
}

async function runAlerts(env: Env, run: 'manha' | 'vespera'): Promise<{ sent: number; removed: number }> {
  const tab = await getTabua(env).catch(() => null);
  const [w, m] = await Promise.all([fetchWeather(), fetchMarine().catch(() => null)]);
  // Lê as inscrições primeiro para calcular só o necessário (o plano grátis limita o processamento).
  const recs: { key: string; subscription: PushSub; settings: AlertSettings }[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.PESCA.list({ prefix: 'sub:', cursor });
    for (const k of page.keys) {
      const rec = await env.PESCA.get<{ subscription: PushSub; settings: AlertSettings }>(k.name, 'json');
      if (rec && rec.settings.ativo && rec.settings.quando === run) recs.push({ key: k.name, ...rec });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  if (!recs.length) return { sent: 0, removed: 0 };
  const now = Date.now();
  const target = localDateKey(run === 'manha' ? now : now + 12 * 3600_000); // 19h → avisa sobre amanhã
  const species = [...new Set(recs.filter(r => r.settings.base === 'spec').map(r => r.settings.especie))];
  const forecast = buildForecast(tab?.tabua ?? null, w, m, now, { days: [target], species });
  let sent = 0, removed = 0;
  {
    for (const rec of recs) {
      const k = { name: rec.key };
      const alert: PlannedAlert | null = alertForRun(forecast, rec.settings, run);
      if (!alert) continue;
      const id = k.name.slice(4);
      await env.PESCA.put('last:' + id, JSON.stringify({ title: alert.title, body: alert.body, date: alert.date }), { expirationTtl: 2 * 86400 });
      const st = await sendPush(env, rec.subscription);
      if (st === 404 || st === 410) { await env.PESCA.delete(k.name); removed++; } else if (st < 300) sent++;
    }
  }
  return { sent, removed };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/') && req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname.startsWith('/api/')) return handleApi(req, env, url);
    return env.ASSETS.fetch(req);
  },
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // 09:00 UTC = 6h em Joinville (aviso do dia); 22:00 UTC = 19h (aviso da véspera)
    const run = event.cron.startsWith('0 9') ? 'manha' : 'vespera';
    ctx.waitUntil(runAlerts(env, run).then(r => console.log(`avisos ${run}: ${r.sent} enviados, ${r.removed} removidos`)));
  },
};
