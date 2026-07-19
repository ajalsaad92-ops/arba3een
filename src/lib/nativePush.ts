// Capacitor native push notifications.
//
// Registers with FCM (Android) / APNs (iOS), captures the device token, and
// persists it to Supabase `push_subscriptions` so the backend can target this
// device even when the app is closed. Web is a no-op — the browser Push flow
// in `pushSubscription.ts` continues to handle desktop/PWA.

import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

let listenersBound = false;

export function isNativePlatform(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

function platformName(): 'ios' | 'android' | 'desktop' {
  try {
    const p = Capacitor.getPlatform();
    if (p === 'ios' || p === 'android') return p;
  } catch { /* ignore */ }
  return 'desktop';
}

async function saveNativeToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const platform = platformName();
  // Reuse the same table as web push — the backend distinguishes native rows
  // by the `native:` endpoint prefix.
  const endpoint = `native:${platform}:${token}`;
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: 'native',
      auth: 'native',
      user_agent: navigator.userAgent,
      platform,
    },
    { onConflict: 'user_id,endpoint' }
  );
  if (error) console.error('Failed to save native push token', error);
}

/**
 * Register for native push and persist the device token. Safe to call more
 * than once — listener binding is guarded.
 */
export async function registerNativePush(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    if (!listenersBound) {
      listenersBound = true;

      await PushNotifications.addListener('registration', (token) => {
        saveNativeToken(token.value).catch((e) => console.error(e));
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('Native push registration error', err);
      });

      // Foreground notification received — surface a lightweight toast so the
      // user sees it even while inside the app.
      await PushNotifications.addListener('pushNotificationReceived', (notif) => {
        const title = notif.title || 'تنبيه جديد';
        const body = notif.body || '';
        toast(title, { description: body });
      });
    }

    const perm = await PushNotifications.checkPermissions();
    let receive = perm.receive;
    if (receive !== 'granted') {
      receive = (await PushNotifications.requestPermissions()).receive;
    }
    if (receive === 'granted') {
      await PushNotifications.register();
    }
  } catch (e) {
    console.error('registerNativePush failed', e);
  }
}

/** Remove this device's native token rows from the backend. */
export async function unregisterNativePush(): Promise<void> {
  if (!isNativePlatform()) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .like('endpoint', 'native:%');
}
