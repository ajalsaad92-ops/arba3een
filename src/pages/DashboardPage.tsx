import { useState, useMemo } from 'react';
import { useOps } from '../store/opsStore';
import { useOffices } from '../lib/offices';
import KpiCustomizer from '../components/KpiCustomizer';
import DateRangeFilter from '../components/DateRangeFilter';
import { Search, Map, Activity, BarChart3 } from 'lucide-react';
import { CommandView } from '../components/dashboard/CommandView';
import { OpsView } from '../components/dashboard/OpsView';
import { AnalyticsView } from '../components/dashboard/AnalyticsView';
import { operationalDateDaysAgo } from '../lib/opDate';
import { extraFieldNumericValue, statExtraKeys } from '../lib/extraFieldStats';

type ViewMode = 'command' | 'ops' | 'analytics';

function usePersisted<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [v, setV] = useState<T>(()=>{ try{ const r=localStorage.getItem(key); return r?JSON.parse(r):initial;}catch{return initial;}});
  useMemo(()=>{ try{ localStorage.setItem(key, JSON.stringify(v)); }catch{} }, [key, v]);
  return [v, setV];
}

function computeAggregates(reports: any[], officeIds: string[], extraKeys:string[]=[]): Record<string,number> {
  const filt = officeIds.length===0 ? reports : reports.filter(r=> officeIds.includes(r.officeId));
  const base:Record<string,number> = { visitors:0, visitorsIn:0, visitorsOut:0, vehicles:0, processions:0, deaths:0, violations:0, events:0, incidents:0, resources:0, deployment:0 };
  for(const k of extraKeys) base[`x:${k}`]=0;
  for(const r of filt){
    base.visitorsIn += r.visitorsIn||0; base.visitorsOut += r.visitorsOut||0;
    base.visitors += (r.visitorsIn||0)+(r.visitorsOut||0);
    base.vehicles += r.vehiclesCount||0; base.processions += r.processionsCount||0;
    base.deaths += r.deathsCount||0; base.violations += r.violationsCount||0;
    base.events += r.eventsCount||0; base.incidents += r.incidentsCount||0;
    base.resources += r.resourcesDistributed||0; base.deployment += r.deploymentCount||0;
    if(r.extraFields){ for(const k of extraKeys){ base[`x:${k}`] += extraFieldNumericValue(r.extraFields[k]); }}
  }
  return base;
}

