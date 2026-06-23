import { useState } from 'react';
import { useOps, useEmergencies } from '../store/opsStore';

import { AlertOctagon, MapPin, Send, Crosshair, Check, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import WalkieTalkie from '../components/WalkieTalkie';
import EmergencyDetailCard from '../components/EmergencyDetailCard';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/FormField';
import type { Emergency } from '../data/types';
import { validateText, validateMGRS, validateLatLng } from '../lib/validation';
import { useRateLimit } from '../hooks/useUtils';

const EMERGENCY_TYPES = [
  'بحاجة عجلات مياه إضافية',
  'بحاجة دعم طبي عاجل',
  'حادث أمني',
  'نقص إمداد غذائي',
  'خلل في البنية التحتية',
  'حريق أو كارثة',
  'أخرى (مع وصف مفصل)',
];

export default function EmergencyPage() {
  const { state, actions, dispatch } = useOps();
  const emergencies = useEmergencies();
  

  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [mgrs, setMgrs] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailEm, setDetailEm] = useState<Emergency | null>(null);
  const [errors, setErrors] = useState<Record<string,string>>({});

  const canSubmitRate = useRateLimit();

  const validate = () => {
    const e: Record<string,string> = {};
    if (!type) e.type = 'اختر نوع الحالة';
    const dErr = validateText(description, { min: 20, max: 2000, label: 'الوصف' });
    if (dErr) e.description = dErr;
    const mErr = validateMGRS(mgrs, false);
    if (mErr) e.mgrs = mErr;
    const locErr = validateLatLng(coords?.lat, coords?.lng, !mgrs);
    if (locErr) e.location = locErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLocate = () => {
    setLocating(true);
    if (!navigator.geolocation) { toast.error('الموقع غير مدعوم'); setLocating(false); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success('تم تحديد موقعك'); setLocating(false); setErrors(s => { const n = {...s}; delete n.location; return n; }); },
      () => { toast.error('فشل تحديد الموقع'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async () => {
    if (!validate()) { toast.error('صحّح الأخطاء أولاً'); return; }
    if (!canSubmitRate('emergency-submit', 10000)) { toast.error('الرجاء الانتظار 10 ثوانٍ قبل إرسال بلاغ آخر'); return; }
    setSubmitting(true);
    const user = state.currentUser!;
    const emergency: Emergency = {
      id: `em-${Date.now()}`,
      reportedById: user.id,
      reportedByName: user.fullNameAr,
      officeId: user.officeId,
      emergencyType: type,
      description: description.trim(),
      locationMgrs: mgrs || undefined,
      lat: coords?.lat, lng: coords?.lng,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    try {
      await actions.submitEmergency(emergency);
      toast.success('🚨 تم إرسال الحالة الطارئة', { description: 'تم تنبيه المدير والمشرف' });
      setType(''); setDescription(''); setMgrs(''); setCoords(null); setErrors({});
    } catch (e: any) {
      toast.error(e?.message || 'فشل إرسال الحالة الطارئة');
    } finally { setSubmitting(false); }
  };

  const handleAck = async (id: string) => {
    if (!state.currentUser) return;
    dispatch({ type: 'ACK_EMERGENCY', id, userId: state.currentUser.id });
    try { await actions.ackEmergency(id, state.currentUser.id); toast.success('تم تأكيد الاستلام'); }
    catch { toast.error('فشل تأكيد الاستلام'); /* rollback: reload */ }
  };
  const handleResolve = async (id: string) => {
    const uid = state.currentUser?.id;
    dispatch({ type: 'RESOLVE_EMERGENCY', id, userId: uid });
    try { await actions.resolveEmergency(id, uid); toast.success('✔ تم وضع الحالة كمنجزة'); }
    catch { toast.error('فشل وضع الحالة كمنجزة'); }
  };

  const descLen = description.length;
  const descCountColor = descLen < 20 ? 'text-red-400' : descLen > 1800 ? 'text-amber-400' : 'text-slate-500';

  return (
    <div className="h-full overflow-y-auto bg-[#0B0F19] p-3 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-red-900/20 to-[#0B0F19] border-2 border-red-500/30 rounded-2xl p-5 md:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <div className="text-2xl font-display font-black text-red-300">نموذج الحالات الطارئة</div>
              <div className="text-xs text-slate-400">إرسال فوري للمشرف العام والمدير العام</div>
            </div>
          </div>

          <div className="space-y-4">
            <FormField label="نوع الحالة الطارئة" required error={errors.type} id="em-type">
              <select
                id="em-type"
                value={type}
                onChange={e => { setType(e.target.value); if (errors.type) setErrors(s => { const n={...s}; delete n.type; return n; }); }}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-3 text-sm text-white focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20"
              >
                <option value="">— اختر نوع الحالة —</option>
                {EMERGENCY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>

            <FormField
              label="الوصف التفصيلي"
              required
              error={errors.description}
              hint="اشرح الحالة بتفاصيل كافية للمعالجة الفورية"
              id="em-desc"
              counter={{ current: descLen, max: 2000 }}
            >
              <textarea
                id="em-desc"
                value={description}
                onChange={e => { setDescription(e.target.value.slice(0,2000)); if (errors.description) setErrors(s=>{const n={...s}; delete n.description; return n;}); }}
                placeholder="اشرح الحالة بتفاصيل كافية..."
                className="w-full bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-3 text-sm text-white placeholder-slate-500 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 min-h-32 resize-none"
                aria-describedby={errors.description ? "em-desc-error" : undefined}
              />
              <div className={`text-[10px] mt-1 ${descCountColor}`} aria-live="polite">{descLen} حرف — الحد الأدنى 20</div>
            </FormField>

            <FormField label="الموقع" error={errors.location || errors.mgrs} hint="GPS أو MGRS — أحدهما يكفي" id="em-loc">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={locating}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-sm font-bold hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                >
                  {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                  {locating ? 'جاري التحديد...' : 'تحديد الموقع تلقائياً'}
                </button>
                <input
                  value={mgrs}
                  onChange={e => { setMgrs(e.target.value); if (errors.mgrs) setErrors(s=>{const n={...s}; delete n.mgrs; return n;}); }}
                  placeholder="MGRS يدوياً (اختياري)"
                  maxLength={30}
                  dir="ltr"
                  className="bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-red-500/40 focus:outline-none text-left"
                />
              </div>
              {coords && (
                <div className="mt-2 text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-2 flex items-center gap-2">
                  <MapPin className="w-3 h-3" /> تم تحديد الموقع: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </div>
              )}
            </FormField>

            <button
              onClick={handleSubmit}
              disabled={submitting || Object.keys(errors).length > 0}
              className="w-full py-4 rounded-xl bg-gradient-to-l from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-display font-black text-base transition-all shadow-xl shadow-red-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {submitting ? 'جاري الإرسال...' : '🚨 إرسال طارئ فوري'}
            </button>
          </div>
        </div>

        <WalkieTalkie />

        <div className="mt-5">
          <div className="text-sm font-bold text-slate-300 mb-3">الحالات الطارئة الأخيرة</div>
          {emergencies.length === 0 ? (
            <EmptyState title="لا توجد حالات طارئة" description="ستظهر هنا البلاغات الواردة من الميدان" />
          ) : (
          <div className="space-y-2">
            {emergencies.slice(0, 8).map(em => (
              <div key={em.id} className="bg-[#111827] border border-[#1E293B] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${
                    em.status === 'active' ? 'bg-red-500 animate-pulse' :
                    em.status === 'acknowledged' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span className="text-sm font-bold text-slate-200">{em.emergencyType}</span>
                  <span className="text-[10px] text-slate-500 mr-auto">{new Date(em.createdAt).toLocaleString('ar-IQ')}</span>
                  <button onClick={() => setDetailEm(em)} className="shrink-0 p-1.5 rounded-md bg-white/5 hover:bg-white/15 text-slate-300">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-slate-400 line-clamp-2">{em.description}</div>
                {(state.currentUser?.role === 'director' || state.currentUser?.role === 'supervisor') && (
                  <div className="flex gap-2 mt-2">
                    {em.status === 'active' && (
                      <button onClick={() => handleAck(em.id)} className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30">
                        تأكيد الاستلام
                      </button>
                    )}
                    {em.status !== 'resolved' && (
                      <button onClick={() => handleResolve(em.id)} className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30">
                        <Check className="w-3 h-3 inline ml-1" /> تم الحل
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
      {detailEm && <EmergencyDetailCard emergency={detailEm} users={state.users} onClose={() => setDetailEm(null)} />}
    </div>
  );
}
