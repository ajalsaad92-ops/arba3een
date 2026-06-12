import { useState } from 'react';
import { useOps } from '../store/opsStore';
import { OFFICES, officeById } from '../data/offices';
import { Clock, Check, X, ChevronRight, Timer, Unlock, Lock, Bell, AlertOctagon, Save } from 'lucide-react';
import { toast } from 'sonner';
import { relativeTime } from '../lib/utils';

export default function SupervisorPanelPage() {
  const { state, actions } = useOps();
  const user = state.currentUser!;
  const isDirector = user.role === 'director';
  const permittedIds = isDirector ? OFFICES.map(o => o.id) : user.permittedOfficeIds;

  const [openTime, setOpenTime] = useState(state.timeWindow.openTime);
  const [closeTime, setCloseTime] = useState(state.timeWindow.closeTime);

  const saveTimes = async () => {
    await actions.updateTimeWindow({ openTime, closeTime, isManuallyOpen: false, isManuallyClosed: false });
    toast.success('تم حفظ المواعيد');
  };

  const forwardExtension = async (id: string) => {
    await actions.updateExtension(id, { status: 'forwarded_to_supervisor', managerReviewedById: user.id, managerReviewedAt: new Date().toISOString() });
    toast.success('تم إحالة الطلب للمشرف العام');
  };

  const approveExtension = async (id: string) => {
    await actions.updateExtension(id, {
      status: 'approved',
      supervisorApprovedById: user.id,
      supervisorApprovedAt: new Date().toISOString(),
      extensionWindowEnd: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    toast.success('✅ تمت الموافقة — فتح نافذة 15 دقيقة');
  };

  const rejectExtension = async (id: string) => {
    await actions.updateExtension(id, { status: 'rejected' });
    toast.error('تم رفض طلب التمديد');
  };

  const handleForceOpen = async () => {
    await actions.updateTimeWindow({ isManuallyOpen: true, isManuallyClosed: false });
    toast.success('✅ تم فتح نافذة الإرسال يدوياً');
  };
  const handleForceClose = async () => {
    await actions.updateTimeWindow({ isManuallyOpen: false, isManuallyClosed: true });
    toast.success('🔒 تم إغلاق نافذة الإرسال يدوياً');
  };
  const handleAck = async (id: string) => { await actions.ackEmergency(id, user.id); toast.success('تم تأكيد الاستلام'); };
  const handleResolve = async (id: string) => { await actions.resolveEmergency(id); toast.success('✔ تم الحل'); };

  const officeReports = OFFICES.filter(o => permittedIds.includes(o.id)).map(o => ({
    office: o,
    report: state.todayReports.find(r => r.officeId === o.id),
  }));

  // H1: scope visible extensions to the user's permitted offices so a
  // manager doesn't see (and get confused by) requests from other offices
  // they can't act on. Directors still see everything.
  const visibleExtensions = isDirector
    ? state.extensions
    : state.extensions.filter(ex => permittedIds.includes(ex.officeId));

  return (
    <div className="h-full overflow-y-auto bg-[#0B0F19] p-3 md:p-5">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <div className="text-2xl font-display font-black text-amber-400">لوحة المشرف</div>
          <div className="text-xs text-slate-400 mt-1">إدارة نافذة الإرسال وطلبات التمديد</div>
        </div>

        {/* Time window card */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 glow-amber">
          <div className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> نافذة التقرير اليومي — {new Date().toLocaleDateString('ar-IQ')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">وقت الفتح</label>
              <input
                type="time"
                value={openTime}
                onChange={e => setOpenTime(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">وقت الإغلاق</label>
              <input
                type="time"
                value={closeTime}
                onChange={e => setCloseTime(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`px-2.5 py-1 rounded-md text-xs font-bold ${
              state.timeWindowStatus === 'open' ? 'bg-emerald-500/20 text-emerald-300' :
              state.timeWindowStatus === 'pre_warning' ? 'bg-amber-500/20 text-amber-300' :
              state.timeWindowStatus === 'locked' ? 'bg-red-500/20 text-red-300' :
              'bg-slate-700/30 text-slate-300'
            }`}>
              {state.timeWindowStatus === 'open' ? '🟢 مفتوحة' :
               state.timeWindowStatus === 'pre_warning' ? '🟡 تحذير' :
               state.timeWindowStatus === 'locked' ? '🔴 مغلقة' : '🔘 قبل الفتح'}
            </div>
            <div className="flex-1" />
            <button onClick={handleForceOpen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
              <Unlock className="w-3.5 h-3.5" /> فتح النافذة الآن
            </button>
            <button onClick={handleForceClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-bold">
              <Lock className="w-3.5 h-3.5" /> إغلاق النافذة الآن
            </button>
            <button onClick={saveTimes} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold">
              <Save className="w-3.5 h-3.5" /> حفظ المواعيد
            </button>
          </div>
        </div>

        {/* Extension requests */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
          <div className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
            <Timer className="w-4 h-4" /> طلبات التمديد
            {visibleExtensions.length > 0 && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">{visibleExtensions.length}</span>}
          </div>

          {visibleExtensions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">لا توجد طلبات تمديد حالياً</div>
          ) : (
            <div className="space-y-2">
              {visibleExtensions.map(ex => {
                const isOwnOffice = ex.officeId === user.officeId;
                const canReviewAsManager = user.role === 'manager' && isOwnOffice && ex.status === 'pending';
                const canReviewAsSupervisor = isDirector || (user.role === 'supervisor' && permittedIds.includes(ex.officeId) && ex.status === 'forwarded_to_supervisor');

                return (
                  <div key={ex.id} className="bg-[#0B0F19] border border-[#1E293B] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">{ex.requestedByName.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{ex.requestedByName}</div>
                        <div className="text-[10px] text-slate-500">{officeById(ex.officeId)?.nameAr} • {relativeTime(ex.requestTime)}</div>
                      </div>
                      <StatusBadge status={ex.status} />
                    </div>
                    {ex.reason && <div className="text-xs text-slate-300 bg-[#111827] border border-[#1E293B] rounded p-2 mb-2">السبب: {ex.reason}</div>}
                    {(canReviewAsManager || canReviewAsSupervisor) && (
                      <div className="flex gap-2 mt-2">
                        {canReviewAsManager && (
                          <button onClick={() => forwardExtension(ex.id)} className="flex-1 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1">
                            إحالة للمشرف <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {canReviewAsSupervisor && (
                          <>
                            <button onClick={() => approveExtension(ex.id)} className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                              <Check className="w-3 h-3" /> موافقة — 15 دقيقة
                            </button>
                            <button onClick={() => rejectExtension(ex.id)} className="flex-1 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                              <X className="w-3 h-3" /> رفض
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Submission overview */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
          <div className="text-sm font-bold text-amber-400 mb-3">حالة الإرسال — {permittedIds.length} مكتب</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {officeReports.map(({ office, report }) => {
              const submitted = !!report;
              const late = report?.isLateSubmission;
              return (
                <div key={office.id} className={`p-3 rounded-lg border ${
                  submitted ? (late ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30') : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {submitted ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                    <span className="text-sm font-semibold truncate flex-1">{office.nameAr}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {submitted
                      ? `${new Date(report!.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} ${late ? '(متأخر)' : ''}`
                      : 'لم يُرسل'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active emergencies */}
        {state.emergencies.filter(e => e.status !== 'resolved' && permittedIds.includes(e.officeId)).length > 0 && (
          <div className="bg-red-900/20 border border-red-500/40 rounded-xl p-4 glow-crimson">
            <div className="text-sm font-bold text-red-300 mb-3 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" /> حالات طارئة نشطة
            </div>
            <div className="space-y-2">
              {state.emergencies.filter(e => e.status !== 'resolved' && permittedIds.includes(e.officeId)).map(e => (
                <div key={e.id} className="bg-[#0B0F19] border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-sm font-semibold">{e.emergencyType}</span>
                    <span className="text-[10px] text-slate-500 mr-auto">{officeById(e.officeId)?.nameAr} • {relativeTime(e.createdAt)}</span>
                  </div>
                  <div className="text-xs text-slate-300">{e.description}</div>
                  <div className="flex gap-2 mt-2">
                    {e.status === 'active' && (
                      <button onClick={() => handleAck(e.id)} className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30">تأكيد الاستلام</button>
                    )}
                    <button onClick={() => handleResolve(e.id)} className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30">✔ تم الحل</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-slate-500/20 border-slate-500/40', text: 'text-slate-300', label: 'بانتظار المدير' },
    forwarded_to_supervisor: { bg: 'bg-amber-500/20 border-amber-500/40', text: 'text-amber-300', label: 'بانتظار المشرف' },
    approved: { bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-300', label: 'موافق عليه' },
    rejected: { bg: 'bg-red-500/20 border-red-500/40', text: 'text-red-300', label: 'مرفوض' },
  };
  const c = cfg[status];
  return <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${c.bg} ${c.text}`}>{c.label}</span>;
}
