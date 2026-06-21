import { useState, useMemo, useEffect } from 'react';

// Persisted state hook — remembers the user's last choice across sessions.
function usePersistedState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue];
}
import { useNavigate } from 'react-router-dom';
import { useOps } from '../store/opsStore';
import { OFFICES, officeById } from '../data/offices';
import KpiCard from '../components/KpiCard';
import IraqMap from '../components/IraqMap';
import MapLayerControl from '../components/MapLayerControl';
import KpiCustomizer from '../components/KpiCustomizer';
import DateRangeFilter from '../components/DateRangeFilter';
import { getEffectiveKpiCatalog } from '../lib/kpiCatalog';
import { buildInsights } from '../lib/insights';
import { exportComprehensiveReports } from '../lib/exportReports';
import { toast } from 'sonner';
import {
  Users, Truck, AlertOctagon, BarChart3, Map, Activity,
  Award, Check, Clock, X, Timer, Search, Download, Plus, TrendingUp, TrendingDown, Star, Info, ZapOff, Package, BarChart2, Eye
} from 'lucide-react';
import EmergencyDetailCard from '../components/EmergencyDetailCard';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, Legend, CartesianGrid, LineChart, Line } from 'recharts';
import { formatNumber, formatFullNumber, relativeTime } from '../lib/utils';
import type { Office } from '../data/offices';
import { getHeatColor, toIntensity } from '../components/Heatmap';

type ViewMode = 'command' | 'ops' | 'analytics';

const GOVERNORATE_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#EC4899', '#84CC16', '#FBBF24', '#A78BFA', '#34D399', '#F87171', '#FB923C', '#FB7185'];

// Selectable metrics (categories) for the visitor-movement chart.
// Arrivals (وافدون) and departures (مغادرون) are intentionally separate —
// they must never be summed together into one cumulative number.
const CHART_METRICS: { id: string; label: string; get: (r: any) => number }[] = [
  { id: 'visitorsIn', label: 'الوافدون', get: (r) => r.visitorsIn || 0 },
  { id: 'visitorsOut', label: 'المغادرون', get: (r) => r.visitorsOut || 0 },
  { id: 'vehicles', label: 'حركة العجلات', get: (r) => r.vehiclesCount || 0 },
  { id: 'processions', label: 'أعداد المواكب', get: (r) => r.processionsCount || 0 },
  { id: 'deaths', label: 'الوفيات', get: (r) => r.deathsCount || 0 },
  { id: 'violations', label: 'الخروقات', get: (r) => r.violationsCount || 0 },
  { id: 'events', label: 'الفعاليات', get: (r) => r.eventsCount || 0 },
  { id: 'incidents', label: 'الحوادث', get: (r) => r.incidentsCount || 0 },
  { id: 'resources', label: 'الموارد الموزعة', get: (r) => r.resourcesDistributed || 0 },
  { id: 'deployment', label: 'القوة المنتشرة', get: (r) => r.deploymentCount || 0 },
];

function computeAggregates(reports: any[], officeIds: string[], extraKeys: string[] = []): Record<string, number> {
  const filt = officeIds.length === 0 ? reports : reports.filter(r => officeIds.includes(r.officeId));
  const base: Record<string, number> = { visitors: 0, visitorsIn: 0, visitorsOut: 0, vehicles: 0, processions: 0, deaths: 0, violations: 0, events: 0, incidents: 0, resources: 0, deployment: 0 };
  for (const k of extraKeys) base[`x:${k}`] = 0;
  for (const r of filt) {
    base.visitorsIn  += r.visitorsIn || 0;
    base.visitorsOut += r.visitorsOut || 0;
    base.visitors    += (r.visitorsIn || 0) + (r.visitorsOut || 0);
    base.vehicles    += r.vehiclesCount || 0;
    base.processions += r.processionsCount || 0;
    base.deaths      += r.deathsCount || 0;
    base.violations  += r.violationsCount || 0;
    base.events      += r.eventsCount || 0;
    base.incidents   += r.incidentsCount || 0;
    base.resources   += r.resourcesDistributed || 0;
    base.deployment  += r.deploymentCount || 0;
    // Sum admin-added numeric fields stored in extra_fields jsonb.
    if (r.extraFields) {
      for (const k of extraKeys) {
        const v = Number(r.extraFields[k]);
        if (!isNaN(v)) base[`x:${k}`] += v;
      }
    }
  }
  return base;
}

