import { useState } from 'react';
import { useOps } from '../store/opsStore';
import { OFFICES, officeById } from '../data/offices';
import { supabase } from '../lib/supabase';
import { UserPlus, Edit2, Power, PowerOff, Shield, Save, X, Database, Check, Search, Timer, FileText, MapPinned, Eye } from 'lucide-react';
import { toast } from 'sonner';
import type { Role, Profile } from '../data/types';

const ROLE_LABELS: Record<Role, string> = {
  director: 'مدير عام',
  supervisor: 'مشرف عام',
  manager: 'مدير مكتب',
  agent: 'مدخل بيانات',
  viewer: 'مشاهد',
};
const ROLE_COLORS: Record<Role, string> = {
  director: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  supervisor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  manager: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  agent: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  viewer: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
};

const PERMS = [
  { key: 'canExport', label: 'تصدير Excel', icon: FileText },
  { key: 'canAddCrossings', label: 'إضافة منافذ', icon: MapPinned },
  { key: 'canViewAllOffices', label: 'مشاهدة كل المكاتب', icon: Eye },
  { key: 'canOpenWindow', label: 'فتح النافذة يدوياً', icon: Timer },
  { key: 'canEditReports', label: 'تعديل التقارير', icon: Edit2 },
];

export default function AdminPage() {
  const { state, dispatch, actions } = useOps();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [username, setUsername] = useState('');

  const filtered = state.users.filter(u => u.fullNameAr.includes(search));

  const startCreate = () => {
    setDraft({ fullNameAr: '', role: 'agent', officeId: OFFICES[0].id, permittedOfficeIds: [], specialPermissions: { canExport: false, canAddCrossings: false, canViewAllOffices: false, canOpenWindow: false, canEditReports: false }, isActive: true });
    setUsername('');
    setCreating(true);
    setEditing(null);
  };

  const startEdit = (u: Profile) => {
    setDraft({ ...u });
    setUsername('');
    setEditing(u);
    setCreating(false);
  };

  const save = async () => {
    if (!draft.fullNameAr) return toast.error('الاسم الكامل مطلوب');
    if (draft.role !== 'director' && !draft.officeId) return toast.error('المكتب مطلوب');
    if (creating) {
      const cleanUser = username.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '');
      if (!cleanUser) return toast.error('اسم المستخدم مطلوب (أحرف إنجليزية أو أرقام)');
      if (!draft.password || draft.password.length < 6) return toast.error('كلمة المرور مطلوبة (6 أحرف على الأقل)');
    }
    try {
      if (creating) {
        const { data, error } = await supabase.functions.invoke('admin-manage-users', {
          body: {
            action: 'create',
            fullNameAr: draft.fullNameAr,
            username: username.toLowerCase().trim(),
            password: draft.password || undefined,
            role: draft.role ?? 'agent',
            officeId: draft.officeId ?? OFFICES[0].id,
            permittedOfficeIds: draft.permittedOfficeIds ?? [],
            specialPermissions: draft.specialPermissions,
          },
        });
        if (error || (data as any)?.error || !(data as any)?.user) {
          toast.error((data as any)?.error || error?.message || 'فشل إنشاء المستخدم');
          return;
        }
        // M2: dispatch ADD_USER so the new row appears in the list immediately
        // without waiting for a refresh or a Realtime round-trip.
        dispatch({ type: 'ADD_USER', user: (data as any).user });
        toast.success(`تم إنشاء المستخدم — اسم الدخول: ${(data as any).user.email} — كلمة المرور: ${draft.password || '123456'}`);
      } else if (editing) {
        await actions.updateUser(editing.id, draft);
        // Optional password reset for an existing user (director only).
        if (draft.password && draft.password.length >= 6) {
          const { data, error } = await supabase.functions.invoke('admin-manage-users', {
            body: { action: 'resetPassword', userId: editing.id, password: draft.password },
          });
          if (error || (data as any)?.error) {
            toast.error((data as any)?.error || error?.message || 'تعذّر تغيير كلمة المرور');
            return;
          }
          toast.success('تم تحديث المستخدم وكلمة المرور');
        } else {
          toast.success('تم تحديث المستخدم');
        }
      }
      setCreating(false); setEditing(null); setDraft({}); setUsername('');
    } catch (e: any) {
      toast.error(e.message || 'فشل الحفظ');
    }
  };

  const toggleActive = async (u: Profile) => {
    await actions.updateUser(u.id, { isActive: !u.isActive });
    toast.success(u.isActive ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم');
  };

  const togglePerm = (perm: string) => {
    setDraft(d => ({
      ...d,
      specialPermissions: { ...(d.specialPermissions || { canExport: false, canAddCrossings: false, canViewAllOffices: false, canOpenWindow: false, canEditReports: false }), [perm]: !(d.specialPermissions as any)?.[perm] }
    }));
  };

  const togglePermittedOffice = (id: string) => {
    setDraft(d => {
      const list = d.permittedOfficeIds || [];
      return { ...d, permittedOfficeIds: list.includes(id) ? list.filter(x => x !== id) : [...list, id] };
    });
  };

  const seedData = async () => {
    const t = toast.loading('جاري تحميل البيانات التجريبية...');
    try {
      const result = await actions.seedDemoData();
      if (result?.error) {
        toast.error(result.error, { id: t });
      } else {
        toast.success(`🌱 تم تحميل ${result.added} تقرير تجريبي بنجاح`, { id: t });
      }
    } catch (e: any) {
      toast.error(e?.message || 'فشل تحميل البيانات', { id: t });
    }
  };

  const clearData = async () => {
    if (!confirm('سيتم حذف جميع البيانات المدخلة (التقارير، الطوارئ، التمديدات، مواقع المندوبين) مع الإبقاء على المستخدمين. هل أنت متأكد؟')) return;
    const t = toast.loading('جاري تفريغ البيانات...');
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-users', {
        body: { action: 'clearData' },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || 'فشل تفريغ البيانات', { id: t });
        return;
      }
      toast.success('تم تفريغ البيانات بنجاح', { id: t });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      toast.error(e?.message || 'فشل تفريغ البيانات', { id: t });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0B0F19] p-3 md:p-5">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="text-2xl font-display font-black text-amber-400">إدارة المستخدمين</div>
            <div className="text-xs text-slate-400 mt-1">إدارة حسابات وصلاحيات مستخدمي النظام</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={seedData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-l from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 text-sm font-bold">
              <Database className="w-4 h-4" /> تحميل بيانات تجريبية
            </button>
            <button onClick={clearData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111827] border border-orange-500/30 hover:border-orange-500/60 text-orange-400 text-sm font-bold">
              <Power className="w-4 h-4" /> تفريغ البيانات
            </button>
            <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-l from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black text-sm font-bold">
              <UserPlus className="w-4 h-4" /> مستخدم جديد
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Users list */}
          <div className="lg:col-span-2 bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
            <div className="p-3 border-b border-[#1E293B]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="بحث..."
                  className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-md pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500"
                />
              </div>
            </div>
            <div className="divide-y divide-[#1E293B] max-h-[600px] overflow-y-auto">
              {filtered.map(u => (
                <div key={u.id} className={`p-3 hover:bg-[#1E293B]/40 cursor-pointer ${editing?.id === u.id ? 'bg-amber-500/10 border-r-2 border-amber-500' : ''}`} onClick={() => startEdit(u)}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold">{u.fullNameAr.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{u.fullNameAr}</div>
                      <div className="text-[10px] text-slate-500 truncate">{officeById(u.officeId)?.nameAr}</div>
                    </div>
                    {!u.isActive && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">معطّل</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Edit/Create form */}
          <div className="lg:col-span-3 bg-[#111827] border border-[#1E293B] rounded-xl p-4">
            {!creating && !editing ? (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                <div className="text-sm text-slate-500">اختر مستخدماً من القائمة أو أنشئ مستخدماً جديداً</div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-bold text-amber-400">{creating ? 'مستخدم جديد' : `تعديل: ${editing?.fullNameAr}`}</div>
                  <button onClick={() => { setCreating(false); setEditing(null); setDraft({}); }} className="p-1 rounded hover:bg-[#1E293B]">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <FieldRow label="الاسم الكامل">
                  <input
                    value={draft.fullNameAr ?? ''}
                    onChange={e => setDraft(d => ({ ...d, fullNameAr: e.target.value }))}
                    className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/40 focus:outline-none"
                  />
                </FieldRow>

                <FieldRow label="الدور">
                  <select
                    value={draft.role ?? 'agent'}
                    onChange={e => setDraft(d => ({ ...d, role: e.target.value as Role }))}
                    className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/40 focus:outline-none"
                  >
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </FieldRow>

                {draft.role !== 'director' && (
                  <FieldRow label="المكتب المرتبط">
                    <select
                      value={draft.officeId ?? ''}
                      onChange={e => setDraft(d => ({ ...d, officeId: e.target.value }))}
                      className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/40 focus:outline-none"
                    >
                      {OFFICES.map(o => <option key={o.id} value={o.id}>{o.nameAr}</option>)}
                    </select>
                  </FieldRow>
                )}

                <FieldRow label={creating ? 'كلمة المرور' : 'كلمة المرور الجديدة (اتركها فارغة للإبقاء على الحالية)'}>
                  <input
                    type="password"
                    value={draft.password ?? ''}
                    onChange={e => setDraft(d => ({ ...d, password: e.target.value }))}
                    placeholder={creating ? 'أدخل كلمة المرور' : '••••••'}
                    className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/40 focus:outline-none"
                    dir="ltr"
                  />
                </FieldRow>

                {draft.role === 'supervisor' && (
                  <FieldRow label="المكاتب المسموح بمشاهدتها">
                    <div className="bg-[#0B0F19] border border-[#1E293B] rounded-md p-2 max-h-32 overflow-y-auto grid grid-cols-2 gap-1">
                      {OFFICES.map(o => (
                        <label key={o.id} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.permittedOfficeIds?.includes(o.id) || false}
                            onChange={() => togglePermittedOffice(o.id)}
                            className="accent-amber-500"
                          />
                          {o.nameAr}
                        </label>
                      ))}
                    </div>
                  </FieldRow>
                )}

                <FieldRow label="الحالة">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDraft(d => ({ ...d, isActive: true }))}
                      className={`flex-1 py-2 rounded-md text-xs font-bold border ${draft.isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-[#0B0F19] text-slate-400 border-[#1E293B]'}`}
                    >
                      <Power className="w-3 h-3 inline ml-1" /> مفعّل
                    </button>
                    <button
                      onClick={() => setDraft(d => ({ ...d, isActive: false }))}
                      className={`flex-1 py-2 rounded-md text-xs font-bold border ${!draft.isActive ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-[#0B0F19] text-slate-400 border-[#1E293B]'}`}
                    >
                      <PowerOff className="w-3 h-3 inline ml-1" /> معطّل
                    </button>
                  </div>
                </FieldRow>

                <div className="border-t border-[#1E293B] pt-3">
                  <div className="text-xs text-slate-400 mb-2 font-bold">الصلاحيات الخاصة</div>
                  <div className="space-y-1.5">
                    {PERMS.map(p => {
                      const Icon = p.icon;
                      const on = (draft.specialPermissions as any)?.[p.key];
                      return (
                        <label key={p.key} className="flex items-center gap-2 p-2 rounded-md hover:bg-[#0B0F19] cursor-pointer">
                          <input type="checkbox" checked={on || false} onChange={() => togglePerm(p.key)} className="accent-amber-500" />
                          <Icon className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs text-slate-300">{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button onClick={save} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold">
                    <Save className="w-4 h-4" /> {creating ? 'إنشاء الحساب' : 'حفظ التعديلات'}
                  </button>
                  {editing && (
                    <button onClick={() => toggleActive(editing)} className="px-4 py-2.5 rounded-lg bg-[#1E293B] hover:bg-[#263244] text-slate-300 text-sm">
                      {editing.isActive ? 'تعطيل' : 'تفعيل'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Permissions matrix */}
        <div className="mt-5 bg-[#111827] border border-[#1E293B] rounded-xl p-4 overflow-x-auto">
          <div className="text-sm font-bold text-amber-400 mb-3">مصفوفة الصلاحيات</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-[#1E293B]">
                <th className="text-right py-2 px-2">المستخدم</th>
                <th className="text-center py-2 px-2">الدور</th>
                {PERMS.map(p => (
                  <th key={p.key} className="text-center py-2 px-2 text-[10px]">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {state.users.map(u => (
                <tr key={u.id} className="hover:bg-[#0B0F19]">
                  <td className="py-2 px-2 text-slate-200">{u.fullNameAr}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  </td>
                  {PERMS.map(p => {
                    const has = (u.specialPermissions as any)[p.key] || u.role === 'director';
                    return (
                      <td key={p.key} className="py-2 px-2 text-center">
                        {has ? <Check className="w-3.5 h-3.5 text-emerald-400 inline" /> : <span className="text-slate-600">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1.5 block font-semibold">{label}</label>
      {children}
    </div>
  );
}
