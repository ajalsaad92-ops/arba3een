import { useState, useMemo } from 'react';
import { useOps } from '../store/opsStore';
import { OFFICES, officeById } from '../data/offices';
import { FileSpreadsheet, Check, Clock } from 'lucide-react';
import { formatNumber } from '../lib/utils';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export default function HistoryPage() {
  const { state } = useOps();
  const user = state.currentUser!;

  const permittedIds = user.role === 'director' ? OFFICES.map(o => o.id) :
    user.role === 'supervisor' ? user.permittedOfficeIds : [user.officeId];

  const [fromDate, setFromDate] = useState(() => operationalDateDaysAgo(14));
  const [toDate, setToDate] = useState(() => operationalDate());
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 50;

  const allReports = useMemo(() => [...state.todayReports, ...state.historicalReports], [state]);

  const filtered = useMemo(() => {
    return allReports.filter(r => {
      if (!permittedIds.includes(r.officeId)) return false;
      if (r.reportDate < fromDate || r.reportDate > toDate) return false;
      if (selectedOffices.length > 0 && !selectedOffices.includes(r.officeId)) return false;
      if (statusFilter === 'on-time' && r.isLateSubmission) return false;
      if (statusFilter === 'late' && !r.isLateSubmission) return false;
      return true;
    }).sort((a, b) => b.reportDate.localeCompare(a.reportDate) || b.submittedAt.localeCompare(a.submittedAt));
  }, [allReports, fromDate, toDate, selectedOffices, statusFilter, permittedIds]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, r) => ({
      visitorsIn: acc.visitorsIn + (r.visitorsIn || 0),
      visitorsOut: acc.visitorsOut + (r.visitorsOut || 0),
      vehicles: acc.vehicles + (r.vehiclesCount || 0),
      processions: acc.processions + (r.processionsCount || 0),
      events: acc.events + (r.eventsCount || 0),
      incidents: acc.incidents + (r.incidentsCount || 0),
      violations: acc.violations + (r.violationsCount || 0),
      deaths: acc.deaths + (r.deathsCount || 0),
      resources: acc.resources + (r.resourcesDistributed || 0),
      deployment: acc.deployment + (r.deploymentCount || 0),
    }), { visitorsIn: 0, visitorsOut: 0, vehicles: 0, processions: 0, events: 0, incidents: 0, violations: 0, deaths: 0, resources: 0, deployment: 0 });
  }, [filtered]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleExport = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Daily reports
      const sheet1 = filtered.map(r => ({
        'التاريخ': r.reportDate,
        'المكتب': officeById(r.officeId)?.nameAr ?? r.officeId,
        'المحافظة': officeById(r.officeId)?.governorateAr ?? '',
        'الانتشار - العدد': r.deploymentCount,
        'الانتشار - المواقع': r.deploymentLocations,
        'الانتشار - التشكيلات': r.deploymentFormations,
        'التنسيق - القطاعات': r.coordinationSectors,
        'التنسيق - العمليات': r.coordinationJointOps,
        'الحوادث - العدد': r.incidentsCount,
        'الحوادث - التفاصيل': r.incidentsDetails,
        'الخروقات - العدد': r.violationsCount,
        'الخروقات - المنطقة': r.violationsArea,
        'الخروقات - التوقيت': r.violationsTimeDetail,
        'الخروقات - التفاصيل': r.violationsDetails,
        'الوفيات - العدد': r.deathsCount,
        'الوفيات - الموقع MGRS': r.deathsLocationMgrs,
        'الوفيات - الإجراء': r.deathsActionTaken,
        'الموارد - العدد': r.resourcesDistributed,
        'الموارد - التفاصيل': r.resourcesDetails,
        'الفعاليات - العدد': r.eventsCount,
        'الفعاليات - التفاصيل': r.eventsDetails,
        'الزيارات - العدد': r.visitsCount,
        'الزيارات - الملخص': r.visitsSummary,
        'الزوار - داخلون': r.visitorsIn,
        'الزوار - خارجون': r.visitorsOut,
        'الزوار - المحاور': r.visitorsRoutes,
        'العجلات - العدد': r.vehiclesCount,
        'العجلات - التفاصيل': r.vehiclesDetails,
        'المواكب - العدد': r.processionsCount,
        'المواكب - التفاصيل': r.processionsDetails,
        'ملاحظات أخرى': r.otherNotes,
        'حالة الإرسال': r.isLateSubmission ? 'متأخر' : 'في الوقت',
        'وقت الإرسال': new Date(r.submittedAt).toLocaleString('ar-IQ'),
      }));
      const ws1 = XLSX.utils.json_to_sheet(sheet1);
      ws1['!cols'] = sheet1.length > 0 ? Object.keys(sheet1[0]).map(() => ({ wch: 18 })) : [];
      ws1['!views'] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, ws1, 'التقارير اليومية');

      // Sheet 2: Cumulative per office
      const byOffice: Record<string, any> = {};
      filtered.forEach(r => {
        if (!byOffice[r.officeId]) byOffice[r.officeId] = { office: officeById(r.officeId)?.nameAr, governorate: officeById(r.officeId)?.governorateAr, reports: 0, visitorsIn: 0, visitorsOut: 0, vehicles: 0, processions: 0, events: 0, incidents: 0, deaths: 0, resources: 0 };
        byOffice[r.officeId].reports++;
        byOffice[r.officeId].visitorsIn += r.visitorsIn || 0;
        byOffice[r.officeId].visitorsOut += r.visitorsOut || 0;
        byOffice[r.officeId].vehicles += r.vehiclesCount || 0;
        byOffice[r.officeId].processions += r.processionsCount || 0;
        byOffice[r.officeId].events += r.eventsCount || 0;
        byOffice[r.officeId].incidents += r.incidentsCount || 0;
        byOffice[r.officeId].deaths += r.deathsCount || 0;
        byOffice[r.officeId].resources += r.resourcesDistributed || 0;
      });
      const ws2 = XLSX.utils.json_to_sheet(Object.values(byOffice));
      ws2['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
      ws2['!views'] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, ws2, 'التراكمي بالمكاتب');

      // Sheet 3: Emergencies
      const sheet3 = state.emergencies.map(e => ({
        'التاريخ': new Date(e.createdAt).toLocaleString('ar-IQ'),
        'المكتب': officeById(e.officeId)?.nameAr ?? e.officeId,
        'النوع': e.emergencyType,
        'الوصف': e.description,
        'الموقع': e.locationMgrs ?? '',
        'الحالة': e.status === 'active' ? 'نشطة' : e.status === 'acknowledged' ? 'مستلمة' : 'محلولة',
        'وقت التأكيد': e.acknowledgedAt ? new Date(e.acknowledgedAt).toLocaleString('ar-IQ') : '',
        'وقت الحل': e.resolvedAt ? new Date(e.resolvedAt).toLocaleString('ar-IQ') : '',
      }));
      const ws3 = XLSX.utils.json_to_sheet(sheet3);
      ws3['!views'] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, ws3, 'سجل الطوارئ');

      // Sheet 4: Extension requests
      const sheet4 = state.extensions.map(e => ({
        'وقت الطلب': new Date(e.requestTime).toLocaleString('ar-IQ'),
        'الطالب': e.requestedByName,
        'المكتب': officeById(e.officeId)?.nameAr ?? e.officeId,
        'السبب': e.reason,
        'الحالة': e.status === 'pending' ? 'بانتظار مدير المكتب' : e.status === 'forwarded_to_supervisor' ? 'بانتظار المشرف' : e.status === 'approved' ? 'موافق عليه' : 'مرفوض',
        'وقت المراجعة': e.managerReviewedAt ? new Date(e.managerReviewedAt).toLocaleString('ar-IQ') : '',
        'وقت الموافقة': e.supervisorApprovedAt ? new Date(e.supervisorApprovedAt).toLocaleString('ar-IQ') : '',
      }));
      const ws4 = XLSX.utils.json_to_sheet(sheet4);
      ws4['!views'] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, ws4, 'طلبات التمديد');

      const filename = `احصائيات_الأربعين_${fromDate}_الى_${toDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`تم تصدير ${filtered.length} تقرير إلى ${filename}`);
    } catch (e) {
      toast.error('فشل التصدير');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0B0F19] p-3 md:p-5">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-2xl font-display font-black text-amber-400">السجل التاريخي</div>
            <div className="text-xs text-slate-400 mt-1">{filtered.length} تقرير في الفترة المحددة</div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" /> تصدير البيانات الشاملة (Excel)
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">من تاريخ</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-2 py-1.5 text-xs text-white focus:border-amber-500/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">إلى تاريخ</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-2 py-1.5 text-xs text-white focus:border-amber-500/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">المكتب</label>
              <select
                value={selectedOffices[0] || ''}
                onChange={e => setSelectedOffices(e.target.value ? [e.target.value] : [])}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-2 py-1.5 text-xs text-white focus:border-amber-500/40 focus:outline-none"
              >
                <option value="">جميع المكاتب</option>
                {OFFICES.filter(o => permittedIds.includes(o.id)).map(o => (
                  <option key={o.id} value={o.id}>{o.nameAr}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">الحالة</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full bg-[#1E293B] border border-[#263244] rounded-md px-2 py-1.5 text-xs text-white focus:border-amber-500/40 focus:outline-none"
              >
                <option value="all">الكل</option>
                <option value="on-time">في الوقت</option>
                <option value="late">متأخر</option>
              </select>
            </div>
            <div className="flex items-end gap-1">
              <button onClick={() => { setPage(0); toast.info(`تم تطبيق الفلتر: ${filtered.length} تقرير`); }} className="flex-1 bg-gradient-to-l from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black text-xs font-bold py-1.5 rounded-md">
                تطبيق الفلتر
              </button>
              <button onClick={() => { setFromDate((() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0,10); })()); setToDate(new Date().toISOString().slice(0,10)); setSelectedOffices([]); setStatusFilter('all'); setPage(0); toast.info('تم إعادة تعيين الفلاتر'); }} className="px-3 bg-[#1E293B] hover:bg-[#263244] text-slate-300 text-xs font-bold py-1.5 rounded-md">
                إعادة تعيين
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0B0F19] border-b border-[#1E293B] text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-right">التاريخ</th>
                  <th className="px-3 py-2 text-right">المكتب</th>
                  <th className="px-3 py-2 text-right">داخلون</th>
                  <th className="px-3 py-2 text-right">خارجون</th>
                  <th className="px-3 py-2 text-right">العجلات</th>
                  <th className="px-3 py-2 text-right">المواكب</th>
                  <th className="px-3 py-2 text-right">الفعاليات</th>
                  <th className="px-3 py-2 text-right">الحوادث</th>
                  <th className="px-3 py-2 text-right">الوفيات</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {paginated.map(r => {
                  const isExp = expanded.has(r.id);
                  return (
                    <>
                      <tr key={r.id} onClick={() => {
                        const next = new Set(expanded);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        setExpanded(next);
                      }} className="hover:bg-[#1E293B]/40 cursor-pointer">
                        <td className="px-3 py-2 text-slate-300 font-mono">{r.reportDate}</td>
                        <td className="px-3 py-2 text-slate-200 font-semibold">{officeById(r.officeId)?.nameAr}</td>
                        <td className="px-3 py-2 text-emerald-400 tabular-nums">{formatNumber(r.visitorsIn)}</td>
                        <td className="px-3 py-2 text-amber-400 tabular-nums">{formatNumber(r.visitorsOut)}</td>
                        <td className="px-3 py-2 text-slate-300 tabular-nums">{formatNumber(r.vehiclesCount)}</td>
                        <td className="px-3 py-2 text-slate-300 tabular-nums">{r.processionsCount}</td>
                        <td className="px-3 py-2 text-slate-300 tabular-nums">{r.eventsCount}</td>
                        <td className="px-3 py-2 text-slate-300 tabular-nums">{r.incidentsCount}</td>
                        <td className="px-3 py-2 text-red-400 tabular-nums">{r.deathsCount}</td>
                        <td className="px-3 py-2">
                          {r.isLateSubmission ? (
                            <span className="text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3" /> متأخر</span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> في الوقت</span>
                          )}
                        </td>
                      </tr>
                      {isExp && (
                        <tr className="bg-[#0B0F19]">
                          <td colSpan={10} className="px-4 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                              {r.deploymentLocations && <Field label="مواقع الانتشار" value={r.deploymentLocations} />}
                              {r.incidentsDetails && <Field label="تفاصيل الحوادث" value={r.incidentsDetails} />}
                              {r.violationsDetails && <Field label="تفاصيل الخروقات" value={r.violationsDetails} />}
                              {r.deathsActionTaken && <Field label="إجراء الوفيات" value={r.deathsActionTaken} />}
                              {r.resourcesDetails && <Field label="تفاصيل الموارد" value={r.resourcesDetails} />}
                              {r.eventsDetails && <Field label="تفاصيل الفعاليات" value={r.eventsDetails} />}
                              {r.visitorsRoutes && <Field label="محاور السير" value={r.visitorsRoutes} />}
                              {r.vehiclesDetails && <Field label="تفاصيل العجلات" value={r.vehiclesDetails} />}
                              {r.processionsDetails && <Field label="تفاصيل المواكب" value={r.processionsDetails} />}
                              {r.otherNotes && <Field label="ملاحظات" value={r.otherNotes} />}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot className="bg-gradient-to-t from-amber-500/10 to-transparent border-t-2 border-amber-500/30 text-amber-300 font-bold">
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-right">المجموع التراكمي للفترة المحددة</td>
                  <td className="px-3 py-3 tabular-nums">{formatNumber(totals.visitorsIn)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatNumber(totals.visitorsOut)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatNumber(totals.vehicles)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatNumber(totals.processions)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatNumber(totals.events)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatNumber(totals.incidents)}</td>
                  <td className="px-3 py-3 tabular-nums text-red-400">{formatNumber(totals.deaths)}</td>
                  <td className="px-3 py-3 text-[10px] text-slate-400">{filtered.length} تقرير</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-[#1E293B] flex items-center justify-between">
              <div className="text-xs text-slate-500">صفحة {page + 1} من {totalPages}</div>
              <div className="flex gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-[#1E293B] hover:bg-[#263244] disabled:opacity-30 text-xs">السابق</button>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-[#1E293B] hover:bg-[#263244] disabled:opacity-30 text-xs">التالي</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded p-2">
      <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-slate-200 text-[11px]">{value}</div>
    </div>
  );
}
