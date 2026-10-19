// No navegador (site e PWA) o tabuademares não pode ser lido direto (CORS),
// então a tábua vem do intermediário do próprio site: /api/tabua (ver api/tabua.ts).
import type { Tabua } from '../core/tabua';

export async function getTabua(signal?: AbortSignal): Promise<Tabua> {
  const base = process.env.EXPO_PUBLIC_API_BASE ?? '';
  const r = await fetch(`${base}/api/tabua`, { signal });
  if (!r.ok) throw new Error('tabua_proxy_' + r.status);
  const j = (await r.json()) as { tabua: Tabua };
  if (!j.tabua || Object.keys(j.tabua).length < 5) throw new Error('tabua_formato');
  return j.tabua;
}
