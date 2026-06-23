import { useState } from 'react';
import { useOps } from '../store/opsStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { FormField } from '../components/FormField';
import { validateEmail } from '../lib/validation';

export default function LoginPage() {
  const { actions, dispatch } = useOps();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{email?:string; password?:string}>({});

  const validate = () => {
    const e: typeof errors = {};
    const em = validateEmail(email);
    if (em) e.email = em;
    if (!password || password.length < 3) e.password = 'كلمة المرور مطلوبة';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { user, error } = await actions.signIn(email, password);
      if (error || !user) { toast.error(error || 'فشل تسجيل الدخول'); return; }
      // Set the authenticated user synchronously so the protected route is ready
      // on the very first navigation (prevents the "login twice" bounce).
      dispatch({ type: 'AUTH_SUCCESS', user });
      toast.success(`أهلاً ${user.fullNameAr}`);
      nav(user.role === 'agent' ? '/report' : '/dashboard', { replace: true });
    } finally { setSubmitting(false); }
  };

  const quick = [
    { role: 'مدير عام', email: 'u-director@ops.iq', color: 'from-amber-500 to-orange-500' },
    { role: 'مشرف', email: 'u-supervisor@ops.iq', color: 'from-blue-500 to-indigo-500' },
    { role: 'مدير مكتب', email: 'u-manager@ops.iq', color: 'from-emerald-500 to-teal-500' },
    { role: 'مندوب', email: 'u-agent@ops.iq', color: 'from-slate-500 to-slate-600' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-3xl font-black text-amber-400 font-display">أربعين</div>
          <div className="text-xs text-slate-400 mt-1">مركز القيادة والعمليات</div>
        </div>

        <form onSubmit={handleLogin} className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 space-y-4" noValidate>
          <FormField label="البريد الإلكتروني" required error={errors.email} id="login-email">
            <input id="login-email" type="email" dir="ltr" value={email} onChange={e=>{ setEmail(e.target.value); if(errors.email) setErrors(s=>({...s, email: undefined} as any)); }}
              placeholder="you@ops.iq"
              className="w-full bg-[#0B0F19] border border-[#263244] rounded-lg px-3 py-3 text-sm text-white text-left placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
              autoComplete="email" />
          </FormField>

          <FormField label="كلمة المرور" required error={errors.password} id="login-pass">
            <div className="relative">
              <input id="login-pass" type={showPass ? 'text' : 'password'} value={password}
                onChange={e=>{ setPassword(e.target.value); if(errors.password) setErrors(s=>({...s, password: undefined} as any)); }}
                className="w-full bg-[#0B0F19] border border-[#263244] rounded-lg px-3 py-3 pl-10 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                autoComplete="current-password" dir="ltr" />
              <button type="button" onClick={()=>setShowPass(s=>!s)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200" aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FormField>

          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-base shadow-lg shadow-amber-500/20 disabled:opacity-60 flex items-center justify-center gap-2">
            <LogIn className="w-4 h-4" />
            {submitting ? 'جاري تسجيل الدخول…' : 'تسجيل الدخول'}
          </button>

          <div className="pt-2 border-t border-[#1E293B]">
            <div className="text-[11px] text-slate-500 mb-2 font-bold">دخول سريع للتجربة:</div>
            <div className="grid grid-cols-2 gap-2">
              {quick.map(q => (
                <button type="button" key={q.email}
                  onClick={()=>{ setEmail(q.email); setPassword('123456'); }}
                  className={`text-[11px] py-2 rounded-lg bg-gradient-to-l ${q.color} text-white font-bold opacity-90 hover:opacity-100 transition-opacity`}>
                  {q.role}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 mt-2 text-center">كلمة المرور للتجربة: <b className="text-slate-300 font-mono">123456</b></div>
          </div>
        </form>

        <div className="text-center mt-4 text-[11px] text-slate-500">
          ليس لديك حساب؟ <button onClick={()=>nav('/register')} className="text-amber-400 hover:underline font-bold">إنشاء حساب جديد</button>
        </div>
      </div>
    </div>
  );
}
