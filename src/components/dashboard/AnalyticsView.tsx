import React, { useMemo, useState } from 'react';
import { useOps } from '../../store/opsStore';
import { useOffices } from '../../lib/offices';
import KpiCard from '../KpiCard';
import IraqMap from '../IraqMap';
import { operationalDateDaysAgo } from '../../lib/opDate';
import { formatNumber, formatFullNumber } from '../../lib/utils';
import { Users, Truck, AlertOctagon, Activity, X, Download, BarChart3, TrendingUp, BarChart2 } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, BarChart, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { getHeatColor, toIntensity } from '../Heatmap';
import { exportComprehensiveReports } from '../../lib/exportReports';
import { toast } from 'sonner';
import type { Office } from '../../data/offices';

function usePersisted<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [v, setV] = React.useState<T>(()=>{ try{ const r=localStorage.getItem(key); return r?JSON.parse(r):initial;} catch {return initial;} });
  React.useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(v)); } catch{} }, [key, v]);
  return [v, setV];
}

const CHART_METRICS = [
  { id: 'visitorsIn', label: 'الوافدون', get: (r:any)=>r.visitorsIn||0 },
  { id: 'visitorsOut', label: 'المغادرون', get: (r:any)=>r.visitorsOut||0 },
  { id: 'vehicles', label: 'العجلات', get: (r:any)=>r.vehiclesCount||0 },
  { id: 'processions', label: 'المواكب', get: (r:any)=>r.processionsCount||0 },
  { id: 'deaths', label: 'الوفيات', get: (r:any)=>r.deathsCount||0 },
  { id: 'violations', label: 'الخروقات', get: (r:any)=>r.violationsCount||0 },
  { id: 'events', label: 'الفعاليات', get: (r:any)=>r.eventsCount||0 },
  { id: 'incidents', label: 'الحوادث', get: (r:any)=>r.incidentsCount||0 },
];

function computeAggregates(reports: any[], officeIds: string[], extraKeys:string[]=[]){
  const filt = officeIds.length===0 ? reports : reports.filter(r=>officeIds.includes(r.officeId));
  const base: Record<string,number> = { visitors:0, visitorsIn:0, visitorsOut:0, vehicles:0, processions:0, deaths:0, violations:0, events:0, incidents:0, resources:0, deployment:0 };
  for(const k of extraKeys) base[`x:${k}`]=0;
  for(const r of filt){
    base.visitorsIn += r.visitorsIn||0; base.visitorsOut += r.visitorsOut||0;
    base.visitors += (r.visitorsIn||0)+(r.visitorsOut||0);
    base.vehicles += r.vehiclesCount||0; base.processions += r.processionsCount||0;
    base.deaths += r.deathsCount||0; base.violations += r.violationsCount||0;
    base.events += r.eventsCount||0; base.incidents += r.incidentsCount||0;
    base.resources += r.resourcesDistributed||0; base.deployment += r.deploymentCount||0;
    if(r.extraFields){ for(const k of extraKeys){ const v=Number(r.extraFields[k]); if(!isNaN(v)) base[`x:${k}`]+=v; }}
  }
  return base;
}

