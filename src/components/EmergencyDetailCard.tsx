import { createPortal } from 'react-dom';
import {
  X, AlertOctagon, MapPin, User, Clock, FileText, CheckCircle2,
  ShieldCheck, ExternalLink, Building2,
} from 'lucide-react';
import { officeById } from '../data/offices';
import { profileById } from '../store/opsStore';
import type { Emergency } from '../data/types';

const STATUS_META: Record<Emergency['status'], { label: string; cls: string; dot: string }> = {
  active: { label: 'نشطة', cls: 'bg-red-500/15 text-red-300 border-red-500/40', dot: 'bg-red-500 animate-pulse' },
  acknowledged: { label: 'تم الاستلام', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40', dot: 'bg-amber-500' },
  resolved: { label: 'تم الحل', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-500' },
};

function fmt(dt?: string) {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleString('ar-IQ', { hour12: false }); } catch { return dt; }
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-[#1E293B] last:border-0">
      <div className="w-7 h-7 rounded-lg bg-[#1E293B] flex items-center justify-center text-slate-400 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-slate-500 font-bold">{label}</div>
        <div className="text-sm text-slate-100 break-words">{value}</div>
      </div>
    </div>
  );
}

export default function EmergencyDetailCard({ emergency, onClose }: { emergency: Emergency; onClose: () => void }) {
  const em = emergency;
  const office = officeById(em.officeId);
  const meta = STATUS_META[em.status];
  const ackBy = em.acknowledgedById ? profileById(em.acknowledgedById)?.fullNameAr : undefined;
  const hasCoords = typeof em.lat === 'number' && typeof em.lng === 'number';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-md bg-[#0B0F19] border-2 border-red-500/40 rounded-2xl shadow-2xl glow-crimson overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 bg-gradient-to-l from-red-900/40 to-[#0B0F19] border-b border-red-500/30">
          <div className="w-11 h-11 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-display font-black text-red-200 truncate">{em.emergencyType}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto">
          <Row icon={<Building2 className="w-4 h-4" />} label="المكتب / المحافظة" value={`${office?.nameAr ?? em.officeId} — ${office?.governorateAr ?? ''}`} />
          <Row icon={<User className="w-4 h-4" />} label="مُبلِّغ الحالة" value={em.reportedByName || profileById(em.reportedById)?.fullNameAr || '—'} />
          <Row icon={<FileText className="w-4 h-4" />} label="الوصف التفصيلي" value={em.description || '—'} />
          <Row
            icon={<MapPin className="w-4 h-4" />}
            label="الموقع"
            value={
              <div className="space-y-1">
                {em.locationMgrs && <div className="font-mono text-xs">{em.locationMgrs}</div>}
                {hasCoords && (
                  <a
                    href={`https://www.google.com/maps?q=${em.lat},${em.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    {em.lat!.toFixed(5)}, {em.lng!.toFixed(5)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {!em.locationMgrs && !hasCoords && '—'}
              </div>
            }
          />
          <Row icon={<Clock className="w-4 h-4" />} label="وقت الإنشاء" value={fmt(em.createdAt)} />
          {em.acknowledgedAt && (
            <Row icon={<ShieldCheck className="w-4 h-4" />} label="تم الاستلام" value={`${fmt(em.acknowledgedAt)}${ackBy ? ` — ${ackBy}` : ''}`} />
          )}
          {em.resolvedAt && (
            <Row icon={<CheckCircle2 className="w-4 h-4" />} label="تم الحل" value={fmt(em.resolvedAt)} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
