import React, { useMemo, useState } from 'react';
import { useOps } from '../../store/opsStore';
import { useOffices } from '../../lib/offices';
import KpiCard from '../KpiCard';
import IraqMap from '../IraqMap';
import { getEffectiveKpiCatalog, getVisibleKpiIds } from '../../lib/kpiCatalog';
import { AlertOctagon, Check, X, Timer, Eye } from 'lucide-react';
import { formatNumber, relativeTime } from '../../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import type { Office } from '../../data/offices';
import EmergencyDetailCard from '../EmergencyDetailCard';

const GOVERNORATE_COLORS = ['#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#F97316','#06B6D4','#EC4899','#84CC16','#FBBF24','#A78BFA','#34D399','#F87171','#FB923C','#FB7185'];

export const CommandView = React.memo(function CommandView({ agg, trend, aggYesterday, effectiveFilter, selectedOffice, setSelectedOffice, activeEmergencies } : any) {
  const { state, actions } = useOps();
  const { officeById } = useOffices();
  const user = state.currentUser!;
  const canHandleEmergencies = user.role === 'director' || user.role === 'supervisor';
  const [detailEm, setDetailEm] = useState<any>(null);

  const governorateData = useMemo(() => {
    const map: Record<string, number> = {};
    state.todayReports.filter((r:any) => effectiveFilter.includes(r.officeId)).forEach((r:any) => {
      const gov = officeById(r.officeId)?.governorateAr || r.officeId;
      map[gov] = (map[gov] || 0) + r.visitorsIn + r.visitorsOut;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value);
  }, [state.todayReports, effectiveFilter, officeById]);

  const eventsRanked = useMemo(() => {
    return state.todayReports.filter((r:any)=> effectiveFilter.includes(r.officeId))
      .map((r:any)=>({ name: officeById(r.officeId)?.nameAr ?? r.officeId, value: r.eventsCount, officeId: r.officeId }))
      .sort((a:any,b:any)=>b.value-a.value).slice(0,10);
  }, [state.todayReports, effectiveFilter, officeById]);

  return (
    <div className="h-full flex flex-col lg:flex-row gap-3 p-3 overflow-y-auto lg:overflow-hidden">
      <div className="lg:w-[45%] flex flex-col gap-3 lg:overflow-y-auto">
        <CustomKpiGrid agg={agg} aggYesterday={aggYesterday} trend={trend} activeEmergencies={activeEmergencies} />
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3">
            <div className="text-xs font-bold text-slate-300 mb-2">توزيع الزوار بالمحافظات</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={governorateData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {governorateData.map((_:any,i:number)=><Cell key={i} fill={GOVERNORATE_COLORS[i % GOVERNORATE_COLORS.length]} stroke="#0B0F19" />)}
                </Pie>
                <Tooltip contentStyle={{ background:'#111827', border:'1px solid #1E293B', borderRadius:8, fontSize:11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-[10px] text-slate-500 text-center mt-1">المجموع: {formatNumber(agg.visitors)} زائر</div>
          </div>
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3">
            <div className="text-xs font-bold text-slate-300 mb-2">ترتيب المكاتب — الفعاليات</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={eventsRanked} layout="vertical" margin={{ left:5, right:10, top:5, bottom:5 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={60} tick={{ fill:'#94A3B8', fontSize:8 }} />
                <Tooltip contentStyle={{ background:'#111827', border:'1px solid #1E293B', borderRadius:8, fontSize:10 }} />
                <Bar dataKey="value" fill="#F59E0B" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
      <div className="lg:w-[55%] bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden relative h-[55vh] lg:h-auto">
        <IraqMap onSelectOffice={setSelectedOffice} selectedOfficeId={selectedOffice?.id} filterOfficeIds={effectiveFilter} height="100%" />
      </div>
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
    <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3">
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
            <button key={office.id} onClick={()=>onSelect(office)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#1E293B]/60 text-xs">
              <div className="w-5 h-5 rounded-full bg-[#1E293B] flex items-center justify-center">{statusIcon}</div>
              <span className="flex-1 text-right truncate text-slate-200">{office.nameAr}</span>
              <span className="font-mono text-amber-300">{report ? formatNumber(visitors) : '—'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
