import { useState, useMemo } from 'react';
import { useOps } from '../store/opsStore';
import { useOffices } from '../lib/offices';
import { Clock, Check, X, Timer, Unlock, Lock, Bell, AlertOctagon, Save } from 'lucide-react';
import { toast } from 'sonner';
import { relativeTime } from '../lib/utils';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/FormField';

export default function SupervisorPanelPage() {
  const { state, actions, dispatch } = useOps();
  const { offices, officeById } = useOffices();
  const user = state.currentUser!;
  const isDirector = user.role === 'director';
  const permittedIds = isDirector ? offices.map(o => o.id) : user.permittedOfficeIds;

  const [openTime, setOpenTime] = useState(state.timeWindow.openTime);
  const [closeTime, setCloseTime] = useState(state.timeWindow.closeTime);
  const [saving, setSaving] = useState(false);
  const [timeError, setTimeError] = useState('');

  const validateTimes = (open: string, close: string) => {
    if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) { setTimeError('صيغة الوقت غير صحيحة'); return false; }
    const [oh, om] = open.split(':').map(Number);
    const [ch, cm] = close.split(':').map(Number);
    if (oh < 0 || oh > 23 || om < 0 || om > 59 || ch < 0 || ch > 23 || cm < 0 || cm > 59) { setTimeError('وقت غير صالح'); return false; }
    const openMin = oh*60+om; const closeMin = ch*60+cm;
    if (closeMin <= openMin) { setTimeError('وقت الإغلاق يجب أن يكون بعد الفتح'); return false; }
    if (closeMin - openMin < 15) { setTimeError('النافذة يجب أن تكون 15 دقيقة على الأقل'); return false; }
    setTimeError(''); return true;
  };

  const saveTimes = async () => {
    if (!validateTimes(openTime, closeTime)) { toast.error(timeError || 'تحقق من المواعيد'); return; }
    setSaving(true);
    try {
      const updated = await actions.updateTimeWindow({ openTime, closeTime, isManuallyOpen: false, isManuallyClosed: false });
      dispatch({ type: 'SET_TIME_WINDOW', window: updated });
      toast.success('تم حفظ المواعيد');
    } catch (e:any) { toast.error(e?.message || 'فشل الحفظ'); }
    finally { setSaving(false); }
  };

  const forwardExtension = async (id: string) => {
    try {
      await actions.updateExtension(id, { status: 'forwarded_to_supervisor', managerReviewedById: user.id, managerReviewedAt: new Date().toISOString() });
      dispatch({ type: 'UPDATE_EXTENSION', id, patch: { status: 'forwarded_to_supervisor', managerReviewedById: user.id } });
      toast.success('تم إحالة الطلب للمشرف العام');
    } catch (e:any) { toast.error(e?.message || 'فشل الإحالة'); }
  };
  const approveExtension = async (id: string) => {
    try {
      const windowEnd = new Date(Date.now() + 15 * 60_000).toISOString();
      await actions.updateExtension(id, { status: 'approved', supervisorApprovedById: user.id, supervisorApprovedAt: new Date().toISOString(), extensionWindowEnd: windowEnd });
      dispatch({ type: 'UPDATE_EXTENSION', id, patch: { status: 'approved', supervisorApprovedById: user.id, extensionWindowEnd: windowEnd } });
      toast.success('✅ تمت الموافقة — فتح نافذة 15 دقيقة');
    } catch (e:any) { toast.error(e?.message || 'فشل الموافقة'); }
  };
  const rejectExtension = async (id: string) => {
    try {
      await actions.updateExtension(id, { status: 'rejected' });
      dispatch({ type: 'UPDATE_EXTENSION', id, patch: { status: 'rejected' } });
      toast.error('تم رفض طلب التمديد');
    } catch (e:any) { toast.error(e?.message || 'فشل الرفض'); }
  };

  const handleForceOpen = async () => {
    try {
      const updated = await actions.updateTimeWindow({ isManuallyOpen: true, isManuallyClosed: false });
      dispatch({ type: 'SET_TIME_WINDOW', window: updated });
      toast.success('تم فتح النافذة يدوياً');
    } catch (e:any) { toast.error(e?.message || 'فشل'); }
  };
  const handleForceClose = async () => {
    try {
      const updated = await actions.updateTimeWindow({ isManuallyOpen: false, isManuallyClosed: true });
      dispatch({ type: 'SET_TIME_WINDOW', window: updated });
      toast.success('تم إغلاق النافذة يدوياً');
    } catch (e:any) { toast.error(e?.message || 'فشل'); }
  };
  const handleAck = async (id: string) => {
    try { await actions.ackEmergency(id, user.id); dispatch({ type: 'ACK_EMERGENCY', id, userId: user.id }); toast.success('تم تأكيد الاستلام'); }
    catch (e:any) { toast.error(e?.message || 'فشل'); }
  };
  const handleResolve = async (id: string) => {
    const uid = state.currentUser?.id;
    try { await actions.resolveEmergency(id, uid); dispatch({ type: 'RESOLVE_EMERGENCY', id, userId: uid }); toast.success('تم الحل'); }
    catch (e:any) { toast.error(e?.message || 'فشل'); }
  };

  const officeReports = useMemo(() => offices.filter(o => permittedIds.includes(o.id)).map(o => ({
    office: o, report: state.todayReports.find(r => r.officeId === o.id)
  })), [offices, permittedIds, state.todayReports]);

  const visibleExtensions = isDirector ? state.extensions : state.extensions.filter(ex => permittedIds.includes(ex.officeId));
  const activeEmergencies = state.emergencies.filter(e => e.status !== 'resolved' && permittedIds.includes(e.officeId));

  return (
    <div className="h-full overflow-y-auto bg-[#0B0F19] p-3 md:p-5" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <div className="text-2xl font-display font-black text-amber-400">لوحة المشرف</div>
          <div className="text-xs text-slate-400 mt-1">إدارة نافذة الإرسال وطلبات التمديد والطوارئ</div>
        </div>

        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
          <div className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> نافذة التقرير اليومي</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <FormField label="وقت الفتح" error={timeError && timeError.includes('الفتح') ? timeError : undefined} id="tw-open">
              <input id="tw-open" type="time" value={openTime}
                onChange={e=>{ setOpenTime(e.target.value); validateTimes(e.target.value, closeTime); }}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/40 focus:outline-none" />
            </FormField>
            <FormField label="وقت الإغلاق" error={timeError && !timeError.includes('الفتح') ? timeError : undefined} id="tw-close">
              <input id="tw-close" type="time" value={closeTime}
                onChange={e=>{ setCloseTime(e.target.value); validateTimes(openTime, e.target.value); }}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/40 focus:outline-none" />
            </FormField>
          </div>
          {timeError && <div className="text-[11px] text-red-400 mb-3">{timeError}</div>}
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`px-2.5 py-1 rounded-md text-xs font-bold ${
              state.timeWindowStatus==='open' ? 'bg-emerald-500/20 text-emerald-300' :
              state.timeWindowStatus==='pre_warning' ? 'bg-amber-500/20 text-amber-300' :
              state.timeWindowStatus==='locked' ? 'bg-red-500/20 text-red-300' :
              'bg-slate-700/30 text-slate-300'
            }`}>
              {state.timeWindowStatus==='open' ? '🟢 مفتوحة' :
               state.timeWindowStatus==='pre_warning' ? '🟡 تحذير' :
               state.timeWindowStatus==='locked' ? '🔴 مغلقة' : '⏳ مغلقة'}
            </div>
            <div className="flex-1" />
            <button onClick={handleForceOpen} className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1">
              <Unlock className="w-3.5 h-3.5" /> فتح يدوي
            </button>
            <button onClick={handleForceClose} className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> إغلاق يدوي
            </button>
            <button onClick={saveTimes} disabled={!!timeError || saving}
              className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold flex items-center gap-1">
              <Save className="w-3.5 h-3.5" /> {saving ? 'جاري الحفظ…' : 'حفظ المواعيد'}
            </button>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
          <div className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
            <Timer className="w-4 h-4" /> طلبات التمديد
            {!!visibleExtensions.length && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">{visibleExtensions.length}</span>}
          </div>
          {!visibleExtensions.length ? (
            <EmptyState title="لا توجد طلبات تمديد" description="ستظهر هنا طلبات المكاتب عند انتهاء نافذة الإرسال" />
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {visibleExtensions.map(ex => {
                const isOwnOffice = ex.officeId === user.officeId;
                const canReviewAsManager = user.role === 'manager' && isOwnOffice && ex.status === 'pending';
                const canReviewAsSupervisor = isDirector || (user.role === 'supervisor' && permittedIds.includes(ex.officeId) && ex.status === 'forwarded_to_supervisor');
                return (
                  <div key={ex.id} className="bg-[#0B0F19] border border-[#1E293B] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold text-sm">{ex.requestedByName.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{ex.requestedByName}</div>
                        <div className="text-[10px] text-slate-400">{officeById(ex.officeId)?.nameAr} • {relativeTime(ex.requestTime)}</div>
                      </div>
                      <StatusBadge status={ex.status} />
                    </div>
                    {ex.reason && <div className="text-xs text-slate-300 bg-[#111827] border border-[#1E293B] rounded p-2 mb-2">{ex.reason}</div>}
                    {(canReviewAsManager || canReviewAsSupervisor) && (
                      <div className="flex gap-2">
                        {canReviewAsManager && (
                          <button onClick={()=>forwardExtension(ex.id)} className="flex-1 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold">إحالة للمشرف →</button>
                        )}
                        {canReviewAsSupervisor && (
                          <>
                            <button onClick={()=>approveExtension(ex.id)} className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1"><Check className="w-3 h-3" /> موافقة 15د</button>
                            <button onClick={()=>rejectExtension(ex.id)} className="flex-1 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1"><X className="w-3 h-3" /> رفض</button>
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

        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
          <div className="text-sm font-bold text-amber-400 mb-3">حالة الإرسال — {permittedIds.length} مكتب</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[340px] overflow-y-auto pr-1">
            {officeReports.map(({ office, report }) => {
              const submitted = !!report;
              const late = report?.isLateSubmission;
              return (
                <div key={office.id} className={`p-3 rounded-lg border text-xs ${
                  submitted ? (late ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30') : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {submitted ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                    <span className="font-semibold truncate flex-1">{office.nameAr}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {submitted ? `${new Date(report!.submittedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} ${late ? '(متأخر)' : ''}` : 'لم يُرسل'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {activeEmergencies.length > 0 && (
          <div className="bg-red-900/15 border border-red-500/30 rounded-xl p-4">
            <div className="text-sm font-bold text-red-300 mb-3 flex items-center gap-2"><AlertOctagon className="w-4 h-4" /> طوارئ نشطة ({activeEmergencies.length})</div>
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {activeEmergencies.map((e:any)=>(
                <div key={e.id} className="bg-[#0B0F19] border border-red-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-sm font-bold">{e.emergencyType}</span>
                    <span className="text-[10px] text-slate-500 mr-auto">{officeById(e.officeId)?.nameAr} • {relativeTime(e.createdAt)}</span>
                  </div>
                  <div className="text-xs text-slate-300">{e.description}</div>
                  <div className="flex gap-2 mt-2">
                    {e.status === 'active' && <button onClick={()=>handleAck(e.id)} className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">تأكيد الاستلام</button>}
                    <button onClick={()=>handleResolve(e.id)} className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">تم الحل</button>
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
  const cfg: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30', label: 'بانتظار المدير' },
    forwarded_to_supervisor: { cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30', label: 'بانتظار المشرف' },
    approved: { cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', label: 'موافق عليه' },
    rejected: { cls: 'bg-red-500/20 text-red-300 border-red-500/30', label: 'مرفوض' },
  };
  const c = cfg[status] ?? cfg.pending;
  return <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${c.cls}`}>{c.label}</span>;
}
