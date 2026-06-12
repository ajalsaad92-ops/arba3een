import { useState, useMemo, useEffect } from 'react';
import { useOps } from '../store/opsStore';
import type { ReportFieldDefinition, ReportFieldGroup, ReportFieldType } from '../data/types';
import { toast } from 'sonner';
import {
  Plus, Eye, EyeOff, Trash2, Save, X, Type, Hash, AlignLeft,
  MapPin, MapPinned, Route, Calendar, Clock, Users as UsersIcon, Edit2, Info,
  ChevronDown,
} from 'lucide-react';

const TYPE_META: Record<ReportFieldType, { icon: any; label: string }> = {
  number:         { icon: Hash,      label: 'رقم' },
  text:           { icon: Type,      label: 'نص قصير' },
  textarea:       { icon: AlignLeft, label: 'نص طويل' },
  location:       { icon: MapPin,    label: 'موقع واحد' },
  multi_location: { icon: MapPinned, label: 'مواقع متعددة' },
  route:          { icon: Route,     label: 'مسار على الخريطة' },
  date:           { icon: Calendar,  label: 'تاريخ' },
  time:           { icon: Clock,     label: 'وقت' },
};

export default function FieldDefinitionsManager() {
  const { state, actions, dispatch } = useOps();
  const user = state.currentUser!;
  const canEdit = user.role === 'director' || user.role === 'supervisor';

  const [expandedGroup, setExpandedGroup] = useState<string | null>(state.fieldGroups[0]?.id ?? null);
  const [editingField, setEditingField] = useState<ReportFieldDefinition | null>(null);
  const [creatingInGroup, setCreatingInGroup] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<ReportFieldGroup | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // refresh definitions on mount so we never operate on stale data
  useEffect(() => { actions.reloadFieldDefs(dispatch).catch(() => {}); }, []);

  const grouped = useMemo(() => {
    return state.fieldGroups.map(g => ({
      group: g,
      fields: state.fieldDefinitions
        .filter(f => f.groupId === g.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [state.fieldGroups, state.fieldDefinitions]);

  if (!canEdit) {
    return (
      <div className="p-6 text-center text-sm text-slate-400">
        هذه الشاشة مخصّصة للمدير العام والمشرف فقط.
      </div>
    );
  }

  const refresh = () => actions.reloadFieldDefs(dispatch);

  const toggleFieldHidden = async (f: ReportFieldDefinition) => {
    try {
      await actions.upsertFieldDefinition({ ...f, isHidden: !f.isHidden });
      await refresh();
      toast.success(f.isHidden ? 'تم إظهار الحقل' : 'تم إخفاء الحقل من الجميع');
    } catch (e: any) { toast.error(e.message || 'فشل التحديث'); }
  };

  const deleteField = async (f: ReportFieldDefinition) => {
    const msg = f.isBuiltIn
      ? `«${f.labelAr}» حقل أساسي ومرتبط بالإحصائيات والخريطة. حذفه نهائياً قد يؤثر على بيانات سابقة — يُفضّل إخفاؤه. هل أنت متأكد من الحذف؟`
      : `حذف الحقل «${f.labelAr}» نهائياً؟`;
    if (!confirm(msg)) return;
    try {
      await actions.deleteFieldDefinition(f.id);
      await refresh();
      toast.success('تم الحذف');
    } catch (e: any) { toast.error(e.message || 'فشل الحذف'); }
  };

  const deleteGroup = async (g: ReportFieldGroup) => {
    const inGroup = state.fieldDefinitions.filter(f => f.groupId === g.id);
    if (inGroup.some(f => f.isBuiltIn)) { toast.error('لا يمكن حذف مجموعة تحتوي على حقول أساسية'); return; }
    if (!confirm(`حذف المجموعة «${g.titleAr}» وكل حقولها؟`)) return;
    try {
      await actions.deleteFieldGroup(g.id);
      await refresh();
      toast.success('تم الحذف');
    } catch (e: any) { toast.error(e.message || 'فشل الحذف'); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          هنا تتحكم بحقول التقرير اليومي. يمكنك إعادة تسمية الحقول، إضافة شرح/تعليمات،
          إخفاء حقل من الجميع، تخصيص حقل لأشخاص محددين، أو إضافة حقول جديدة بأي نوع
          (رقم / نص / موقع / مسار…). الحقول الرقمية المؤشّر عليها <b>«احتسابه في الإحصائيات»</b>
          ستظهر تلقائياً ضمن مؤشرات لوحة القيادة.
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-200">المجموعات والحقول</div>
        <button
          onClick={() => { setCreatingGroup(true); setEditingGroup({ id: '', titleAr: '', sortOrder: (state.fieldGroups.at(-1)?.sortOrder ?? 0) + 1, isHidden: false } as any); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25"
        >
          <Plus className="w-3.5 h-3.5" /> مجموعة جديدة
        </button>
      </div>

      <div className="space-y-2">
        {grouped.map(({ group, fields }) => {
          const expanded = expandedGroup === group.id;
          return (
            <div key={group.id} className="bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
              <div className="p-3 flex items-center gap-2">
                <button
                  onClick={() => setExpandedGroup(expanded ? null : group.id)}
                  className="flex-1 flex items-center gap-2 text-right"
                >
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  <div className="font-bold text-sm">{group.titleAr}</div>
                  <div className="text-[10px] text-slate-500">({fields.length})</div>
                  {group.isHidden && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">مخفية</span>}
                </button>
                <button onClick={() => { setEditingGroup(group); setCreatingGroup(false); }} className="p-1.5 rounded hover:bg-[#1E293B] text-slate-400" title="تعديل المجموعة">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteGroup(group)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400" title="حذف المجموعة">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {expanded && (
                <div className="border-t border-[#1E293B] divide-y divide-[#1E293B]">
                  {fields.map(f => {
                    const Tm = TYPE_META[f.fieldType] || TYPE_META.text;
                    const TIcon = Tm.icon;
                    return (
                      <div key={f.id} className={`p-3 flex items-center gap-3 ${f.isHidden ? 'opacity-50' : ''}`}>
                        <div className="w-8 h-8 rounded-md bg-[#0B0F19] border border-[#1E293B] flex items-center justify-center text-slate-400">
                          <TIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-200 truncate">{f.labelAr}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E293B] text-slate-400">{Tm.label}</span>
                            {f.isBuiltIn && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">أساسي</span>}
                            {f.countInStats && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">إحصائيات</span>}
                            {f.allowedUserIds.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 flex items-center gap-1">
                                <UsersIcon className="w-2.5 h-2.5" /> {f.allowedUserIds.length} مخصّص
                              </span>
                            )}
                          </div>
                          {f.descriptionAr && <div className="text-[10px] text-slate-500 mt-1 truncate">{f.descriptionAr}</div>}
                        </div>
                        <button onClick={() => toggleFieldHidden(f)} className="p-1.5 rounded hover:bg-[#1E293B] text-slate-400" title={f.isHidden ? 'إظهار' : 'إخفاء'}>
                          {f.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button onClick={() => { setEditingField(f); setCreatingInGroup(null); }} className="p-1.5 rounded hover:bg-[#1E293B] text-slate-300" title="تعديل">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteField(f)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400" title={f.isBuiltIn ? 'حذف (حقل أساسي — يُفضّل الإخفاء)' : 'حذف'}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="p-2">
                    <button
                      onClick={() => { setCreatingInGroup(group.id); setEditingField(null); }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#0B0F19] border border-dashed border-[#1E293B] hover:border-amber-500/40 text-amber-400 text-xs font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة حقل لهذه المجموعة
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Field editor */}
      {(editingField || creatingInGroup) && (
        <FieldEditor
          initial={editingField ?? undefined}
          groupId={creatingInGroup ?? editingField?.groupId ?? ''}
          users={state.users}
          onCancel={() => { setEditingField(null); setCreatingInGroup(null); }}
          onSaved={async () => { await refresh(); setEditingField(null); setCreatingInGroup(null); }}
        />
      )}

      {/* Group editor */}
      {editingGroup && (
        <GroupEditor
          initial={editingGroup}
          isNew={creatingGroup}
          onCancel={() => { setEditingGroup(null); setCreatingGroup(false); }}
          onSaved={async () => { await refresh(); setEditingGroup(null); setCreatingGroup(false); }}
        />
      )}
    </div>
  );
}

// ─── Group editor ────────────────────────────────────────────────────
function GroupEditor({ initial, isNew, onCancel, onSaved }: any) {
  const { actions } = useOps();
  const [title, setTitle] = useState(initial.titleAr || '');
  const [order, setOrder] = useState<number>(initial.sortOrder ?? 99);
  const [hidden, setHidden] = useState<boolean>(!!initial.isHidden);

  const save = async () => {
    if (!title.trim()) return toast.error('العنوان مطلوب');
    try {
      await actions.upsertFieldGroup({
        id: isNew ? undefined : initial.id,
        titleAr: title.trim(),
        sortOrder: order,
        isHidden: hidden,
      } as any);
      toast.success(isNew ? 'تم إنشاء المجموعة' : 'تم الحفظ');
      onSaved();
    } catch (e: any) { toast.error(e.message || 'فشل الحفظ'); }
  };

  return (
    <Modal title={isNew ? 'مجموعة جديدة' : `تعديل المجموعة: ${initial.titleAr}`} onClose={onCancel}>
      <FieldRow label="العنوان (عربي)">
        <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
      </FieldRow>
      <FieldRow label="ترتيب الظهور">
        <input type="number" value={order} onChange={e => setOrder(Number(e.target.value))} className={inputCls} />
      </FieldRow>
      <label className="flex items-center gap-2 text-xs text-slate-300 mt-2">
        <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} className="accent-amber-500" />
        إخفاء المجموعة (لن تظهر لأي مستخدم)
      </label>
      <div className="flex gap-2 pt-3 mt-3 border-t border-[#1E293B]">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-[#1E293B] hover:bg-[#263244] text-slate-300 text-sm font-bold">إلغاء</button>
        <button onClick={save} className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold flex items-center justify-center gap-2"><Save className="w-4 h-4"/> حفظ</button>
      </div>
    </Modal>
  );
}

// ─── Field editor ────────────────────────────────────────────────────
function FieldEditor({ initial, groupId, users, onCancel, onSaved }: any) {
  const { actions } = useOps();
  const [labelAr, setLabelAr]         = useState(initial?.labelAr ?? '');
  const [descriptionAr, setDesc]      = useState(initial?.descriptionAr ?? '');
  const [placeholderAr, setPh]        = useState(initial?.placeholderAr ?? '');
  const [fieldType, setFieldType]     = useState<ReportFieldType>(initial?.fieldType ?? 'text');
  const [countInStats, setCount]      = useState<boolean>(initial?.countInStats ?? false);
  const [statLabelAr, setStatLabel]   = useState(initial?.statLabelAr ?? '');
  const [sortOrder, setSortOrder]     = useState<number>(initial?.sortOrder ?? 99);
  const [maxLength, setMaxLength]     = useState<string>(initial?.maxLength ? String(initial.maxLength) : '');
  const [allowedUserIds, setAllowed]  = useState<string[]>(initial?.allowedUserIds ?? []);
  const [hidden, setHidden]           = useState<boolean>(!!initial?.isHidden);
  // field_key: editable only when creating a new (non-built-in) field
  const [fieldKey, setFieldKey]       = useState<string>(initial?.fieldKey ?? '');
  const isNew = !initial;
  const isBuiltIn = !!initial?.isBuiltIn;

  const toggleUser = (id: string) => setAllowed(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

  const save = async () => {
    if (!labelAr.trim()) return toast.error('عنوان الحقل مطلوب');
    let key = fieldKey.trim();
    if (isNew) {
      if (!key) key = 'x_' + Math.random().toString(36).slice(2, 8);
      key = key.replace(/[^a-zA-Z0-9_]/g, '_');
    }
    try {
      await actions.upsertFieldDefinition({
        id: initial?.id,
        groupId,
        fieldKey: key,
        labelAr: labelAr.trim(),
        descriptionAr: descriptionAr?.trim() || null,
        placeholderAr: placeholderAr?.trim() || null,
        fieldType,
        sortOrder,
        maxLength: maxLength ? Number(maxLength) : null,
        isHidden: hidden,
        isBuiltIn,
        countInStats: fieldType === 'number' ? countInStats : false,
        statLabelAr: countInStats ? (statLabelAr?.trim() || labelAr.trim()) : null,
        allowedUserIds,
      });
      toast.success(isNew ? 'تم إنشاء الحقل' : 'تم الحفظ');
      onSaved();
    } catch (e: any) { toast.error(e.message || 'فشل الحفظ'); }
  };

  return (
    <Modal title={isNew ? 'حقل جديد' : `تعديل الحقل: ${initial.labelAr}`} onClose={onCancel}>
      <FieldRow label="العنوان المعروض">
        <input value={labelAr} onChange={e => setLabelAr(e.target.value)} className={inputCls} placeholder="مثال: عدد الزوار" />
      </FieldRow>
      <FieldRow label="شرح أو أمثلة أو تعليمات (يظهر تحت الحقل للمستخدم)">
        <textarea value={descriptionAr} onChange={e => setDesc(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="مثال: أدخل الرقم الإجمالي خلال الـ 24 ساعة الماضية…" />
      </FieldRow>
      <FieldRow label="نص توضيحي داخل المربع (placeholder)">
        <input value={placeholderAr} onChange={e => setPh(e.target.value)} className={inputCls} />
      </FieldRow>
      <FieldRow label="نوع الحقل">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {(Object.keys(TYPE_META) as ReportFieldType[]).map(t => {
            const Tm = TYPE_META[t];
            const Tn = Tm.icon;
            const active = fieldType === t;
            return (
              <button
                key={t}
                onClick={() => setFieldType(t)}
                className={`p-2 rounded-md text-[11px] flex flex-col items-center gap-1 border transition-colors ${
                  active ? 'border-amber-500/60 bg-amber-500/15 text-amber-300' :
                  'border-[#1E293B] bg-[#0B0F19] text-slate-400 hover:border-[#263244]'
                }`}
              >
                <Tn className="w-4 h-4" />
                {Tm.label}
              </button>
            );
          })}
        </div>
      </FieldRow>

      {isNew && (
        <FieldRow label="مفتاح الحقل (اختياري، إنجليزي)">
          <input value={fieldKey} onChange={e => setFieldKey(e.target.value)} placeholder="auto" dir="ltr" className={inputCls} />
        </FieldRow>
      )}

      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="ترتيب">
          <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} className={inputCls} />
        </FieldRow>
        <FieldRow label="حد أقصى للأحرف">
          <input type="number" value={maxLength} onChange={e => setMaxLength(e.target.value)} className={inputCls} placeholder="بدون حد" />
        </FieldRow>
      </div>

      {fieldType === 'number' && (
        <>
          <label className="flex items-center gap-2 text-xs text-slate-300 mt-2">
            <input type="checkbox" checked={countInStats} onChange={e => setCount(e.target.checked)} className="accent-amber-500" />
            احتساب هذا الحقل في إحصائيات لوحة القيادة
          </label>
          {countInStats && (
            <FieldRow label="اسم المؤشّر في الإحصائيات (اختياري)">
              <input value={statLabelAr} onChange={e => setStatLabel(e.target.value)} className={inputCls} placeholder="مثال: إجمالي الزوار" />
            </FieldRow>
          )}
        </>
      )}

      <label className="flex items-center gap-2 text-xs text-slate-300 mt-2">
        <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} className="accent-amber-500" />
        إخفاء الحقل (لن يظهر لأي مستخدم في نموذج التقرير)
      </label>

      <FieldRow label={`تخصيص الحقل لمستخدمين محدّدين (${allowedUserIds.length === 0 ? 'الافتراضي: للكل' : allowedUserIds.length + ' مستخدم'})`}>
        <div className="bg-[#0B0F19] border border-[#1E293B] rounded-md p-2 max-h-44 overflow-y-auto grid grid-cols-1 gap-1">
          {users.map((u: any) => (
            <label key={u.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:bg-[#1E293B]/40 px-1 py-0.5 rounded">
              <input type="checkbox" checked={allowedUserIds.includes(u.id)} onChange={() => toggleUser(u.id)} className="accent-amber-500" />
              <span className="flex-1">{u.fullNameAr}</span>
              <span className="text-[10px] text-slate-500">{u.role}</span>
            </label>
          ))}
          {users.length === 0 && <div className="text-[11px] text-slate-500 text-center py-2">لا يوجد مستخدمون</div>}
        </div>
      </FieldRow>

      <div className="flex gap-2 pt-3 mt-3 border-t border-[#1E293B]">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-[#1E293B] hover:bg-[#263244] text-slate-300 text-sm font-bold">إلغاء</button>
        <button onClick={save} className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold flex items-center justify-center gap-2"><Save className="w-4 h-4"/> حفظ</button>
      </div>
    </Modal>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────
const inputCls = 'w-full bg-[#1E293B] border border-[#263244] rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500/40 focus:outline-none';

function FieldRow({ label, children }: any) {
  return (
    <div className="mb-2">
      <label className="text-xs text-slate-400 mb-1 block font-semibold">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 z-[700] bg-black/70 flex items-center justify-center p-3 animate-fade-in-up" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#0B0F19] border border-amber-500/30 rounded-2xl shadow-2xl">
        <div className="p-4 border-b border-[#1E293B] flex items-center justify-between sticky top-0 bg-[#0B0F19] z-10">
          <div className="font-display font-black text-amber-400 text-sm">{title}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#1E293B] hover:bg-[#263244] flex items-center justify-center text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">{children}</div>
      </div>
    </div>
  );
}