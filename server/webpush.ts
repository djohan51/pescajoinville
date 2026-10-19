// Web Push sem conteúdo criptografado: o servidor só "cutuca" o navegador (VAPID),
// e o service worker busca o texto do aviso em /api/push/last.
export type PushSub = { endpoint: string };
type VapidEnv = { VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_JWK: string; VAPID_SUBJECT: string };

const b64url = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ''; for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

let keyCache: CryptoKey | null = null;
async function privateKey(env: VapidEnv): Promise<CryptoKey> {
  if (!keyCache) keyCache = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return keyCache;
}

export async function vapidJwt(env: VapidEnv, endpoint: string, nowS = Math.floor(Date.now() / 1000)): Promise<string> {
  const aud = new URL(endpoint).origin;
  const head = enc({ typ: 'JWT', alg: 'ES256' });
  const body = enc({ aud, exp: nowS + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:contato@example.com' });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await privateKey(env), new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

/** Envia o push e devolve o status HTTP do serviço (201 = ok; 404/410 = inscrição expirada). */
export async function sendPush(env: VapidEnv, sub: PushSub): Promise<number> {
  const jwt = await vapidJwt(env, sub.endpoint);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`, TTL: '43200', Urgency: 'high', 'Content-Length': '0' },
  });
  return r.status;
}
