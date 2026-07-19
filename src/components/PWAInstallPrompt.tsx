import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_DAYS = 7;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function recentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    // Skip inside Capacitor native shell.
    if ((window as any).Capacitor?.isNativePlatform?.()) return;

    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream;
    const isSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);

    if (isIOS && isSafari) {
      // iOS Safari doesn't fire beforeinstallprompt — show manual hint.
      const t = setTimeout(() => { setIosHint(true); setVisible(true); }, 1500);
      return () => clearTimeout(t);
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    const onInstalled = () => { setVisible(false); setDeferred(null); };
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-4 inset-x-3 md:inset-x-auto md:right-4 md:w-96 z-[100] bg-[#0d0d0d]/95 backdrop-blur border border-amber-500/30 rounded-2xl shadow-2xl shadow-black/60 p-4"
      dir="rtl"
    >
      <button
        onClick={dismiss}
        className="absolute top-2 left-2 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1a1a1a] flex items-center justify-center"
        aria-label="إغلاق"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pl-6">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-amber-400 mb-1">تثبيت منظومة الرصد</div>
          {iosHint ? (
            <div className="text-[12px] text-slate-300 leading-relaxed">
              لتثبيت التطبيق: اضغط زر المشاركة <Share className="inline w-3.5 h-3.5 mx-1 text-slate-200" /> ثم اختر
              <span className="text-amber-400 font-semibold"> "إضافة إلى الشاشة الرئيسية"</span>.
            </div>
          ) : (
            <>
              <div className="text-[12px] text-slate-400 mb-3">ثبّت التطبيق على شاشتك الرئيسية للعمل بكامل الشاشة وبتجربة أسرع.</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={install}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors"
                >
                  تثبيت الآن
                </button>
                <button
                  onClick={dismiss}
                  className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#232323] text-slate-300 hover:text-slate-100 text-xs"
                >
                  لاحقاً
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
