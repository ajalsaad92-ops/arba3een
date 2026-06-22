import { useState } from 'react';
import { useOps } from '../store/opsStore';
import { useOffices } from '../lib/offices';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FormField } from '../components/FormField';
import { validateEmail, validatePassword, passwordStrength, validateText } from '../lib/validation';

export default function RegisterPage() {
  const { actions } = useOps();
  const nav = useNavigate();
  const { offices } = useOffices();
  const [step, setStep] = useState(1);
  const [fullNameAr, setFullNameAr] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<'agent'|'manager'>('agent');
  const [officeId, setOfficeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});

  const pw = passwordStrength(password);

  const validateStep1 = () => {
    const e: Record<string,string> = {};
    const nErr = validateText(fullNameAr, { min:3, max:120, label:'الاسم' });
    if (nErr) e.fullNameAr = nErr;
    const emErr = validateEmail(email);
    if (emErr) e.email = emErr;
    const pErr = validatePassword(password, { min: 6 });
    if (pErr) e.password = pErr;
    if (password !== confirm) e.confirm = 'كلمتا المرور غير متطابقتين';
    setErrors(e);
    return !Object.keys(e).length;
  };
  const validateStep2 = () => {
    const e: Record<string,string> = {};
    if (!officeId) e.officeId = 'اختر المكتب';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const next = () => { if (validateStep1()) setStep(2); };
  const submit = async () => {
    if (!validateStep2()) return;
    setSubmitting(true);
    try {
      const { user, error } = await actions.signUp({ fullNameAr: fullNameAr.trim(), email, password, role, officeId });
      if (error || !user) { toast.error(error || 'فشل إنشاء الحساب'); return; }
      toast.success('تم إنشاء حسابك بنجاح');
      nav('/dashboard', { replace: true });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg bg-[#111827] border border-[#1E293B] rounded-2xl p-6">
        <div className="text-xl font-black text-amber-400 mb-1">إنشاء حساب جديد</div>
        <div className="text-xs text-slate-400 mb-5">الخطوة {step} من 2</div>

        {step === 1 && (
          <div className="space-y-4">
            <FormField label="الاسم الكامل" required error={errors.fullNameAr} id="r-name" counter={{ current: fullNameAr.length, max: 120 }}>
              <input id="r-name" value={fullNameAr} maxLength={120}
                onChange={e=>{ setFullNameAr(e.target.value); if(errors.fullNameAr) setErrors(s=>({...s, fullNameAr: undefined} as any)); }}
                className="w-full bg-[#0B0F19] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/40 focus:outline-none" />
            </FormField>
            <FormField label="البريد الإلكتروني" required error={errors.email} id="r-email">
              <input id="r-email" type="email" dir="ltr" value={email}
                onChange={e=>{ setEmail(e.target.value.toLowerCase()); if(errors.email) setErrors(s=>({...s, email: undefined} as any)); }}
                className="w-full bg-[#0B0F19] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white text-left focus:border-amber-500/40 focus:outline-none" />
            </FormField>
            <FormField label="كلمة المرور" required error={errors.password} id="r-pass" hint={`القوة: ${pw.label}`}>
              <input id="r-pass" type="password" value={password} onChange={e=>{ setPassword(e.target.value); if(errors.password) setErrors(s=>({...s, password: undefined} as any)); }}
                className="w-full bg-[#0B0F19] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/40 focus:outline-none" dir="ltr" />
              <div className="mt-2 h-1.5 rounded-full bg-[#1E293B] overflow-hidden"><div className="h-full transition-all" style={{ width: `${(pw.score+1)*20}%`, background: pw.color }} /></div>
            </FormField>
            <FormField label="تأكيد كلمة المرور" required error={errors.confirm} id="r-pass2">
              <input id="r-pass2" type="password" value={confirm} onChange={e=>{ setConfirm(e.target.value); if(errors.confirm) setErrors(s=>({...s, confirm: undefined} as any)); }}
                className="w-full bg-[#0B0F19] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/40 focus:outline-none" dir="ltr" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <button onClick={()=>nav('/login')} className="px-4 py-2.5 rounded-lg bg-[#1E293B] text-slate-300 text-sm">رجوع</button>
              <button onClick={next} className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black">التالي →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <FormField label="الدور" required id="r-role">
              <select id="r-role" value={role} onChange={e=>setRole(e.target.value as any)}
                className="w-full bg-[#0B0F19] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white">
                <option value="agent">مندوب ميداني</option>
                <option value="manager">مدير مكتب</option>
              </select>
            </FormField>
            <FormField label="المكتب" required error={errors.officeId} id="r-office">
              <select id="r-office" value={officeId} onChange={e=>{ setOfficeId(e.target.value); if(errors.officeId) setErrors(s=>({...s, officeId: undefined} as any)); }}
                className="w-full bg-[#0B0F19] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white">
                <option value="">— اختر المكتب —</option>
                {offices.map(o=> <option key={o.id} value={o.id}>{o.nameAr}</option>)}
              </select>
            </FormField>
            <div className="flex gap-2 pt-2">
              <button onClick={()=>setStep(1)} className="px-4 py-2.5 rounded-lg bg-[#1E293B] text-slate-300 text-sm">السابق</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-black">
                {submitting ? 'جاري الإنشاء…' : 'إنشاء الحساب'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
