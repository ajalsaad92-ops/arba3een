import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function isPushSupported(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const reg = await getRegistration();
  return reg !== null;
}

export async function hasActivePushSubscription(): Promise<boolean> {
  const reg = await getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return sub !== null;
}

export async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const json = subscription.toJSON();
  const keys = json.keys as Record<string, string> | undefined;
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) return;

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent,
      platform: /android/i.test(navigator.userAgent)
        ? 'android'
        : /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? 'ios'
          : 'desktop',
    },
    { onConflict: 'user_id,endpoint' }
  );

  if (error) {
    console.error('Failed to save push subscription', error);
    throw error;
  }
}

export async function deletePushSubscription(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const reg = await getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await sub.unsubscribe().catch(() => {});
  }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id);
}

export async function subscribeToPush(): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    toast.error('مفتاح الإشعارات غير مُهيأ بعد. سيتم تفعيلها من الخادم لاحقاً.');
    return false;
  }

  const reg = await getRegistration();
  if (!reg) {
    toast.error('لا يوجد Service Worker مسجّل.');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast.error('لم يتم منح إذن الإشعارات.');
    return false;
  }

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await savePushSubscription(sub);
    toast.success('تم تفعيل الإشعارات — ستصلك حتى عند إغلاق التطبيق عند ربط الخادم.');
    return true;
  } catch (err) {
    console.error('Push subscription failed', err);
    toast.error('فشل الاشتراك في الإشعارات.');
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    await deletePushSubscription();
    toast.success('تم إيقاف الإشعارات.');
    return true;
  } catch (err) {
    console.error('Unsubscribe failed', err);
    toast.error('فشل إلغاء الإشعارات.');
    return false;
  }
}

/** Check server connectivity and remove stale local subscriptions if needed. */
export async function syncPushSubscriptionState(): Promise<void> {
  const supported = await isPushSupported();
  if (!supported) return;

  const reg = await getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;

  if (!sub) {
    // No local subscription; clean up any server rows for this device.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
    return;
  }

  // If the VAPID key is configured, re-save the existing subscription so the
  // server always has the latest endpoint/key pair.
  if (VAPID_PUBLIC_KEY) {
    await savePushSubscription(sub).catch(() => {});
  }
}
