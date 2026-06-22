import { useState, useMemo } from 'react';
import { useOps } from '../store/opsStore';
import { Building2, Diamond, MapPin, Waves, Users, Layers, ChevronDown, Check, Map as MapIcon } from 'lucide-react';
import { OFFICES } from '../data/offices';
import { computeFieldLayers, fieldLayerOffKey, isFieldLayerOn } from '../lib/mapLayers';

const LAYERS = [
  { id: 'offices', label: 'مواقع المكاتب', icon: Building2, color: 'text-amber-400' },
  { id: 'borderCrossings', label: 'المنافذ الحدودية', icon: Diamond, color: 'text-emerald-400' },
  { id: 'events', label: 'الانتشار والفعاليات', icon: MapPin, color: 'text-blue-400' },
  { id: 'flowPaths', label: 'مسارات الزوار', icon: Waves, color: 'text-orange-400' },
  { id: 'agentGPS', label: 'مواقع مستخدمي الموقع (مباشر)', icon: Users, color: 'text-blue-300' },
];

const PROVINCES = OFFICES.filter(o => o.id !== 'HQ').map(o => ({ code: o.id, label: o.governorateAr }));

interface Props {
  position?: 'right' | 'left';
  variant?: 'vertical' | 'horizontal';
  className?: string;
}

export default function MapLayerControl({ position = 'right', variant = 'vertical', className = '' }: Props) {
  const { state, dispatch } = useOps();
  const active = state.activeMapLayers;
  const visibleProv = state.visibleProvinces;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'layers' | 'provinces'>('layers');

  // Dynamic layers: every report field that actually has location/route data
  // becomes its own toggleable layer (default ON).
  const fieldLayers = useMemo(
    () => computeFieldLayers(state.fieldDefinitions, state.todayReports),
    [state.fieldDefinitions, state.todayReports]
  );

  // Unified layer list (built-in + data-driven custom fields).
  const allLayers = useMemo(() => {
    const builtins = LAYERS.map(l => ({
      label: l.label, icon: l.icon, color: l.color,
      toggleKey: l.id, on: active.has(l.id),
    }));
    const dyn = fieldLayers.map(f => ({
      label: f.label,
      icon: f.kind === 'route' ? Waves : MapPin,
      color: f.kind === 'route' ? 'text-cyan-400' : 'text-violet-400',
      toggleKey: fieldLayerOffKey(f.key),
      on: isFieldLayerOn(active, f.key),
    }));
    return [...builtins, ...dyn];
  }, [active, fieldLayers]);

  const activeCount = allLayers.filter(l => l.on).length;
  const provCount = visibleProv.size === 0 ? PROVINCES.length : visibleProv.size;

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center gap-1 flex-wrap ${className}`}>
        {LAYERS.map(l => {
          const Icon = l.icon;
          const on = active.has(l.id);
          return (
            <button
              key={l.id}
              onClick={() => dispatch({ type: 'TOGGLE_LAYER', layer: l.id })}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold border transition-all ${
                on
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-[#0B0F19]/80 text-slate-400 border-[#1E293B] hover:border-slate-500'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${on ? l.color : ''}`} />
              {l.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`absolute ${position === 'right' ? 'right-3' : 'left-3'} top-3 z-[400] ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-lg text-xs font-bold text-slate-700 hover:border-amber-500 transition-colors min-w-[210px]"
      >
        <Layers className="w-4 h-4 text-amber-500" />
        <span className="flex-1 text-right">طبقات الخريطة</span>
        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold tabular-nums">
          {activeCount}/{LAYERS.length}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold tabular-nums" title="المحافظات الظاهرة">
          {provCount}/{PROVINCES.length}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 w-[270px] bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden">
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setTab('layers')}
              className={`flex-1 px-3 py-2 text-[11px] font-bold flex items-center justify-center gap-1.5 ${tab === 'layers' ? 'bg-white text-amber-600 border-b-2 border-amber-500' : 'text-slate-500'}`}
            >
              <Layers className="w-3 h-3" /> الطبقات
            </button>
            <button
              onClick={() => setTab('provinces')}
              className={`flex-1 px-3 py-2 text-[11px] font-bold flex items-center justify-center gap-1.5 ${tab === 'provinces' ? 'bg-white text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500'}`}
            >
              <MapIcon className="w-3 h-3" /> المحافظات
            </button>
          </div>

          {tab === 'layers' && (
            <div className="p-1">
              {LAYERS.map(l => {
                const Icon = l.icon;
                const on = active.has(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => dispatch({ type: 'TOGGLE_LAYER', layer: l.id })}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs transition-colors text-right ${
                      on ? 'bg-amber-50 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-amber-500 border-amber-500' : 'border-slate-300 bg-white'}`}>
                      {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                    <Icon className={`w-4 h-4 shrink-0 ${on ? l.color.replace('-400', '-500').replace('-300', '-500') : 'text-slate-400'}`} />
                    <span className="flex-1 font-semibold">{l.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'provinces' && (
            <div className="p-1 max-h-72 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] text-slate-500 leading-snug">
                فارغ = عرض كل العراق. اختر محافظة أو أكثر لإظهارها فقط.
              </div>
              {PROVINCES.map(p => {
                const filtered = visibleProv.size > 0;
                const sel = filtered && visibleProv.has(p.code);
                return (
                  <button
                    key={p.code}
                    onClick={() => dispatch({ type: 'TOGGLE_PROVINCE', code: p.code })}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-right ${
                      sel ? 'bg-emerald-50 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      sel ? 'bg-emerald-500 border-emerald-500'
                          : !filtered ? 'bg-slate-200 border-slate-300'
                          : 'border-slate-300 bg-white'
                    }`}>
                      {sel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 font-semibold">{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex border-t border-slate-200">
            {tab === 'layers' ? (
              <>
                <button
                  onClick={() => LAYERS.forEach(l => !active.has(l.id) && dispatch({ type: 'TOGGLE_LAYER', layer: l.id }))}
                  className="flex-1 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50"
                >
                  تفعيل الكل
                </button>
                <div className="w-px bg-slate-200" />
                <button
                  onClick={() => LAYERS.forEach(l => active.has(l.id) && dispatch({ type: 'TOGGLE_LAYER', layer: l.id }))}
                  className="flex-1 px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50"
                >
                  إخفاء الكل
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => dispatch({ type: 'SET_PROVINCES', codes: [] })}
                  className="flex-1 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50"
                >
                  عرض كل العراق
                </button>
                <div className="w-px bg-slate-200" />
                <button
                  onClick={() => dispatch({ type: 'SET_PROVINCES', codes: PROVINCES.map(p => p.code) })}
                  className="flex-1 px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50"
                >
                  تحديد الكل
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
