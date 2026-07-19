import React, { useMemo, useState, useEffect } from 'react';
import { useOps } from '../../store/opsStore';
import { useOffices } from '../../lib/offices';
import KpiCard from '../KpiCard';
import IraqMap from '../IraqMap';
import { getEffectiveKpiCatalog, getVisibleKpiIds, isBuiltInFieldHidden } from '../../lib/kpiCatalog';
import { AlertOctagon, Check, X, Timer, Eye, Activity, BarChart3, TrendingUp, BarChart2 } from 'lucide-react';
import { formatNumber, relativeTime } from '../../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import type { Office } from '../../data/offices';
import type { ReportFieldDefinition } from '../../data/types';
import EmergencyDetailCard from '../EmergencyDetailCard';
import { operationalDateDaysAgo } from '../../lib/opDate';
import { extraFieldNumericValue } from '../../lib/extraFieldStats';

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

function AnalyticsSection({ effectiveFilter }: any) {
  const { state } = useOps();
  const { offices } = useOffices();
  type VisitorChartType = 'area'|'line'|'vertical'|'horizontal';
  const [visitorChartType, setVisitorChartType] = usePersisted<VisitorChartType>('dash:visitorChartType', 'area');
  const [chartMetric, setChartMetric] = usePersisted<string>('dash:chartMetric', 'visitorsIn');

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

  const totalValue = useMemo(() => areaData.reduce((sum:number, day:any) => {
    return sum + officesForChart.reduce((s:number, o:Office) => s + (day[o.code]||0), 0);
  }, 0), [areaData, officesForChart]);

  const peakDay = useMemo(() => {
    let peak = { date: '—', value: 0 };
    areaData.forEach((day:any) => {
      const v = officesForChart.reduce((s:number, o:Office) => s + (day[o.code]||0), 0);
      if (v > peak.value) peak = { date: day.date, value: v };
    });
    return peak;
  }, [areaData, officesForChart]);

  const avgPerDay = Math.round(totalValue / 14);

  return (
    <div className="p-3 pt-0 pb-6">
      <div className="relative bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-4 border-b border-[#232323] bg-gradient-to-l from-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <BarChart3 className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 leading-tight">{activeMetric.label}</h3>
              <div className="text-[11px] text-slate-500 mt-0.5">تحليل آخر 14 يوم — {officesForChart.length} مكتب</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">الفئة</span>
            <select value={chartMetric} onChange={e=>setChartMetric(e.target.value)}
              className="bg-[#0d0d0d] border border-[#2a2a2a] hover:border-amber-500/40 focus:border-amber-500/60 focus:outline-none rounded-lg px-3 py-1.5 text-xs text-slate-100 font-semibold min-w-[140px] transition-colors">
              {CHART_METRICS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[#232323] border-b border-[#232323]">
          <div className="px-5 py-3 text-center">
            <div className="text-[10px] text-slate-500 mb-1">المجموع</div>
            <div className="text-lg font-black text-amber-400 tabular-nums">{formatNumber(totalValue)}</div>
          </div>
          <div className="px-5 py-3 text-center">
            <div className="text-[10px] text-slate-500 mb-1">المتوسط اليومي</div>
            <div className="text-lg font-black text-slate-100 tabular-nums">{formatNumber(avgPerDay)}</div>
          </div>
          <div className="px-5 py-3 text-center">
            <div className="text-[10px] text-slate-500 mb-1">أعلى يوم</div>
            <div className="text-lg font-black text-emerald-400 tabular-nums">{formatNumber(peakDay.value)}</div>
            <div className="text-[9px] text-slate-500 mt-0.5 font-mono">{peakDay.date}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap border-b border-[#232323]">
          <div className="flex items-center gap-1 p-1 bg-[#0a0a0a] border border-[#232323] rounded-lg">
            {[
              {id:'area', label:'مساحة', icon: Activity},
              {id:'line', label:'خطي', icon: TrendingUp},
              {id:'vertical', label:'أعمدة', icon: BarChart3},
              {id:'horizontal', label:'أفقي', icon: BarChart2},
            ].map(t=>{
              const Icon=t.icon as any;
              const active = visitorChartType===t.id;
              return <button key={t.id} onClick={()=>setVisitorChartType(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${active?'bg-amber-500 text-black shadow-lg shadow-amber-500/20':'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>;
            })}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <span className="text-[10px] text-slate-500 ml-1">المكاتب:</span>
            {availableOffices.slice(0,8).map((o:Office)=>{
              const on = selectedChartOffices.includes(o.id);
              return <button key={o.id} onClick={()=>{
                setSelectedChartOffices(p=> on ? p.filter(x=>x!==o.id) : [...p, o.id]);
              }} className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${on?'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10':'bg-[#0a0a0a] text-slate-500 border-[#232323] hover:border-[#333] hover:text-slate-300'}`}>{o.nameAr.replace('مكتب ','')}</button>;
            })}
          </div>
        </div>

        {/* Chart */}
        <div className="p-5">
          <ResponsiveContainer width="100%" height={340}>
            {visitorChartType==='line' ? (
              <LineChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="date" tick={{ fill:'#64748B', fontSize:10 }} axisLine={{ stroke:'#232323' }} tickLine={false} />
                <YAxis tick={{ fill:'#64748B', fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:8, fontSize:11 }} cursor={{ stroke:'#F59E0B', strokeOpacity:0.3 }} />
                <Legend wrapperStyle={{ fontSize:10, paddingTop:12 }} iconType="circle" />
                {officesForChart.map((o:Office,i:number)=> <Line key={o.code} type="monotone" dataKey={o.code} stroke={SERIES_COLORS[i%8]} strokeWidth={2.5} dot={{ r:3 }} activeDot={{ r:5 }} name={o.nameAr.replace('مكتب ','')} />)}
              </LineChart>
            ) : visitorChartType==='vertical' ? (
              <BarChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="date" tick={{ fill:'#64748B', fontSize:10 }} axisLine={{ stroke:'#232323' }} tickLine={false} />
                <YAxis tick={{ fill:'#64748B', fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:8, fontSize:11 }} cursor={{ fill:'#F59E0B', fillOpacity:0.05 }} />
                <Legend wrapperStyle={{ fontSize:10, paddingTop:12 }} iconType="circle" />
                {officesForChart.map((o:Office,i:number)=> <Bar key={o.code} dataKey={o.code} fill={SERIES_COLORS[i%8]} name={o.nameAr.replace('مكتب ','')} radius={[4,4,0,0]} />)}
              </BarChart>
            ) : visitorChartType==='horizontal' ? (
              <BarChart data={areaData} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" horizontal={false} />
                <XAxis type="number" tick={{ fill:'#64748B', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="date" width={48} tick={{ fill:'#64748B', fontSize:10 }} axisLine={{ stroke:'#232323' }} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:8, fontSize:11 }} cursor={{ fill:'#F59E0B', fillOpacity:0.05 }} />
                <Legend wrapperStyle={{ fontSize:10, paddingTop:12 }} iconType="circle" />
                {officesForChart.map((o:Office,i:number)=> <Bar key={o.code} dataKey={o.code} fill={SERIES_COLORS[i%8]} name={o.nameAr.replace('مكتب ','')} radius={[0,4,4,0]} />)}
              </BarChart>
            ) : (
              <AreaChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {officesForChart.map((o:Office,i:number)=>{
                    const c = SERIES_COLORS[i%8];
                    return (
                      <linearGradient key={o.code} id={`grad-${o.code}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={c} stopOpacity={0} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="date" tick={{ fill:'#64748B', fontSize:10 }} axisLine={{ stroke:'#232323' }} tickLine={false} />
                <YAxis tick={{ fill:'#64748B', fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:8, fontSize:11 }} cursor={{ stroke:'#F59E0B', strokeOpacity:0.3 }} />
                <Legend wrapperStyle={{ fontSize:10, paddingTop:12 }} iconType="circle" />
                {officesForChart.map((o:Office,i:number)=> {
                  const c = SERIES_COLORS[i%8];
                  return <Area key={o.code} type="monotone" dataKey={o.code} stroke={c} strokeWidth={2} fill={`url(#grad-${o.code})`} name={o.nameAr.replace('مكتب ','')} />;
                })}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
