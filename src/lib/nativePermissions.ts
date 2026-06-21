// Native (Capacitor) permission bootstrap.
//
// On a real device (iOS/Android) this requests every permission the app needs
// up-front on first launch: location (incl. background), notifications (push +
// local), and microphone. On the web it is a no-op so the existing browser
// permission flow in App.tsx keeps working.

import { Capacitor } from '@capacitor/core';

const FLAG = 'ops:native-perms-asked';

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function requestLocation() {
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    // Triggers the OS location dialog; "Always"/background is requested too.
    await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
    // Prime a first fix so the OS marks the permission as actively used.
    try { await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000 }); } catch { /* ignore */ }
  } catch { /* plugin missing on web */ }
}

async function requestPush() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive === 'granted') {
      await PushNotifications.register();
    }
  } catch { /* ignore */ }
}

async function requestLocalNotifications() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.requestPermissions();
  } catch { /* ignore */ }
}

async function requestMicrophone() {
  try {
    if (navigator?.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately release the mic; we only needed the permission grant.
      stream.getTracks().forEach((t) => t.stop());
    }
  } catch { /* denied or unsupported */ }
}

/**
 * Request all native permissions once, sequentially (some OSes drop dialogs
 * fired in parallel). Safe to call on every launch — it self-guards.
 */
export async function requestAllNativePermissions(force = false): Promise<void> {
  if (!isNative()) return;
  if (!force && localStorage.getItem(FLAG)) return;

  await requestLocation();
  await requestPush();
  await requestLocalNotifications();
  await requestMicrophone();

  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
}
