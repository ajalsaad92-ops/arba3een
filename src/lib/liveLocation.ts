/**
 * Centralized live-location service.
 *
 * A single `watchPosition` runs for the whole app lifetime (started as soon as
 * the app opens). The most recent fix is cached in memory + localStorage and
 * broadcast to subscribers. Any feature that needs the user's location reads
 * the already-tracked live position instead of triggering a brand-new
 * permission prompt / GPS request every time.
 */

export type LiveFix = {
  lat: number;
  lng: number;
  accuracy: number;
  ts: number; // epoch ms when captured
};

const CACHE_KEY = 'ops:live-loc';
const FRESH_MS = 60_000; // a cached fix newer than this is considered "live"

let watchId: number | null = null;
let latest: LiveFix | null = null;
const listeners = new Set<(fix: LiveFix) => void>();

function restoreCache(): LiveFix | null {
  if (latest) return latest;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LiveFix;
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function persist(fix: LiveFix) {
  latest = fix;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(fix)); } catch { /* ignore */ }
  listeners.forEach(l => { try { l(fix); } catch { /* ignore */ } });
}

/**
 * Begin tracking the live location. Safe to call multiple times — only one
 * underlying geolocation watch is ever created. Call this on app open so the
 * permission is requested once and the position is kept fresh in the background.
 */
export function startLiveLocation() {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
  if (watchId != null) return; // already watching
  watchId = navigator.geolocation.watchPosition(
    (pos) => persist({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      ts: Date.now(),
    }),
    () => { /* permission denied / unavailable — silent, features still work manually */ },
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
  );
}

/** Latest known fix (memory, then localStorage). Never prompts. */
export function getLiveLocation(): LiveFix | null {
  return restoreCache();
}

/**
 * Resolve a usable location WITHOUT prompting again when a recent live fix
 * exists. Falls back to a one-shot getCurrentPosition only if nothing fresh is
 * cached, and ultimately returns the last-known fix (or null) on failure.
 */
export function requestLiveLocation(timeoutMs = 8000): Promise<LiveFix | null> {
  const cached = restoreCache();
  if (cached && Date.now() - cached.ts < FRESH_MS) {
    return Promise.resolve(cached);
  }
  // Make sure the background watch is running for next time.
  startLiveLocation();

  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(cached);
      return;
    }
    let done = false;
    const finish = (v: LiveFix | null) => { if (!done) { done = true; resolve(v); } };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fix: LiveFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          ts: Date.now(),
        };
        persist(fix);
        finish(fix);
      },
      () => finish(cached),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
    setTimeout(() => finish(cached), timeoutMs + 500);
  });
}

/** Subscribe to live-location updates. Immediately replays the last fix. */
export function subscribeLiveLocation(cb: (fix: LiveFix) => void): () => void {
  listeners.add(cb);
  const cached = restoreCache();
  if (cached) { try { cb(cached); } catch { /* ignore */ } }
  return () => { listeners.delete(cb); };
}
