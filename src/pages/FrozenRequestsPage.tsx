import { useEffect, useMemo, useState } from 'react';
import { Lock, Check, X, Clock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useOps } from '../store/opsStore';
import { useOffices } from '../lib/offices';
import { api } from '../lib/api';
import type { FrozenFieldChangeRequest } from '../data/types';

type Tab = 'pending' | 'done' | 'mine';

function fmtVal(v: any): string {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const STATUS_META: Record<FrozenFieldChangeRequest['status'], { label: string; cls: string }> = {
  pending_supervisor: { label: 'بانتظار المشرف', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  pending_director:   { label: 'بانتظار المدير العام', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  approved:           { label: 'تمت الموافقة', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  rejected:           { label: 'مرفوض', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

export default function FrozenRequestsPage() {
  const { state } = useOps();
  const { officeById } = useOffices();
  const user = state.currentUser!;
  const role = user.role;
  const isDirector = role === 'director';
  const isSupervisor = role === 'supervisor';

  const [items, setItems] = useState<FrozenFieldChangeRequest[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setItems(await api.listFrozenRequests()); }
    catch (e: any) { toast.error(e?.message || 'فشل تحميل الطلبات'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (tab === 'mine') return items.filter(r => r.requestedById === user.id);
    if (tab === 'done') return items.filter(r => r.status === 'approved' || r.status === 'rejected');
    // pending
    return items.filter(r =>
      isDirector ? r.status === 'pending_director' :
      isSupervisor ? r.status === 'pending_supervisor' :
      false
    );
  }, [items, tab, user.id, isDirector, isSupervisor]);

  const approve = async (r: FrozenFieldChangeRequest) => {
    if (!isDirector && !isSupervisor) return;
    setBusyId(r.id);
    const t = toast.loading('جاري الموافقة...');
    try {
      await api.approveFrozenRequest(r.id, user.id, isDirector && r.status === 'pending_director' ? 'director' : 'supervisor');
      toast.success('تمت الموافقة', { id: t });
      await load();
    } catch (e: any) { toast.error(e?.message || 'فشل', { id: t }); }
    finally { setBusyId(null); }
  };

  const reject = async (r: FrozenFieldChangeRequest) => {
    const reason = prompt('سبب الرفض (اختياري):', '') ?? '';
    setBusyId(r.id);
    const t = toast.loading('جاري الرفض...');
    try {
      await api.rejectFrozenRequest(r.id, user.id, reason);
      toast.success('تم الرفض', { id: t });
      await load();
    } catch (e: any) { toast.error(e?.message || 'فشل', { id: t }); }
    finally { setBusyId(null); }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0d0d0d] p-3 md:p-5">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-300">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-display font-black text-blue-300">طلبات تعديل الحقول المجمّدة</div>
            <div className="text-xs text-slate-400 mt-0.5">
              الحقول المجمّدة تُدخل مرة واحدة وتُقفل. أي تعديل لاحق يتطلب موافقة المشرف ثم المدير العام.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#232323] rounded-lg p-1 mb-3 w-fit">
          {([
            { id: 'pending', label: isDirector ? 'بانتظار موافقتي' : isSupervisor ? 'بانتظار موافقتي' : 'قيد الانتظار', icon: Clock },
            { id: 'done', label: 'المنجزة', icon: ShieldCheck },
            { id: 'mine', label: 'طلباتي', icon: Lock },
          ] as { id: Tab; label: string; icon: any }[]).map(t => {
            const Icon = t.icon; const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${active ? 'bg-blue-500 text-black' : 'text-slate-400 hover:text-slate-200'}`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="text-center py-10 text-sm text-slate-500">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-[#232323] rounded-xl p-10 text-center text-sm text-slate-500">لا توجد طلبات</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => {
              const sm = STATUS_META[r.status];
              const off = officeById(r.officeId);
              const canAct = (r.status === 'pending_supervisor' && (isSupervisor || isDirector))
                          || (r.status === 'pending_director' && isDirector);
              return (
                <div key={r.id} className="bg-[#1a1a1a] border border-[#232323] rounded-xl p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-sm text-slate-100">{r.fieldLabelAr || r.fieldKey}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sm.cls}`}>{sm.label}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {off?.nameAr ?? r.officeId} • {r.requestedByName ?? '—'} • {new Date(r.createdAt).toLocaleString('en-GB', { hour12: false })}
                      </div>
                    </div>
                    {canAct && (
                      <div className="flex gap-1.5">
                        <button disabled={busyId === r.id} onClick={() => approve(r)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 disabled:opacity-50">
                          <Check className="w-3.5 h-3.5" /> موافقة
                        </button>
                        <button disabled={busyId === r.id} onClick={() => reject(r)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold hover:bg-red-500/25 disabled:opacity-50">
                          <X className="w-3.5 h-3.5" /> رفض
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    <div className="p-2 rounded-md bg-[#0d0d0d] border border-[#232323]">
                      <div className="text-[10px] text-slate-500 mb-1">القيمة الحالية</div>
                      <div className="text-xs text-slate-200 break-words" dir="auto">{fmtVal(r.currentValue)}</div>
                    </div>
                    <div className="p-2 rounded-md bg-[#0d0d0d] border border-blue-500/30">
                      <div className="text-[10px] text-blue-300 mb-1">القيمة المطلوبة</div>
                      <div className="text-xs text-slate-100 break-words" dir="auto">{fmtVal(r.requestedValue)}</div>
                    </div>
                  </div>

                  <div className="mt-2 p-2 rounded-md bg-[#0d0d0d] border border-[#232323]">
                    <div className="text-[10px] text-slate-500 mb-0.5">سبب الطلب</div>
                    <div className="text-xs text-slate-300 whitespace-pre-wrap">{r.reason}</div>
                  </div>

                  {r.status === 'rejected' && r.rejectionReason && (
                    <div className="mt-2 p-2 rounded-md bg-red-500/5 border border-red-500/30 text-xs text-red-300">
                      سبب الرفض: {r.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
