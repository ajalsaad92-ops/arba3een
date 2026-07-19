import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '../components/FormField';
import { validateEmail } from '../lib/validation';

export default function ForgotPasswordPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = validateEmail(email);
    if (em) { setErr(em); return; }
    setErr(undefined);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) { toast.error(error.message || 'تعذّر إرسال الرابط'); return; }
      setSent(true);
      toast.success('تم إرسال رابط إعادة التعيين إلى بريدك');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-3xl font-black text-amber-400 font-display">أربعين</div>
          <div className="text-xs text-slate-400 mt-1">استعادة كلمة المرور</div>
        </div>

        <form onSubmit={submit} className="bg-[#1a1a1a] border border-[#232323] rounded-2xl p-6 space-y-4" noValidate>
          {sent ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-sm text-slate-200 font-bold">تحقق من بريدك الإلكتروني</div>
              <div className="text-xs text-slate-400">أرسلنا رابطاً لإعادة تعيين كلمة المرور إلى {email}</div>
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-400 leading-relaxed">
                أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
              </div>
              <FormField label="البريد الإلكتروني" required error={err} id="fp-email">
                <input id="fp-email" type="email" dir="ltr" value={email}
                  onChange={e=>{ setEmail(e.target.value); if(err) setErr(undefined); }}
                  placeholder="you@ops.iq"
                  className="w-full bg-[#0d0d0d] border border-[#2c2c2c] rounded-lg px-3 py-3 text-sm text-white text-left placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                  autoComplete="email" />
              </FormField>
              <button type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-base shadow-lg shadow-amber-500/20 disabled:opacity-60">
                {submitting ? 'جاري الإرسال…' : 'إرسال رابط الاستعادة'}
              </button>
            </>
          )}

          <div className="pt-3 border-t border-[#232323] text-center">
            <button type="button" onClick={()=>nav('/login')} className="text-[11px] text-amber-400 hover:underline inline-flex items-center gap-1">
              <ArrowRight className="w-3 h-3" /> العودة لتسجيل الدخول
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
