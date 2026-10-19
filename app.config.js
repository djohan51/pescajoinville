// Permite publicar o site numa subpasta (GitHub Pages: /pescajoinville).
// EXPO_BASE_URL=/pescajoinville npx expo export --platform web
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments || {}), baseUrl: process.env.EXPO_BASE_URL || '' },
});
