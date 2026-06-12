import { useEffect, useRef, useState, useCallback } from 'react';
import { useOps } from '../store/opsStore';
import { supabase } from '../lib/supabase';
import { Radio, Mic, Users, ChevronDown, Volume2, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Role } from '../data/types';

const SEGMENT_MS = 2200; // length of each streamed audio segment

type TargetMode = 'all' | 'role' | 'user';
type Target = { mode: TargetMode; value?: string };

type VoicePayload = {
  senderId: string;
  senderName: string;
  senderRole: Role;
  target: Target;
  mime: string;
  audio: string; // base64 (without data: prefix)
};

const ROLE_LABELS: Record<Role, string> = {
  director: 'المدراء العامون',
  supervisor: 'المشرفون',
  manager: 'مدراء المكاتب',
  agent: 'المندوبون',
};

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

export default function WalkieTalkie() {
  const { state } = useOps();
  const me = state.currentUser;

  const [target, setTarget] = useState<Target>({ mode: 'all' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [transmitting, setTransmitting] = useState(false);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [bgEnabled, setBgEnabled] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const holdingRef = useRef(false);
  const wakeLockRef = useRef<any>(null);

  // Sequential playback queue for received segments
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);

  const playNext = useCallback(() => {
    if (playingRef.current) return;
    const url = queueRef.current.shift();
    if (!url) { setIncoming(null); return; }
    playingRef.current = true;
    const audio = new Audio(url);
    audio.onended = audio.onerror = () => {
      URL.revokeObjectURL(url);
      playingRef.current = false;
      playNext();
    };
    audio.play().catch(() => {
      playingRef.current = false;
      playNext();
    });
  }, []);

  const isForMe = useCallback((p: VoicePayload): boolean => {
    if (!me) return false;
    if (p.senderId === me.id) return false;
    if (p.target.mode === 'all') return true;
    if (p.target.mode === 'role') return me.role === p.target.value;
    if (p.target.mode === 'user') return me.id === p.target.value;
    return false;
  }, [me]);

  // Subscribe to the shared walkie-talkie channel
  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel('walkie-talkie', {
      config: { broadcast: { self: false } },
    });
    channel.on('broadcast', { event: 'voice' }, ({ payload }) => {
      const p = payload as VoicePayload;
      if (!isForMe(p)) return;
      try {
        const bin = atob(p.audio);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: p.mime });
        const url = URL.createObjectURL(blob);
        queueRef.current.push(url);
        setIncoming(`${p.senderName} • ${ROLE_LABELS[p.senderRole]}`);
        playNext();
      } catch { /* ignore malformed */ }
    });
    channel.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
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
        target,
        mime,
        audio,
      } satisfies VoicePayload,
    });
  }, [me, target]);

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
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('المايكروفون غير مدعوم في هذا المتصفح');
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
    } catch {
      toast.error('تعذّر الوصول للمايكروفون — تأكد من منح الإذن');
    }
  }, [transmitting, me, recordSegment]);

  const stopTalking = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setTransmitting(false);
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop(); // flush final segment
    }
  }, []);

  // Background mode: wake lock + notification permission
  const toggleBackground = useCallback(async () => {
    if (bgEnabled) {
      try { await wakeLockRef.current?.release?.(); } catch { /* noop */ }
      wakeLockRef.current = null;
      setBgEnabled(false);
      toast.info('تم إيقاف وضع العمل بالخلفية');
      return;
    }
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
      setBgEnabled(true);
      toast.success('تم تفعيل وضع العمل بالخلفية — سيبقى الاستقبال نشطاً');
    } catch {
      toast.error('تعذّر تفعيل وضع الخلفية في هذا المتصفح');
    }
  }, [bgEnabled]);

  // Re-acquire wake lock when tab becomes visible again
  useEffect(() => {
    const onVis = async () => {
      if (bgEnabled && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch { /* noop */ }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [bgEnabled]);

  useEffect(() => {
    return () => {
      holdingRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try { wakeLockRef.current?.release?.(); } catch { /* noop */ }
    };
  }, []);

  const targetLabel = (() => {
    if (target.mode === 'all') return 'الجميع المتصلون';
    if (target.mode === 'role') return ROLE_LABELS[target.value as Role] ?? 'مجموعة';
    const u = state.users.find((x) => x.id === target.value);
    return u ? u.fullNameAr : 'شخص محدد';
  })();

  return (
    <div className="bg-gradient-to-br from-indigo-950/40 to-[#0B0F19] border-2 border-indigo-500/30 rounded-2xl p-5 md:p-6 mt-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
          <Radio className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="text-lg font-display font-black text-indigo-200">اتصال صوتي مباشر (لاسلكي)</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            {connected
              ? <><Wifi className="w-3 h-3 text-emerald-400" /> متصل بالقناة</>
              : <><WifiOff className="w-3 h-3 text-slate-500" /> جاري الاتصال...</>}
          </div>
        </div>
      </div>

      {/* Recipient picker */}
      <div className="relative mb-4">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-3 text-sm text-white hover:border-indigo-500/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-300" />
            <span className="text-slate-300">المستلِم:</span>
            <span className="font-bold">{targetLabel}</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
        </button>

        {pickerOpen && (
          <div className="absolute z-20 mt-1 w-full bg-[#111827] border border-[#1E293B] rounded-lg shadow-2xl max-h-72 overflow-y-auto p-1 animate-fade-in-up">
            <button
              onClick={() => { setTarget({ mode: 'all' }); setPickerOpen(false); }}
              className="w-full text-right px-3 py-2 rounded-md text-sm text-slate-200 hover:bg-indigo-500/15"
            >
              📢 الجميع المتصلون
            </button>
            <div className="px-3 pt-2 pb-1 text-[10px] text-slate-500 font-bold">حسب الصلاحية</div>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => { setTarget({ mode: 'role', value: r }); setPickerOpen(false); }}
                className="w-full text-right px-3 py-2 rounded-md text-sm text-slate-200 hover:bg-indigo-500/15"
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
            <div className="px-3 pt-2 pb-1 text-[10px] text-slate-500 font-bold">شخص محدد</div>
            {state.users.filter((u) => u.id !== me?.id).map((u) => (
              <button
                key={u.id}
                onClick={() => { setTarget({ mode: 'user', value: u.id }); setPickerOpen(false); }}
                className="w-full text-right px-3 py-2 rounded-md text-sm text-slate-200 hover:bg-indigo-500/15 flex items-center justify-between"
              >
                <span>{u.fullNameAr}</span>
                <span className="text-[10px] text-slate-500">{ROLE_LABELS[u.role]}</span>
              </button>
            ))}
            {state.users.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500">لا يوجد مستخدمون آخرون</div>
            )}
          </div>
        )}
      </div>

      {/* Incoming indicator */}
      {incoming && (
        <div className="mb-3 flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 animate-fade-in-up">
          <Volume2 className="w-4 h-4 animate-pulse" />
          <span>يتحدث الآن: <b>{incoming}</b></span>
        </div>
      )}

      {/* Push to talk */}
      <button
        type="button"
        disabled={!connected}
        onMouseDown={startTalking}
        onMouseUp={stopTalking}
        onMouseLeave={stopTalking}
        onTouchStart={(e) => { e.preventDefault(); startTalking(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopTalking(); }}
        className={`w-full py-6 rounded-2xl font-display font-black text-base transition-all flex flex-col items-center justify-center gap-2 select-none touch-none disabled:opacity-40 ${
          transmitting
            ? 'bg-gradient-to-l from-red-600 to-red-700 text-white shadow-xl shadow-red-500/40 scale-[0.98] animate-pulse-alert'
            : 'bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-xl shadow-indigo-500/30'
        }`}
      >
        <Mic className={`w-8 h-8 ${transmitting ? 'animate-pulse' : ''}`} />
        {transmitting ? 'جارٍ الإرسال... اترك للإيقاف' : 'اضغط مع الاستمرار للتحدث'}
      </button>
      <p className="text-center text-[10px] text-slate-500 mt-2">
        يصل الصوت مباشرة لكل من تختاره ممن لديه التطبيق مفتوحاً
      </p>

      {/* Background mode */}
      <button
        type="button"
        onClick={toggleBackground}
        className={`w-full mt-3 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 border ${
          bgEnabled
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            : 'bg-[#1E293B] border-[#263244] text-slate-400 hover:text-slate-200'
        }`}
      >
        {bgEnabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
        {bgEnabled ? 'وضع العمل بالخلفية مُفعّل' : 'تفعيل العمل بالخلفية (إبقاء الاستقبال نشطاً)'}
      </button>
    </div>
  );
}
