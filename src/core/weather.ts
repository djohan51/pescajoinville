// Tempo, pressão e temperatura da água pelo Open-Meteo (gratuito, sem chave).
export type Weather = {
  t0: string; // primeira hora das séries, horário local, ex. "2026-10-18T00:00"
  current: { time: string; temperature_2m: number; pressure_msl: number; wind_speed_10m: number; wind_direction_10m: number; relative_humidity_2m: number; weather_code: number };
  p: number[]; temp: number[]; w: number[]; pp: number[]; wc: number[];
};
export type Marine = { t0: string; sst: (number | null)[]; wave: (number | null)[] };

const LAT = -26.3, LON = -48.85;

export async function fetchWeather(signal?: AbortSignal): Promise<Weather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    '&hourly=temperature_2m,pressure_msl,wind_speed_10m,precipitation_probability,weather_code' +
    '&current=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,relative_humidity_2m,weather_code' +
    '&timezone=America%2FSao_Paulo&forecast_days=8&past_days=1';
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('tempo_http_' + r.status);
  const d = (await r.json()) as any; // formato do Open-Meteo
  const h = d.hourly;
  return { t0: h.time[0], current: d.current, p: h.pressure_msl, temp: h.temperature_2m, w: h.wind_speed_10m,
           pp: h.precipitation_probability.map((v: number | null) => v ?? 0), wc: h.weather_code };
}

export async function fetchMarine(signal?: AbortSignal): Promise<Marine> {
  const url = 'https://marine-api.open-meteo.com/v1/marine?latitude=-26.2&longitude=-48.5' +
    '&hourly=sea_surface_temperature,wave_height&timezone=America%2FSao_Paulo&forecast_days=8&past_days=1';
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('mar_http_' + r.status);
  const d = (await r.json()) as any; // formato do Open-Meteo
  return { t0: d.hourly.time[0], sst: d.hourly.sea_surface_temperature, wave: d.hourly.wave_height };
}

export const WMO: Record<number, string> = {
  0: 'Céu limpo', 1: 'Poucas nuvens', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Neblina', 48: 'Neblina',
  51: 'Garoa fraca', 53: 'Garoa', 55: 'Garoa forte', 61: 'Chuva fraca', 63: 'Chuva', 65: 'Chuva forte',
  80: 'Pancadas fracas', 81: 'Pancadas de chuva', 82: 'Pancadas fortes', 95: 'Trovoada', 96: 'Trovoada com granizo', 99: 'Trovoada com granizo',
};
