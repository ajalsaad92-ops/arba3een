import React, { useMemo } from 'react';
import { useOps } from '../../store/opsStore';
import { useOffices } from '../../lib/offices';
import IraqMap from '../IraqMap';
import MapLayerControl from '../MapLayerControl';
import { getEffectiveKpiCatalog } from '../../lib/kpiCatalog';
import { buildInsights } from '../../lib/insights';
import { AlertOctagon, TrendingUp, TrendingDown, Star, Info, Package, Activity } from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import type { Office } from '../../data/offices';

export const OpsView = React.memo(function OpsView({ agg, effectiveFilter, selectedOffice, setSelectedOffice, activeEmergencies }: any) {
  const { state } = useOps();
  const { officeById } = useOffices();
  const insights = useMemo(() => buildInsights(state.todayReports, state.historicalReports, state.emergencies, state.users), [state.todayReports, state.historicalReports, state.emergencies, state.users]);

  return (
    <div className="h-full relative">
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2 w-52 max-h-[70vh] overflow-y-auto">
        <OpsKpiOverlay agg={agg} activeEmergencies={activeEmergencies} />
      </div>
      {activeEmergencies > 0 && state.currentUser?.role !== 'viewer' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-red-600/95 text-white px-4 py-2 rounded-lg shadow-2xl flex items-center gap-2 text-sm font-bold">
          <AlertOctagon className="w-4 h-4" />
          <span>حالة طارئة نشطة في {officeById(state.emergencies.find((e:any)=>e.status==='active')?.officeId ?? '')?.nameAr}</span>
        </div>
      )}
      <MapLayerControl position="left" variant="vertical" />
      <IraqMap onSelectOffice={setSelectedOffice} selectedOfficeId={selectedOffice?.id} filterOfficeIds={effectiveFilter} height="100%" />
      <SmartInsightsTicker insights={insights} />
    </div>
  );
});

function OpsKpiOverlay({ agg, activeEmergencies }: any) {
  const { state } = useOps();
  const ids = state.currentUser?.role === 'viewer' ? state.customKpis.filter((id:string)=>id!=='emergencies') : state.customKpis;
  const catalog = getEffectiveKpiCatalog(state.fieldDefinitions);
  const toneClass: Record<string,string> = {
    amber:'from-amber-400 to-orange-600', blue:'from-blue-400 to-indigo-600', emerald:'from-emerald-400 to-teal-600',
    red:'from-red-400 to-rose-700', orange:'from-orange-400 to-red-600', purple:'from-purple-400 to-fuchsia-700', slate:'from-slate-400 to-slate-600'
  };
  const textClass: Record<string,string> = {
    amber:'text-amber-400', blue:'text-blue-400', emerald:'text-emerald-400', red:'text-red-300', orange:'text-orange-400', purple:'text-purple-400', slate:'text-slate-300'
  };
  return <>
    {ids.map((id: string) => {
      const def = catalog.find(k=>k.id===id); if(!def) return null;
      const v = id==='emergencies' ? activeEmergencies : (agg as any)[id] || 0;
      const isEmergency = id==='emergencies' && v>0;
      return (
        <div key={id} className={`${isEmergency?'bg-gradient-to-br from-red-900/95 to-red-800/85 border-red-500/50':'bg-gradient-to-br from-[#0B0F19]/95 to-[#111827]/85 border-[#1E293B]'} backdrop-blur-md border rounded-lg p-2.5 relative overflow-hidden`}>
          <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${toneClass[def.tone]}`} />
          <div className="text-[10px] text-slate-400 mb-0.5">{def.label}</div>
          <div className={`text-xl font-black ${textClass[def.tone]}`}>{formatNumber(v)}</div>
        </div>
      );
    })}
  </>;
}

function SmartInsightsTicker({ insights }: { insights: ReturnType<typeof buildInsights> }) {
  if (insights.length === 0) {
    return <div className="absolute bottom-0 left-0 right-0 z-[400] bg-[#0B0F19]/90 backdrop-blur-md border-t border-[#1E293B] h-10 flex items-center px-4 text-xs text-slate-500">لا توجد رؤى لعرضها بعد</div>;
  }
  const iconFor = (icon: string) => {
    switch(icon){
      case 'up': return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
      case 'down': return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
      case 'alert': return <AlertOctagon className="w-3.5 h-3.5 text-red-400" />;
      case 'star': return <Star className="w-3.5 h-3.5 text-amber-400" />;
      case 'service': return <Package className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <Info className="w-3.5 h-3.5 text-blue-400" />;
    }
  };
  const toneCls = (tone: string) => tone==='positive' ? 'text-emerald-300' : tone==='negative' ? 'text-red-300' : tone==='warning' ? 'text-amber-300' : 'text-slate-200';
  return (
    <div className="absolute bottom-0 left-0 right-0 z-[400] bg-[#0B0F19]/95 backdrop-blur-md border-t border-[#1E293B] h-12 flex items-center overflow-hidden" dir="rtl">
      <div className="shrink-0 px-3 text-[10px] font-bold text-black bg-amber-400 h-full flex items-center gap-1.5"><Activity className="w-3 h-3" />رؤى لحظية</div>
      <div className="flex-1 overflow-hidden relative">
        <div className="flex w-max items-center animate-marquee-rtl whitespace-nowrap text-xs" style={{ animationDuration: `${Math.max(25, insights.length * 6)}s` }}>
          {[...insights, ...insights].map((ins, i) => (
            <div key={`${ins.id}-${i}`} className="flex items-center gap-2 px-6 shrink-0">
              {ins.source && <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black">{ins.source}</span>}
              {iconFor(ins.icon)}
              <span className={`font-semibold ${toneCls(ins.tone)}`}>{ins.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
