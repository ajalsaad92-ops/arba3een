import { useOps } from '../store/opsStore';
import { Clock, Lock, Unlock, AlertTriangle, Timer } from 'lucide-react';
import { useState, useEffect, type ReactNode } from 'react';
import { OFFICES } from '../data/offices';

interface Props { compact?: boolean; }

export default function TimeLockBar({ compact = false }: Props) {
  const { state, actions } = useOps();
  const { timeWindow, timeWindowStatus, serverTime, todayReports, extensions, currentUser } = state;
  const isSupervisorPlus = currentUser?.role === 'director' || currentUser?.role === 'supervisor';

  const [now, setNow] = useState(serverTime);
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const [oH, oM] = timeWindow.openTime.split(':').map(Number);
  const [cH, cM] = timeWindow.closeTime.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = oH * 60 + oM;
  const closeMin = cH * 60 + cM;

  let countdown = '';
  if (timeWindowStatus === 'closed') {
    const diff = openMin - nowMin;
    if (diff > 0) countdown = `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`;
  } else if (timeWindowStatus === 'open' || timeWindowStatus === 'pre_warning') {
    const diff = closeMin - nowMin;
    if (diff > 0) countdown = `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`;
  }

  const submittedCount = todayReports.length;
  const totalOffices = OFFICES.length;
  const unsubmitted = OFFICES.filter(o => !todayReports.find(r => r.officeId === o.id));

  const stateConfig: Record<string, { bg: string; border: string; text: string; icon: ReactNode; label: string; detail: string; pulse?: boolean }> = {
    closed: {
      bg: 'bg-slate-800/40',
      border: 'border-slate-600/40',
      text: 'text-slate-300',
      icon: <Lock className="w-3.5 h-3.5" />,
      label: 'نافذة الإغلاق',
      detail: `ستُفتح الساعة ${timeWindow.openTime}`,
    },
    open: {
      bg: 'bg-emerald-900/30',
      border: 'border-emerald-500/40',
      text: 'text-emerald-300',
      icon: <Unlock className="w-3.5 h-3.5" />,
      label: 'مفتوحة',
      detail: `متبقي ${countdown} دقيقة`,
    },
    pre_warning: {
      bg: 'bg-amber-900/30',
      border: 'border-amber-500/50',
      text: 'text-amber-300',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      label: 'تحذير — قبل الإغلاق',
      detail: `متبقي ${countdown} دقيقة`,
      pulse: true,
    },
    locked: {
      bg: 'bg-red-900/30',
      border: 'border-red-500/40',
      text: 'text-red-300',
      icon: <Lock className="w-3.5 h-3.5" />,
      label: 'مغلقة',
      detail: `مكاتب لم ترسل: ${unsubmitted.length}`,
    },
  };

  const cfg = stateConfig[timeWindowStatus];

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${cfg.bg} border ${cfg.border} ${cfg.pulse ? 'animate-pulse-alert' : ''} text-xs`}>
        <span className={cfg.text}>{cfg.icon}</span>
        <span className={`font-display font-bold ${cfg.text}`}>{cfg.label}</span>
        <span className="text-slate-400">•</span>
        <span className="text-slate-300">{cfg.detail}</span>
        <span className="text-slate-500 mx-1">|</span>
        <span className="text-slate-400">{submittedCount}/{totalOffices} مكتب</span>
        {extensions.filter(e => e.status === 'approved').length > 0 && (
          <span className="text-blue-300 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {extensions.filter(e => e.status === 'approved').length} تمديد
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`${cfg.bg} ${cfg.border} ${cfg.pulse ? 'animate-pulse-alert' : ''} border-r-4 px-4 py-3 flex items-center gap-3 flex-wrap`}>
      <div className={`flex items-center gap-2 ${cfg.text} font-bold text-sm`}>
        {cfg.icon}
        <span className="font-display">{cfg.label}</span>
      </div>
      <div className="text-slate-300 text-sm">{cfg.detail}</div>
      <div className="text-slate-500 text-xs flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {now.toLocaleTimeString('en-GB', { hour12: false })}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>تم الإرسال:</span>
        <span className="text-emerald-400 font-bold">{submittedCount}</span>
        <span>/</span>
        <span className="text-slate-300">{totalOffices}</span>
      </div>

      {extensions.filter(e => e.status === 'approved').length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs">
          <Timer className="w-3 h-3" />
          {extensions.filter(e => e.status === 'approved').length} تمديد نشط
        </div>
      )}

      {isSupervisorPlus && (timeWindowStatus === 'open' || timeWindowStatus === 'pre_warning') && (
        <button
          onClick={() => actions.updateTimeWindow({ isManuallyOpen: false, isManuallyClosed: true })}
          className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
        >
          إغلاق النافذة
        </button>
      )}
      {isSupervisorPlus && (timeWindowStatus === 'closed' || timeWindowStatus === 'locked') && (
        <button
          onClick={() => actions.updateTimeWindow({ isManuallyOpen: true, isManuallyClosed: false })}
          className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
        >
          فتح النافذة
        </button>
      )}
    </div>
  );
}