export const AnalyticsView = React.memo(function AnalyticsView({ agg, trend, aggYesterday, effectiveFilter, selectedOffice, setSelectedOffice }: any) {
  const { state } = useOps();
  const { offices } = useOffices();
  type VisitorChartType = 'area'|'line'|'vertical'|'horizontal';
  const [visitorChartType, setVisitorChartType] = usePersisted<VisitorChartType>('dash:visitorChartType', 'area');
  const [chartMetric, setChartMetric] = usePersisted<string>('dash:chartMetric', 'visitorsIn');
  const [visitorFlow, setVisitorFlow] = usePersisted<'in'|'out'>('dash:visitorFlow','in');

  const availableOffices = useMemo(()=> offices.filter((o:Office)=> effectiveFilter.includes(o.id)), [offices, effectiveFilter]);
  const [selectedChartOffices, setSelectedChartOffices] = usePersisted<string[]>('dash:selectedChartOffices', availableOffices.slice(0,5).map(o=>o.id));

  const activeMetric = CHART_METRICS.find(m=>m.id===chartMetric) || CHART_METRICS[0];
  const officesForChart = useMemo(()=> availableOffices.filter(o=> selectedChartOffices.includes(o.id)).slice(0,8), [availableOffices, selectedChartOffices]);

  const hasAnyData = state.todayReports.length > 0 || state.historicalReports.length > 0;

  const sparklineFor = (key: keyof typeof agg) => {
    const days:number[] = [];
    for (let d=13; d>=0; d--) {
      const ds = operationalDateDaysAgo(d);
      const dayAgg = computeAggregates(state.historicalReports.filter(r=>r.reportDate===ds), effectiveFilter);
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
      const dayReports = state.historicalReports.filter(r=>r.reportDate===ds);
      officesForChart.forEach((o:Office)=>{
        const r = d===0 ? state.todayReports.find(x=>x.officeId===o.id) : dayReports.find(x=>x.officeId===o.id);
        obj[o.code] = r ? activeMetric.get(r) : 0;
      });
      days.push(obj);
    }
    return days;
  }, [state.historicalReports, state.todayReports, officesForChart, activeMetric]);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {!hasAnyData && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-200">
          لا توجد بيانات للتحليل بعد — ستظهر المؤشرات فور إدخال أول تقرير.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="relative">
          <KpiCard label={visitorFlow==='in' ? 'الوافدون' : 'المغادرون'} value={visitorFlow==='in' ? agg.visitorsIn : agg.visitorsOut}
            icon={Users} size="lg" trend={trend(visitorFlow==='in'?agg.visitorsIn:agg.visitorsOut, visitorFlow==='in'?aggYesterday.visitorsIn:aggYesterday.visitorsOut)}
            sparklineData={sparklineFor(visitorFlow==='in' ? 'visitorsIn':'visitorsOut')} borderGlow tone="amber" />
          <div className="absolute top-2 left-2 flex rounded-md overflow-hidden border border-amber-500/30 text-[10px] font-bold">
            <button onClick={()=>setVisitorFlow('in')} className={visitorFlow==='in'?'px-2 py-0.5 bg-amber-500 text-black':'px-2 py-0.5 bg-[#0B0F19] text-amber-300'}>وافدون</button>
            <button onClick={()=>setVisitorFlow('out')} className={visitorFlow==='out'?'px-2 py-0.5 bg-amber-500 text-black':'px-2 py-0.5 bg-[#0B0F19] text-amber-300'}>مغادرون</button>
          </div>
        </div>
        <KpiCard label="الوفيات" value={agg.deaths} icon={AlertOctagon} size="lg" trend={trend(agg.deaths, aggYesterday.deaths)} sparklineData={sparklineFor('deaths')} tone="red" />
        <KpiCard label="الخروقات" value={agg.violations} icon={X} size="lg" trend={trend(agg.violations, aggYesterday.violations)} sparklineData={sparklineFor('violations')} tone="orange" />
        <KpiCard label="الفعاليات" value={agg.events} icon={Activity} size="lg" trend={trend(agg.events, aggYesterday.events)} sparklineData={sparklineFor('events')} tone="purple" />
        <KpiCard label="العجلات" value={agg.vehicles} icon={Truck} size="lg" trend={trend(agg.vehicles, aggYesterday.vehicles)} sparklineData={sparklineFor('vehicles')} tone="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 bg-[#111827] border border-[#1E293B] rounded-xl p-4">
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
                  className={`px-2 py-1 rounded-md text-[10px] font-bold ${active?'bg-amber-500 text-black':'bg-[#0B0F19] text-slate-400 border border-[#1E293B]'}`}>
                  <Icon className="w-3 h-3 inline ml-1" />{t.label}
                </button>;
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap text-[11px]">
            <span className="text-slate-500">الفئة:</span>
            <select value={chartMetric} onChange={e=>setChartMetric(e.target.value)} className="bg-[#0B0F19] border border-[#1E293B] rounded px-2 py-1 text-slate-200">
              {CHART_METRICS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <span className="text-slate-500 mr-3">المكاتب: {selectedChartOffices.length}</span>
            <div className="flex flex-wrap gap-1">
              {availableOffices.slice(0,8).map((o:Office)=>{
                const on = selectedChartOffices.includes(o.id);
                return <button key={o.id} onClick={()=>{
                  setSelectedChartOffices(p=> on ? p.filter(x=>x!==o.id) : [...p, o.id]);
                }} className={`px-2 py-0.5 rounded text-[10px] border ${on?'bg-amber-500/20 text-amber-300 border-amber-500/40':'bg-[#0B0F19] text-slate-400 border-[#1E293B]'}`}>{o.nameAr.replace('مكتب ','')}</button>;
              })}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            {visitorChartType==='line' ? (
              <LineChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" tick={{ fill:'#94A3B8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#111827', border:'1px solid #1E293B' }} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                {officesForChart.map((o:Office,i:number)=> <Line key={o.code} type="monotone" dataKey={o.code} stroke={['#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#F97316','#06B6D4','#EC4899'][i%8]} strokeWidth={2} dot={false} name={o.nameAr.replace('مكتب ','')} />)}
              </LineChart>
            ) : (
              <AreaChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" tick={{ fill:'#94A3B8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#111827', border:'1px solid #1E293B' }} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                {officesForChart.map((o:Office,i:number)=> {
                  const c = ['#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#F97316','#06B6D4','#EC4899'][i%8];
                  return <Area key={o.code} type="monotone" dataKey={o.code} stroke={c} fill={c} fillOpacity={0.15} name={o.nameAr.replace('مكتب ','')} />;
                })}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-[#111827] border border-[#1E293B] rounded-xl p-4">
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

      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
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
});
