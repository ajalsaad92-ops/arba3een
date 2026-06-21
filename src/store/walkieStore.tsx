import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
  type ReactNode,
} from 'react';
import { useOps } from './opsStore';
import { supabase } from '../lib/supabase';
import { playStatic, playEncodedAudio } from '../lib/notify';
import { toast } from 'sonner';
import type { Role } from '../data/types';

const SEGMENT_MS = 2200; // length of each streamed audio segment

export type TargetMode = 'all' | 'role' | 'user';
export type Target = { mode: TargetMode; value?: string };

type VoicePayload = {
  senderId: string;
  senderName: string;
  senderRole: Role;
  target: Target;
  mime: string;
  audio: string; // base64 (without data: prefix)
};

export const ROLE_LABELS: Record<Role, string> = {
  director: 'المدراء العامون',
  supervisor: 'المشرفون',
  manager: 'مدراء المكاتب',
  agent: 'مستخدمو الموقع',
  viewer: 'المشاهدون',
};

// ─── Persisted settings ───────────────────────────────────────────────
const LS_BG = 'walkie:bg';
const LS_DIRLISTEN = 'walkie:dirListen';
const LS_TARGET = 'walkie:target';

function loadBool(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v == null ? def : v === '1';
  } catch { return def; }
}
function saveBool(key: string, val: boolean) {
  try { localStorage.setItem(key, val ? '1' : '0'); } catch { /* noop */ }
}
function loadTarget(): Target {
  try {
    const v = localStorage.getItem(LS_TARGET);
    if (v) return JSON.parse(v) as Target;
  } catch { /* noop */ }
  return { mode: 'all' };
}

function pickMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export type OnlineUser = { id: string; name: string; role: Role };
export type Listener = { id: string; name: string; role: Role; at: number };

interface WalkieCtx {
  connected: boolean;
  transmitting: boolean;
  incoming: string | null;
  target: Target;
  setTarget: (t: Target) => void;
  bgEnabled: boolean;
  toggleBackground: () => void;
  directorListening: boolean;
  setDirectorListening: (v: boolean) => void;
  isDirector: boolean;
  startTalking: () => void;
  stopTalking: () => void;
  /** Other users currently connected to the walkie channel (excludes me). */
  onlineUsers: OnlineUser[];
  /** Who actually heard my most recent transmission (director/all can review). */
  recentListeners: Listener[];
}

const Ctx = createContext<WalkieCtx | null>(null);