export default function DashboardPage() {
  const { state, dispatch } = useOps();
  const { offices, officeById } = useOffices();
  const [view, setView] = usePersisted<ViewMode>('dash:view', 'command');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<any>(null);
  const [search, setSearch] = useState('');

  const user = state.currentUser!;
  const permittedIds = useMemo(() => 
    user.role === 'director' ? offices.map(o=>o.id) :
    user.role === 'supervisor' ? user.permittedOfficeIds :
    [user.officeId],
    [user, offices]
  );

  const effectiveFilter = useMemo(() => 
    state.officeFilter.length === 0 ? permittedIds : state.officeFilter.filter(id => permittedIds.includes(id)),
    [state.officeFilter, permittedIds]
  );

  const { aggToday, aggYesterday, rangeLabel } = useMemo(() => {
    const extraKeys = state.fieldDefinitions.filter(f=>f.countInStats && !f.isBuiltIn && f.fieldType==='number' && !f.isHidden).map(f=>f.fieldKey);
    const dr = state.dateRange;
    if (!dr) {
      const yestStr = operationalDateDaysAgo(1);
      return {
        aggToday: computeAggregates(state.todayReports, effectiveFilter, extraKeys),
        aggYesterday: computeAggregates(state.historicalReports.filter(r=>r.reportDate===yestStr), effectiveFilter, extraKeys),
        rangeLabel: 'اليوم',
      };
    }
    const all = [...state.historicalReports, ...state.todayReports];
    const inRange = all.filter(r => r.reportDate >= dr.from && r.reportDate <= dr.to);
    return {
      aggToday: computeAggregates(inRange, effectiveFilter, extraKeys),
      aggYesterday: computeAggregates([], effectiveFilter, extraKeys),
      rangeLabel: dr.from === dr.to ? dr.from : `${dr.from} → ${dr.to}`,
    };
  }, [state.dateRange, state.todayReports, state.historicalReports, effectiveFilter, state.fieldDefinitions]);

  const trend = (today:number, yest:number) => yest===0 ? 0 : ((today-yest)/yest)*100;
  const activeEmergencies = state.emergencies.filter(e=>e.status==='active').length;

  const officeFilterLabel = state.officeFilter.length===0 ? 'كل المكاتب' :
    state.officeFilter.length===1 ? officeById(state.officeFilter[0])?.nameAr ?? 'مكتب' :
    `${state.officeFilter.length} مكاتب`;

  return (
    <div className="h-full flex flex-col bg-[#0B0F19] overflow-hidden">
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap border-b border-[#1E293B]">
        <div className="flex items-center gap-1 bg-[#111827] border border-[#1E293B] rounded-lg p-1">
          {[
            { id:'ops', label:'العمليات', icon: Map },
            { id:'command', label:'القيادة', icon: Activity },
            { id:'analytics', label:'التحليل', icon: BarChart3 },
          ].map(t=>{
            const Icon=t.icon; const active=view===t.id;
            return <button key={t.id} onClick={()=>setView(t.id as ViewMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${active?'bg-amber-500 text-black':'text-slate-400 hover:text-slate-200'}`}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>;
          })}
        </div>

        {user.role !== 'agent' && (
          <div className="relative">
            <button onClick={()=>setFilterOpen(!filterOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1E293B] text-xs text-slate-300">
              <span>المكاتب:</span><span className="text-amber-400 font-bold">{officeFilterLabel}</span>
              <Search className="w-3 h-3 text-slate-500" />
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={()=>setFilterOpen(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-[#111827] border border-[#1E293B] rounded-xl shadow-2xl z-40 max-h-96 overflow-hidden">
                  <div className="p-2 border-b border-[#1E293B]">
                    <input placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)}
                      className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-md px-2 py-1.5 text-xs text-white" />
                  </div>
                  <div className="max-h-64 overflow-y-auto p-1">
                    <button onClick={()=>{ dispatch({ type:'SET_OFFICE_FILTER', ids:[]}); setFilterOpen(false); }}
                      className="w-full text-right px-2 py-1.5 rounded text-xs text-amber-400 hover:bg-[#1E293B] font-bold">
                      ✓ كل المكاتب
                    </button>
                    {offices.filter(o=> permittedIds.includes(o.id) && o.nameAr.includes(search)).map(o=>{
                      const sel = state.officeFilter.includes(o.id);
                      return (
                        <button key={o.id} onClick={()=>{
                          const next = sel ? state.officeFilter.filter(x=>x!==o.id) : [...state.officeFilter, o.id];
                          dispatch({ type:'SET_OFFICE_FILTER', ids: next });
                        }} className={`w-full text-right px-2 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-[#1E293B] ${sel?'text-amber-400':'text-slate-300'}`}>
                          <span className={`w-3 h-3 rounded border ${sel?'bg-amber-500 border-amber-500':'border-slate-500'}`} />
                          {o.nameAr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {user.role !== 'agent' && <DateRangeFilter />}
        {user.role !== 'agent' && <KpiCustomizer />}
        <div className="text-xs text-slate-500 hidden md:flex items-center gap-1">
          <span className="text-amber-400 font-bold">{rangeLabel}</span>
          <span>•</span>
          <span>آخر تحديث: {state.serverTime.toLocaleTimeString('en-GB',{hour12:false})}</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'command' && <CommandView agg={aggToday} trend={trend} aggYesterday={aggYesterday} effectiveFilter={effectiveFilter} selectedOffice={selectedOffice} setSelectedOffice={setSelectedOffice} activeEmergencies={activeEmergencies} />}
        {view === 'ops' && <OpsView agg={aggToday} effectiveFilter={effectiveFilter} selectedOffice={selectedOffice} setSelectedOffice={setSelectedOffice} activeEmergencies={activeEmergencies} />}
        {view === 'analytics' && <AnalyticsView agg={aggToday} trend={trend} aggYesterday={aggYesterday} effectiveFilter={effectiveFilter} selectedOffice={selectedOffice} setSelectedOffice={setSelectedOffice} />}
      </div>

      {selectedOffice && <DrillDown office={selectedOffice} onClose={()=>setSelectedOffice(null)} />}
    </div>
  );
}

// Drilldown – memoized
import { formatNumber, relativeTime } from '../lib/utils';

import { X } from 'lucide-react';
function DrillDown({ office, onClose }: { office: any; onClose: ()=>void }) {
  const { state } = useOps();
  const report = state.todayReports.find(r => r.officeId === office.id);
  const agents = state.agentLocations.filter(a => a.officeId === office.id);
  const emergencies = state.emergencies.filter(e => e.officeId === office.id && e.status !== 'resolved');
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[500]" onClick={onClose} />
      <div className="fixed top-0 left-0 bottom-0 w-[380px] max-w-[90vw] bg-[#0B0F19] border-r border-amber-500/30 z-[501] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#0B0F19] border-b border-[#1E293B] p-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-display font-black text-amber-400">{office.nameAr}</div>
            <div className="text-xs text-slate-400">{office.governorateAr} • {report ? relativeTime(report.submittedAt) : 'لا يوجد تقرير'}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#1E293B] hover:bg-[#263244] flex items-center justify-center text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          {report ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['الداخلون', report.visitorsIn],
                ['العجلات', report.vehiclesCount],
                ['المواكب', report.processionsCount],
                ['الوفيات', report.deathsCount],
                ['الحوادث', report.incidentsCount],
                ['الفعاليات', report.eventsCount],
              ].map(([l,v])=>(
                <div key={l as string} className="bg-[#111827] border border-[#1E293B] rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">{l}</div>
                  <div className="text-lg font-black text-slate-200">{formatNumber(v as number)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center text-sm text-red-300">لم يُرسل تقرير اليوم</div>
          )}
          <div>
            <div className="text-xs font-bold text-slate-300 mb-2">مستخدمو الموقع النشطون ({agents.length})</div>
            {agents.length === 0 ? <div className="text-xs text-slate-500 bg-[#111827] border border-[#1E293B] rounded-lg p-3 text-center">لا يوجد</div> :
              agents.map(a=>(
                <div key={a.agentId} className="flex items-center gap-2 p-2 rounded-md bg-[#111827] border border-[#1E293B] text-xs mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="flex-1">{a.agentName}</span>
                  <span className="text-slate-500 text-[10px]">{a.lat.toFixed(2)}, {a.lng.toFixed(2)}</span>
                </div>
              ))
            }
          </div>
          {emergencies.length > 0 && (
            <div>
              <div className="text-xs font-bold text-red-300 mb-2">حالات طارئة نشطة</div>
              {emergencies.map(e=>(
                <div key={e.id} className="p-2 rounded-md bg-red-500/10 border border-red-500/30 text-xs mb-1">
                  <div className="font-bold text-red-300">{e.emergencyType}</div>
                  <div className="text-slate-300 text-[10px] line-clamp-2">{e.description}</div>
                </div>
              ))}
            </div>
          )}
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold">إغلاق</button>
        </div>
      </div>
    </>
  );
}
