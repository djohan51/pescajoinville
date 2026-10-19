import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, Switch, TextInput } from 'react-native';
import type { Forecast } from '../core/forecast';
import { SPECIES, SPECIES_KEYS } from '../core/especies';
import { weekday, WD, WDL } from '../core/time';
import { useTheme, vColor, vText } from './theme';
import { Card, Label } from './common';
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type AlertSettings } from '../data/store';
import { ensurePermission, scheduleAlerts, passa, pushSupport, sendTestAlert } from '../data/notify';
import { Platform } from 'react-native';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Option({ on, title, sub, onPress }: { on: boolean; title: string; sub: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }}
      style={{ flexGrow: 1, flexBasis: '45%', borderWidth: on ? 2 : 1, borderColor: on ? t.sea : t.line, backgroundColor: on ? t.seaSoft : t.paper, borderRadius: 8, padding: 10 }}>
      <Text style={{ color: t.ink, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: t.muted, fontSize: 12 }}>{sub}</Text>
    </Pressable>
  );
}

export default function Avisos({ f }: { f: Forecast }) {
  const t = useTheme();
  const [s, setS] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => { loadSettings().then(setS); }, []);
  const up = (p: Partial<AlertSettings>) => { setS(prev => ({ ...prev, ...p })); setMsg('Alterações não salvas'); };

  const preview = useMemo(() => f.days.filter(d => s.dias.includes(weekday(d.date))).map(d => {
    const ev = s.base === 'site' ? d.site : d.species[s.especie];
    return { d, v: ev.verdict, ok: passa(ev.verdict, s.criterio) };
  }), [f, s]);
  const found = useMemo(() => { const nq = norm(q.trim()); return nq ? SPECIES_KEYS.filter(k => SPECIES[k].status !== 'proibida' && norm(SPECIES[k].nome).includes(nq)).slice(0, 6) : []; }, [q]);

  async function salvar() {
    setBusy(true);
    try {
      const sup = pushSupport();
      if (s.ativo && sup === 'ios-instalar') { setMsg('No iPhone, instale o app primeiro: toque em Compartilhar › Adicionar à Tela de Início e abra pelo ícone.'); return; }
      if (s.ativo && sup === 'sem-servidor') { setMsg('Os avisos desta versão do site ainda não estão ligados (falta o servidor). No app do celular eles já funcionam.'); return; }
      if (s.ativo && sup === 'sem-suporte') { setMsg('Este navegador não recebe avisos. Use Chrome, Edge, Firefox ou Safari atualizados.'); return; }
      if (s.ativo && !(await ensurePermission())) {
        setMsg(Platform.OS === 'web' ? 'O navegador bloqueou as notificações deste site. Libere nas configurações do navegador e tente de novo.' : 'O app não tem permissão para notificar. Libere em Ajustes › Notificações › Pesca Joinville.');
        return;
      }
      await saveSettings(s);
      const n = s.ativo ? await scheduleAlerts(f, s) : (await scheduleAlerts(f, { ...s, ativo: false }), 0);
      setMsg(!s.ativo ? 'Avisos desligados.' : n ? `Salvo. ${n} ${n === 1 ? 'aviso agendado' : 'avisos agendados'} para os próximos dias.` : 'Salvo. Nenhum dia desta semana atende ao critério; o app confere de novo quando a previsão atualizar.');
    } catch { setMsg('Não consegui salvar agora. Tente de novo.'); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: 28, fontWeight: '800', color: t.ink }}>Avisos de pesca</Text>
      <Text style={{ color: t.muted, fontSize: 13 }}>O app avisa no celular se vai estar bom, ruim ou muito bom para pescar nos dias que você escolher.</Text>

      {Platform.OS === 'web' && pushSupport() === 'ios-instalar' && (
        <Card style={{ backgroundColor: t.seaSoft }}>
          <Text style={{ color: t.ink, fontWeight: '700' }}>Para receber avisos no iPhone</Text>
          <Text style={{ color: t.ink, fontSize: 14 }}>Toque em Compartilhar (□↑) no Safari, escolha "Adicionar à Tela de Início" e abra o Pesca Joinville pelo ícone. Os avisos funcionam no iOS 16.4 ou mais novo.</Text>
        </Card>
      )}
      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>Avisos ligados</Text>
        <Switch value={s.ativo} onValueChange={v => up({ ativo: v })} trackColor={{ true: t.sea }} accessibilityLabel="Ligar avisos" />
      </Card>

      <Card>
        <Label>Dias da semana</Label>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {WD.map((n, i) => {
            const on = s.dias.includes(i);
            return (<Pressable key={n} onPress={() => up({ dias: on ? s.dias.filter(x => x !== i) : [...s.dias, i].sort() })} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={WDL[i]}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 6, borderWidth: 1, borderColor: on ? t.sea : t.line, backgroundColor: on ? t.sea : t.paper }}>
              <Text style={{ textAlign: 'center', fontWeight: '800', fontSize: 13, color: on ? t.paper : t.ink }}>{n.toUpperCase()}</Text>
            </Pressable>);
          })}
        </View>
      </Card>

      <Card>
        <Label>Quando avisar</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Option on={s.quando === 'vespera'} title="Na véspera, 19h" sub="Dá tempo de preparar" onPress={() => up({ quando: 'vespera' })} />
          <Option on={s.quando === 'manha'} title="No dia, 6h" sub="Previsão mais recente" onPress={() => up({ quando: 'manha' })} />
        </View>
        <Label>Me avise quando estiver</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Option on={s.criterio === 'muito_bom'} title="Muito bom" sub="Só os melhores dias" onPress={() => up({ criterio: 'muito_bom' })} />
          <Option on={s.criterio === 'bom'} title="Bom ou muito bom" sub="Dias que valem a saída" onPress={() => up({ criterio: 'bom' })} />
          <Option on={s.criterio === 'sempre'} title="Sempre" sub="Inclusive quando estiver ruim" onPress={() => up({ criterio: 'sempre' })} />
        </View>
        <Label>Avaliar por</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Option on={s.base === 'site'} title="Tábua de Marés" sub="Atividade do site e barômetro" onPress={() => up({ base: 'site' })} />
          <Option on={s.base === 'spec'} title={s.base === 'spec' ? SPECIES[s.especie].nome : 'Uma espécie'} sub="Escolha o peixe abaixo" onPress={() => up({ base: 'spec' })} />
        </View>
        {s.base === 'spec' && (<View style={{ gap: 6 }}>
          <TextInput value={q} onChangeText={setQ} placeholder={`Trocar peixe (atual: ${SPECIES[s.especie].nome})`} placeholderTextColor={t.muted} autoCorrect={false}
            style={{ backgroundColor: t.paper, borderColor: t.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: t.ink }} />
          {found.map(k => (<Pressable key={k} onPress={() => { up({ especie: k }); setQ(''); }} style={{ padding: 10, backgroundColor: t.paper, borderRadius: 6 }}>
            <Text style={{ color: t.ink }}>{SPECIES[k].nome}</Text></Pressable>))}
        </View>)}
      </Card>

      <Card>
        <Label>Com a previsão desta semana</Label>
        {!s.ativo ? <Text style={{ color: t.muted }}>Avisos desligados.</Text>
          : !s.dias.length ? <Text style={{ color: t.muted }}>Marque pelo menos um dia da semana.</Text>
          : preview.length ? preview.map(({ d, v, ok }) => (
            <Text key={d.date} style={{ color: t.ink }}>{WDL[weekday(d.date)]} {d.date.slice(8, 10)}/{d.date.slice(5, 7)}: <Text style={{ color: vColor(t, v), fontWeight: '700' }}>{vText(v)}</Text> — {ok ? 'você recebe aviso' : 'sem aviso'}</Text>))
          : <Text style={{ color: t.muted }}>Nenhum dos dias escolhidos está nos próximos 7 dias.</Text>}
      </Card>

      <Pressable onPress={salvar} disabled={busy} accessibilityRole="button"
        style={{ backgroundColor: t.ink, borderRadius: 8, paddingVertical: 15, opacity: busy ? 0.6 : 1 }}>
        <Text style={{ color: t.paper, textAlign: 'center', fontWeight: '800', fontSize: 17 }}>{busy ? 'Salvando…' : 'Salvar avisos'}</Text>
      </Pressable>
      <Pressable onPress={async () => { try { if (!(await ensurePermission())) { setMsg('Sem permissão para notificar.'); return; } await sendTestAlert(); setMsg('Aviso de teste enviado. Deve chegar em alguns segundos.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Falha no teste.'); } }}
        accessibilityRole="button" style={{ borderWidth: 1, borderColor: t.ink, borderRadius: 8, paddingVertical: 12 }}>
        <Text style={{ color: t.ink, textAlign: 'center', fontWeight: '700', fontSize: 15 }}>Enviar aviso de teste</Text>
      </Pressable>
      {!!msg && <Text style={{ color: t.muted, fontSize: 13 }} accessibilityLiveRegion="polite">{msg}</Text>}
      <Text style={{ color: t.muted, fontSize: 12, lineHeight: 17 }}>
        {Platform.OS === 'web' ? 'No site e no PWA, o servidor do app confere a previsão às 6h e às 19h e manda o aviso para este navegador.' : 'Os avisos ficam agendados no próprio celular com a previsão mais recente. O app atualiza a previsão sozinho algumas vezes por dia e reagenda os avisos; abrir o app também atualiza.'}
      </Text>
    </ScrollView>
  );
}
