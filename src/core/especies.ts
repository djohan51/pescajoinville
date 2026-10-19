import data from './especies.json';

export type Species = {
  key: string; nome: string; cientifico: string; ambiente: 'baia' | 'mar' | 'ambos';
  status: 'ok' | 'ameacada' | 'proibida'; dica: string; temp: [number, number]; soft: number; meses: number[];
  tempo: Record<'madrugada' | 'amanhecer' | 'manha' | 'meio_dia' | 'tarde' | 'entardecer' | 'noite', number>;
  mare: Record<'enchente' | 'vazante' | 'parada', number>;
  pressao: Record<'subindo' | 'estavel' | 'caindo', number>;
  vento_max: number; chuva_ok: boolean; temporada: string;
};

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function seasonText(m: number[]): string {
  if (m.length >= 12) return 'o ano todo';
  const ms = [...m].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const x of ms) { const last = runs[runs.length - 1]; if (last && x === last[last.length - 1] + 1) last.push(x); else runs.push([x]); }
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1].slice(-1)[0] === 12) { runs[0] = [...runs.pop()!, ...runs[0]]; }
  return runs.map(r => (r.length === 1 ? MES[r[0] - 1] : `${MES[r[0] - 1]}–${MES[r[r.length - 1] - 1]}`)).join(', ');
}

type Perfil = Pick<Species, 'tempo' | 'mare' | 'pressao' | 'vento_max' | 'chuva_ok'>;
type Entrada = Omit<Species, 'key' | 'temporada' | keyof Perfil> & { perfil: string };
const perfis = (data as unknown as { perfis: Record<string, Perfil> }).perfis;
const especies = (data as unknown as { especies: Record<string, Entrada> }).especies;

export const SPECIES: Record<string, Species> = Object.fromEntries(
  Object.entries(especies).map(([key, e]) => [key, { ...perfis[e.perfil], ...e, key, temporada: seasonText(e.meses) } as Species]),
);
export const SPECIES_KEYS = Object.keys(SPECIES).sort((a, b) => SPECIES[a].nome.localeCompare(SPECIES[b].nome, 'pt'));
export const ENV_LABEL = { baia: 'Baía', mar: 'Mar aberto', ambos: 'Baía e mar' } as const;
