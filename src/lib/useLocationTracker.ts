import { useEffect, useRef } from 'react';
import { useOps } from '../store/opsStore';
import { startLiveLocation, subscribeLiveLocation } from './liveLocation';

/**
 * Global, battery-aware location tracking for the signed-in user.
 *
 * Battery & DB-bloat protections:
 *  - Distance filter: only push an update when the user has moved > 50 m.
 *  - Time throttle: at most one write every 5 minutes when idle. While an
 *    emergency involving the user's office is active, the throttle tightens to
 *    30 s so command can follow responders closely.
 * The last fix is always cached locally so the most recent position survives a
 * network drop even if it isn't written to the backend.
 */

const IDLE_INTERVAL_MS = 5 * 60_000;   // 5 minutes when nothing is happening
const EMERGENCY_INTERVAL_MS = 30_000;  // 30 s during an active emergency
const MIN_DISTANCE_M = 50;             // ignore jitter / stationary noise

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function useLocationTracker() {
  const { state, actions } = useOps();
  const user = state.currentUser;
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // Live ref so the watch callback always sees the current emergency state
  // without having to re-create the geolocation watch.
  const emergencyActiveRef = useRef(false);
  useEffect(() => {
    emergencyActiveRef.current = state.emergencies.some(
      e => e.status !== 'resolved' && (!user || e.officeId === user.officeId),
    );
  }, [state.emergencies, user?.officeId]);

  useEffect(() => {
    if (!user) return;
    if (!('geolocation' in navigator)) return;

    const onPos = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const loc = {
        agentId: user.id,
        agentName: user.fullNameAr,
        officeId: user.officeId,
        lat,
        lng,
        accuracyMeters: pos.coords.accuracy,
        updatedAt: new Date().toISOString(),
      };
      // Cache locally so the last-known position/time persists even offline.
      try { localStorage.setItem(`ops:last-loc:${user.id}`, JSON.stringify(loc)); } catch { /* ignore */ }

      const now = Date.now();
      const interval = emergencyActiveRef.current ? EMERGENCY_INTERVAL_MS : IDLE_INTERVAL_MS;
      const isFirst = lastPosRef.current === null;
      const moved = isFirst
        ? Infinity
        : distanceMeters(lastPosRef.current!.lat, lastPosRef.current!.lng, lat, lng);
      const timeElapsed = now - lastSentRef.current >= interval;

      // First fix always sends (shows presence). Afterwards, only write when the
      // throttle window has elapsed AND the user actually moved ≥ 50 m.
      if (!isFirst && (!timeElapsed || moved < MIN_DISTANCE_M)) return;

      lastSentRef.current = now;
      lastPosRef.current = { lat, lng };
      actions.updateAgentLocation(loc).catch(() => { /* offline — kept in cache */ });
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onPos,
      () => { /* permission denied / unavailable — silent */ },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [user?.id]);
}
