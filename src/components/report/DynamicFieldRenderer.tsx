import { memo } from 'react';
import { MapPin, MapPinned, X, Plus, Lock } from 'lucide-react';
import type { ReportFieldDefinition } from '../../data/types';

export type Pt = { lat: number; lng: number };

function renderLockedValue(field: ReportFieldDefinition, value: any, location: Pt | null, route: Pt[]): string {
  if (field.fieldType === 'location') return location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : '—';
  if (field.fieldType === 'multi_location' || field.fieldType === 'route') return route?.length ? `${route.length} نقطة` : '—';
  if (field.fieldType === 'select' && field.withQuantity) {
    if (!Array.isArray(value) || !value.length) return '—';
    return value.map((r: any) => `${r.item} × ${r.qty}`).join('، ');
  }
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}

export interface DynamicFieldRendererProps {
  field: ReportFieldDefinition; value: any; error?: string; onChange: (v: any) => void;
  location: Pt | null; route: Pt[]; locked?: boolean; onRequestEdit?: () => void;
  onOpenPicker: (m: 'single' | 'multi' | 'route', l: string) => void;
  onRemoveRoutePoint: (i: number) => void; onClearLocation: () => void;
}

function DynamicFieldRenderer({ field, value, error, onChange, location, route, locked, onRequestEdit, onOpenPicker, onRemoveRoutePoint, onClearLocation }: DynamicFieldRendererProps) {
  if (locked) {
    return (
      <div>
        <label className="text-xs text-slate-300 mb-1.5 block font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-blue-400" />{field.labelAr}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">مجمّد</span>
        </label>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0d0d0d] border border-blue-500/30 text-xs">
          <span className="flex-1 text-slate-200 truncate">{renderLockedValue(field, value, location, route)}</span>
          <button onClick={onRequestEdit} className="text-[11px] px-2 py-1 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-200 font-bold hover:bg-blue-500/30">طلب تعديل</button>
        </div>
        {field.descriptionAr && <div className="text-[10px] text-slate-500 mt-1">{field.descriptionAr}</div>}
      </div>
    );
  }
  const inputCls = `w-full bg-[#232323] border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 ${error ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20' : 'border-[#2c2c2c] focus:border-amber-500/40 focus:ring-amber-500/20'}`;
  const Label = <label className="text-xs text-slate-300 mb-1.5 block font-semibold flex items-center justify-between"><span>{field.labelAr}</span>{field.maxLength && <span className="text-[10px] text-slate-500">{String(value ?? '').length}/{field.maxLength}</span>}</label>;
  const helper = field.descriptionAr ? <div className="text-[10px] text-slate-500 mt-1">{field.descriptionAr}</div> : null;

  if (field.fieldType === 'number') return <div>{Label}<input type="text" inputMode="numeric" value={value ?? ''} onChange={e => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))} placeholder={field.placeholderAr ?? ''} className={inputCls} />{error ? <div className="text-[10px] text-red-400 mt-1">{error}</div> : helper}</div>;
  if (field.fieldType === 'textarea') return <div>{Label}<textarea value={value ?? ''} onChange={e => onChange(e.target.value.slice(0, field.maxLength || 2000))} className={inputCls + ' min-h-20 resize-none'} placeholder={field.placeholderAr ?? ''} />{error ? <div className="text-[10px] text-red-400 mt-1">{error}</div> : helper}</div>;
  if (['text', 'date', 'time'].includes(field.fieldType)) return <div>{Label}<input type={field.fieldType === 'text' ? 'text' : field.fieldType} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholderAr ?? ''} className={inputCls} />{error ? <div className="text-[10px] text-red-400 mt-1">{error}</div> : helper}</div>;
  if (field.fieldType === 'select') return <div>{Label}<SelectField field={field} value={value} onChange={onChange} />{error ? <div className="text-[10px] text-red-400 mt-1">{error}</div> : helper}</div>;
  if (field.fieldType === 'location') return (
    <div>{Label}{location ? (
      <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs">
        <MapPin className="w-4 h-4 text-emerald-400" /><span className="flex-1 font-mono text-emerald-200">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
        <button onClick={() => onOpenPicker('single', field.labelAr)} className="text-emerald-400 text-[11px] font-bold">تعديل</button>
        <button onClick={onClearLocation} className="text-red-400"><X className="w-3.5 h-3.5" /></button>
      </div>
    ) : (
      <button onClick={() => onOpenPicker('single', field.labelAr)} className="w-full flex items-center justify-center gap-2 p-2.5 bg-[#232323] border border-dashed border-[#2c2c2c] rounded-lg text-slate-400 hover:text-amber-400 text-xs">
        <MapPinned className="w-4 h-4" /> فتح الخريطة
      </button>
    )}{helper}</div>
  );
  if (field.fieldType === 'multi_location' || field.fieldType === 'route') {
    const isRoute = field.fieldType === 'route';
    return <div>{Label}
      <div className="space-y-1.5">
        {route.map((wp, i) => (
          <div key={i} className="flex items-center gap-2 p-2 bg-[#232323] border border-[#2c2c2c] rounded-lg text-xs">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
            <span className="flex-1 font-mono">{wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}</span>
            <button onClick={() => onRemoveRoutePoint(i)} className="text-red-400"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <button onClick={() => onOpenPicker(isRoute ? 'route' : 'multi', field.labelAr)} className="w-full p-2 bg-[#232323] border border-dashed border-[#2c2c2c] rounded-lg text-slate-400 hover:text-amber-400 text-xs">
          {route.length ? `تعديل (${route.length} نقطة)` : 'فتح الخريطة'}
        </button>
      </div>{helper}</div>;
  }
  return <div>{Label}<input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} className={inputCls} />{helper}</div>;
}

function SelectField({ field, value, onChange }: { field: ReportFieldDefinition; value: any; onChange: (v: any) => void }) {
  const options = field.options ?? [];
  const allowFree = field.allowFreeText;
  const cls = 'flex-1 bg-[#232323] border border-[#2c2c2c] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/40 focus:outline-none';
  if (!field.withQuantity) {
    const v = typeof value === 'string' ? value : '';
    const isOtherDraft = v === '__other__';
    const isFree = !!v && !isOtherDraft && !options.includes(v);
    return <div className="space-y-1.5">
      <select value={isOtherDraft || isFree ? '__other__' : v} onChange={e => onChange(e.target.value)} className={cls + ' w-full'}>
        <option value="">— اختر —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        {allowFree && <option value="__other__">أخرى…</option>}
      </select>
      {allowFree && (isOtherDraft || isFree) && <input type="text" value={isOtherDraft ? '' : v} onChange={e => onChange(e.target.value.slice(0, 200))} className={cls + ' w-full'} placeholder="اكتب…" />}
    </div>;
  }
  const list = Array.isArray(value) ? value : [];
  const rows = list.length ? list : [{ item: '', qty: 1 }];
  const update = (next: any[]) => onChange(next.slice(0, 50));
  return <div className="space-y-2">
    {rows.map((r: any, i: number) => {
      const isOtherDraft = r.item === '__other__';
      const isFree = !!r.item && !isOtherDraft && !options.includes(r.item);
      return <div key={i} className="flex flex-wrap items-center gap-1.5 bg-[#0d0d0d] border border-[#232323] rounded-lg p-2">
        <select value={isOtherDraft || isFree ? '__other__' : r.item} onChange={e => { const n = [...rows]; n[i] = { ...n[i], item: e.target.value }; update(n); }} className={cls}>
          <option value="">— اختر —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
          {allowFree && <option value="__other__">أخرى…</option>}
        </select>
        {allowFree && (isOtherDraft || isFree) && <input type="text" value={isOtherDraft ? '' : r.item} onChange={e => { const n = [...rows]; n[i] = { ...n[i], item: e.target.value.slice(0, 200) }; update(n); }} placeholder="اسم المادة" className={cls} />}
        <input type="number" min={1} max={999999} value={r.qty} onChange={e => { const n = [...rows]; n[i] = { ...n[i], qty: Math.max(1, Math.min(999999, Number(e.target.value) || 1)) }; update(n); }} className="w-20 bg-[#232323] border border-[#2c2c2c] rounded-lg px-2 py-2.5 text-sm text-center" />
        {rows.length > 1 && <button onClick={() => update(rows.filter((_, idx) => idx !== i))} className="p-2 rounded bg-red-500/10 text-red-300"><X className="w-4 h-4" /></button>}
      </div>;
    })}
    <button onClick={() => rows.length < 50 && onChange([...rows, { item: '', qty: 1 }])} disabled={rows.length >= 50}
      className="w-full p-2 bg-[#232323] border border-dashed border-[#2c2c2c] rounded-lg text-amber-400 text-xs font-bold disabled:opacity-40">
      <Plus className="w-4 h-4 inline ml-1" /> إضافة مادة {rows.length > 0 && `(${rows.length}/50)`}
    </button>
  </div>;
}

export const MemoField = memo(DynamicFieldRenderer, (p, n) => p.field.id === n.field.id && p.value === n.value && p.error === n.error && p.location === n.location && (p.route?.length ?? 0) === (n.route?.length ?? 0) && p.locked === n.locked);
