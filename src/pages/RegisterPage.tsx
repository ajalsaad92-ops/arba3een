import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, Check, ChevronLeft, Building2 } from 'lucide-react';
import { useOps } from '../store/opsStore';
import { OFFICES } from '../data/offices';
import { toast } from 'sonner';
import type { Role } from '../data/types';

const ROLES: { value: Role; label: string; desc: string; icon: string; gradient: string }[] = [
  { value: 'agent', label: 'مدخل بيانات', desc: 'إدخال التقارير اليومية', icon: '📋', gradient: 'from-slate-400 to-slate-600' },
  { value: 'manager', label: 'مدير مكتب', desc: 'إدارة مكتب محدد', icon: '🏢', gradient: 'from-emerald-400 to-teal-600' },
  { value: 'supervisor', label: 'مشرف عام', desc: 'إدارة عدة مكاتب', icon: '⏱️', gradient: 'from-blue-400 to-indigo-600' },
  { value: 'director', label: 'مدير عام', desc: 'صلاحيات كاملة', icon: '⚡', gradient: 'from-amber-400 to-orange-600' },
];

export default function RegisterPage() {
  const { dispatch, actions } = useOps();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fullNameAr: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'agent' as Role,
    officeId: OFFICES[0].id,
    agreedToTerms: false,
  });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: any) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const triggerError = (msg: string) => { setError(msg); setShake(true); setTimeout(() => setShake(false), 500); };

  const passwordStrength = () => {
    const p = form.password;
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };
  const strengthLabel = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية', 'ممتازة'];
  const strengthColor = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-amber-400', 'bg-emerald-500', 'bg-emerald-400'];

  const nextStep = () => {
    if (step === 1) {
      if (form.fullNameAr.length < 3) return triggerError('الاسم يجب أن يكون 3 أحرف على الأقل');
      if (!/^[\u0600-\u06FF\s]+$/.test(form.fullNameAr)) return triggerError('الاسم يجب أن يكون بالعربية فقط');
    }
    if (step === 2) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return triggerError('البريد الإلكتروني غير صالح');
    }
    if (step === 3) {
      if (form.password.length < 6) return triggerError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      if (form.password !== form.confirmPassword) return triggerError('كلمة المرور وتأكيدها غير متطابقتين');
    }
    setStep(s => s + 1);
  };

  const handleRegister = async () => {
    if (!form.agreedToTerms) return triggerError('يجب الموافقة على الشروط للمتابعة');
    setLoading(true);
    const { user, error: err } = await actions.signUp({
      fullNameAr: form.fullNameAr,
      email: form.email,
      password: form.password,
      role: form.role,
      officeId: form.officeId,
    });
    setLoading(false);
    if (err || !user) { triggerError(err || 'فشل إنشاء الحساب'); return; }
    dispatch({ type: 'AUTH_SUCCESS', user });
    toast.success('🎉 تم إنشاء حسابك بنجاح', { description: `أهلاً ${user.fullNameAr}` });
    navigate(user.role === 'agent' ? '/report' : '/dashboard');
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 grid-pattern relative overflow-hidden">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/login')}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 mb-4 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> {step > 1 ? 'الخطوة السابقة' : 'العودة لتسجيل الدخول'}
        </button>

        <div className={`bg-gradient-to-br from-[#111827] to-[#0B0F19] border border-[#1E293B] rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/60 ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <User className="w-6 h-6 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xl font-display font-black bg-gradient-to-l from-emerald-300 to-emerald-500 bg-clip-text text-transparent">إنشاء حساب جديد</div>
              <div className="text-xs text-slate-400">الخطوة {step} من 4</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className={`flex-1 h-1 rounded-full transition-all ${n <= step ? 'bg-gradient-to-l from-emerald-400 to-emerald-600' : 'bg-[#1E293B]'}`} />
            ))}
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-gradient-to-l from-red-500/15 to-red-900/10 border border-red-500/40 text-red-300 text-xs animate-fade-in-up">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">الاسم الكامل (بالعربية)</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={form.fullNameAr}
                    onChange={e => update('fullNameAr', e.target.value)}
                    placeholder="مثال: أبو علي الجبوري"
                    className="w-full bg-[#1E293B] border border-[#263244] rounded-lg pr-10 pl-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <button onClick={nextStep} className="w-full py-3 rounded-lg bg-gradient-to-l from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-black font-bold text-sm shadow-lg shadow-emerald-500/30">
                التالي ←
              </button>
            </div>
          )}

          {/* Step 2: Email */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">البريد الإلكتروني المهني</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="name@ops.iq"
                    className="w-full bg-[#1E293B] border border-[#263244] rounded-lg pr-10 pl-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-1">سيُستخدم هذا البريد لتسجيل الدخول</div>
              </div>
              <button onClick={nextStep} className="w-full py-3 rounded-lg bg-gradient-to-l from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-black font-bold text-sm shadow-lg shadow-emerald-500/30">
                التالي ←
              </button>
            </div>
          )}

          {/* Step 3: Password */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    placeholder="6 أحرف على الأقل"
                    className="w-full bg-[#1E293B] border border-[#263244] rounded-lg pr-10 pl-10 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <div key={n} className={`flex-1 h-1 rounded-full ${n <= passwordStrength() ? strengthColor[passwordStrength()] : 'bg-[#1E293B]'}`} />
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-500">القوة: <span className="text-slate-300">{strengthLabel[passwordStrength()]}</span></div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">تأكيد كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={e => update('confirmPassword', e.target.value)}
                    placeholder="أعد إدخال كلمة المرور"
                    className="w-full bg-[#1E293B] border border-[#263244] rounded-lg pr-10 pl-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                  />
                  {form.confirmPassword && form.password === form.confirmPassword && (
                    <Check className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  )}
                </div>
              </div>
              <button onClick={nextStep} className="w-full py-3 rounded-lg bg-gradient-to-l from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-black font-bold text-sm shadow-lg shadow-emerald-500/30">
                التالي ←
              </button>
            </div>
          )}

          {/* Step 4: Role & Office */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <label className="text-xs text-slate-400 mb-2 block">اختر دورك في النظام</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r => {
                    const selected = form.role === r.value;
                    return (
                      <button
                        key={r.value}
                        onClick={() => update('role', r.value)}
                        className={`relative p-3 rounded-lg border text-right transition-all overflow-hidden ${
                          selected ? `bg-gradient-to-br ${r.gradient} border-transparent text-black shadow-lg` : 'bg-[#1E293B] border-[#263244] hover:border-emerald-500/30 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-lg">{r.icon}</div>
                          <div className="text-sm font-bold">{r.label}</div>
                        </div>
                        <div className={`text-[10px] ${selected ? 'text-black/70' : 'text-slate-500'}`}>{r.desc}</div>
                        {selected && <Check className="absolute top-2 left-2 w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">المكتب المرتبط</label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select
                    value={form.officeId}
                    onChange={e => update('officeId', e.target.value)}
                    className="w-full bg-[#1E293B] border border-[#263244] rounded-lg pr-10 pl-3 py-2.5 text-sm text-white focus:border-emerald-500/40 focus:outline-none appearance-none"
                  >
                    {OFFICES.map(o => <option key={o.id} value={o.id}>{o.nameAr} - {o.governorateAr}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-start gap-2 p-3 rounded-lg bg-[#1E293B] border border-[#263244] cursor-pointer hover:border-emerald-500/30 transition-colors">
                <input
                  type="checkbox"
                  checked={form.agreedToTerms}
                  onChange={e => update('agreedToTerms', e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <span className="text-[11px] text-slate-300 leading-relaxed">
                  أوافق على شروط الاستخدام وسياسة الخصوصية، وألتزم بإدخال بيانات دقيقة وفقاً لقواعد النظام.
                </span>
              </label>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-3 rounded-lg bg-gradient-to-l from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-black font-bold text-sm shadow-lg shadow-emerald-500/30 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    جاري إنشاء الحساب...
                  </span>
                ) : '🚀 إنشاء الحساب والانضمام للنظام'}
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-4 text-[10px] text-slate-600">
          بتسجيلك، أنت توافق على أن تكون جزءاً من منظومة الرصد الميداني الوطني
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
