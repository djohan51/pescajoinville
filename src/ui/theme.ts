import { useColorScheme, Platform } from 'react-native';

const light = {
  bg: '#eef2f4', paper: '#f8fafb', ink: '#10283a', muted: '#5a6f7e', line: '#cfd9e0',
  sea: '#1f6f9a', seaSoft: '#cfe3ef', brass: '#b07a1f', act: '#2c8a6e',
  good: '#1e8a55', goodBg: '#dff1e7', ok: '#a86c00', okBg: '#f7ebd2', bad: '#b33a2e', badBg: '#f6e0dc',
};
const dark: typeof light = {
  bg: '#0b1922', paper: '#11232f', ink: '#e3edf3', muted: '#8fa6b5', line: '#24404f',
  sea: '#5fb3e0', seaSoft: '#173a4f', brass: '#e0aa4a', act: '#4cc49e',
  good: '#56d08e', goodBg: '#123726', ok: '#f0b44a', okBg: '#3a2c10', bad: '#f07a6c', badBg: '#3d1b17',
};
export type Theme = typeof light;
export function useTheme(): Theme { return useColorScheme() === 'dark' ? dark : light; }

export const vColor = (t: Theme, v: string) => (v === 'MAU' ? t.bad : v === 'BOM' ? t.ok : t.good);
export const vBg = (t: Theme, v: string) => (v === 'MAU' ? t.badBg : v === 'BOM' ? t.okBg : t.goodBg);
export const vText = (v: string) => (v === 'MAU' ? 'Ruim para pescar' : v === 'BOM' ? 'Bom para pescar' : 'Muito bom para pescar');
export const MONO = { fontVariant: ['tabular-nums' as const] };
/** Fonte dos textos dos gráficos (no navegador o SVG usaria serifa por padrão). */
export const SVG_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;
