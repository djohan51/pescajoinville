// No celular (app nativo) o app lê o tabuademares direto.
import { fetchTabua, type Tabua } from '../core/tabua';
export const getTabua = (signal?: AbortSignal): Promise<Tabua> => fetchTabua(signal);
