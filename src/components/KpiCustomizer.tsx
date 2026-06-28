import { useState } from 'react';
import { useOps } from '../store/opsStore';
import { getEffectiveKpiCatalog, getVisibleKpiIds } from '../lib/kpiCatalog';
import { Settings, Check, X } from 'lucide-react';

export default function KpiCustomizer() {
  const { state, dispatch } = useOps();
  const [open, setOpen] = useState(false);
  const catalog = getEffectiveKpiCatalog(state.fieldDefinitions);
  const selected = getVisibleKpiIds(state.customKpis, state.fieldDefinitions, state.hiddenKpis);

  const toggle = (id: string) => {
    const isOn = selected.includes(id);
    if (isOn) {
      if (selected.length === 1) return; // keep at least one
      // turn off: remove from custom selection and mark hidden (covers auto-merged dynamic KPIs)
      dispatch({ type: 'SET_CUSTOM_KPIS', ids: state.customKpis.filter(x => x !== id) });
      if (!state.hiddenKpis.includes(id)) dispatch({ type: 'SET_HIDDEN_KPIS', ids: [...state.hiddenKpis, id] });
    } else {
      // turn on: add to custom selection and clear any hidden flag
      if (!state.customKpis.includes(id)) dispatch({ type: 'SET_CUSTOM_KPIS', ids: [...state.customKpis, id] });
      if (state.hiddenKpis.includes(id)) dispatch({ type: 'SET_HIDDEN_KPIS', ids: state.hiddenKpis.filter(x => x !== id) });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#111827] border border-[#1E293B] text-[11px] text-slate-300 hover:border-amber-500/30 transition-colors"
        title="تخصيص الإحصائيات الظاهرة"
      >
        <Settings className="w-3.5 h-3.5 text-amber-400" />
        <span>تخصيص</span>
        <span className="px-1 rounded bg-amber-500/15 text-amber-300 text-[10px] font-bold">{selected.length}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[800]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-[#111827] border border-[#1E293B] rounded-xl shadow-2xl z-[801] overflow-hidden">
            <div className="px-3 py-2 border-b border-[#1E293B] flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">تخصيص الإحصائيات</span>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-1">
              {catalog.map(k => {
                const on = selected.includes(k.id);
                const Icon = k.icon;
                return (
                  <button
                    key={k.id}
                    onClick={() => toggle(k.id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs text-right hover:bg-[#1E293B]/60 ${on ? 'text-amber-300' : 'text-slate-400'}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-amber-500 border-amber-500' : 'border-slate-500'}`}>
                      {on && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                    </span>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1">{k.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}