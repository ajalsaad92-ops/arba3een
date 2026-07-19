import React, { useMemo, useState, useEffect } from 'react';
import { useOps } from '../../store/opsStore';
import { useOffices } from '../../lib/offices';
import KpiCard from '../KpiCard';
import IraqMap from '../IraqMap';
import { getEffectiveKpiCatalog, getVisibleKpiIds, isBuiltInFieldHidden } from '../../lib/kpiCatalog';
import { AlertOctagon, Check, X, Timer, Eye, Users, Truck, Activity, Download, BarChart3, TrendingUp, BarChart2 } from 'lucide-react';
import { formatNumber, relativeTime } from '../../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import type { Office } from '../../data/offices';
import type { ReportFieldDefinition } from '../../data/types';
import EmergencyDetailCard from '../EmergencyDetailCard';
import { operationalDateDaysAgo } from '../../lib/opDate';
import { extraFieldNumericValue } from '../../lib/extraFieldStats';
import { getHeatColor, toIntensity } from '../Heatmap';
import { exportComprehensiveReports } from '../../lib/exportReports';
import { toast } from 'sonner';

const GOVERNORATE_COLORS = ['#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#F97316','#06B6D4','#EC4899','#84CC16','#FBBF24','#A78BFA','#34D399','#F87171','#FB923C','#FB7185'];
const SERIES_COLORS = ['#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#F97316','#06B6D4','#EC4899'];

function usePersisted<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [v, setV] = useState<T>(()=>{ try{ const r=localStorage.getItem(key); return r?JSON.parse(r):initial;} catch {return initial;} });
  useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(v)); } catch{} }, [key, v]);
  return [v, setV];
}

const BUILTIN_CHART_METRICS = [
  { id: 'visitorsIn', label: 'الوافدون', field: 'visitorsIn', get: (r:any)=>r.visitorsIn||0 },
  { id: 'visitorsOut', label: 'المغادرون', field: 'visitorsOut', get: (r:any)=>r.visitorsOut||0 },
  { id: 'vehicles', label: 'العجلات', field: 'vehiclesCount', get: (r:any)=>r.vehiclesCount||0 },
  { id: 'processions', label: 'المواكب', field: 'processionsCount', get: (r:any)=>r.processionsCount||0 },
  { id: 'deaths', label: 'الوفيات', field: 'deathsCount', get: (r:any)=>r.deathsCount||0 },
  { id: 'violations', label: 'الخروقات', field: 'violationsCount', get: (r:any)=>r.violationsCount||0 },
  { id: 'events', label: 'الفعاليات', field: 'eventsCount', get: (r:any)=>r.eventsCount||0 },
  { id: 'incidents', label: 'الحوادث', field: 'incidentsCount', get: (r:any)=>r.incidentsCount||0 },
];

