import * as XLSX from 'xlsx';
import type { DailyReport, Profile } from '../data/types';
import type { ReportFieldDefinition } from '../data/types';
import { officeById } from '../data/offices';

/** Format an ISO timestamp as a readable Baghdad-local date+time string. */
function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

/**
 * Build and download a comprehensive Excel workbook containing EVERY report
 * (today + historical) with all fields, plus who entered the data, exactly
 * when (timestamp), and where (reporter coordinates).
 */
export function exportComprehensiveReports(
  reports: DailyReport[],
  users: Profile[],
  fieldDefinitions: ReportFieldDefinition[] = [],
): void {
  const userById = new Map(users.map((u) => [u.id, u]));

  // Collect every dynamic (admin-added) field key that appears across reports.
  const extraKeys = new Set<string>();
  for (const r of reports) {
    if (r.extraFields) Object.keys(r.extraFields).forEach((k) => extraKeys.add(k));
  }
  const extraLabel = (key: string) =>
    fieldDefinitions.find((d) => d.fieldKey === key)?.labelAr || key;

  const rows = reports
    .slice()
    .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
    .map((r) => {
      const office = officeById(r.officeId);
      const submitter = userById.get(r.submittedBy);
      const row: Record<string, any> = {
        'المكتب': office?.nameAr || r.officeId,
        'المحافظة': office?.governorateAr || '',
        'تاريخ التقرير': r.reportDate,
        'وقت الإدخال': fmtDateTime(r.submittedAt),
        'مُدخِل البيانات': submitter?.fullNameAr || r.submittedBy || 'غير معروف',
        'دور المُدخِل': submitter?.role || '',
        'متأخر؟': r.isLateSubmission ? 'نعم' : 'لا',
        'موقع المُدخِل (إحداثيات)':
          r.reporterLat != null && r.reporterLng != null
            ? `${r.reporterLat.toFixed(5)}, ${r.reporterLng.toFixed(5)}`
            : '',
        'مرجع MGRS': r.mgrsReference || '',
        'القوة المنتشرة': r.deploymentCount,
        'مواقع الانتشار': r.deploymentLocations,
        'التشكيلات': r.deploymentFormations,
        'قطاعات التنسيق': r.coordinationSectors,
        'العمليات المشتركة': r.coordinationJointOps,
        'عدد الحوادث': r.incidentsCount,
        'تفاصيل الحوادث': r.incidentsDetails,
        'عدد الخروقات': r.violationsCount,
        'منطقة الخرق': r.violationsArea,
        'توقيت الخرق': r.violationsTimeDetail,
        'تفاصيل الخروقات': r.violationsDetails,
        'عدد الوفيات': r.deathsCount,
        'موقع الوفاة (MGRS)': r.deathsLocationMgrs,
        'الإجراء المتخذ': r.deathsActionTaken,
        'الموارد الموزعة': r.resourcesDistributed,
        'تفاصيل الموارد': r.resourcesDetails,
        'عدد الفعاليات': r.eventsCount,
        'تفاصيل الفعاليات': r.eventsDetails,
        'عدد الزيارات': r.visitsCount,
        'ملخص الزيارات': r.visitsSummary,
        'الوافدون': r.visitorsIn,
        'المغادرون': r.visitorsOut,
        'مسارات الزوار': r.visitorsRoutes,
        'عدد العجلات': r.vehiclesCount,
        'تفاصيل العجلات': r.vehiclesDetails,
        'عدد المواكب': r.processionsCount,
        'تفاصيل المواكب': r.processionsDetails,
        'ملاحظات أخرى': r.otherNotes,
      };
      // Append all dynamic/custom fields.
      for (const k of extraKeys) {
        const v = r.extraFields?.[k];
        const def = fieldDefinitions.find((d) => d.fieldKey === k);
        if (def?.fieldType === 'select' && def.withQuantity) {
          // select + quantity → readable list + numeric total column
          row[extraLabel(k)] = extraFieldDisplay(v);
          row[`${extraLabel(k)} (الإجمالي)`] = extraFieldNumericValue(v);
        } else {
          row[extraLabel(k)] = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v;
        }
      }
      return row;
    });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'لا توجد بيانات': '' }]);
  // RTL sheet view.
  (ws as any)['!sheetViews'] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, ws, 'كل التقارير');

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  XLSX.writeFile(wb, `التقارير_الشاملة_${stamp}.xlsx`);
}
