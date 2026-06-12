import { useOps } from '../store/opsStore';
import { AlertOctagon, X, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { officeById } from '../data/offices';

export default function EmergencyBanner() {
  const { state, dispatch } = useOps();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const active = state.emergencies
    .filter(e => e.status === 'active' && !dismissed.has(e.id))
    .slice(0, 1);

  if (active.length === 0) return null;
  const em = active[0];
  const office = officeById(em.officeId);
  const minutesAgo = Math.floor((Date.now() - new Date(em.createdAt).getTime()) / 60000);

  return (
    <div className="bg-gradient-to-l from-red-600 to-red-700 text-white px-4 py-2.5 flex items-center gap-3 animate-pulse-alert border-b border-red-400/30 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]" />
      </div>
      <div className="relative w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-ping-slow shrink-0">
        <AlertOctagon className="w-5 h-5" />
      </div>
      <div className="relative flex items-center gap-2 min-w-0 flex-1">
        <span className="font-display font-black text-sm shrink-0">حالة طارئة جديدة</span>
        <span className="text-white/80">|</span>
        <span className="text-sm truncate">{office?.nameAr} — {em.emergencyType}</span>
        <span className="text-white/80 hidden sm:inline">|</span>
        <span className="text-xs text-white/80 hidden sm:inline">منذ {minutesAgo} دقيقة</span>
      </div>
      <div className="relative flex items-center gap-1 shrink-0">
        <button className="px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 text-xs font-bold flex items-center gap-1 transition-colors">
          عرض التفاصيل
          <ChevronLeft className="w-3 h-3" />
        </button>
        <button
          onClick={() => setDismissed(d => new Set(d).add(em.id))}
          className="p-1 rounded-md hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
