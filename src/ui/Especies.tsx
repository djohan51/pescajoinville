import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import type { Forecast } from '../core/forecast';
import { SPECIES, SPECIES_KEYS, ENV_LABEL } from '../core/especies';
import { weekday, WDL } from '../core/time';
import { useTheme, vColor } from './theme';
import { Chip, Label, Segmented } from './common';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Especies({ f, sel, sp, onPick }: { f: Forecast; sel: number; sp: string; onPick: (k: string) => void }) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [env, setEnv] = useState<'todos' | 'baia' | 'mar'>('todos');
  const [ordem, setOrdem] = useState<'melhores' | 'az'>('melhores');
  const d = f.days[Math.min(sel, f.days.length - 1)];
  const list = useMemo(() => {
    const nq = norm(q.trim());
    const ks = SPECIES_KEYS.filter(k => {
      const s = SPECIES[k];
      return (!nq || norm(`${s.nome} ${s.cientifico}`).includes(nq)) && (env === 'todos' || s.ambiente === env || s.ambiente === 'ambos');
    });
    return ordem === 'az' ? ks : [...ks].sort((a, b) => (SPECIES[a].status === 'proibida' ? 1 : 0) - (SPECIES[b].status === 'proibida' ? 1 : 0) || d.species[b].score - d.species[a].score);
  }, [q, env, ordem, d]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: t.ink }}>Espécies</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>{SPECIES_KEYS.length} peixes da Baía da Babitonga e do mar de São Francisco do Sul. Notas para {WDL[weekday(d.date)].toLowerCase()}, {d.date.slice(8, 10)}/{d.date.slice(5, 7)}.</Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar: robalo, garoupa, Centropomus…" placeholderTextColor={t.muted}
          autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search" accessibilityLabel="Buscar espécie"
          style={{ backgroundColor: t.paper, borderColor: t.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: t.ink }} />
        <Segmented value={env} onChange={setEnv} options={[{ key: 'todos', label: 'Todos' }, { key: 'baia', label: 'Baía' }, { key: 'mar', label: 'Mar' }]} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label>{list.length ? `${list.length} ${list.length === 1 ? 'espécie' : 'espécies'}` : 'Nenhuma espécie encontrada'}</Label>
          <Pressable onPress={() => setOrdem(ordem === 'az' ? 'melhores' : 'az')} accessibilityRole="button">
            <Text style={{ color: t.sea, fontWeight: '700' }}>{ordem === 'az' ? 'Ordenar: melhores do dia' : 'Ordenar: A–Z'}</Text>
          </Pressable>
        </View>
      </View>
      <FlatList data={list} keyExtractor={k => k} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={{ color: t.muted, padding: 8 }}>Tente outro nome ou mude o filtro de ambiente.</Text>}
        renderItem={({ item: k }) => {
          const s = SPECIES[k], e = d.species[k], on = k === sp;
          return (
            <Pressable onPress={() => onPick(k)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ backgroundColor: t.paper, borderRadius: 8, borderWidth: on ? 2 : 1, borderColor: on ? t.sea : t.line, padding: 12, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700' }}>{s.nome}</Text>
                  <Text style={{ color: t.muted, fontStyle: 'italic', fontSize: 12 }}>{s.cientifico}</Text>
                </View>
                {s.status === 'proibida' ? <Text style={{ color: t.bad, fontWeight: '800', fontSize: 12 }}>PROIBIDA</Text>
                  : <View style={{ alignItems: 'flex-end', gap: 2 }}><Chip v={e.verdict} small /><Text style={{ color: vColor(t, e.verdict), fontSize: 12, fontWeight: '700' }}>{e.score}</Text></View>}
              </View>
              <Text style={{ color: t.muted, fontSize: 12 }}>{ENV_LABEL[s.ambiente]} · temporada {s.temporada} · água {s.temp[0]}–{s.temp[1]} °C</Text>
              {s.status === 'ameacada' && <Text style={{ color: t.ok, fontSize: 12 }}>Espécie ameaçada: confira as regras vigentes e prefira soltar.</Text>}
              {s.status === 'proibida' && <Text style={{ color: t.bad, fontSize: 12 }}>Pesca proibida. Se fisgar, solte o peixe ainda na água.</Text>}
            </Pressable>);
        }} />
    </View>
  );
}
