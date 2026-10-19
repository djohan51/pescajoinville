// Busca os dados, monta a previsão e guarda no aparelho.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tabua } from '../core/tabua';
import { getTabua } from './tabuaSource';
import { fetchWeather, fetchMarine, type Marine } from '../core/weather';
import { buildForecast, type Forecast } from '../core/forecast';

const K_FORECAST = 'pesca.forecast.v1';
const K_TABUA = 'pesca.tabua.v1';
const K_SETTINGS = 'pesca.avisos.v1';

export { DEFAULT_SETTINGS, type AlertSettings, type Criterio } from '../core/alerts';
import { DEFAULT_SETTINGS, type AlertSettings } from '../core/alerts';

export type RefreshResult = { forecast: Forecast; tabuaOk: boolean; errors: string[] };

export async function loadCachedForecast(): Promise<Forecast | null> {
  try { const s = await AsyncStorage.getItem(K_FORECAST); return s ? (JSON.parse(s) as Forecast) : null; } catch { return null; }
}

/** Busca tudo de novo. Se o site da tábua falhar, usa a última tábua salva e, sem ela, o cálculo próprio. */
export async function refreshForecast(): Promise<RefreshResult> {
  const errors: string[] = [];
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25_000);
  try {
    const [tab, w, m] = await Promise.allSettled([getTabua(ctl.signal), fetchWeather(ctl.signal), fetchMarine(ctl.signal)]);
    if (w.status !== 'fulfilled') throw new Error('Sem conexão com a previsão do tempo. Verifique a internet e tente de novo.');
    let tabua: Tabua | null = null, tabuaOk = false;
    if (tab.status === 'fulfilled') {
      tabua = tab.value; tabuaOk = true;
      // junta com a tábua salva, para não perder dias do mês anterior/seguinte já baixados
      try { const old = JSON.parse((await AsyncStorage.getItem(K_TABUA)) || '{}') as Tabua; tabua = { ...old, ...tabua }; } catch { /* ignora */ }
      await AsyncStorage.setItem(K_TABUA, JSON.stringify(tabua));
    } else {
      errors.push('tabua');
      try { const old = await AsyncStorage.getItem(K_TABUA); if (old) tabua = JSON.parse(old) as Tabua; } catch { /* ignora */ }
    }
    const marine: Marine | null = m.status === 'fulfilled' ? m.value : null;
    if (!marine) errors.push('mar');
    const forecast = buildForecast(tabua, w.value, marine);
    await AsyncStorage.setItem(K_FORECAST, JSON.stringify(forecast));
    return { forecast, tabuaOk, errors };
  } finally { clearTimeout(timer); }
}

export async function loadSettings(): Promise<AlertSettings> {
  try { const s = await AsyncStorage.getItem(K_SETTINGS); return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; }
}
export async function saveSettings(s: AlertSettings): Promise<void> {
  await AsyncStorage.setItem(K_SETTINGS, JSON.stringify(s));
}