export function WalkieProvider({ children }: { children: ReactNode }) {
  const { state } = useOps();
  const me = state.currentUser;
  const isDirector = me?.role === 'director';

  const [target, setTargetState] = useState<Target>(() => loadTarget());
  const [connected, setConnected] = useState(false);
  const [transmitting, setTransmitting] = useState(false);
  const [incoming, setIncoming] = useState<string | null>(null);
  // Background mode + director-listen default to ON, and persist across sessions.
  const [bgEnabled, setBgEnabled] = useState(() => loadBool(LS_BG, true));
  const [directorListening, setDirectorListeningState] = useState(() => loadBool(LS_DIRLISTEN, true));
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [recentListeners, setRecentListeners] = useState<Listener[]>([]);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const holdingRef = useRef(false);
  const wakeLockRef = useRef<any>(null);
  const receivingRef = useRef(false);

  // Live refs so the single subscription always reads the latest settings.
  const dirListenRef = useRef(directorListening);
  useEffect(() => { dirListenRef.current = directorListening; }, [directorListening]);
  const targetRef = useRef(target);
  useEffect(() => { targetRef.current = target; }, [target]);

  const setTarget = useCallback((t: Target) => {
    setTargetState(t);
    try { localStorage.setItem(LS_TARGET, JSON.stringify(t)); } catch { /* noop */ }
  }, []);

  const setDirectorListening = useCallback((v: boolean) => {
    setDirectorListeningState(v);
    saveBool(LS_DIRLISTEN, v);
  }, []);

  // Sequential playback queue for received segments (raw encoded bytes).
  // We decode + play through the shared WebAudio context (notify.playEncodedAudio)
  // because HTML <audio>.play() is blocked from autoplaying on iOS Safari.
  const queueRef = useRef<Uint8Array[]>([]);
  const playingRef = useRef(false);

  const playNext = useCallback(() => {
    if (playingRef.current) return;
    const bytes = queueRef.current.shift();
    if (!bytes) {
      if (receivingRef.current) {
        receivingRef.current = false;
        playStatic();
      }
      setIncoming(null);
      return;
    }
    playingRef.current = true;
    playEncodedAudio(bytes).then(() => {
      playingRef.current = false;
      playNext();
    });
  }, []);

  const isForMe = useCallback((p: VoicePayload): boolean => {
    if (!me) return false;
    if (p.senderId === me.id) return false;
    // The director hears every call only while "listen" mode is enabled
    // (default ON), regardless of who the call was addressed to.
    if (me.role === 'director') return dirListenRef.current;
    if (p.target.mode === 'all') return true;
    if (p.target.mode === 'role') return me.role === p.target.value;
    if (p.target.mode === 'user') return me.id === p.target.value;
    return false;
  }, [me]);

  // Single global subscription — runs everywhere the user is logged in, so the
  // walkie-talkie keeps receiving in the background regardless of the page.
  useEffect(() => {
    if (!me) { setConnected(false); setOnlineUsers([]); return; }
    const channel = supabase.channel('walkie-talkie', {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });

    // Presence → who is actually connected right now (excluding me).
    const syncPresence = () => {
      const stateMap = channel.presenceState() as Record<string, any[]>;
      const seen = new Map<string, OnlineUser>();
      Object.values(stateMap).forEach((metas) => {
        metas.forEach((m: any) => {
          if (m?.id && m.id !== me.id) seen.set(m.id, { id: m.id, name: m.name, role: m.role });
        });
      });
      setOnlineUsers([...seen.values()]);
    };
    channel.on('presence', { event: 'sync' }, syncPresence);
    channel.on('presence', { event: 'join' }, syncPresence);
    channel.on('presence', { event: 'leave' }, syncPresence);

    channel.on('broadcast', { event: 'voice' }, ({ payload }) => {
      const p = payload as VoicePayload;
      if (!isForMe(p)) return;
      try {
        const bin = atob(p.audio);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: p.mime });
        const url = URL.createObjectURL(blob);
        if (!receivingRef.current) {
          receivingRef.current = true;
          playStatic();
        }
        queueRef.current.push(url);
        setIncoming(`${p.senderName} • ${ROLE_LABELS[p.senderRole]}`);
        playNext();
        // Acknowledge back to the sender that this device actually heard the call.
        channel.send({
          type: 'broadcast',
          event: 'ack',
          payload: { senderId: p.senderId, id: me.id, name: me.fullNameAr, role: me.role },
        });
      } catch { /* ignore malformed */ }
    });

    // Receive acks → record who heard MY transmission.
    channel.on('broadcast', { event: 'ack' }, ({ payload }) => {
      const a = payload as { senderId: string; id: string; name: string; role: Role };
      if (a.senderId !== me.id) return;
      setRecentListeners((prev) => {
        const others = prev.filter((l) => l.id !== a.id);
        return [...others, { id: a.id, name: a.name, role: a.role, at: Date.now() }];
      });
    });

    channel.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') {
        channel.track({ id: me.id, name: me.fullNameAr, role: me.role });
      }
    });
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [me, isForMe, playNext]);

  const broadcastSegment = useCallback(async (blob: Blob, mime: string) => {
    if (!me || !channelRef.current || blob.size === 0) return;
    const audio = await blobToBase64(blob);
    if (!audio) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'voice',
      payload: {
        senderId: me.id,
        senderName: me.fullNameAr,
        senderRole: me.role,
        target: targetRef.current,
        mime,
        audio,
      } satisfies VoicePayload,
    });
  }, [me]);

  const recordSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      await broadcastSegment(blob, rec.mimeType || mime || 'audio/webm');
      if (holdingRef.current) {
        recordSegment();
      } else {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    recRef.current = rec;
    rec.start();
    window.setTimeout(() => {
      if (rec.state !== 'inactive') rec.stop();
    }, SEGMENT_MS);
  }, [broadcastSegment]);

  const startTalking = useCallback(async () => {
    if (transmitting || !me) return;
    // New transmission → clear the "who heard me" list so it reflects this call.
    setRecentListeners([]);
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('المتصفح لا يدعم الميكروفون على هذا الجهاز');
      return;
    }
    if (!channelRef.current || !connected) {
      toast.error('جاري الاتصال بالقناة… حاول بعد لحظة');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      holdingRef.current = true;
      setTransmitting(true);
      recordSegment();
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        toast.error('تم رفض إذن الميكروفون — فعّله من إعدادات المتصفح');
      } else if (name === 'NotFoundError') {
        toast.error('لا يوجد ميكروفون متصل بالجهاز');
      } else {
        toast.error('تعذّر تشغيل الميكروفون');
      }
    }
  }, [transmitting, me, recordSegment, connected]);

  const stopTalking = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setTransmitting(false);
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop();
    }
  }, []);

  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch { /* noop */ }
  }, []);

  const toggleBackground = useCallback(() => {
    setBgEnabled((prev) => {
      const next = !prev;
      saveBool(LS_BG, next);
      if (next) {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
        acquireWakeLock();
      } else {
        try { wakeLockRef.current?.release?.(); } catch { /* noop */ }
        wakeLockRef.current = null;
      }
      return next;
    });
  }, [acquireWakeLock]);

  // Acquire the wake lock on mount when background mode is enabled (default).
  useEffect(() => {
    if (bgEnabled && me) acquireWakeLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // Re-acquire wake lock when the tab becomes visible again.
  useEffect(() => {
    const onVis = () => {
      if (bgEnabled && document.visibilityState === 'visible') acquireWakeLock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [bgEnabled, acquireWakeLock]);

  useEffect(() => {
    return () => {
      holdingRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try { wakeLockRef.current?.release?.(); } catch { /* noop */ }
    };
  }, []);

  return (
    <Ctx.Provider value={{
      connected, transmitting, incoming,
      target, setTarget,
      bgEnabled, toggleBackground,
      directorListening, setDirectorListening,
      isDirector,
      startTalking, stopTalking,
      onlineUsers, recentListeners,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWalkie() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWalkie must be used inside WalkieProvider');
  return ctx;
}
