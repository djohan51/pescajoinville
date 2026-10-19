// Notificações locais: agendadas no próprio celular, sem servidor.
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { Platform } from 'react-native';
import type { Forecast } from '../core/forecast';
import { planAlerts, type AlertSettings } from '../core/alerts';
import { refreshForecast, loadSettings } from './store';

export const BG_TASK = 'pesca-joinville-atualizar';
const CHANNEL = 'avisos-pesca';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export { passa, planAlerts } from '../core/alerts';

/** No app nativo as notificações são locais e sempre suportadas. */
export function pushSupport(): 'ok' | 'ios-instalar' | 'sem-suporte' { return 'ok'; }

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Avisos de pesca', importance: Notifications.AndroidImportance.HIGH });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Cancela os avisos antigos e agenda os novos. Retorna quantos foram agendados. */
export async function scheduleAlerts(f: Forecast, s: AlertSettings): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const plan = planAlerts(f, s);
  for (const a of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { title: a.title, body: a.body, data: { date: a.date } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(a.fireAt), ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
    });
  }
  return plan.length;
}

// Tarefa em segundo plano: o sistema roda de tempos em tempos (normalmente algumas vezes por dia)
// para atualizar a previsão e reagendar os avisos com dados novos.
TaskManager.defineTask(BG_TASK, async () => {
  try {
    const [{ forecast }, s] = await Promise.all([refreshForecast(), loadSettings()]);
    if (s.ativo) await scheduleAlerts(forecast, s);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackground(): Promise<void> {
  try {
    const st = await BackgroundTask.getStatusAsync();
    if (st !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(BG_TASK))) await BackgroundTask.registerTaskAsync(BG_TASK, { minimumInterval: 360 });
  } catch { /* não disponível neste ambiente (ex.: Expo Go) */ }
}

/** Aviso de teste em 5 segundos, para conferir se as notificações aparecem. */
export async function sendTestAlert(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Teste do Pesca Joinville', body: 'Os avisos estão funcionando neste celular.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
  });
}
