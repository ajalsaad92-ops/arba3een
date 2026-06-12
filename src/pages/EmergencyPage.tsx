import { useState } from 'react';
import { useOps } from '../store/opsStore';
import { AlertOctagon, MapPin, Send, Crosshair, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import WalkieTalkie from '../components/WalkieTalkie';

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
  const { state, actions } = useOps();
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [mgrs, setMgrs] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleLocate = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      toast.error('الموقع غير مدعوم');
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        toast.success('تم تحديد موقعك');
        setLocating(false);
      },
      () => { toast.error('فشل تحديد الموقع'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async () => {
    if (!type) { toast.error('اختر نوع الحالة الطارئة'); return; }
    if (description.length < 20) { toast.error('الوصف يجب أن يكون 20 حرف على الأقل'); return; }
    if (!mgrs && !coords) { toast.error('الرجاء تحديد الموقع (GPS أو MGRS)'); return; }

    setSubmitting(true);
    const user = state.currentUser!;
    const emergency = {
      id: `em-${Date.now()}`,
      reportedById: user.id,
      reportedByName: user.fullNameAr,
      officeId: user.officeId,
      emergencyType: type,
      description,
      locationMgrs: mgrs || undefined,
      lat: coords?.lat,
      lng: coords?.lng,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };
    try {
      await actions.submitEmergency(emergency);
      toast.success('🚨 تم إرسال الحالة الطارئة — تم تنبيه المدير والمشرف', {
        description: 'سيتم التعامل معها فوراً',
        duration: 6000,
      });
      // Play alert sound
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQBvAAA=');
        audio.volume = 0.2;
        audio.play().catch(() => {});
      } catch {}
      setType(''); setDescription(''); setMgrs(''); setCoords(null);
    } catch (e) {
      toast.error('فشل إرسال الحالة الطارئة');
    } finally {
      setSubmitting(false);
    }
  };

  // Demo: quickly fill in sample data
  const fillDemo = () => {
    setType(EMERGENCY_TYPES[Math.floor(Math.random() * EMERGENCY_TYPES.length)]);
    setDescription('حالة طارئة تجريبية تتطلب تدخلاً فورياً من الجهات المختصة. يرجى التحقق من الموقع وإرسال الدعم اللازم بأسرع وقت ممكن.');
    setMgrs('38SMB' + Math.floor(Math.random() * 9999999));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setCoords({ lat: 32.6161, lng: 44.0248 }),
        { timeout: 3000 }
      );
    } else {
      setCoords({ lat: 32.6161, lng: 44.0248 });
    }
    toast.info('تم تعبئة النموذج ببيانات تجريبية');
  };

  const handleAck = async (id: string) => {
    if (!state.currentUser) return;
    await actions.ackEmergency(id, state.currentUser.id);
    toast.success('تم تأكيد استلام الحالة');
  };
  const handleResolve = async (id: string) => {
    await actions.resolveEmergency(id);
    toast.success('✔ تم وضع الحالة كمنجزة');
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0B0F19] p-3 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-red-900/20 to-[#0B0F19] border-2 border-red-500/30 rounded-2xl p-5 md:p-6 glow-crimson">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 animate-pulse-alert">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <div className="text-2xl font-display font-black text-red-300">نموذج الحالات الطارئة</div>
              <div className="text-xs text-slate-400">إرسال فوري للمشرف العام والمدير العام</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-300 mb-1.5 block font-bold">نوع الحالة الطارئة *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-3 text-sm text-white focus:border-red-500/40 focus:outline-none"
              >
                <option value="">— اختر نوع الحالة —</option>
                {EMERGENCY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-300 mb-1.5 block font-bold flex items-center justify-between">
                <span>الوصف التفصيلي *</span>
                <span className="text-[10px] text-slate-500">{description.length} حرف (الحد الأدنى 20)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="اشرح الحالة بتفاصيل كافية للمعالجة الفورية..."
                className="w-full bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-3 text-sm text-white placeholder-slate-500 focus:border-red-500/40 focus:outline-none min-h-32 resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 mb-1.5 block font-bold">الموقع</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleLocate}
                  disabled={locating}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-sm font-bold hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                >
                  {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                  {locating ? 'جاري التحديد...' : 'تحديد الموقع تلقائياً'}
                </button>
                <input
                  value={mgrs}
                  onChange={e => setMgrs(e.target.value)}
                  placeholder="إدخال MGRS يدوياً"
                  className="bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-red-500/40 focus:outline-none"
                />
              </div>
              {coords && (
                <div className="mt-2 text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-2 flex items-center gap-2">
                  <MapPin className="w-3 h-3" /> تم تحديد الموقع: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </div>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-gradient-to-l from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-display font-black text-base transition-all shadow-xl shadow-red-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {submitting ? 'جاري الإرسال...' : '🚨 إرسال طارئ فوري'}
            </button>

            <button
              type="button"
              onClick={fillDemo}
              className="w-full py-2 rounded-lg bg-[#1E293B] hover:bg-[#263244] text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
            >
              🎲 تعبئة ببيانات تجريبية (للاختبار)
            </button>
          </div>
        </div>

        {/* Recent emergencies */}
        <div className="mt-5">
          <div className="text-sm font-bold text-slate-300 mb-3">الحالات الطارئة الأخيرة</div>
          <div className="space-y-2">
            {state.emergencies.slice(0, 5).map(em => {
              return (
                <div key={em.id} className="bg-[#111827] border border-[#1E293B] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${
                      em.status === 'active' ? 'bg-red-500 animate-pulse' :
                      em.status === 'acknowledged' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <span className="text-sm font-bold text-slate-200">{em.emergencyType}</span>
                    <span className="text-[10px] text-slate-500 mr-auto">{new Date(em.createdAt).toLocaleString('ar-IQ')}</span>
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-2">{em.description}</div>
                  {state.currentUser?.role === 'director' || state.currentUser?.role === 'supervisor' ? (
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
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
