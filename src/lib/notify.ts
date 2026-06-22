// Real notification helper: browser Notification + sound (WebAudio) + vibration.

type AlertKind = 'emergency' | 'extension' | 'report' | 'system';

let audioCtx: AudioContext | null = null;
let soundUnlocked = false;
let keepAliveStarted = false;

// --- Audio lifecycle manager ---
let currentOscillators = new Set<OscillatorNode>();
let isPlaying = false;
let playTimeout: number | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  try { audioCtx = new AC(); } catch { audioCtx = null; }
  return audioCtx;
}

function startKeepAlive(ctx: AudioContext) {
  if (keepAliveStarted) return;
  try {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.0000001;
    src.connect(g); g.connect(ctx.destination);
    src.start();
    keepAliveStarted = true;
  } catch { }
}

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
  startKeepAlive(ctx);
}

export function stopAllAudio() {
  isPlaying = false;
  if (playTimeout) { clearTimeout(playTimeout); playTimeout = null; }
  currentOscillators.forEach(o => { try { o.stop(); } catch {} });
  currentOscillators.clear();
}

export function playEncodedAudio(bytes: Uint8Array): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getCtx();
    if (!ctx) return resolve();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const done = () => resolve();
    try {
      ctx.decodeAudioData(
        ab as ArrayBuffer,
        (buffer) => {
          try {
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(ctx.destination);
            src.onended = done;
            src.start();
          } catch { done(); }
        },
        () => done(),
      );
    } catch { done(); }
  });
}

export function playStatic(duration = 0.32, volume = 0.12) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  try {
    const frameCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter); filter.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + duration + 0.02);
  } catch {}
}

function beep(freq: number, duration: number, when = 0, volume = 0.25, type: OscillatorType = 'sine') {
  const ctx = getCtx();
  if (!ctx) return null;
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
    currentOscillators.add(o);
    o.onended = () => currentOscillators.delete(o);
    return o;
  } catch { return null; }
}

function playPattern(kind: AlertKind) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  // Prevent overlapping alerts
  if (isPlaying) return;
  isPlaying = true;

  stopAllAudio();
  isPlaying = true;

  const cleanup = () => {
    isPlaying = false;
    if (playTimeout) { clearTimeout(playTimeout); playTimeout = null; }
  };

  let totalDuration = 0;
  switch (kind) {
    case 'emergency':
      // 2 cycles only, 3.5s max
      beep(880, 0.15, 0.0, 0.28, 'square');
      beep(660, 0.15, 0.18, 0.28, 'square');
      beep(880, 0.15, 0.36, 0.28, 'square');
      beep(660, 0.15, 0.54, 0.28, 'square');
      totalDuration = 800;
      break;
    case 'extension':
      beep(700, 0.12, 0.0, 0.22);
      beep(900, 0.12, 0.15, 0.22);
      totalDuration = 300;
      break;
    case 'report':
      beep(880, 0.1, 0.0, 0.18);
      beep(1175, 0.14, 0.12, 0.18);
      totalDuration = 280;
      break;
    default:
      beep(660, 0.1, 0.0, 0.18);
      totalDuration = 120;
  }

  playTimeout = window.setTimeout(cleanup, totalDuration + 100);
}

function vibrate(kind: AlertKind) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    if (kind === 'emergency') navigator.vibrate([200, 80, 200]);
    else if (kind === 'extension') navigator.vibrate([120, 60, 120]);
    else if (kind === 'report') navigator.vibrate(100);
    else navigator.vibrate(80);
  } catch {}
}

function showSystemNotification(title: string, body: string, kind: AlertKind) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) {
        reg.active.postMessage({
          type: 'notify',
          title, body, kind,
          tag: `ops-${kind}-${Date.now()}`,
          url: '/',
        });
      } else {
        reg.showNotification(title, {
          body, icon: '/favicon.ico', tag: `ops-${kind}-${Date.now()}`,
          // @ts-ignore
          vibrate: kind === 'emergency' ? [200, 80, 200] : [120, 60, 120],
        });
      }
    }).catch(() => fallbackNotification(title, body));
    return;
  }
  fallbackNotification(title, body);
}

function fallbackNotification(title: string, body: string) {
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico', silent: false } as any);
    setTimeout(() => { try { n.close(); } catch {} }, 6000);
  } catch {}
}

export function fireAlert(kind: AlertKind, title: string, body: string) {
  playPattern(kind);
  vibrate(kind);
  showSystemNotification(title, body, kind);
}

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

export function requestGeolocationPermission(): Promise<boolean> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(false);
    navigator.geolocation.getCurrentPosition(() => resolve(true), () => resolve(false), { timeout: 8000 });
  });
}

export function testVibration() {
  if ('vibrate' in navigator) {
    try { navigator.vibrate([60, 40, 60]); } catch {}
  }
}

// Export class wrapper for easier use
export class AudioNotifier {
  init() { unlockAudio(); }
  async playEmergencyAlert() { fireAlert('emergency', '🚨 حالة طارئة', 'تم استلام بلاغ طارئ'); }
  stop() { stopAllAudio(); }
}
