// Avisos no site/PWA: Web Push. O navegador se inscreve e o servidor (api/push/*) manda
// a notificação às 6h ou às 19h conforme a configuração salva junto da inscrição.
import type { Forecast } from '../core/forecast';
import { planAlerts, type AlertSettings } from '../core/alerts';

export { passa, planAlerts } from '../core/alerts';
export const BG_TASK = 'web';

const VAPID = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const API = process.env.EXPO_PUBLIC_API_BASE ?? '';

export function pushSupport(): 'ok' | 'ios-instalar' | 'sem-suporte' {
  if (typeof window === 'undefined') return 'sem-suporte';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return 'ios-instalar';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sem-suporte';
  return 'ok';
}

function keyToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export async function ensurePermission(): Promise<boolean> {
  if (pushSupport() !== 'ok' || !VAPID) return false;
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  return p === 'granted';
}

async function subscription(): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) ??
    reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID) as unknown as BufferSource });
}

/** Salva a configuração no servidor junto com a inscrição deste navegador. Retorna quantos avisos a semana gera. */
export async function scheduleAlerts(f: Forecast, s: AlertSettings): Promise<number> {
  if (pushSupport() !== 'ok' || !VAPID) return 0;
  if (!s.ativo) {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await fetch(`${API}/api/push/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    return 0;
  }
  const sub = await subscription();
  const r = await fetch(`${API}/api/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), settings: s }) });
  if (!r.ok) throw new Error('push_subscribe_' + r.status);
  return planAlerts(f, s).length;
}

export async function registerBackground(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch { /* sem service worker */ }
  }
}

/** Pede ao servidor um push de teste para este navegador (precisa ter salvo os avisos antes). */
export async function sendTestAlert(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) throw new Error('Salve os avisos antes de testar.');
  const r = await fetch(`${API}/api/push/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})) as { error?: string }; throw new Error(j.error || 'Falha no teste.'); }
}
