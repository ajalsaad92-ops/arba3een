import { useState } from 'react';
import { useOps } from '../store/opsStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, LogIn, Zap } from 'lucide-react';
import { FormField } from '../components/FormField';
import { validateEmail } from '../lib/validation';

const DEMO_ACCOUNTS: { label: string; email: string; password: string }[] = [
  { label: 'مدير عام',   email: 'u-director@ops.iq',   password: '123456' },
  { label: 'مشرف',       email: 'u-supervisor@ops.iq', password: '123456' },
  { label: 'مدير مكتب',  email: 'u-manager@ops.iq',    password: '123456' },
  { label: 'مُدخل بيانات', email: 'u-agent@ops.iq',    password: '123456' },
];


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

  const doSignIn = async (em: string, pw: string) => {
    setSubmitting(true);
    try {
      const { user, error } = await actions.signIn(em, pw);
      if (error || !user) { toast.error(error || 'فشل تسجيل الدخول'); return; }
      dispatch({ type: 'AUTH_SUCCESS', user });
      toast.success(`أهلاً ${user.fullNameAr}`);
      nav(user.role === 'agent' ? '/report' : '/dashboard', { replace: true });
    } finally { setSubmitting(false); }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;
    await doSignIn(email, password);
  };

  const quickLogin = async (acc: { email: string; password: string }) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setErrors({});
    await doSignIn(acc.email, acc.password);
  };



  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-3xl font-black text-amber-400 font-display">أربعين</div>
          <div className="text-xs text-slate-400 mt-1">مركز القيادة والعمليات</div>
        </div>

        <form onSubmit={handleLogin} className="bg-[#1a1a1a] border border-[#232323] rounded-2xl p-6 space-y-4" noValidate>
          <FormField label="البريد الإلكتروني" required error={errors.email} id="login-email">
            <input id="login-email" type="email" dir="ltr" value={email} onChange={e=>{ setEmail(e.target.value); if(errors.email) setErrors(s=>({...s, email: undefined} as any)); }}
              placeholder="you@ops.iq"
              className="w-full bg-[#0d0d0d] border border-[#2c2c2c] rounded-lg px-3 py-3 text-sm text-white text-left placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
              autoComplete="email" />
          </FormField>

          <FormField label="كلمة المرور" required error={errors.password} id="login-pass">
            <div className="relative">
              <input id="login-pass" type={showPass ? 'text' : 'password'} value={password}
                onChange={e=>{ setPassword(e.target.value); if(errors.password) setErrors(s=>({...s, password: undefined} as any)); }}
                className="w-full bg-[#0d0d0d] border border-[#2c2c2c] rounded-lg px-3 py-3 pl-10 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
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

          <div className="pt-3 border-t border-[#232323] space-y-2">
            <div className="flex items-center justify-center gap-2 text-[11px] text-amber-400/80">
              <Zap className="w-3 h-3" />
              <span>دخول سريع (للتجربة)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button key={acc.email} type="button" disabled={submitting}
                  onClick={()=>quickLogin(acc)}
                  className="px-2 py-2 rounded-lg bg-[#0d0d0d] border border-[#2c2c2c] hover:border-amber-500/50 hover:bg-amber-500/5 text-[12px] text-slate-200 font-bold disabled:opacity-50 transition-colors">
                  {acc.label}
                </button>
              ))}
            </div>
          </div>



          <div className="pt-2 border-t border-[#232323]">
            <div className="text-[11px] text-slate-500 text-center">
              للحصول على حساب، تواصل مع المدير العام
            </div>
          </div>
        </form>

        <div className="text-center mt-4 text-[11px] text-slate-500 space-y-2">
          <div>
            <button onClick={()=>nav('/forgot-password')} className="text-amber-400/90 hover:text-amber-400 hover:underline">
              نسيت كلمة المرور؟
            </button>
          </div>
          <div>
            ليس لديك حساب؟ <button onClick={()=>nav('/register')} className="text-amber-400 hover:underline font-bold">إنشاء حساب جديد</button>
          </div>
        </div>
      </div>
    </div>
  );
}
