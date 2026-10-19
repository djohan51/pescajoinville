# Pesca Joinville

App de previsão de pesca para a Baía da Babitonga e o mar de São Francisco do Sul.
Um só código gera **app para iPhone e Android**, **PWA** (instalável pelo navegador) e **site normal**.

- Barômetro "agora" com tendência de 3 h e gráfico de −12 h a +12 h
- Previsão de 7 dias em dois modos: **Tábua de Marés** (atividade e períodos solunares do tabuademares + barômetro) e **Por espécie** (35 peixes, com busca e filtro Baía/Mar)
- Gráfico de maré e atividade dos peixes em blocos de 30 min; gráfico de pressão, ar, água e chuva
- **Avisos** nos dias da semana escolhidos (bom, muito bom ou sempre), às 6h do dia ou 19h da véspera

## Como os dados chegam

| Dado | App nativo | Site / PWA |
|---|---|---|
| Marés, coeficiente, atividade (peixinhos) | lê o tabuademares direto | pelo servidor (`/api/tabua`), com cache de 3 h |
| Se o tabuademares falhar | última tábua salva; senão cálculo harmônico próprio (estimativa, ±20 min a 1 h) | idem |
| Tempo, pressão, vento, chuva, água | Open-Meteo direto | Open-Meteo direto |
| Avisos | notificação local agendada no celular | Web Push enviado pelo servidor às 6h/19h |

> O tabuademares é "todos os direitos reservados". Para uso pessoal e testes, tudo bem. **Antes de publicar na App Store/Play Store, peça autorização a eles** (tabuademares.com/contatar). Sem ela, troque a fonte em `src/core/tabua.ts` — o app já funciona só com o cálculo próprio.

## Estrutura

```
App.tsx                 abas Previsão / Espécies / Avisos
src/core/               lógica pura (também usada pelo servidor)
  tabua.ts              leitor da tábua do tabuademares
  tides.ts, tideConstants.ts   marés (interpolação e cálculo de reserva)
  moon.ts               lua, períodos solunares (astronomy-engine)
  weather.ts            Open-Meteo (tempo e mar)
  forecast.ts           monta os 7 dias e as notas dos dois modos
  especies.json/.ts     35 espécies e perfis de comportamento
  alerts.ts             regras dos avisos
src/data/               armazenamento e avisos (notify.ts = celular, notify.web.ts = PWA)
src/ui/                 telas e gráficos
public/                 manifest, service worker e ícones do PWA
server/                 Cloudflare Worker: site + /api/tabua + push
test/                   testes com dados reais de 19/10/2026 (npm test)
```

## 1. Testar no seu iPhone agora (grátis, sem conta Apple)

1. No Mac: `npm install` e depois `npx expo start`.
2. No iPhone, instale **Expo Go** (App Store) e leia o QR code com a câmera.
3. O app abre no celular. Previsão, espécies e avisos funcionam; a atualização em segundo plano só funciona no app instalado de verdade (passo 3).

## 2. Publicar o site e o PWA (grátis, Cloudflare)

1. Crie uma conta em cloudflare.com e rode `npx wrangler login`.
2. `cd server && npx wrangler kv namespace create PESCA` → cole o `id` em `server/wrangler.toml`.
3. `node server/scripts/vapid.mjs` → gera as chaves dos avisos.
   - Chave pública: cole em `server/wrangler.toml` (`VAPID_PUBLIC_KEY`) e no `.env` do app (`EXPO_PUBLIC_VAPID_PUBLIC_KEY`, copie de `.env.example`).
   - Chave privada: `cd server && npx wrangler secret put VAPID_PRIVATE_JWK` e cole o JSON.
4. `npm run server:deploy` → gera o site e publica em `https://pesca-joinville.SEU-USUARIO.workers.dev`.
5. Instalar como app:
   - **iPhone (Safari):** Compartilhar › Adicionar à Tela de Início. Abra pelo ícone para ativar avisos (iOS 16.4+).
   - **Android (Chrome):** menu › Instalar app.
6. Opcional: aponte um domínio seu (ex. `pesca.seudominio.com.br`) em Workers › Settings › Domains.

## 3. Publicar nas lojas

- **iPhone:** conta Apple Developer (US$ 99/ano). Depois: `npx eas-cli@latest build -p ios --profile production` e `npx eas-cli@latest submit -p ios`. O build roda na nuvem do Expo; o Mac não é obrigatório.
- **Android:** conta Google Play (US$ 25, uma vez). `npx eas-cli@latest build -p android --profile production` e `submit`.
- Para testar o app instalado sem loja: `npx eas-cli@latest build -p android --profile preview` gera um APK; no iPhone, `npx expo run:ios` instala direto pelo Mac com Xcode.

## Comandos

```
npm test              testes da previsão e do servidor
npm run typecheck     checagem de tipos
npm run web:build     gera o site em dist/
npm run server:dev    servidor local (site + API)
npm run server:deploy publica site e servidor
```
