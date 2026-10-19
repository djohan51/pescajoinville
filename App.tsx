import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Forecast } from './src/core/forecast';
import { loadCachedForecast, refreshForecast, loadSettings } from './src/data/store';
import { registerBackground, scheduleAlerts } from './src/data/notify';
import { useTheme } from './src/ui/theme';
import Previsao from './src/ui/Previsao';
import Especies from './src/ui/Especies';
import Avisos from './src/ui/Avisos';
import { localDateKey } from './src/core/time';

type Tab = 'prev' | 'esp' | 'av';

function Main() {
  const t = useTheme();
  const [f, setF] = useState<Forecast | null>(null);
  const [tab, setTab] = useState<Tab>('prev');
  const [mode, setMode] = useState<'site' | 'spec'>('site');
  const [sp, setSp] = useState('robalo-flecha');
  const [sel, setSel] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useRef(0);

  const refresh = useCallback(async () => {
    setRefreshing(true); setError(null);
    try {
      const r = await refreshForecast();
      setF(r.forecast); last.current = Date.now();
      setNotice(r.tabuaOk ? null : 'Não consegui ler o tabuademares agora. Marés e atividade estão sendo calculadas pelo app (estimativa).');
      const s = await loadSettings();
      if (s.ativo) await scheduleAlerts(r.forecast, s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao atualizar.');
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    loadCachedForecast().then(c => { if (c) { setF(c); if (localDateKey(c.generatedAt) !== localDateKey(Date.now())) setNotice('Mostrando a última previsão salva. Atualizando…'); } });
    refresh();
    registerBackground();
    const sub = AppState.addEventListener('change', st => { if (st === 'active' && Date.now() - last.current > 30 * 60_000) refresh(); });
    return () => sub.remove();
  }, [refresh]);

  if (!f) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, padding: 24, gap: 12 }}>
        {error ? (<>
          <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Não consegui carregar a previsão</Text>
          <Text style={{ color: t.muted, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={refresh} style={{ backgroundColor: t.ink, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 }}><Text style={{ color: t.paper, fontWeight: '800' }}>Tentar de novo</Text></Pressable>
        </>) : (<><ActivityIndicator color={t.sea} /><Text style={{ color: t.muted }}>Buscando marés e previsão do tempo…</Text></>)}
      </View>
    );
  }

  const tabs: { key: Tab; label: string }[] = [{ key: 'prev', label: 'Previsão' }, { key: 'esp', label: 'Espécies' }, { key: 'av', label: 'Avisos' }];
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'prev' && <Previsao f={f} mode={mode} setMode={setMode} sp={sp} goSpecies={() => setTab('esp')} sel={sel} setSel={setSel} refreshing={refreshing} onRefresh={refresh} notice={error ? `Falha ao atualizar: ${error}` : notice} />}
        {tab === 'esp' && <Especies f={f} sel={sel} sp={sp} onPick={k => { setSp(k); setMode('spec'); setTab('prev'); }} />}
        {tab === 'av' && <Avisos f={f} />}
      </View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: t.line, backgroundColor: t.paper }}>
        {tabs.map(x => {
          const on = x.key === tab;
          return (<Pressable key={x.key} onPress={() => setTab(x.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderTopWidth: 3, borderTopColor: on ? t.sea : 'transparent' }}>
            <Text style={{ color: on ? t.ink : t.muted, fontWeight: '800', fontSize: 14 }}>{x.label}</Text>
          </Pressable>);
        })}
      </View>
    </View>
  );
}

export default function App() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.paper }} edges={['top', 'bottom']}>
        <StatusBar style="auto" />
        <Main />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
