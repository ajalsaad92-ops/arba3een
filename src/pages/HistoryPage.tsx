import { useState, useMemo, useEffect } from 'react';
import { useOps } from '../store/opsStore';
import { useOffices } from '../lib/offices';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { operationalDate, operationalDateDaysAgo } from '../lib/opDate';
import { EmptyState, Skeleton } from '../components/FormField';
import { ArbaeenTemplateTable } from '../components/ArbaeenTemplateTable';
import { exportArbaeenTemplate } from '../lib/exportArbaeenExcel';

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

  // Client-side status filter — the on-screen table below aggregates per-office
  // for the whole filtered period, matching the official Excel template layout.
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return reports;
    return reports.filter(r => statusFilter === 'late' ? r.isLateSubmission : !r.isLateSubmission);
  }, [reports, statusFilter]);

  const handleExport = async () => {
    try {
      const toastId = toast.loading('جاري تجهيز التصدير...');
      // Fetch ALL matching reports for the range so the template totals are complete.
      let all: any[] = [];
      let p = 1, total = Infinity;
      while (all.length < total && p <= 25) {
        const res = await actions.loadHistoricalPage(p, 200, filters);
        all = all.concat(res.data);
        total = res.total; p++;
      }
      if (statusFilter !== 'all') {
        all = all.filter((r: any) => statusFilter === 'late' ? r.isLateSubmission : !r.isLateSubmission);
      }
      if (!all.length) { toast.error('لا توجد بيانات', { id: toastId }); return; }
      await exportArbaeenTemplate(all, state.fieldDefinitions, {
        toDate,
        fileName: `احصاء_الاربعين_${fromDate}_الى_${toDate}.xlsx`,
      });
      toast.success(`تم تصدير ${all.length} تقرير`, { id: toastId });
      actions.loadHistoricalPage(page, PAGE_SIZE, filters, dispatch);
    } catch (e: any) { toast.error(e?.message || 'فشل التصدير'); }
  };

  // (row-level expand no longer used with the template table view)
  void expanded; void setExpanded; void officeById;

  return (
    <div className="h-full overflow-y-auto bg-[#0d0d0d] p-3 md:p-5" dir="rtl">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-2xl font-display font-black text-amber-400">السجل التاريخي</div>
            <div className="text-xs text-slate-400 mt-1">{loading ? 'جاري التحميل…' : `${meta.total} تقرير في النطاق — العرض تراكمي حسب القالب الرسمي`}</div>
          </div>
          <button onClick={handleExport} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg">
            <FileSpreadsheet className="w-4 h-4" /> تصدير Excel (القالب الرسمي)
          </button>
        </div>

        <div className="bg-[#1a1a1a] border border-[#232323] rounded-xl p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <div><label className="text-[10px] text-slate-500 block mb-1">من</label>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="w-full bg-[#232323] border border-[#2c2c2c] rounded-md px-2 py-1.5 text-xs text-white" />
            </div>
            <div><label className="text-[10px] text-slate-500 block mb-1">إلى</label>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="w-full bg-[#232323] border border-[#2c2c2c] rounded-md px-2 py-1.5 text-xs text-white" />
            </div>
            <div><label className="text-[10px] text-slate-500 block mb-1">المكتب</label>
              <select value={selectedOffice} onChange={e => { setSelectedOffice(e.target.value); setPage(1); }}
                className="w-full bg-[#232323] border border-[#2c2c2c] rounded-md px-2 py-1.5 text-xs text-white">
                <option value="">جميع المكاتب</option>
                {offices.filter(o=> permittedIds.includes(o.id)).map(o => <option key={o.id} value={o.id}>{o.nameAr}</option>)}
              </select>
            </div>
            <div><label className="text-[10px] text-slate-500 block mb-1">الحالة</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full bg-[#232323] border border-[#2c2c2c] rounded-md px-2 py-1.5 text-xs text-white">
                <option value="all">الكل</option>
                <option value="on-time">في الوقت</option>
                <option value="late">متأخر</option>
              </select>
            </div>
            <button onClick={() => { setFromDate(operationalDateDaysAgo(14)); setToDate(operationalDate()); setSelectedOffice(''); setStatusFilter('all'); setPage(1); }}
              className="px-3 bg-[#232323] hover:bg-[#2c2c2c] text-slate-300 text-xs font-bold py-1.5 rounded-md">إعادة تعيين</button>
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#232323] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#232323] flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-sm font-bold text-amber-300">احصائية مسيرة الاربعين — مديرية شؤون المحافظات</div>
              <div className="text-[11px] text-slate-500">تجميع تراكمي حسب المكتب لكامل الفترة المحددة ({fromDate} → {toDate})</div>
            </div>
            <div className="text-[11px] text-slate-500">{filtered.length} تقرير تم تجميعه</div>
          </div>
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(6)].map((_,i)=> <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="لا توجد تقارير" description="جرّب تغيير الفلاتر أو النطاق الزمني" />
          ) : (
            <ArbaeenTemplateTable reports={filtered} fieldDefs={state.fieldDefinitions} />
          )}
          <div className="p-3 border-t border-[#232323] flex items-center justify-between text-xs">
            <div className="text-slate-500">صفحة البيانات: {page} / {totalPages} — الإجمالي {meta.total}</div>
            <div className="flex gap-1">
              <button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-[#232323] hover:bg-[#2c2c2c] disabled:opacity-30">السابق</button>
              <button disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-[#232323] hover:bg-[#2c2c2c] disabled:opacity-30">التالي</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
