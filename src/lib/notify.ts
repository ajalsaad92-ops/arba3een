// Real notification helper: browser Notification + sound (WebAudio) + vibration.
// Designed for mobile-first: requires a user gesture for the first sound,
// and uses the Vibration API where supported (Android).

type AlertKind = 'emergency' | 'extension' | 'report' | 'system';

let audioCtx: AudioContext | null = null;
let soundUnlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  try { audioCtx = new AC(); } catch { audioCtx = null; }
  return audioCtx;
}

/** Must be called from inside a user gesture (click/tap) to unlock audio on iOS. */
export function unlockAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (!soundUnlocked) {
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.02);
    } catch {}
    soundUnlocked = true;
  }
}

function beep(freq: number, duration: number, when = 0, volume = 0.25, type: OscillatorType = 'sine') {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + duration + 0.02);
  } catch {}
}

function playPattern(kind: AlertKind) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  switch (kind) {
    case 'emergency':
      // Urgent siren: 3 rapid alternating tones
      beep(880, 0.18, 0.0, 0.35, 'square');
      beep(660, 0.18, 0.22, 0.35, 'square');
      beep(880, 0.18, 0.44, 0.35, 'square');
      beep(660, 0.18, 0.66, 0.35, 'square');
      break;
    case 'extension':
      beep(700, 0.14, 0.0, 0.25);
      beep(900, 0.14, 0.18, 0.25);
      break;
    case 'report':
      beep(880, 0.12, 0.0, 0.2);
      beep(1175, 0.16, 0.14, 0.2);
      break;
    default:
      beep(660, 0.12, 0.0, 0.2);
  }
}

function vibrate(kind: AlertKind) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    if (kind === 'emergency') navigator.vibrate([300, 100, 300, 100, 600]);
    else if (kind === 'extension') navigator.vibrate([150, 80, 150]);
    else if (kind === 'report') navigator.vibrate([120]);
    else navigator.vibrate(100);
  } catch {}
}

function showSystemNotification(title: string, body: string, kind: AlertKind) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: `ops-${kind}-${Date.now()}`,
      silent: false,
    } as any);
    // Auto-close after 8s (mobile browsers may ignore)
    setTimeout(() => { try { n.close(); } catch {} }, 8000);
  } catch {}
}

/** Fire a real notification: sound + vibration + OS notification (if allowed). */
export function fireAlert(kind: AlertKind, title: string, body: string) {
  playPattern(kind);
  vibrate(kind);
  showSystemNotification(title, body, kind);
}

/** Ask the browser for notification permission. Must run from a user gesture. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return 'denied';
  }
}

/** Ask for geolocation permission (resolves on grant/deny). */
export function requestGeolocationPermission(): Promise<boolean> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(false);
    navigator.geolocation.getCurrentPosition(() => resolve(true), () => resolve(false), { timeout: 8000 });
  });
}

/** Trigger a short vibration to confirm vibration API works (Android). */
export function testVibration() {
  if ('vibrate' in navigator) {
    try { navigator.vibrate([60, 40, 60]); } catch {}
  }
}