export default function DashboardPage() {
  const { state, dispatch } = useOps();
  const [view, setView] = usePersistedState<ViewMode>('dash:view', 'command');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [search, setSearch] = useState('');

  const user = state.currentUser!;
  const permittedIds = user.role === 'director' ? OFFICES.map(o => o.id) :
                       user.role === 'supervisor' ? user.permittedOfficeIds :
                       [user.officeId];

  const effectiveFilter = state.officeFilter.length === 0 ? permittedIds :
    state.officeFilter.filter(id => permittedIds.includes(id));

  // Apply date-range when set; else use today (cumulative-today behavior).
  const { aggToday, aggYesterday, rangeLabel } = useMemo(() => {
    const extraKeys = state.fieldDefinitions
      .filter(f => f.countInStats && !f.isBuiltIn && f.fieldType === 'number' && !f.isHidden)
      .map(f => f.fieldKey);
    const dr = state.dateRange;
    if (!dr) {
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().slice(0, 10);
      return {
        aggToday: computeAggregates(state.todayReports, effectiveFilter, extraKeys),
        aggYesterday: computeAggregates(state.historicalReports.filter(r => r.reportDate === yestStr), effectiveFilter, extraKeys),
        rangeLabel: 'اليوم',
      };
    }
    const all = [...state.historicalReports, ...state.todayReports];
    const inRange = all.filter(r => r.reportDate >= dr.from && r.reportDate <= dr.to);
    // Previous equal-length window for trend
    const fromD = new Date(dr.from), toD = new Date(dr.to);
    const days = Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1);
    const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (days - 1));
    const prevFromStr = prevFrom.toISOString().slice(0, 10);
    const prevToStr = prevTo.toISOString().slice(0, 10);
    const prev = all.filter(r => r.reportDate >= prevFromStr && r.reportDate <= prevToStr);
    return {
      aggToday: computeAggregates(inRange, effectiveFilter, extraKeys),
      aggYesterday: computeAggregates(prev, effectiveFilter, extraKeys),
      rangeLabel: dr.from === dr.to ? dr.from : `${dr.from} → ${dr.to}`,
    };
  }, [state.dateRange, state.todayReports, state.historicalReports, effectiveFilter, state.fieldDefinitions]);

  const trend = (today: number, yest: number) => yest === 0 ? 0 : ((today - yest) / yest) * 100;
  const activeEmergencies = state.emergencies.filter(e => e.status === 'active').length;

  const officeFilterLabel = state.officeFilter.length === 0 ? 'كل المكاتب' :
    state.officeFilter.length === 1 ? officeById(state.officeFilter[0])?.nameAr ?? 'مكتب' :
    `${state.officeFilter.length} مكاتب`;

  return (
    <div className="h-full flex flex-col bg-[#0B0F19] overflow-hidden">
      {/* View switcher tabs */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap border-b border-[#1E293B]">
        <div className="flex items-center gap-1 bg-[#111827] border border-[#1E293B] rounded-lg p-1">
          {[
            { id: 'ops', label: 'وضع العمليات', icon: Map },
            { id: 'command', label: 'مركز القيادة', icon: Activity, star: true },
            { id: 'analytics', label: 'التحليل', icon: BarChart3 },
          ].map(t => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id as ViewMode)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  active ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {t.star && <span className="text-[10px]">★</span>}
              </button>
            );
          })}
        </div>

        {user.role !== 'agent' && (
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1E293B] text-xs text-slate-300 hover:border-amber-500/30 transition-colors"
            >
              <span>المكاتب:</span>
              <span className="text-amber-400 font-bold">{officeFilterLabel}</span>
              <Search className="w-3 h-3 text-slate-500" />
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-[#111827] border border-[#1E293B] rounded-xl shadow-2xl z-40 max-h-96 overflow-hidden">
                  <div className="p-2 border-b border-[#1E293B]">
                    <input
                      placeholder="بحث..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-md px-2 py-1.5 text-xs text-white placeholder-slate-500"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto p-1">
                    <button
                      onClick={() => { dispatch({ type: 'SET_OFFICE_FILTER', ids: [] }); setFilterOpen(false); }}
                      className="w-full text-right px-2 py-1.5 rounded text-xs text-amber-400 hover:bg-[#1E293B] font-bold"
                    >
                      ✓ كل المكاتب
                    </button>
                    {OFFICES.filter(o => permittedIds.includes(o.id) && o.nameAr.includes(search)).map(o => {
                      const sel = state.officeFilter.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          onClick={() => {
                            const next = sel ? state.officeFilter.filter(x => x !== o.id) : [...state.officeFilter, o.id];
                            dispatch({ type: 'SET_OFFICE_FILTER', ids: next });
                          }}
                          className={`w-full text-right px-2 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-[#1E293B] ${sel ? 'text-amber-400' : 'text-slate-300'}`}
                        >
                          <span className={`w-3 h-3 rounded border ${sel ? 'bg-amber-500 border-amber-500' : 'border-slate-500'}`} />
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
          <span>•</span>
          <span className="text-amber-400 font-bold">{rangeLabel}</span>
          <span>•</span>
          <span>آخر تحديث: {state.serverTime.toLocaleTimeString('en-GB', { hour12: false })}</span>
        </div>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-hidden">
        {view === 'command' && <CommandView agg={aggToday} trend={trend} aggYesterday={aggYesterday} effectiveFilter={effectiveFilter} selectedOffice={selectedOffice} setSelectedOffice={setSelectedOffice} activeEmergencies={activeEmergencies} />}
        {view === 'ops' && <OpsView agg={aggToday} trend={trend} aggYesterday={aggYesterday} effectiveFilter={effectiveFilter} selectedOffice={selectedOffice} setSelectedOffice={setSelectedOffice} activeEmergencies={activeEmergencies} />}
        {view === 'analytics' && <AnalyticsView agg={aggToday} trend={trend} aggYesterday={aggYesterday} effectiveFilter={effectiveFilter} selectedOffice={selectedOffice} setSelectedOffice={setSelectedOffice} />}
      </div>

      {/* Drill-down panel */}
      {selectedOffice && <DrillDownPanel office={selectedOffice} onClose={() => setSelectedOffice(null)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// VIEW 2: Command Mode (45/55 split)
// ════════════════════════════════════════════════════════════════
function CommandView({ agg, trend, aggYesterday, effectiveFilter, selectedOffice, setSelectedOffice, activeEmergencies }: any) {
  const { state, actions } = useOps();
  useNavigate();
  const user = state.currentUser;
  if (!user) return <div className="p-4 text-center text-slate-500">جاري التحميل...</div>;
  const canHandleEmergencies = user.role === 'director' || user.role === 'supervisor';
  const [detailEm, setDetailEm] = useState<any>(null);

  const handleAck = async (id: string) => { await actions.ackEmergency(id, user.id); };
  const handleResolve = async (id: string) => { await actions.resolveEmergency(id); };

  const governorateData = useMemo(() => {
    const map: Record<string, number> = {};
    state.todayReports.filter((r: any) => effectiveFilter.includes(r.officeId)).forEach((r: any) => {
      const gov = officeById(r.officeId)?.governorateAr || r.officeId;
      map[gov] = (map[gov] || 0) + r.visitorsIn + r.visitorsOut;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [state.todayReports, effectiveFilter]);

  const eventsRanked = useMemo(() => {
    return state.todayReports
      .filter((r: any) => effectiveFilter.includes(r.officeId))
      .map((r: any) => ({ name: officeById(r.officeId)?.nameAr ?? r.officeId, value: r.eventsCount, officeId: r.officeId }))
      .sort((a: any, b: any) => b.value - a.value).slice(0, 10);
  }, [state.todayReports, effectiveFilter]);

  return (
    <div className="h-full flex flex-col lg:flex-row gap-3 p-3 overflow-hidden">
      {/* Left 45% */}
      <div className="lg:w-[45%] flex flex-col gap-3 overflow-y-auto">
        {/* Top KPIs — driven by customKpis */}
        <CustomKpiGrid agg={agg} aggYesterday={aggYesterday} trend={trend} activeEmergencies={activeEmergencies} cols={3} />

        {/* Charts */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3">
            <div className="text-xs font-bold text-slate-300 mb-2">توزيع الزوار بالمحافظات</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={governorateData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {governorateData.map((_: any, i: number) => (
                    <Cell key={i} fill={GOVERNORATE_COLORS[i % GOVERNORATE_COLORS.length]} stroke="#0B0F19" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#F59E0B' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-[10px] text-slate-500 text-center mt-1">المجموع: {formatFullNumber(agg.visitors)} زائر</div>
          </div>

          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3">
            <div className="text-xs font-bold text-slate-300 mb-2">ترتيب المكاتب — الفعاليات</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={eventsRanked} layout="vertical" margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#FACC15" />
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#EF4444" />
                  </linearGradient>
                </defs>
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={60} 
                  tick={{ fill: '#94A3B8', fontSize: 8 }}
                  tickFormatter={(v: string) => v.replace('مكتب ', '').slice(0, 8) + (v.length > 12 ? '...' : '')}
                />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 8, fontSize: 10 }} cursor={{ fill: 'rgba(245,158,11,0.05)' }} />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Report status table */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-slate-300">حالة إرسال التقارير — اليوم</div>
            <div className="text-[10px] text-slate-500">{state.todayReports.length} / {OFFICES.length}</div>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {OFFICES.filter((o: Office) => effectiveFilter.includes(o.id)).map(office => {
              const report = state.todayReports.find((r: any) => r.officeId === office.id);
              const status: 'submitted' | 'pending' | 'missing' | 'extension' | 'not-open' =
                report ? (report.isLateSubmission ? 'submitted' : 'submitted') :
                state.extensions.some((e: any) => e.officeId === office.id && e.status === 'approved') ? 'extension' :
                'missing';
              const totalVisitors = report ? (report.visitorsIn || 0) + (report.visitorsOut || 0) : 0;
              // heat color: 0-50k pale yellow, 50-150k amber, 150-300k orange, 300k+ red
              const heatIntensity = Math.min(1, totalVisitors / 250000);
              const heatColor = totalVisitors > 0 ? getHeatColor(0.15 + heatIntensity * 0.7) : null;
              return (
                <button
                  key={office.id}
                  onClick={() => setSelectedOffice(office)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#1E293B]/60 text-xs transition-colors group"
                >
                  <StatusIcon status={status} />
                  <span className="text-slate-200 font-semibold flex-1 text-right truncate">{office.nameAr}</span>
                  <span
                    className="px-1.5 py-0.5 rounded tabular-nums font-bold min-w-[60px] text-center"
                    style={heatColor ? { background: heatColor.background, color: heatColor.textColor } : { color: '#475569' }}
                  >
                    {report ? formatNumber(totalVisitors) : '—'}
                  </span>
                  <span className="text-slate-500 hidden sm:inline w-12 text-left">{report ? report.deathsCount : '—'} وفاة</span>
                  <span className="text-slate-500 hidden md:inline w-16 text-left text-[10px]">{report ? new Date(report.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Emergency ticker (hidden for viewers — no critical alerts) */}
        {activeEmergencies > 0 && user.role !== 'viewer' && (
          <div className="bg-red-900/20 border-2 border-red-500/50 rounded-xl p-3 glow-crimson">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-300">حالات طارئة نشطة — {activeEmergencies}</span>
            </div>
            <div className="space-y-1">
              {state.emergencies.filter((e: any) => e.status === 'active' || e.status === 'acknowledged').slice(0, 3).map((e: any) => (
                <div
                  key={e.id}
                  className="w-full flex items-center gap-2 p-2 rounded-md bg-red-500/10 text-xs hover:bg-red-500/20 transition-colors"
                >
                  <AlertOctagon className={`w-3.5 h-3.5 shrink-0 ${e.status === 'active' ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
                  <span className="text-red-200 font-bold">{officeById(e.officeId)?.nameAr}</span>
                  <span className="text-slate-300 truncate flex-1">— {e.emergencyType}</span>
                  <span className="text-slate-500 text-[10px] shrink-0">{relativeTime(e.createdAt)}</span>
                  <button
                    onClick={() => setDetailEm(e)}
                    title="عرض التفاصيل"
                    className="shrink-0 p-1 rounded bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {canHandleEmergencies && (
                    <div className="flex gap-1 shrink-0">
                      {e.status === 'active' && (
                        <button onClick={() => handleAck(e.id)} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 hover:bg-amber-500/50">تأكيد</button>
                      )}
                      <button onClick={() => handleResolve(e.id)} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-200 hover:bg-emerald-500/50">حل</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right 55% - map */}
      <div className="lg:w-[55%] bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden relative min-h-[400px]">
        <MapLayerControl position="right" variant="vertical" />
        <IraqMap
          onSelectOffice={setSelectedOffice}
          selectedOfficeId={selectedOffice?.id}
          filterOfficeIds={effectiveFilter}
          height="100%"
        />
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: 'submitted' | 'pending' | 'missing' | 'extension' | 'not-open' }) {
  if (status === 'submitted') return <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-400" /></div>;
  if (status === 'pending') return <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center"><Clock className="w-3 h-3 text-amber-400" /></div>;
  if (status === 'missing') return <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center"><X className="w-3 h-3 text-red-400" /></div>;
  if (status === 'extension') return <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center"><Timer className="w-3 h-3 text-blue-400" /></div>;
  return <div className="w-5 h-5 rounded-full bg-slate-700/50 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-slate-500" /></div>;
}

// ════════════════════════════════════════════════════════════════
// VIEW 1: Operations Mode (full map)
// ════════════════════════════════════════════════════════════════
function OpsView({ agg, effectiveFilter, selectedOffice, setSelectedOffice, activeEmergencies }: any) {
  const { state } = useOps();
  const insights = useMemo(() => buildInsights(state.todayReports, state.historicalReports, state.emergencies, state.users), [state.todayReports, state.historicalReports, state.emergencies, state.users]);

  return (
    <div className="h-full relative">
      {/* Top KPI overlay — customizable */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2 w-52 max-h-[70vh] overflow-y-auto">
        <OpsKpiOverlay agg={agg} activeEmergencies={activeEmergencies} />
      </div>

      {/* Emergency banner top-center (hidden for viewers — no critical alerts) */}
      {activeEmergencies > 0 && state.currentUser?.role !== 'viewer' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-red-600/95 text-white px-4 py-2 rounded-lg animate-pulse-alert shadow-2xl flex items-center gap-2 text-sm font-bold">
          <AlertOctagon className="w-4 h-4" />
          <span>حالة طارئة نشطة في {officeById(state.emergencies.find((e: any) => e.status === 'active')?.officeId ?? '')?.nameAr}</span>
        </div>
      )}

      {/* Layer control (right) */}
      <MapLayerControl position="left" variant="vertical" />

      {/* Map */}
      <IraqMap
        onSelectOffice={setSelectedOffice}
        selectedOfficeId={selectedOffice?.id}
        filterOfficeIds={effectiveFilter}
        height="100%"
      />

      {/* Bottom smart insights ticker */}
      <SmartInsightsTicker insights={insights} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// VIEW 3: Analytics Mode
// ════════════════════════════════════════════════════════════════
function AnalyticsView({ agg, trend, aggYesterday, effectiveFilter, selectedOffice, setSelectedOffice }: any) {
  const { state } = useOps();


  type VisitorChartType = 'area' | 'line' | 'vertical' | 'horizontal';
  const [visitorChartType, setVisitorChartType] = usePersistedState<VisitorChartType>('dash:visitorChartType', 'area');
  const [chartMetric, setChartMetric] = usePersistedState<string>('dash:chartMetric', 'visitorsIn');
  // Visitors KPI shows arrivals OR departures — never their sum (they are distinct flows).
  const [visitorFlow, setVisitorFlow] = usePersistedState<'in' | 'out'>('dash:visitorFlow', 'in');
  const [officeMenuOpen, setOfficeMenuOpen] = useState(false);
  // Offices available for this user, and which are selected for the chart (max recommended 5 shown).
  const availableOffices = useMemo(() => OFFICES.filter((o: Office) => effectiveFilter.includes(o.id)), [effectiveFilter]);
  const [selectedChartOffices, setSelectedChartOffices] = usePersistedState<string[]>('dash:selectedChartOffices', availableOffices.slice(0, 5).map((o: Office) => o.id));

  const activeMetric = CHART_METRICS.find((m) => m.id === chartMetric) || CHART_METRICS[0];
  const officesForChart = useMemo(
    () => availableOffices.filter((o: Office) => selectedChartOffices.includes(o.id)).slice(0, 8),
    [availableOffices, selectedChartOffices]
  );

  const toggleChartOffice = (id: string) => {
    setSelectedChartOffices((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const hasAnyData =
    state.todayReports.length > 0 || state.historicalReports.length > 0;

  const sparklineFor = (key: keyof typeof agg) => {
    const days: number[] = [];
    for (let d = 13; d >= 0; d--) {
      const ds = new Date(); ds.setDate(ds.getDate() - d);
      const dsStr = ds.toISOString().slice(0, 10);
      const dayAgg = computeAggregates(state.historicalReports.filter(r => r.reportDate === dsStr), effectiveFilter);
      days.push((dayAgg as any)[key] || 0);
    }
    days.push((agg as any)[key] || 0);
    return days;
  };

  const areaData = useMemo(() => {
    const days: any[] = [];
    for (let d = 13; d >= 0; d--) {
      const date = new Date(); date.setDate(date.getDate() - d);
      const dsStr = date.toISOString().slice(0, 10);
      const obj: any = { date: dsStr.slice(5) };
      const dayReports = state.historicalReports.filter(r => r.reportDate === dsStr);
      officesForChart.forEach((officeForChart: Office) => {
        const r = d === 0
          ? state.todayReports.find(x => x.officeId === officeForChart.id)
          : dayReports.find(x => x.officeId === officeForChart.id);
        obj[officeForChart.code] = r ? activeMetric.get(r) : 0;
      });
      days.push(obj);
    }
    return days;
  }, [state.historicalReports, state.todayReports, officesForChart, activeMetric]);

  const horizontalData = useMemo(() => {
    return officesForChart.map((o: Office) => {
      let total = 0;
      for (let d = 13; d >= 0; d--) {
        const ds = new Date(); ds.setDate(ds.getDate() - d);
        const dsStr = ds.toISOString().slice(0, 10);
        const r = d === 0
          ? state.todayReports.find(x => x.officeId === o.id)
          : state.historicalReports.find(x => x.officeId === o.id && x.reportDate === dsStr);
        if (r) total += activeMetric.get(r);
      }
      return { name: o.nameAr.replace('مكتب ', '').slice(0, 10), value: total, officeId: o.id };
    }).sort((a, b) => b.value - a.value);
  }, [state.historicalReports, state.todayReports, officesForChart, activeMetric]);

  const incidentsRanked = useMemo(() => {
    return state.todayReports
      .filter((r: any) => effectiveFilter.includes(r.officeId))
      .map((r: any) => ({ name: officeById(r.officeId)?.nameAr ?? r.officeId, value: r.incidentsCount, officeId: r.officeId }))
      .sort((a: any, b: any) => b.value - a.value);
  }, [state.todayReports, effectiveFilter]);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {!hasAnyData && (
        <div className="bg-gradient-to-l from-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-bold text-amber-300 mb-1">لا توجد بيانات للتحليل بعد</div>
            <div className="text-xs text-slate-400 leading-relaxed">
              لم يتم استلام أي تقارير يومية أو تاريخية حتى الآن. ستظهر جميع المؤشرات والرسوم البيانية أدناه فور إدخال أول تقرير من المكاتب الميدانية.
            </div>
            <div className="text-[10px] text-slate-500 mt-2">
              المكاتب المسموح بها: {effectiveFilter.length} مكتب • التقارير اليوم: 0 • تقارير تاريخية: 0
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="relative">
          <KpiCard
            label={visitorFlow === 'in' ? 'الوافدون (تراكمي)' : 'المغادرون (تراكمي)'}
            value={visitorFlow === 'in' ? agg.visitorsIn : agg.visitorsOut}
            icon={Users} size="lg"
            trend={trend(
              visitorFlow === 'in' ? agg.visitorsIn : agg.visitorsOut,
              visitorFlow === 'in' ? aggYesterday.visitorsIn : aggYesterday.visitorsOut,
            )}
            sparklineData={sparklineFor(visitorFlow === 'in' ? 'visitorsIn' : 'visitorsOut')}
            borderGlow tone="amber"
          />
          <div className="absolute top-2 left-2 z-10 flex rounded-md overflow-hidden border border-amber-500/30 text-[10px] font-bold">
            <button
              onClick={() => setVisitorFlow('in')}
              className={visitorFlow === 'in' ? 'px-2 py-0.5 bg-amber-500 text-black' : 'px-2 py-0.5 bg-[#0B0F19] text-amber-300'}
            >وافدون</button>
            <button
              onClick={() => setVisitorFlow('out')}
              className={visitorFlow === 'out' ? 'px-2 py-0.5 bg-amber-500 text-black' : 'px-2 py-0.5 bg-[#0B0F19] text-amber-300'}
            >مغادرون</button>
          </div>
        </div>
        <KpiCard label="الوفيات التراكمية" value={agg.deaths} icon={AlertOctagon} size="lg" trend={trend(agg.deaths, aggYesterday.deaths)} sparklineData={sparklineFor('deaths')} tone="red" />
        <KpiCard label="الخروقات الأمنية" value={agg.violations} icon={X} size="lg" trend={trend(agg.violations, aggYesterday.violations)} sparklineData={sparklineFor('violations')} tone="orange" />
        <KpiCard label="الفعاليات" value={agg.events} icon={Activity} size="lg" trend={trend(agg.events, aggYesterday.events)} sparklineData={sparklineFor('events')} tone="purple" />
        <KpiCard label="حركة العجلات" value={agg.vehicles} icon={Truck} size="lg" trend={trend(agg.vehicles, aggYesterday.vehicles)} sparklineData={sparklineFor('vehicles')} tone="blue" />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 bg-[#111827] border border-[#1E293B] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-sm font-bold text-slate-200">{activeMetric.label} — آخر 14 يوم</div>
            <div className="flex items-center gap-1">
              {[
                { id: 'area', label: 'مساحة', icon: Activity },
                { id: 'line', label: 'خطي', icon: TrendingUp },
                { id: 'vertical', label: 'أعمدة', icon: BarChart3 },
                { id: 'horizontal', label: 'أفقي', icon: BarChart2 },
              ].map((t) => {
                const Icon = t.icon;
                const active = visitorChartType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setVisitorChartType(t.id as VisitorChartType)}
                    title={t.label}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                      active ? 'bg-amber-500 text-black' : 'bg-[#0B0F19] text-slate-400 hover:text-slate-200 border border-[#1E293B]'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters: category (metric) + governorates */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-bold">الفئة:</span>
              <select
                value={chartMetric}
                onChange={(e) => setChartMetric(e.target.value)}
                className="bg-[#0B0F19] border border-[#1E293B] text-slate-200 text-[11px] font-bold rounded-md px-2 py-1 focus:outline-none focus:border-amber-500"
              >
                {CHART_METRICS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <button
                onClick={() => setOfficeMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 bg-[#0B0F19] border border-[#1E293B] text-slate-200 text-[11px] font-bold rounded-md px-2 py-1 hover:border-amber-500 transition-colors"
              >
                <Map className="w-3 h-3 text-amber-400" />
                <span>المحافظات ({selectedChartOffices.length})</span>
              </button>
              {officeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOfficeMenuOpen(false)} />
                  <div className="absolute z-20 mt-1 right-0 w-56 max-h-64 overflow-y-auto bg-[#111827] border border-[#1E293B] rounded-lg shadow-xl p-2 space-y-0.5">
                    <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-[#1E293B]">
                      <button
                        onClick={() => setSelectedChartOffices(availableOffices.map((o: Office) => o.id))}
                        className="text-[10px] text-amber-400 font-bold hover:underline"
                      >تحديد الكل</button>
                      <button
                        onClick={() => setSelectedChartOffices([])}
                        className="text-[10px] text-slate-400 font-bold hover:underline"
                      >مسح الكل</button>
                    </div>
                    {availableOffices.map((o: Office) => {
                      const checked = selectedChartOffices.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          onClick={() => toggleChartOffice(o.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#0B0F19] text-right transition-colors"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-amber-500 border-amber-500' : 'border-[#334155]'}`}>
                            {checked && <Check className="w-3 h-3 text-black" />}
                          </span>
                          <span className="text-[11px] text-slate-200 flex-1">{o.nameAr.replace('مكتب ', '')}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            {visitorChartType === 'horizontal' ? (
              <BarChart data={horizontalData} layout="vertical" margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="hbarGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#FACC15" />
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#EF4444" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={60} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [formatFullNumber(v), activeMetric.label]} />
                <Bar dataKey="value" fill="url(#hbarGradient)" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            ) : visitorChartType === 'vertical' ? (
              <BarChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {officesForChart.map((o: Office, i: number) => (
                  <Bar key={o.code} dataKey={o.code} fill={GOVERNORATE_COLORS[i]} stroke={GOVERNORATE_COLORS[i]} radius={[3, 3, 0, 0]} name={o.nameAr.replace('مكتب ', '')} />
                ))}
              </BarChart>
            ) : visitorChartType === 'line' ? (
              <LineChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {officesForChart.map((o: Office, i: number) => (
                  <Line key={o.code} type="monotone" dataKey={o.code} stroke={GOVERNORATE_COLORS[i]} strokeWidth={2} dot={{ r: 2, fill: GOVERNORATE_COLORS[i] }} name={o.nameAr.replace('مكتب ', '')} />
                ))}
              </LineChart>
            ) : (
              <AreaChart data={areaData}>
                <defs>
                  {officesForChart.map((o: Office, i: number) => (
                    <linearGradient key={o.code} id={`g-${o.code}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GOVERNORATE_COLORS[i]} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={GOVERNORATE_COLORS[i]} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                  <linearGradient id="axisGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E293B" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#1E293B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {officesForChart.map((o: Office, i: number) => (
                  <Area key={o.code} type="monotone" dataKey={o.code} stroke={GOVERNORATE_COLORS[i]} fill={`url(#g-${o.code})`} strokeWidth={2} name={o.nameAr.replace('مكتب ', '')} />
                ))}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-[#111827] border border-[#1E293B] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-slate-200">خريطة حرارية — حركة الزوار (7 أيام)</div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <span>منخفض</span>
              <div className="flex h-2 w-20 rounded-full overflow-hidden">
                <div className="flex-1" style={{ background: 'rgba(250, 204, 21, 0.4)' }} />
                <div className="flex-1" style={{ background: 'rgba(245, 158, 11, 0.6)' }} />
                <div className="flex-1" style={{ background: 'rgba(249, 115, 22, 0.75)' }} />
                <div className="flex-1" style={{ background: 'rgba(239, 68, 68, 0.8)' }} />
                <div className="flex-1" style={{ background: 'rgba(185, 28, 28, 0.95)' }} />
              </div>
              <span>حرج</span>
            </div>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {OFFICES.filter((o: Office) => effectiveFilter.includes(o.id)).map(office => {
              // Get all visitor counts for this office in the window
              const cellData: { value: number; date: string }[] = [];
              for (let i = 6; i >= 0; i--) {
                const ds = new Date(); ds.setDate(ds.getDate() - i);
                const dsStr = ds.toISOString().slice(0, 10);
                const r = i === 0
                  ? state.todayReports.find(x => x.officeId === office.id)
                  : state.historicalReports.find(x => x.officeId === office.id && x.reportDate === dsStr);
                cellData.push({ value: r ? r.visitorsIn + r.visitorsOut : 0, date: dsStr });
              }
              const maxVal = Math.max(...cellData.map(c => c.value), 1);
              return (
                <div key={office.id} className="flex items-center gap-2 group">
                  <div className="w-20 text-[10px] text-slate-300 truncate shrink-0">{office.nameAr.replace('مكتب ', '')}</div>
                  <div className="flex-1 flex gap-0.5">
                    {cellData.map((c, i) => {
                      const intensity = c.value > 0 ? toIntensity(c.value, 0, maxVal) : 0;
                      const color = getHeatColor(intensity);
                      return (
                        <div
                          key={i}
                          title={c.value > 0 ? `${formatFullNumber(c.value)} زائر` : 'لا يوجد'}
                          className="flex-1 h-6 rounded-sm border transition-all group-hover:scale-110 group-hover:z-10 relative"
                          style={{
                            background: color.background,
                            borderColor: color.border,
                          }}
                        >
                          {intensity > 0.6 && c.value > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color: color.textColor }}>
                              {c.value >= 1000 ? `${Math.round(c.value / 1000)}ك` : c.value}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-500 mt-2 text-center">كل خلية تمثل عدد الزوار لذلك اليوم — الألوان من الأصفر (منخفض) إلى الأحمر (حرج)</div>
        </div>
      </div>

      {/* Row 3: Three columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
          <div className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" /> ترتيب الحوادث
          </div>
          <div className="space-y-1">
            {incidentsRanked.map((o: any, i: number) => {
              const incidentIntensity = o.value === 0 ? 0 : Math.min(1, o.value / 8);
              const incidentColor = getHeatColor(0.15 + incidentIntensity * 0.7);
              return (
                <button
                  key={o.officeId}
                  onClick={() => setSelectedOffice(officeById(o.officeId) || null)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#1E293B]/40 text-xs"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    i === 0 ? 'bg-gradient-to-br from-amber-300 to-amber-600 text-black shadow-lg shadow-amber-500/30' :
                    i === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-500 text-black' :
                    i === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-800 text-white' :
                    'bg-[#1E293B] text-slate-400'
                  }`}>
                    {i + 1}
                  </div>
                  <span className="flex-1 text-right truncate">{o.name}</span>
                  <span
                    className="px-2 py-0.5 rounded-full font-bold text-[10px] tabular-nums"
                    style={o.value > 0 ? { background: incidentColor.background, color: incidentColor.textColor } : { background: 'rgba(30,41,59,0.5)', color: '#94A3B8' }}
                  >
                    {o.value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
          <div className="text-sm font-bold text-slate-200 mb-3 flex items-center justify-between">
            <span>المنافذ الحدودية</span>
            {state.currentUser?.role === 'director' && (
              <button className="text-[10px] text-amber-400 flex items-center gap-1 hover:text-amber-300">
                <Plus className="w-3 h-3" /> إضافة منفذ
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {state.borderCrossings.slice(0, 8).map((bc: any) => {
              const total = bc.dailyIn + bc.dailyOut;
              const inPct = (bc.dailyIn / total) * 100;
              // Find max traffic across all crossings for relative heat
              const maxTraffic = Math.max(...state.borderCrossings.map((x: any) => x.dailyIn + x.dailyOut));
              const trafficIntensity = total / maxTraffic;
              const heatColor = getHeatColor(0.15 + trafficIntensity * 0.7);
              return (
                <div key={bc.id} className="p-2 rounded-md bg-[#0B0F19] border border-[#1E293B] hover:border-amber-500/30 transition-colors">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-200 truncate">{bc.nameAr}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: heatColor.background, color: heatColor.textColor }}
                        title={heatColor.label}
                      >
                        {heatColor.label}
                      </span>
                      <span className="text-base">{bc.countryFlag}</span>
                    </div>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-[#1E293B] mb-1">
                    <div className="bg-gradient-to-l from-emerald-400 to-emerald-600" style={{ width: `${inPct}%` }} />
                    <div className="bg-gradient-to-l from-amber-400 to-amber-600" style={{ width: `${100 - inPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span className="text-emerald-400">داخلون: {formatNumber(bc.dailyIn)}</span>
                    <span className="text-amber-400">خارجون: {formatNumber(bc.dailyOut)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
          <div className="text-sm font-bold text-slate-200 mb-3">نظرة عامة على الخريطة</div>
          <div className="h-56 rounded-lg overflow-hidden border border-[#1E293B]">
            <IraqMap onSelectOffice={setSelectedOffice} selectedOfficeId={selectedOffice?.id} filterOfficeIds={effectiveFilter} height="100%" />
          </div>
        </div>
      </div>

      {/* Row 4: Footer */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-sm font-bold text-slate-200">جميع المكاتب — حالة اليوم</div>
          <button
            onClick={() => {
              const all = [...state.todayReports, ...state.historicalReports];
              if (all.length === 0) { toast.error('لا توجد بيانات لتصديرها'); return; }
              try {
                exportComprehensiveReports(all, state.users, state.fieldDefinitions);
                toast.success(`تم تصدير ${all.length} تقرير بكامل التفاصيل`);
              } catch (e: any) {
                toast.error(e?.message || 'فشل التصدير');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/20"
          >
            <Download className="w-4 h-4" />
            تصدير البيانات الشاملة (Excel)
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {OFFICES.filter((o: Office) => effectiveFilter.includes(o.id)).map(office => {
            const r = state.todayReports.find((x: any) => x.officeId === office.id);
            const color = r ? (r.isLateSubmission ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300') : 'bg-red-500/15 border-red-500/30 text-red-300';
            return (
              <button
                key={office.id}
                onClick={() => setSelectedOffice(office)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${color} hover:scale-105 transition-transform`}
              >
                {office.nameAr.replace('مكتب ', '')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DRILL-DOWN PANEL
// ════════════════════════════════════════════════════════════════
function DrillDownPanel({ office, onClose }: { office: Office; onClose: () => void }) {
  const { state } = useOps();
  const report = state.todayReports.find(r => r.officeId === office.id);
  const agents = state.agentLocations.filter(a => a.officeId === office.id);
  const emergencies = state.emergencies.filter(e => e.officeId === office.id && e.status !== 'resolved');

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[500]" onClick={onClose} />
      <div className="fixed top-0 left-0 bottom-0 w-[380px] max-w-[90vw] bg-[#0B0F19] border-r border-amber-500/30 z-[501] overflow-y-auto animate-slide-in-right shadow-2xl">
        <div className="sticky top-0 bg-[#0B0F19] border-b border-[#1E293B] p-4 flex items-center justify-between z-10">
          <div>
            <div className="text-lg font-display font-black text-amber-400">{office.nameAr}</div>
            <div className="text-xs text-slate-400">{office.governorateAr} • {report ? relativeTime(report.submittedAt) : 'لا يوجد تقرير'}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#1E293B] hover:bg-[#263244] flex items-center justify-center text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {report ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'الداخلون', value: report.visitorsIn, gradient: 'from-emerald-400 to-teal-600' },
                { label: 'العجلات', value: report.vehiclesCount, gradient: 'from-blue-400 to-indigo-600' },
                { label: 'المواكب', value: report.processionsCount, gradient: 'from-amber-400 to-orange-600' },
                { label: 'الوفيات', value: report.deathsCount, gradient: 'from-red-400 to-rose-700' },
                { label: 'الحوادث', value: report.incidentsCount, gradient: 'from-orange-400 to-red-600' },
                { label: 'الفعاليات', value: report.eventsCount, gradient: 'from-purple-400 to-fuchsia-700' },
              ].map(k => (
                <div key={k.label} className="bg-[#111827] border border-[#1E293B] rounded-lg p-3 relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${k.gradient}`} />
                  <div className="text-[10px] text-slate-400 mb-1">{k.label}</div>
                  <div className={`kpi-number text-xl bg-gradient-to-l ${k.gradient} bg-clip-text text-transparent`}>{formatNumber(k.value)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center text-sm text-red-300">
              لم يُرسل تقرير اليوم من هذا المكتب
            </div>
          )}

          {report && (
            <div className={`rounded-lg p-3 ${report.isLateSubmission ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'}`}>
              <div className="text-xs flex items-center gap-2">
                {report.isLateSubmission ? <Clock className="w-3.5 h-3.5 text-amber-400" /> : <Check className="w-3.5 h-3.5 text-emerald-400" />}
                <span className={report.isLateSubmission ? 'text-amber-300' : 'text-emerald-300'}>
                  {report.isLateSubmission ? 'تم الإرسال متأخراً' : 'تم الإرسال في الوقت'} — {new Date(report.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-bold text-slate-300 mb-2">مستخدمو الموقع النشطون ({agents.length})</div>
            {agents.length === 0 ? (
              <div className="text-xs text-slate-500 bg-[#111827] border border-[#1E293B] rounded-lg p-3 text-center">لا يوجد مستخدمون نشطون</div>

            ) : (
              <div className="space-y-1">
                {agents.map(a => (
                  <div key={a.agentId} className="flex items-center gap-2 p-2 rounded-md bg-[#111827] border border-[#1E293B] text-xs">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="flex-1 truncate">{a.agentName}</span>
                    <span className="text-slate-500 text-[10px]">📍 {a.lat.toFixed(2)}, {a.lng.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {emergencies.length > 0 && (
            <div>
              <div className="text-xs font-bold text-red-300 mb-2">حالات طارئة نشطة</div>
              <div className="space-y-1">
                {emergencies.map(e => (
                  <div key={e.id} className="p-2 rounded-md bg-red-500/10 border border-red-500/30 text-xs">
                    <div className="font-bold text-red-300">{e.emergencyType}</div>
                    <div className="text-slate-300 text-[10px] mt-1 line-clamp-2">{e.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold"
          >
            إغلاق والرجوع إلى العراق
          </button>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Customizable KPI grid (for CommandView left column)
// ════════════════════════════════════════════════════════════════
function CustomKpiGrid({ agg, aggYesterday, trend, activeEmergencies, cols = 3 }: any) {
  const { state } = useOps();
  // Viewers must not see critical/emergency stats.
  const ids = state.currentUser?.role === 'viewer'
    ? state.customKpis.filter((id: string) => id !== 'emergencies')
    : state.customKpis;
  const catalog = getEffectiveKpiCatalog(state.fieldDefinitions);
  const byId = (id: string) => catalog.find(k => k.id === id);
  const valFor = (id: string) => id === 'emergencies' ? activeEmergencies : (agg as any)[id] || 0;
  const yestFor = (id: string) => id === 'emergencies' ? activeEmergencies : (aggYesterday as any)[id] || 0;
  const colsCls = cols === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3';
  return (
    <div className={`grid ${colsCls} gap-3`}>
      {ids.map((id: string) => {
        const def = byId(id);
        if (!def) return null;
        return (
          <KpiCard
            key={id}
            label={def.label}
            value={valFor(id)}
            icon={def.icon}
            trend={id === 'emergencies' ? 0 : trend(valFor(id), yestFor(id))}
            tone={def.tone as any}
            borderGlow={id === 'visitors'}
          />
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// OpsView KPI overlay (vertical stack of cards)
// ════════════════════════════════════════════════════════════════
function OpsKpiOverlay({ agg, activeEmergencies }: any) {
  const { state } = useOps();
  // Viewers must not see critical/emergency stats.
  const ids = state.currentUser?.role === 'viewer'
    ? state.customKpis.filter((id: string) => id !== 'emergencies')
    : state.customKpis;
  const catalog = getEffectiveKpiCatalog(state.fieldDefinitions);
  const byId = (id: string) => catalog.find(k => k.id === id);
  const toneClass: Record<string, string> = {
    amber: 'from-amber-400 to-orange-600',
    blue: 'from-blue-400 to-indigo-600',
    emerald: 'from-emerald-400 to-teal-600',
    red: 'from-red-400 to-rose-700',
    orange: 'from-orange-400 to-red-600',
    purple: 'from-purple-400 to-fuchsia-700',
    slate: 'from-slate-400 to-slate-600',
  };
  const textClass: Record<string, string> = {
    amber: 'text-amber-400', blue: 'text-blue-400', emerald: 'text-emerald-400',
    red: 'text-red-300', orange: 'text-orange-400', purple: 'text-purple-400', slate: 'text-slate-300',
  };
  return (
    <>
      {ids.map((id: string) => {
        const def = byId(id);
        if (!def) return null;
        const v = id === 'emergencies' ? activeEmergencies : (agg as any)[id] || 0;
        const isEmergency = id === 'emergencies' && v > 0;
        return (
          <div
            key={id}
            className={`${isEmergency ? 'bg-gradient-to-br from-red-900/95 to-red-800/85 border-red-500/50 animate-pulse-alert glow-crimson' : 'bg-gradient-to-br from-[#0B0F19]/95 to-[#111827]/85 border-[#1E293B]'} backdrop-blur-md border rounded-lg p-2.5 relative overflow-hidden`}
          >
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${toneClass[def.tone]}`} />
            <div className="text-[10px] text-slate-400 mb-0.5">{def.label}</div>
            <div className={`kpi-number text-xl ${textClass[def.tone]}`}>{formatNumber(v)}</div>
          </div>
        );
      })}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Smart Insights ticker (OpsView bottom)
// ════════════════════════════════════════════════════════════════
function SmartInsightsTicker({ insights }: { insights: ReturnType<typeof buildInsights> }) {
  if (insights.length === 0) {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-[400] bg-[#0B0F19]/90 backdrop-blur-md border-t border-[#1E293B] h-10 flex items-center px-4 text-xs text-slate-500">
        لا توجد رؤى لعرضها بعد — ستظهر فور إدخال تقارير اليوم.
      </div>
    );
  }
  const iconFor = (icon: string) => {
    switch (icon) {
      case 'up': return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
      case 'down': return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
      case 'alert': return <AlertOctagon className="w-3.5 h-3.5 text-red-400" />;
      case 'star': return <Star className="w-3.5 h-3.5 text-amber-400" />;
      case 'service': return <Package className="w-3.5 h-3.5 text-emerald-400" />;
      case 'idle': return <ZapOff className="w-3.5 h-3.5 text-amber-400" />;
      case 'news': return <Activity className="w-3.5 h-3.5 text-amber-400" />;
      default: return <Info className="w-3.5 h-3.5 text-blue-400" />;
    }
  };
  const toneCls = (tone: string) => tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-red-300' : tone === 'warning' ? 'text-amber-300' : 'text-slate-200';
  return (
    <div className="absolute bottom-0 left-0 right-0 z-[400] bg-[#0B0F19]/95 backdrop-blur-md border-t border-[#1E293B] h-12 flex items-center overflow-hidden" dir="rtl">
      <div className="shrink-0 px-3 text-[10px] font-bold text-black bg-amber-400 h-full flex items-center gap-1.5">
        <Activity className="w-3 h-3 animate-pulse" />
        رؤى لحظية
      </div>
      <div className="flex-1 overflow-hidden relative">
        {/* Single pass over the FULL set of insights, then it loops. The
            duration scales with the number of insights so every headline is
            shown completely before the cycle restarts (no early repeat). */}
        <div
          className="inline-flex items-center gap-10 px-4 animate-ticker whitespace-nowrap text-xs"
          style={{ animationDuration: `${Math.max(30, insights.length * 7)}s` }}
        >
          {insights.map((ins, i) => (
            <div key={`${ins.id}-${i}`} className="flex items-center gap-2">
              {ins.source && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black shrink-0">
                  {ins.source}
                </span>
              )}
              {iconFor(ins.icon)}
              <span className={`font-semibold ${toneCls(ins.tone)}`}>{ins.text}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

