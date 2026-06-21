import { useState } from 'react';
import { useOps } from '../store/opsStore';
import { Calendar, X } from 'lucide-react';
import { operationalDate, operationalDateDaysAgo } from '../lib/opDate';

function todayStr() { return operationalDate(); }
function daysAgoStr(n: number) { return operationalDateDaysAgo(n); }

export default function DateRangeFilter() {
  const { state, dispatch } = useOps();
  const [open, setOpen] = useState(false);
  const r = state.dateRange;
  const label = !r ? 'اليوم (تراكمي)' : r.from === r.to ? r.from : `${r.from} → ${r.to}`;

  const presets: { label: string; from: string; to: string | null }[] = [
    { label: 'اليوم', from: todayStr(), to: todayStr() },
    { label: 'آخر 7 أيام', from: daysAgoStr(6), to: todayStr() },
    { label: 'آخر 14 يوم', from: daysAgoStr(13), to: todayStr() },
    { label: 'آخر 30 يوم', from: daysAgoStr(29), to: todayStr() },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1E293B] text-xs text-slate-300 hover:border-amber-500/30 transition-colors"
      >
        <Calendar className="w-3.5 h-3.5 text-amber-400" />
        <span>التاريخ:</span>
        <span className="text-amber-400 font-bold tabular-nums">{label}</span>
        {r && (
          <span
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_DATE_RANGE', range: null }); }}
            className="w-4 h-4 rounded-full bg-[#1E293B] flex items-center justify-center hover:bg-red-500/30"
            role="button"
          >
            <X className="w-2.5 h-2.5" />
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[800]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-[#111827] border border-[#1E293B] rounded-xl shadow-2xl z-[801] p-3 space-y-3">
            <div className="text-[11px] font-bold text-slate-300">قوالب جاهزة</div>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => { dispatch({ type: 'SET_DATE_RANGE', range: { from: p.from, to: p.to! } }); setOpen(false); }}
                  className="px-2 py-1.5 rounded-md bg-[#0B0F19] border border-[#1E293B] text-[11px] text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="border-t border-[#1E293B] pt-3 space-y-2">
              <div className="text-[11px] font-bold text-slate-300">نطاق مخصص</div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 block mb-1">من</label>
                  <input
                    type="date"
                    defaultValue={r?.from || daysAgoStr(6)}
                    onChange={(e) => dispatch({ type: 'SET_DATE_RANGE', range: { from: e.target.value, to: r?.to || todayStr() } })}
                    className="w-full bg-[#0B0F19] border border-[#1E293B] rounded px-2 py-1 text-[11px] text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 block mb-1">إلى</label>
                  <input
                    type="date"
                    defaultValue={r?.to || todayStr()}
                    onChange={(e) => dispatch({ type: 'SET_DATE_RANGE', range: { from: r?.from || daysAgoStr(6), to: e.target.value } })}
                    className="w-full bg-[#0B0F19] border border-[#1E293B] rounded px-2 py-1 text-[11px] text-white"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={() => { dispatch({ type: 'SET_DATE_RANGE', range: null }); setOpen(false); }}
              className="w-full py-1.5 rounded-md bg-amber-500/15 text-amber-300 text-[11px] font-bold hover:bg-amber-500/25"
            >
              إعادة إلى وضع التراكم (اليوم)
            </button>
          </div>
        </>
      )}
    </div>
  );
}