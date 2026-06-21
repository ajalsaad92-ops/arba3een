import { useEffect, useState } from 'react';
import { Bell, MapPin, Vibrate, Volume2, X, Shield } from 'lucide-react';
import { useOps } from '../store/opsStore';
import {
  fireAlert,
  requestGeolocationPermission,
  requestNotificationPermission,
  testVibration,
  unlockAudio,
} from '../lib/notify';
import { requestAllNativePermissions, isNative } from '../lib/nativePermissions';

const STORAGE_KEY = 'ops:perms-granted-v2';

/**
 * On first login, shows a single modal that asks for Notifications + Location
 * and unlocks audio/vibration. All requests are bound to a real user click so
 * mobile browsers (iOS Safari, Android Chrome) actually grant them.
 */
export function ToastPermissions() {
  const { state } = useOps();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state.currentUser) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [state.currentUser]);

  if (!state.currentUser || !open) return null;

  const close = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  const enableAll = async () => {
    setBusy(true);
    try {
      // Audio must unlock inside this click handler for iOS
      unlockAudio();
      // Vibration test (Android)
      testVibration();
      // Notifications — must be from gesture
      const np = await requestNotificationPermission();
      // Geolocation
      await requestGeolocationPermission();
      // Confirm with a real alert so the user hears + feels it now
      fireAlert('report', 'تم تفعيل الإشعارات', np === 'granted'
        ? 'سوف تصلك التنبيهات الفورية مع الصوت والاهتزاز.'
        : 'تم تفعيل الصوت والاهتزاز. يمكن تفعيل إشعارات النظام من إعدادات المتصفح.');
    } finally {
      setBusy(false);
      close();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3" dir="rtl">
      <div className="w-full max-w-md bg-[#0F172A] border border-[#1E293B] rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-[#1E293B] flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-slate-100 font-display">تفعيل التنبيهات الفورية</div>
            <div className="text-[11px] text-slate-500">صوت + اهتزاز + إشعارات النظام</div>
          </div>
          <button onClick={close} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-sm">
          <Row icon={<Bell className="w-4 h-4" />} title="إشعارات النظام" desc="تنبيهات الطوارئ والتمديد فور وصولها — حتى لو كان التطبيق في الخلفية." />
          <Row icon={<Volume2 className="w-4 h-4" />} title="الصوت" desc="نغمة تنبيه واضحة لكل نوع (طارئ، تمديد، تقرير)." />
          <Row icon={<Vibrate className="w-4 h-4" />} title="الاهتزاز" desc="اهتزاز قوي على الموبايل عند وصول حالة طارئة." />
          <Row icon={<MapPin className="w-4 h-4" />} title="الموقع الجغرافي" desc="تسجيل موقع التقرير تلقائياً وعرضه على الخريطة." />
        </div>

        <div className="p-4 border-t border-[#1E293B] flex gap-2">
          <button
            onClick={close}
            className="flex-1 px-3 py-2.5 rounded-lg bg-[#1E293B] text-slate-300 text-sm hover:bg-[#263244] transition-colors"
          >
            لاحقاً
          </button>
          <button
            onClick={enableAll}
            disabled={busy}
            className="flex-[2] px-3 py-2.5 rounded-lg bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 transition-colors disabled:opacity-60"
          >
            {busy ? 'جارٍ التفعيل…' : 'تفعيل الكل الآن'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#111827] border border-[#1E293B] flex items-center justify-center text-amber-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-slate-200 text-[13px]">{title}</div>
        <div className="text-[11px] text-slate-500 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}
