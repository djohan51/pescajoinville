// Gera o par de chaves VAPID dos avisos do PWA. Rodar: node server/scripts/vapid.mjs
// - A chave PÚBLICA vai no .env do app (EXPO_PUBLIC_VAPID_PUBLIC_KEY) e no wrangler.toml (VAPID_PUBLIC_KEY).
// - A chave PRIVADA é segredo: `cd server && npx wrangler secret put VAPID_PRIVATE_JWK` e cole o JSON.
const { subtle } = globalThis.crypto;
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
const pub = Buffer.from(raw).toString('base64url');
const jwk = await subtle.exportKey('jwk', kp.privateKey);
console.log('Chave pública (VAPID_PUBLIC_KEY / EXPO_PUBLIC_VAPID_PUBLIC_KEY):\n' + pub + '\n');
console.log('Chave privada (VAPID_PRIVATE_JWK — guarde em segredo):\n' + JSON.stringify(jwk));
