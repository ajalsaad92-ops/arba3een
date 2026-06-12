import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hexagon, Mail, Lock, Eye, EyeOff, AlertCircle, Radio, Activity, MapPin, ChevronRight, Loader2, User } from 'lucide-react';
import { useOps } from '../store/opsStore';
import { OFFICES, officeById } from '../data/offices';
import { toast } from 'sonner';
import type { Profile, Role } from '../data/types';
import { api, type DemoCredHint } from '../lib/api';

const ROLE_VISUALS: Record<Role, { label: string; desc: string; gradient: string; icon: string }> = {
  director: { label: 'المدير العام', desc: 'صلاحيات كاملة', gradient: 'from-amber-400 to-orange-600', icon: '⚡' },
  supervisor: { label: 'المشرف العام', desc: 'لوحة المشرف', gradient: 'from-blue-400 to-indigo-600', icon: '⏱️' },
  manager: { label: 'مدير مكتب', desc: 'إدارة مكتب محدد', gradient: 'from-emerald-400 to-teal-600', icon: '🕌' },
  agent: { label: 'مدخل بيانات', desc: 'إدخال التقارير', gradient: 'from-slate-400 to-slate-600', icon: '📋' },
};

interface QuickAccessItem {
  userId: string;
  email: string;
  password: string;
  fullName: string;
  role: Role;
  officeName: string;
  label: string;
  desc: string;
  gradient: string;
  icon: string;
}

