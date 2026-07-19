import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '../components/FormField';

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{password?: string; confirm?: string; general?: string}>({});

  useEffect(() => {
    // Supabase attaches the recovery token via URL hash. Wait for the client to
    // process it and confirm we have a session before showing the form.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // No recovery token → show error state instead of a working form.
        setTimeout(() => {
          if (!ready) setErrors(e => ({ ...e, general: 'رابط الاستعادة غير صالح أو منتهي الصلاحية' }));
        }, 1200);
      }
    });
    return () => { sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!password || password.length < 6) errs.password = 'كلمة المرور يجب ألا تقل عن 6 أحرف';
    if (password !== confirm) errs.confirm = 'كلمتا المرور غير متطابقتين';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { toast.error(error.message || 'تعذّر تحديث كلمة المرور'); return; }
      toast.success('تم تحديث كلمة المرور بنجاح');
      await supabase.auth.signOut();
      nav('/login', { replace: true });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-3xl font-black text-amber-400 font-display">أربعين</div>
          <div className="text-xs text-slate-400 mt-1">تعيين كلمة مرور جديدة</div>
        </div>

        <form onSubmit={submit} className="bg-[#1a1a1a] border border-[#232323] rounded-2xl p-6 space-y-4" noValidate>
          {errors.general ? (
            <div className="text-center py-4 space-y-3">
              <div className="text-sm text-rose-400 font-bold">{errors.general}</div>
              <button type="button" onClick={()=>nav('/forgot-password')}
                className="text-[12px] text-amber-400 hover:underline">طلب رابط جديد</button>
            </div>
          ) : !ready ? (
            <div className="text-center py-8 text-xs text-slate-400">جاري التحقق من رابط الاستعادة…</div>
          ) : (
            <>
              <div className="text-xs text-slate-400 leading-relaxed flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                أدخل كلمة المرور الجديدة الخاصة بحسابك.
              </div>

              <FormField label="كلمة المرور الجديدة" required error={errors.password} id="rp-pass">
                <div className="relative">
                  <input id="rp-pass" type={show ? 'text' : 'password'} value={password}
                    onChange={e=>{ setPassword(e.target.value); if(errors.password) setErrors(s=>({...s, password: undefined})); }}
                    className="w-full bg-[#0d0d0d] border border-[#2c2c2c] rounded-lg px-3 py-3 pl-10 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                    dir="ltr" autoComplete="new-password" />
                  <button type="button" onClick={()=>setShow(s=>!s)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200" aria-label={show ? 'إخفاء' : 'إظهار'}>
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>

              <FormField label="تأكيد كلمة المرور" required error={errors.confirm} id="rp-confirm">
                <input id="rp-confirm" type={show ? 'text' : 'password'} value={confirm}
                  onChange={e=>{ setConfirm(e.target.value); if(errors.confirm) setErrors(s=>({...s, confirm: undefined})); }}
                  className="w-full bg-[#0d0d0d] border border-[#2c2c2c] rounded-lg px-3 py-3 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                  dir="ltr" autoComplete="new-password" />
              </FormField>

              <button type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-base shadow-lg shadow-amber-500/20 disabled:opacity-60">
                {submitting ? 'جاري التحديث…' : 'حفظ كلمة المرور الجديدة'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
