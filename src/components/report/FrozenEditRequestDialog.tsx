import { useState } from 'react';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { ReportFieldDefinition } from '../../data/types';
import { api } from '../../lib/api';

export default function FrozenEditRequestDialog({ field, currentValue, officeId, requesterId, requesterName, onClose }: {
  field: ReportFieldDefinition; currentValue: any; officeId: string; requesterId: string; requesterName: string; onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [newVal, setNewVal] = useState<string>(() => {
    if (currentValue == null) return '';
    if (typeof currentValue === 'object') return JSON.stringify(currentValue);
    return String(currentValue);
  });
  const [busy, setBusy] = useState(false);

  const parseVal = (): any => {
    if (field.fieldType === 'number') return Number(newVal) || 0;
    if (field.fieldType === 'select' && field.withQuantity) {
      try { const j = JSON.parse(newVal); return Array.isArray(j) ? j : []; } catch { return []; }
    }
    return newVal;
  };

  const submit = async () => {
    if (reason.trim().length < 5) { toast.error('السبب مطلوب (5 أحرف على الأقل)'); return; }
    setBusy(true);
    const t = toast.loading('جاري رفع الطلب...');
    try {
      await api.createFrozenRequest({
        officeId, fieldKey: field.fieldKey, fieldLabelAr: field.labelAr,
        currentValue, requestedValue: parseVal(), reason: reason.trim(),
        requestedById: requesterId, requestedByName: requesterName,
      });
      toast.success('تم رفع الطلب — بانتظار موافقة المشرف ثم المدير العام', { id: t });
      onClose();
    } catch (e: any) { toast.error(e?.message || 'فشل رفع الطلب', { id: t }); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#0d0d0d] border-2 border-blue-500/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-400" />
          <div className="text-lg font-black text-blue-300">طلب تعديل حقل مجمّد</div>
        </div>
        <div className="text-xs text-slate-400">الحقل: <b className="text-slate-200">{field.labelAr}</b></div>
        <div className="p-2 rounded-md bg-[#232323] text-xs text-slate-300">
          <div className="text-[10px] text-slate-500 mb-0.5">القيمة الحالية</div>
          <div dir="auto">{typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue ?? '—')}</div>
        </div>
        <div>
          <label className="text-xs text-slate-300 mb-1 block font-semibold">القيمة المطلوبة</label>
          {field.fieldType === 'select' && field.withQuantity ? (
            <textarea value={newVal} onChange={e => setNewVal(e.target.value)} rows={4}
              placeholder='[{"item":"...","qty":1}]'
              className="w-full bg-[#232323] border border-[#2c2c2c] rounded-lg p-2 text-xs text-white font-mono" />
          ) : field.fieldType === 'select' ? (
            <select value={newVal} onChange={e => setNewVal(e.target.value)} className="w-full bg-[#232323] border border-[#2c2c2c] rounded-lg p-2 text-sm text-white">
              <option value="">— اختر —</option>
              {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : field.fieldType === 'textarea' ? (
            <textarea value={newVal} onChange={e => setNewVal(e.target.value)} rows={3}
              className="w-full bg-[#232323] border border-[#2c2c2c] rounded-lg p-2 text-sm text-white" />
          ) : (
            <input type={field.fieldType === 'number' ? 'number' : 'text'} value={newVal} onChange={e => setNewVal(e.target.value)}
              className="w-full bg-[#232323] border border-[#2c2c2c] rounded-lg p-2 text-sm text-white" />
          )}
        </div>
        <div>
          <label className="text-xs text-slate-300 mb-1 block font-semibold">سبب طلب التعديل</label>
          <textarea value={reason} onChange={e => setReason(e.target.value.slice(0, 1000))} rows={3}
            placeholder="اشرح سبب الحاجة إلى التعديل..."
            className="w-full bg-[#232323] border border-[#2c2c2c] rounded-lg p-2 text-sm text-white" />
          <div className="text-[10px] text-slate-500 mt-1">{reason.length}/1000</div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-[#232323] text-slate-300 font-bold">إلغاء</button>
          <button onClick={submit} disabled={busy || reason.trim().length < 5}
            className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-black font-black disabled:opacity-50">
            {busy ? 'جاري الإرسال...' : 'رفع الطلب'}
          </button>
        </div>
      </div>
    </div>
  );
}