export default function LoginPage() {
  const { state, dispatch, actions } = useOps();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Build quick access list from real DB users (live from state.users + api credentials)
  const [quickAccess, setQuickAccess] = useState<QuickAccessItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // Run both in parallel; never throw on failure (so the spinner always
        // resolves, even if Supabase is unreachable or the table is empty).
        const [users, creds] = await Promise.all([
          api.getUsers().catch(() => [] as Profile[]),
          (api as any).getAllCredentials?.().catch(() => null) ?? Promise.resolve(null),
        ]);

        // credMap is keyed by email in the new backend (was keyed by userId
        // in the localStorage mock). Build an email -> {password,userId} map.
        const credMap: Record<string, { password: string; userId: string }> = creds ?? {};

        // Build a reverse lookup: userId -> { email, password }. The static
        // hints carry string ids like "u-director" while Supabase profiles
        // carry UUIDs, so we also fall back to matching by role for the demo
        // hints when a profile's email matches the hint email.
        const emailToCred: Record<string, { email: string; password: string }> = {};
        Object.entries(credMap).forEach(([email, cred]: [string, any]) => {
          if (email.includes('@')) emailToCred[email.toLowerCase()] = { email, password: cred.password };
        });

        const seenRoles = new Set<Role>();
        const items: QuickAccessItem[] = [];
        users.filter((u: Profile) => u.isActive).forEach((u: Profile) => {
          if (seenRoles.has(u.role)) return;
          seenRoles.add(u.role);
          // First try the user's actual email; if not in credMap, try matching
          // by role against the demo hints (handles UUID vs string-id mismatch).
          let cred = emailToCred[(u as any).email?.toLowerCase?.() ?? ''];
          if (!cred && (u as any).email) cred = emailToCred[(u as any).email.toLowerCase()];
          const visual = ROLE_VISUALS[u.role];
          if (!visual) return;
          const office = officeById(u.officeId);
          items.push({
            userId: u.id,
            email: cred?.email ?? (u as any).email ?? '',
            password: cred?.password ?? '123456',
            fullName: u.fullNameAr,
            role: u.role,
            officeName: office?.nameAr || u.officeId,
            label: visual.label,
            desc: `${u.fullNameAr} • ${office?.governorateAr || ''}`,
            gradient: visual.gradient,
            icon: visual.icon,
          });
        });

        // If profiles didn't match (e.g. Supabase unreachable), fall back to
        // the demo hints directly so the user always sees something clickable.
        if (items.length === 0) {
          const hints: DemoCredHint[] = await api.getDemoLoginHints().catch(() => []);
          hints.forEach((hint) => {
            if (seenRoles.has(hint.role)) return;
            seenRoles.add(hint.role);
            const visual = ROLE_VISUALS[hint.role];
            if (!visual) return;
            const office = officeById(hint.officeId);
            items.push({
              userId: hint.userId,
              email: hint.email,
              password: hint.password,
              fullName: hint.fullName,
              role: hint.role,
              officeName: office?.nameAr || hint.officeId,
              label: visual.label,
              desc: `${hint.fullName} • ${office?.governorateAr || ''}`,
              gradient: visual.gradient,
              icon: visual.icon,
            });
          });
        }

        setQuickAccess(items);
      } catch (e) {
        console.error('Failed to load quick access', e);
        setQuickAccess([]);
      }
    })();
  }, [state.users.length]);

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    const { user, error: err } = await actions.signIn(loginEmail, loginPassword);
    if (err || !user) {
      triggerError(err || 'فشل تسجيل الدخول');
      return false;
    }
    dispatch({ type: 'AUTH_SUCCESS', user });
    toast.success(`أهلاً ${user.fullNameAr}`, { description: 'تم تسجيل الدخول بنجاح' });
    navigate(user.role === 'agent' ? '/report' : '/dashboard', { replace: true });
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { triggerError('الرجاء إدخال البريد الإلكتروني'); return; }
    if (!password.trim()) { triggerError('الرجاء إدخال كلمة المرور'); return; }
    setLoading(true);
    await performLogin(email, password);
    setLoading(false);
  };

  const quickLogin = async (item: QuickAccessItem) => {
    setEmail(item.email);
    setPassword(item.password);
    setLoading(true);
    const ok = await performLogin(item.email, item.password);
    if (ok) {
      toast.success(`أهلاً ${item.fullName}`, { description: `صلاحية: ${item.label}` });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 grid-pattern relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full bg-red-500/8 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl grid md:grid-cols-2 gap-6">
        {/* Left: Branding */}
        <div className="hidden md:flex flex-col justify-center p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/40 glow-amber">
              <Hexagon className="w-9 h-9 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-3xl font-display font-black bg-gradient-to-l from-amber-300 to-amber-500 bg-clip-text text-transparent">منظومة الرصد</div>
              <div className="text-sm text-slate-400 mt-1">المركز العملياتي - مديرية شؤون المحافظات</div>
            </div>
          </div>
          <h1 className="text-4xl font-display font-black mb-3 leading-tight">
            مركز القيادة
            <br />
            <span className="bg-gradient-to-l from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent">العملياتي الموحد</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-md">
            نظام رصد ميداني متكامل لإدارة التقارير الإحصائية اليومية عبر {OFFICES.length} مكتباً في عموم المحافظات العراقية خلال زيارة الأربعين.
          </p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Activity, label: 'رصد لحظي', value: '15 مكتب', gradient: 'from-amber-500/20 to-orange-500/10' },
              { icon: MapPin, label: 'تغطية جغرافية', value: '11 منفذ', gradient: 'from-emerald-500/20 to-teal-500/10' },
              { icon: Radio, label: 'مستخدمو ميدان', value: '100+ مستخدم', gradient: 'from-blue-500/20 to-indigo-500/10' },
            ].map((s, i) => (
              <div key={i} className={`p-3 rounded-xl bg-gradient-to-br ${s.gradient} border border-[#1E293B] backdrop-blur-sm`}>
                <s.icon className="w-4 h-4 text-amber-400 mb-2" />
                <div className="text-xs text-slate-500">{s.label}</div>
                <div className="text-sm font-display font-bold mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Auth */}
        <div className={`bg-gradient-to-br from-[#111827] to-[#0B0F19] border border-[#1E293B] rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/60 ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
          <div className="md:hidden flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Hexagon className="w-7 h-7 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xl font-display font-black text-amber-400">منظومة الرصد</div>
              <div className="text-xs text-slate-400">المركز العملياتي</div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-display font-bold mb-1">تسجيل الدخول</h2>
            <p className="text-xs text-slate-500">الرجاء إدخال بيانات الاعتماد للمتابعة</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="user@ops.iq"
                  autoComplete="username"
                  className="w-full bg-[#1E293B] border border-[#263244] rounded-lg pr-10 pl-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-[#1E293B] border border-[#263244] rounded-lg pr-10 pl-10 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-gradient-to-l from-red-500/15 to-red-900/10 border border-red-500/40 text-red-300 text-xs animate-fade-in-up">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-l from-amber-400 via-amber-500 to-orange-600 hover:from-amber-300 hover:via-amber-400 hover:to-orange-500 text-black font-display font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري التحقق...
                </span>
              ) : 'تسجيل الدخول'}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button type="button" className="text-slate-500 hover:text-amber-400 transition-colors">نسيت كلمة المرور؟</button>
              <button type="button" onClick={() => navigate('/register')} className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
                إنشاء حساب جديد <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </form>

          {/* Quick Access from DB */}
          <div className="mt-6 pt-6 border-t border-[#1E293B]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">وصول سريع للتجربة</div>
              <div className="text-[9px] text-emerald-500/70 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                متصل بقاعدة البيانات
              </div>
            </div>

            {quickAccess.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-4 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                جاري تحميل الحسابات التجريبية...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickAccess.map(item => (
                  <button
                    key={item.userId}
                    onClick={() => quickLogin(item)}
                    disabled={loading}
                    className="group p-2.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] hover:border-amber-500/40 text-right transition-all relative overflow-hidden disabled:opacity-50"
                    title={`${item.email} / ${item.password}`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-l ${item.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                    <div className="relative flex items-center gap-2 mb-1">
                      <div className={`w-9 h-9 rounded-md bg-gradient-to-br ${item.gradient} flex items-center justify-center text-base shadow-lg shrink-0`}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate text-slate-100">{item.fullName}</div>
                        <div className="text-[10px] text-amber-400 truncate">{item.label}</div>
                      </div>
                    </div>
                    <div className="relative flex items-center gap-1.5 text-[10px] text-slate-500">
                      <User className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{item.officeName}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {quickAccess.length > 0 && (
              <div className="mt-3 p-2 rounded-md bg-[#0B0F19] border border-[#1E293B]">
                <div className="text-[10px] text-slate-500 text-center">
                  كلمات المرور التجريبية: <span className="text-amber-500/70 font-mono font-bold">123456</span>
                </div>
                <div className="text-[9px] text-slate-600 text-center mt-1">
                  انقر على أي بطاقة لتسجيل الدخول الفوري
                </div>
              </div>
            )}
          </div>
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
