// Leitura da tábua de marés de Joinville no tabuademares.com
// Extrai, para cada dia do mês mostrado: nascer/pôr do sol, coeficiente,
// atividade dos peixes (0–3 peixinhos) e os horários/alturas das marés.

export type TideExtreme = { t: string; h: number }; // "6:09", 0.4 (m)
export type TabuaDay = {
  sunrise: string;
  sunset: string;
  coef: number;
  fish: number | null; // peixinhos cheios na tabela do site (0-3)
  tides: TideExtreme[];
};
export type Tabua = Record<string, TabuaDay>; // chave: "2026-10-19"

export const TABUA_URL = 'https://tabuademares.com/br/santa-catarina/joinville';

export function parseTabua(html: string): Tabua {
  const out: Tabua = {};
  const rows = html.split(/<tr\b/i).slice(1);
  let key: string | null = null;
  for (const raw of rows) {
    const row = raw.split(/<\/tr>/i)[0];
    const m = row.match(/Day\('(\d{4})-(\d{1,2})-(\d{1,2})'\)/);
    if (m && /tabla_mareas_fila/.test(row)) {
      const k = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; // o site escreve "2026-10-2"
      if (out[k]) { key = null; continue; } // tabela repetida (versão de impressão)
      key = k;
      const sr = row.match(/tabla_mareas_salida_puesta_sol_salida"[^>]*>[\s\S]*?(\d{1,2}:\d{2})/);
      const ss = row.match(/tabla_mareas_salida_puesta_sol_puesta"[^>]*>[\s\S]*?(\d{1,2}:\d{2})/);
      const cf = row.match(/tabla_mareas_coeficiente_numero"[^>]*>\s*(\d+)/);
      const actM = row.match(/tabla_mareas_actividad"[^>]*>([\s\S]*?)<\/td>/);
      const fish = actM ? (actM[1].match(/icon-ic_pez_leyenda(?!2)\b/g) || []).length : null;
      out[key] = { sunrise: sr ? sr[1] : '', sunset: ss ? ss[1] : '', coef: cf ? parseInt(cf[1], 10) : 0, fish, tides: [] };
    }
    if (!key) continue;
    const re = /tabla_mareas_marea_hora[^"]*"[^>]*>\s*(\d{1,2}:\d{2})\s*<\/div>[\s\S]*?tabla_mareas_marea_altura_numero"[^>]*>\s*(-?[\d.,]+)\s*</g;
    let t: RegExpExecArray | null;
    while ((t = re.exec(row))) out[key].tides.push({ t: t[1], h: parseFloat(t[2].replace(',', '.')) });
  }
  // descarta dias sem dados úteis
  for (const k of Object.keys(out)) if (!out[k].tides.length || !out[k].sunrise) delete out[k];
  return out;
}

export async function fetchTabua(signal?: AbortSignal): Promise<Tabua> {
  const res = await fetch(TABUA_URL, {
    signal,
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', 'Accept-Language': 'pt-BR' },
  });
  if (!res.ok) throw new Error('tabua_http_' + res.status);
  const tab = parseTabua(await res.text());
  if (Object.keys(tab).length < 5) throw new Error('tabua_formato');
  return tab;
}
