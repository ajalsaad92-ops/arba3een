import { useEffect, useRef } from 'react';
import { useOps } from '../store/opsStore';

/**
 * Global, continuous location tracking for the signed-in user.
 *
 * Once the user grants the location permission, this keeps a live
 * `watchPosition` running for the whole session and pushes every fix to the
 * backend so supervisors can follow "site users" in real time. The last fix is
 * also cached locally so the most recent position/time survives a network drop.
 */
export function useLocationTracker() {
  const { state, actions } = useOps();
  const user = state.currentUser;
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    if (!('geolocation' in navigator)) return;

    const onPos = (pos: GeolocationPosition) => {
      const loc = {
        agentId: user.id,
        agentName: user.fullNameAr,
        officeId: user.officeId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy,
        updatedAt: new Date().toISOString(),
      };
      // Cache locally so the last-known position/time persists even offline.
      try { localStorage.setItem(`ops:last-loc:${user.id}`, JSON.stringify(loc)); } catch { /* ignore */ }

      // Throttle network writes to at most once every 20s to spare the backend.
      const now = Date.now();
      if (now - lastSentRef.current < 20_000) return;
      lastSentRef.current = now;
      actions.updateAgentLocation(loc).catch(() => { /* offline — kept in cache */ });
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onPos,
      () => { /* permission denied / unavailable — silent */ },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [user?.id]);
}
