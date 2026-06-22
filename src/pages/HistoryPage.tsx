import React, { useState, useMemo, useEffect } from 'react';
import { useOps } from '../store/opsStore';
import { useOffices } from '../lib/offices';
import { FileSpreadsheet, Check, Clock, Loader2 } from 'lucide-react';
import { formatNumber } from '../lib/utils';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { operationalDate, operationalDateDaysAgo } from '../lib/opDate';
import { EmptyState, Skeleton } from '../components/FormField';

export default function HistoryPage() {
  const { state, actions, dispatch } = useOps();
  const { offices, officeById } = useOffices();
  const user = state.currentUser!;

  const permittedIds = useMemo(() => 
    user.role === 'director' ? offices.map(o => o.id) :
    user.role === 'supervisor' ? user.permittedOfficeIds : [user.officeId],
    [user, offices]
  );

  const [fromDate, setFromDate] = useState(() => operationalDateDaysAgo(14));
  const [toDate, setToDate] = useState(() => operationalDate());
  const [selectedOffice, setSelectedOffice] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on-time' | 'late'>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loading = !!state.loadingFlags.historical;

  const filters = useMemo(() => ({
    officeId: selectedOffice || undefined,
    fromDate, toDate,
  }), [selectedOffice, fromDate, toDate]);

  // server-side load
  useEffect(() => {
    actions.loadHistoricalPage(page, PAGE_SIZE, filters, dispatch).catch(e => toast.error(e?.message || 'فشل التحميل'));
  }, [page, filters.officeId, filters.fromDate, filters.toDate]);

  const reports = state.historicalReports;
  const meta = state.historicalMeta;
  const totalPages = Math.max(1, Math.ceil(meta.total / PAGE_SIZE));

  // status filter client-side (we could move this server-side too – simple for now)
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return reports;
    return reports.filter(r => statusFilter === 'late' ? r.isLateSubmission : !r.isLateSubmission);
  }, [reports, statusFilter]);

  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    visitorsIn: acc.visitorsIn + (r.visitorsIn || 0),
    visitorsOut: acc.visitorsOut + (r.visitorsOut || 0),
    vehicles: acc.vehicles + (r.vehiclesCount || 0),
    processions: acc.processions + (r.processionsCount || 0),
    events: acc.events + (r.eventsCount || 0),
    incidents: acc.incidents + (r.incidentsCount || 0),
    deaths: acc.deaths + (r.deathsCount || 0),
  }), { visitorsIn: 0, visitorsOut: 0, vehicles: 0, processions: 0, events: 0, incidents: 0, deaths: 0 }), [filtered]);

  const handleExport = async () => {
    try {
      const toastId = toast.loading('جاري تجهيز التصدير...');
      let all: any[] = [];
      let p = 1, total = Infinity;
      while (all.length < total && p <= 25) {
        const res = await actions.loadHistoricalPage(p, 200, filters);
        all = all.concat(res.data);
        total = res.total; p++;
      }
      if (!all.length) { toast.error('لا توجد بيانات', { id: toastId }); return; }
      const wb = XLSX.utils.book_new();
      const sheet = all.map(r => ({
        'التاريخ': r.reportDate,
        'المكتب': officeById(r.officeId)?.nameAr ?? r.officeId,
        'المحافظة': officeById(r.officeId)?.governorateAr ?? '',
        'داخلون': r.visitorsIn, 'خارجون': r.visitorsOut,
        'العجلات': r.vehiclesCount, 'المواكب': r.processionsCount,
        'الفعاليات': r.eventsCount, 'الحوادث': r.incidentsCount,
        'الوفيات': r.deathsCount,
        'الحالة': r.isLateSubmission ? 'متأخر' : 'في الوقت',
      }));
      const ws = XLSX.utils.json_to_sheet(sheet);
      ws['!views'] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, ws, 'التقارير');
      XLSX.writeFile(wb, `احصائيات_${fromDate}_الى_${toDate}.xlsx`);
      toast.success(`تم تصدير ${all.length} تقرير`, { id: toastId });
      // reload current page
      actions.loadHistoricalPage(page, PAGE_SIZE, filters, dispatch);
    } catch (e: any) { toast.error(e?.message || 'فشل التصدير'); }
  };

  const toggleExpand = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="h-full overflow-y-auto bg-[#0B0F19] p-3 md:p-5" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-2xl font-display font-black text-amber-400">السجل التاريخي</div>
            <div className="text-xs text-slate-400 mt-1">{loading ? 'جاري التحميل…' : `${meta.total} تقرير إجمالي — صفحة ${page} / ${totalPages}`}</div>
          </div>
          <button onClick={handleExport} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg">
            <FileSpreadsheet className="w-4 h-4" /> تصدير Excel
          </button>
        </div>

        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <div><label className="text-[10px] text-slate-500 block mb-1">من</label>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-2 py-1.5 text-xs text-white" />
            </div>
            <div><label className="text-[10px] text-slate-500 block mb-1">إلى</label>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-2 py-1.5 text-xs text-white" />
            </div>
            <div><label className="text-[10px] text-slate-500 block mb-1">المكتب</label>
              <select value={selectedOffice} onChange={e => { setSelectedOffice(e.target.value); setPage(1); }}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-2 py-1.5 text-xs text-white">
                <option value="">جميع المكاتب</option>
                {offices.filter(o=> permittedIds.includes(o.id)).map(o => <option key={o.id} value={o.id}>{o.nameAr}</option>)}
              </select>
            </div>
            <div><label className="text-[10px] text-slate-500 block mb-1">الحالة</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-2 py-1.5 text-xs text-white">
                <option value="all">الكل</option>
                <option value="on-time">في الوقت</option>
                <option value="late">متأخر</option>
              </select>
            </div>
            <button onClick={() => { setFromDate(operationalDateDaysAgo(14)); setToDate(operationalDate()); setSelectedOffice(''); setStatusFilter('all'); setPage(1); }}
              className="px-3 bg-[#1E293B] hover:bg-[#263244] text-slate-300 text-xs font-bold py-1.5 rounded-md">إعادة تعيين</button>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(6)].map((_,i)=> <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="لا توجد تقارير" description="جرّب تغيير الفلاتر أو النطاق الزمني" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0B0F19] border-b border-[#1E293B] text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-right">التاريخ</th>
                    <th className="px-3 py-2 text-right">المكتب</th>
                    <th className="px-3 py-2 text-right">داخلون</th>
                    <th className="px-3 py-2 text-right">خارجون</th>
                    <th className="px-3 py-2 text-right">عجلات</th>
                    <th className="px-3 py-2 text-right">مواكب</th>
                    <th className="px-3 py-2 text-right">وفيات</th>
                    <th className="px-3 py-2 text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {filtered.map(r => {
                    const isExp = expanded.has(r.id);
                    return (
                      <React.Fragment key={r.id}>
                        <tr onClick={()=>toggleExpand(r.id)} className="hover:bg-[#1E293B]/40 cursor-pointer">
                          <td className="px-3 py-2 text-slate-300 font-mono">{r.reportDate}</td>
                          <td className="px-3 py-2 text-slate-200 font-semibold">{officeById(r.officeId)?.nameAr ?? r.officeId}</td>
                          <td className="px-3 py-2 text-emerald-400 tabular-nums">{formatNumber(r.visitorsIn)}</td>
                          <td className="px-3 py-2 text-amber-400 tabular-nums">{formatNumber(r.visitorsOut)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatNumber(r.vehiclesCount)}</td>
                          <td className="px-3 py-2 tabular-nums">{r.processionsCount}</td>
                          <td className="px-3 py-2 text-red-400 tabular-nums">{r.deathsCount}</td>
                          <td className="px-3 py-2">
                            {r.isLateSubmission
                              ? <span className="text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3" /> متأخر</span>
                              : <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> في الوقت</span>}
                          </td>
                        </tr>
                        {isExp && (
                          <tr className="bg-[#0B0F19]">
                            <td colSpan={8} className="px-4 py-3 text-[11px] text-slate-300">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {r.incidentsDetails && <div><b className="text-slate-500">حوادث:</b> {r.incidentsDetails}</div>}
                                {r.violationsDetails && <div><b className="text-slate-500">خروقات:</b> {r.violationsDetails}</div>}
                                {r.otherNotes && <div><b className="text-slate-500">ملاحظات:</b> {r.otherNotes}</div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-amber-500/5 border-t-2 border-amber-500/30 text-amber-300 font-bold">
                  <tr>
                    <td colSpan={2} className="px-3 py-3">مجموع الصفحة</td>
                    <td className="px-3 py-3">{formatNumber(totals.visitorsIn)}</td>
                    <td className="px-3 py-3">{formatNumber(totals.visitorsOut)}</td>
                    <td className="px-3 py-3">{formatNumber(totals.vehicles)}</td>
                    <td className="px-3 py-3">{totals.processions}</td>
                    <td className="px-3 py-3 text-red-400">{totals.deaths}</td>
                    <td className="px-3 py-3 text-[10px] text-slate-400">{filtered.length} تقرير</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="p-3 border-t border-[#1E293B] flex items-center justify-between text-xs">
            <div className="text-slate-500">إجمالي: {meta.total} — صفحة {page} / {totalPages}</div>
            <div className="flex gap-1">
              <button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-[#1E293B] hover:bg-[#263244] disabled:opacity-30">السابق</button>
              <button disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-[#1E293B] hover:bg-[#263244] disabled:opacity-30">التالي</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
