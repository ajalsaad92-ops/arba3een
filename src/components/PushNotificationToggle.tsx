import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import {
  hasActivePushSubscription,
  isPushSupported,
  subscribeToPush,
  syncPushSubscriptionState,
  unsubscribeFromPush,
} from '@/lib/pushSubscription';

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await isPushSupported();
      if (cancelled) return;
      setSupported(ok);
      if (ok) {
        await syncPushSubscriptionState();
        const active = await hasActivePushSubscription();
        if (!cancelled) setSubscribed(active);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        const ok = await unsubscribeFromPush();
        if (ok) setSubscribed(false);
      } else {
        const ok = await subscribeToPush();
        if (ok) setSubscribed(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        جاري التحقق…
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="px-3 py-2 text-[11px] text-slate-500">
        المتصفّح لا يدعم إشعارات Push.
      </div>
    );
  }

  return (
    <button
      onClick={toggle}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-[#1E293B] rounded-lg transition-colors"
    >
      {subscribed ? (
        <>
          <BellOff className="w-3.5 h-3.5 text-amber-400" />
          <span>إيقاف إشعارات التطبيق المغلق</span>
        </>
      ) : (
        <>
          <Bell className="w-3.5 h-3.5 text-emerald-400" />
          <span>تفعيل إشعارات التطبيق المغلق</span>
        </>
      )}
    </button>
  );
}