export const CommandView = React.memo(function CommandView({ agg, trend, aggYesterday, effectiveFilter, selectedOffice, setSelectedOffice, activeEmergencies } : any) {
  const { state, actions } = useOps();
  const { officeById } = useOffices();
  const user = state.currentUser!;
  const canHandleEmergencies = user.role === 'director' || user.role === 'supervisor';
  const [detailEm, setDetailEm] = useState<any>(null);

  const visitorsHidden = isBuiltInFieldHidden(state.fieldDefinitions, 'visitorsIn') && isBuiltInFieldHidden(state.fieldDefinitions, 'visitorsOut');
  const eventsHidden = isBuiltInFieldHidden(state.fieldDefinitions, 'eventsCount');

  const governorateData = useMemo(() => {
    if (visitorsHidden) return [];
    const map: Record<string, number> = {};
    state.todayReports.filter((r:any) => effectiveFilter.includes(r.officeId)).forEach((r:any) => {
      const gov = officeById(r.officeId)?.governorateAr || r.officeId;
      map[gov] = (map[gov] || 0) + r.visitorsIn + r.visitorsOut;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value);
  }, [state.todayReports, effectiveFilter, officeById, visitorsHidden]);

  const eventsRanked = useMemo(() => {
    if (eventsHidden) return [];
    return state.todayReports.filter((r:any)=> effectiveFilter.includes(r.officeId))
      .map((r:any)=>({ name: officeById(r.officeId)?.nameAr ?? r.officeId, value: r.eventsCount, officeId: r.officeId }))
      .sort((a:any,b:any)=>b.value-a.value).slice(0,10);
  }, [state.todayReports, effectiveFilter, officeById, eventsHidden]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col lg:flex-row gap-3 p-3 lg:h-[calc(100vh-140px)]">
        <div className="lg:w-[45%] flex flex-col gap-3 lg:overflow-y-auto">
          <CustomKpiGrid agg={agg} aggYesterday={aggYesterday} trend={trend} activeEmergencies={activeEmergencies} />
          <div className="grid grid-cols-2 gap-3">
            {!visitorsHidden && (
              <div className="bg-[#1a1a1a] border border-[#232323] rounded-xl p-3">
                <div className="text-xs font-bold text-slate-300 mb-2">توزيع الزوار بالمحافظات</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={governorateData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {governorateData.map((_:any,i:number)=><Cell key={i} fill={GOVERNORATE_COLORS[i % GOVERNORATE_COLORS.length]} stroke="#0d0d0d" />)}
                    </Pie>
                    <Tooltip contentStyle={{ background:'#1a1a1a', border:'1px solid #232323', borderRadius:8, fontSize:11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-[10px] text-slate-500 text-center mt-1">المجموع: {formatNumber(agg.visitors)} زائر</div>
              </div>
            )}
            {!eventsHidden && (
              <div className="bg-[#1a1a1a] border border-[#232323] rounded-xl p-3">
                <div className="text-xs font-bold text-slate-300 mb-2">ترتيب المكاتب — الفعاليات</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={eventsRanked} layout="vertical" margin={{ left:5, right:10, top:5, bottom:5 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={60} tick={{ fill:'#94A3B8', fontSize:8 }} />
                    <Tooltip contentStyle={{ background:'#1a1a1a', border:'1px solid #232323', borderRadius:8, fontSize:10 }} />
                    <Bar dataKey="value" fill="#F59E0B" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>


          {/* report status table */}
          <ReportStatusTable effectiveFilter={effectiveFilter} onSelect={setSelectedOffice} />

          {activeEmergencies > 0 && user.role !== 'viewer' && (
            <div className="bg-red-900/20 border-2 border-red-500/50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-300">حالات طارئة نشطة — {activeEmergencies}</span>
              </div>
              <div className="space-y-1">
                {state.emergencies.filter((e:any)=> e.status==='active'||e.status==='acknowledged').slice(0,3).map((e:any)=>(
                  <div key={e.id} className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 text-xs">
                    <AlertOctagon className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-red-200 font-bold">{officeById(e.officeId)?.nameAr}</span>
                    <span className="text-slate-300 truncate flex-1">— {e.emergencyType}</span>
                    <span className="text-slate-500 text-[10px]">{relativeTime(e.createdAt)}</span>
                    <button onClick={()=>setDetailEm(e)} className="p-1 rounded bg-white/5 hover:bg-white/15"><Eye className="w-3.5 h-3.5" /></button>
                    {canHandleEmergencies && (
                      <div className="flex gap-1">
                        {e.status==='active' && <button onClick={()=>actions.ackEmergency(e.id, user.id)} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200">تأكيد</button>}
                        <button onClick={()=>actions.resolveEmergency(e.id, user.id)} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-200">حل</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="lg:w-[55%] bg-[#1a1a1a] border border-[#232323] rounded-xl overflow-hidden relative h-[55vh] lg:h-auto">
          <IraqMap onSelectOffice={setSelectedOffice} selectedOfficeId={selectedOffice?.id} filterOfficeIds={effectiveFilter} height="100%" />
        </div>
      </div>

      {/* --- Analytics section (merged from previous "تحليل" tab) --- */}
      <AnalyticsSection
        agg={agg}
        aggYesterday={aggYesterday}
        trend={trend}
        effectiveFilter={effectiveFilter}
        setSelectedOffice={setSelectedOffice}
      />

      {detailEm && <EmergencyDetailCard emergency={detailEm} users={state.users} onClose={()=>setDetailEm(null)} />}
    </div>
  );
});

function CustomKpiGrid({ agg, aggYesterday, trend, activeEmergencies }: any) {
  const { state } = useOps();
  const visible = getVisibleKpiIds(state.customKpis, state.fieldDefinitions, state.hiddenKpis);
  const ids = state.currentUser?.role === 'viewer' ? visible.filter((id:string)=>id!=='emergencies') : visible;
  const catalog = getEffectiveKpiCatalog(state.fieldDefinitions);
  const byId = (id:string)=> catalog.find(k=>k.id===id);
  const valFor = (id:string)=> id==='emergencies' ? activeEmergencies : (agg as any)[id] || 0;
  const yestFor = (id:string)=> id==='emergencies' ? activeEmergencies : (aggYesterday as any)[id] || 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {ids.map((id: string)=>{
        const def = byId(id); if(!def) return null;
        return <KpiCard key={id} label={def.label} value={valFor(id)} icon={def.icon} trend={id==='emergencies'?0:trend(valFor(id), yestFor(id))} tone={def.tone as any} borderGlow={id==='visitors'} />;
      })}
    </div>
  );
}

function ReportStatusTable({ effectiveFilter, onSelect }: { effectiveFilter: string[]; onSelect: (o: Office)=>void }) {
  const { state } = useOps();
  const { offices } = useOffices();
  const list = offices.filter(o => effectiveFilter.includes(o.id));
  return (
    <div className="bg-[#1a1a1a] border border-[#232323] rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-slate-300">حالة إرسال التقارير — اليوم</div>
        <div className="text-[10px] text-slate-500">{state.todayReports.length} / {list.length}</div>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {list.map(office => {
          const report = state.todayReports.find((r:any)=> r.officeId === office.id);
          const statusIcon = report ? <Check className="w-3 h-3 text-emerald-400" /> :
            state.extensions.some((e:any)=>e.officeId===office.id && e.status==='approved') ? <Timer className="w-3 h-3 text-blue-400" /> :
            <X className="w-3 h-3 text-red-400" />;
          const visitors = report ? (report.visitorsIn + report.visitorsOut) : 0;
          return (
            <button key={office.id} onClick={()=>onSelect(office)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#232323]/60 text-xs">
              <div className="w-5 h-5 rounded-full bg-[#232323] flex items-center justify-center">{statusIcon}</div>
              <span className="flex-1 text-right truncate text-slate-200">{office.nameAr}</span>
              <span className="font-mono text-amber-300">{report ? formatNumber(visitors) : '—'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Analytics section (merged from AnalyticsView)
// -----------------------------------------------------------------------------

function computeDayAggregate(reports: any[], officeIds: string[], defs: ReportFieldDefinition[]) {
  const filt = officeIds.length===0 ? reports : reports.filter(r=>officeIds.includes(r.officeId));
  const base: Record<string,number> = { visitors:0, visitorsIn:0, visitorsOut:0, vehicles:0, processions:0, deaths:0, violations:0, events:0, incidents:0, resources:0, deployment:0 };
  const h = (key:string) => isBuiltInFieldHidden(defs, key);
  for (const r of filt) {
    if(!h('visitorsIn')) base.visitorsIn += r.visitorsIn||0;
    if(!h('visitorsOut')) base.visitorsOut += r.visitorsOut||0;
    base.visitors = base.visitorsIn + base.visitorsOut;
    if(!h('vehiclesCount')) base.vehicles += r.vehiclesCount||0;
    if(!h('processionsCount')) base.processions += r.processionsCount||0;
    if(!h('deathsCount')) base.deaths += r.deathsCount||0;
    if(!h('violationsCount')) base.violations += r.violationsCount||0;
    if(!h('eventsCount')) base.events += r.eventsCount||0;
    if(!h('incidentsCount')) base.incidents += r.incidentsCount||0;
    if(!h('resourcesDistributed')) base.resources += extraFieldNumericValue(r.resourcesDistributed);
    if(!h('deploymentCount')) base.deployment += r.deploymentCount||0;
  }
  return base;
}

function AnalyticsSection({ agg, aggYesterday, trend, effectiveFilter, setSelectedOffice }: any) {
  const { state } = useOps();
  const { offices } = useOffices();
  type VisitorChartType = 'area'|'line'|'vertical'|'horizontal';
  const [visitorChartType, setVisitorChartType] = usePersisted<VisitorChartType>('dash:visitorChartType', 'area');
  const [chartMetric, setChartMetric] = usePersisted<string>('dash:chartMetric', 'visitorsIn');
  const [visitorFlow, setVisitorFlow] = usePersisted<'in'|'out'>('dash:visitorFlow','in');

  const availableOffices = useMemo(()=> offices.filter((o:Office)=> effectiveFilter.includes(o.id)), [offices, effectiveFilter]);
  const [selectedChartOffices, setSelectedChartOffices] = usePersisted<string[]>('dash:selectedChartOffices', availableOffices.slice(0,5).map(o=>o.id));

  // Chart metrics = active built-ins + admin-added numeric fields (dynamic)
  const CHART_METRICS = useMemo(() => {
    const built = BUILTIN_CHART_METRICS.filter(m => !isBuiltInFieldHidden(state.fieldDefinitions, m.field));
    const dyn = state.fieldDefinitions
      .filter((f:ReportFieldDefinition) => !f.isBuiltIn && !f.isHidden &&
        (f.fieldType === 'number' || (f.fieldType === 'select' && f.withQuantity)))
      .map((f:ReportFieldDefinition) => ({
        id: `x:${f.fieldKey}`,
        label: f.statLabelAr || f.labelAr,
        field: f.fieldKey,
        get: (r:any) => extraFieldNumericValue(r?.extraFields?.[f.fieldKey]),
      }));
    return [...built, ...dyn];
  }, [state.fieldDefinitions]);

  const activeMetric = CHART_METRICS.find(m=>m.id===chartMetric) || CHART_METRICS[0] || BUILTIN_CHART_METRICS[0];
  const officesForChart = useMemo(()=> availableOffices.filter(o=> selectedChartOffices.includes(o.id)).slice(0,8), [availableOffices, selectedChartOffices]);

  const visibleIds = useMemo(
    () => new Set(getVisibleKpiIds(state.customKpis, state.fieldDefinitions, state.hiddenKpis)),
    [state.customKpis, state.fieldDefinitions, state.hiddenKpis]
  );
  const additionalKpis = useMemo(() => {
    const alreadyShown = new Set(['visitors', 'vehicles', 'deaths', 'violations', 'events', 'emergencies']);
    const visible = [...visibleIds].filter(id => !alreadyShown.has(id));
    const catalog = getEffectiveKpiCatalog(state.fieldDefinitions);
    return visible.map(id => catalog.find(k => k.id === id)).filter(Boolean);
  }, [visibleIds, state.fieldDefinitions]);

  const sparklineFor = (key: string) => {
    const days:number[] = [];
    for (let d=13; d>=0; d--) {
      const ds = operationalDateDaysAgo(d);
      const dayAgg = computeDayAggregate(state.historicalReports.filter((r:any)=>r.reportDate===ds), effectiveFilter, state.fieldDefinitions);
      days.push((dayAgg as any)[key] || 0);
    }
    days.push((agg as any)[key] || 0);
    return days;
  };

  const areaData = useMemo(()=>{
    const days:any[]=[];
    for(let d=13; d>=0; d--){
      const ds = operationalDateDaysAgo(d);
      const obj:any = { date: ds.slice(5) };
      const dayReports = state.historicalReports.filter((r:any)=>r.reportDate===ds);
      officesForChart.forEach((o:Office)=>{
        const r = d===0 ? state.todayReports.find((x:any)=>x.officeId===o.id) : dayReports.find((x:any)=>x.officeId===o.id);
        obj[o.code] = r ? activeMetric.get(r) : 0;
      });
      days.push(obj);
    }
    return days;
  }, [state.historicalReports, state.todayReports, officesForChart, activeMetric]);

  return (
    <div className="p-3 pt-0 space-y-3">
      <div className="flex items-center gap-2 pt-2 border-t border-[#232323]">
        <BarChart3 className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-bold text-slate-200">التحليل والاتجاهات</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {visibleIds.has('visitors') && (
          <div className="relative">
            <KpiCard label={visitorFlow==='in' ? 'الوافدون' : 'المغادرون'} value={visitorFlow==='in' ? agg.visitorsIn : agg.visitorsOut}
              icon={Users} size="lg" trend={trend(visitorFlow==='in'?agg.visitorsIn:agg.visitorsOut, visitorFlow==='in'?aggYesterday.visitorsIn:aggYesterday.visitorsOut)}
              sparklineData={sparklineFor(visitorFlow==='in' ? 'visitorsIn':'visitorsOut')} borderGlow tone="amber" />
            <div className="absolute top-2 left-2 flex rounded-md overflow-hidden border border-amber-500/30 text-[10px] font-bold">
              <button onClick={()=>setVisitorFlow('in')} className={visitorFlow==='in'?'px-2 py-0.5 bg-amber-500 text-black':'px-2 py-0.5 bg-[#0d0d0d] text-amber-300'}>وافدون</button>
              <button onClick={()=>setVisitorFlow('out')} className={visitorFlow==='out'?'px-2 py-0.5 bg-amber-500 text-black':'px-2 py-0.5 bg-[#0d0d0d] text-amber-300'}>مغادرون</button>
            </div>
          </div>
        )}
        {visibleIds.has('deaths') && <KpiCard label="الوفيات" value={agg.deaths} icon={AlertOctagon} size="lg" trend={trend(agg.deaths, aggYesterday.deaths)} sparklineData={sparklineFor('deaths')} tone="red" />}
        {visibleIds.has('violations') && <KpiCard label="الخروقات" value={agg.violations} icon={X} size="lg" trend={trend(agg.violations, aggYesterday.violations)} sparklineData={sparklineFor('violations')} tone="orange" />}
        {visibleIds.has('events') && <KpiCard label="الفعاليات" value={agg.events} icon={Activity} size="lg" trend={trend(agg.events, aggYesterday.events)} sparklineData={sparklineFor('events')} tone="purple" />}
        {visibleIds.has('vehicles') && <KpiCard label="العجلات" value={agg.vehicles} icon={Truck} size="lg" trend={trend(agg.vehicles, aggYesterday.vehicles)} sparklineData={sparklineFor('vehicles')} tone="blue" />}
        {additionalKpis.map((k:any) => {
          const v = (agg as any)[k.id] || 0;
          const y = (aggYesterday as any)[k.id] || 0;
          return <KpiCard key={k.id} label={k.label} value={v} icon={k.icon} size="lg" trend={trend(v, y)} tone={k.tone as any} />;
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 bg-[#1a1a1a] border border-[#232323] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-sm font-bold text-slate-200">{activeMetric.label} — آخر 14 يوم</div>
            <div className="flex items-center gap-1">
              {[
                {id:'area', label:'مساحة', icon: Activity},
                {id:'line', label:'خطي', icon: TrendingUp},
                {id:'vertical', label:'أعمدة', icon: BarChart3},
                {id:'horizontal', label:'أفقي', icon: BarChart2},
              ].map(t=>{
                const Icon=t.icon as any;
                const active = visitorChartType===t.id;
                return <button key={t.id} onClick={()=>setVisitorChartType(t.id as any)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold ${active?'bg-amber-500 text-black':'bg-[#0d0d0d] text-slate-400 border border-[#232323]'}`}>
                  <Icon className="w-3 h-3 inline ml-1" />{t.label}
                </button>;
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap text-[11px]">
            <span className="text-slate-500">الفئة:</span>
            <select value={chartMetric} onChange={e=>setChartMetric(e.target.value)} className="bg-[#0d0d0d] border border-[#232323] rounded px-2 py-1 text-slate-200">
              {CHART_METRICS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <span className="text-slate-500 mr-3">المكاتب: {selectedChartOffices.length}</span>
            <div className="flex flex-wrap gap-1">
              {availableOffices.slice(0,8).map((o:Office)=>{
                const on = selectedChartOffices.includes(o.id);
                return <button key={o.id} onClick={()=>{
                  setSelectedChartOffices(p=> on ? p.filter(x=>x!==o.id) : [...p, o.id]);
                }} className={`px-2 py-0.5 rounded text-[10px] border ${on?'bg-amber-500/20 text-amber-300 border-amber-500/40':'bg-[#0d0d0d] text-slate-400 border-[#232323]'}`}>{o.nameAr.replace('مكتب ','')}</button>;
              })}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            {visitorChartType==='line' ? (
              <LineChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232323" />
                <XAxis dataKey="date" tick={{ fill:'#94A3B8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#1a1a1a', border:'1px solid #232323' }} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                {officesForChart.map((o:Office,i:number)=> <Line key={o.code} type="monotone" dataKey={o.code} stroke={SERIES_COLORS[i%8]} strokeWidth={2} dot={false} name={o.nameAr.replace('مكتب ','')} />)}
              </LineChart>
            ) : visitorChartType==='vertical' ? (
              <BarChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232323" />
                <XAxis dataKey="date" tick={{ fill:'#94A3B8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#1a1a1a', border:'1px solid #232323' }} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                {officesForChart.map((o:Office,i:number)=> <Bar key={o.code} dataKey={o.code} fill={SERIES_COLORS[i%8]} name={o.nameAr.replace('مكتب ','')} radius={[2,2,0,0]} />)}
              </BarChart>
            ) : visitorChartType==='horizontal' ? (
              <BarChart data={areaData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#232323" />
                <XAxis type="number" tick={{ fill:'#94A3B8', fontSize:10 }} />
                <YAxis type="category" dataKey="date" width={44} tick={{ fill:'#94A3B8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#1a1a1a', border:'1px solid #232323' }} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                {officesForChart.map((o:Office,i:number)=> <Bar key={o.code} dataKey={o.code} fill={SERIES_COLORS[i%8]} name={o.nameAr.replace('مكتب ','')} radius={[0,2,2,0]} />)}
              </BarChart>
            ) : (
              <AreaChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232323" />
                <XAxis dataKey="date" tick={{ fill:'#94A3B8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#1a1a1a', border:'1px solid #232323' }} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                {officesForChart.map((o:Office,i:number)=> {
                  const c = SERIES_COLORS[i%8];
                  return <Area key={o.code} type="monotone" dataKey={o.code} stroke={c} fill={c} fillOpacity={0.15} name={o.nameAr.replace('مكتب ','')} />;
                })}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-[#1a1a1a] border border-[#232323] rounded-xl p-4">
          <div className="text-sm font-bold text-slate-200 mb-3">خريطة حرارية — 7 أيام</div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {availableOffices.map((office: Office) => {
              const cellData:number[] = [];
              for(let i=6;i>=0;i--){
                const ds = operationalDateDaysAgo(i);
                const r = i===0 ? state.todayReports.find((x:any)=>x.officeId===office.id) : state.historicalReports.find((x:any)=>x.officeId===office.id && x.reportDate===ds);
                cellData.push(r ? r.visitorsIn + r.visitorsOut : 0);
              }
              const maxVal = Math.max(...cellData,1);
              return (
                <div key={office.id} className="flex items-center gap-2">
                  <div className="w-20 text-[10px] text-slate-300 truncate">{office.nameAr.replace('مكتب ','')}</div>
                  <div className="flex-1 flex gap-0.5">
                    {cellData.map((c,i)=>{
                      const intensity = c>0 ? toIntensity(c,0,maxVal):0;
                      const color = getHeatColor(intensity);
                      return <div key={i} title={String(c)} className="flex-1 h-5 rounded-sm" style={{ background: color.background }} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#232323] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-sm font-bold text-slate-200">تصدير شامل</div>
          <button
            onClick={()=>{
              const all=[...state.todayReports, ...state.historicalReports];
              if(!all.length){ toast.error('لا توجد بيانات'); return; }
              try { exportComprehensiveReports(all, state.users, state.fieldDefinitions); toast.success(`تم تصدير ${all.length} تقرير`);} catch(e:any){ toast.error(e?.message||'فشل');}
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
          >
            <Download className="w-4 h-4" /> تصدير Excel
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {availableOffices.map((o:Office)=>{
            const r = state.todayReports.find((x:any)=>x.officeId===o.id);
            const cls = r ? (r.isLateSubmission ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30') : 'bg-red-500/15 text-red-300 border-red-500/30';
            return <button key={o.id} onClick={()=>setSelectedOffice(o)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${cls}`}>{o.nameAr.replace('مكتب ','')}</button>;
          })}
        </div>
      </div>
    </div>
  );
}
