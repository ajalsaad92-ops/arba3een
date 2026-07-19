/**
 * Arba3een official Excel template — layout + aggregation.
 *
 * The uploaded template `public/report-template.xlsx` defines the exact
 * headers/merges/styles required by the directorate. We reuse it verbatim on
 * export (via ExcelJS) and mirror the same structure in the HistoryPage table.
 */
import type { DailyReport, ReportFieldDefinition } from '../data/types';
import { officeById } from '../data/offices';

/** Office rows exactly as they appear in the template (rows 8..23). */
export const TEMPLATE_OFFICES: { label: string; officeIds: string[] }[] = [
  { label: 'مقر المديرية',          officeIds: ['HQ'] },
  { label: 'مكتب البصرة',           officeIds: ['BAS'] },
  { label: 'مكتب ميسان',            officeIds: ['MYS'] },
  { label: 'مكتب ذي قار',           officeIds: ['DHQ'] },
  { label: 'مكتب واسط',             officeIds: ['WST'] },
  { label: 'مكتب المثنى',           officeIds: ['MTH'] },
  { label: 'مكتب الديوانية',        officeIds: ['QDS'] },
  { label: 'مكتب النجف الاشرف',     officeIds: ['NJF'] },
  { label: 'مكتب بابل',             officeIds: ['BBL'] },
  { label: 'مكتب كربلاء المقدسة',   officeIds: ['KRB'] },
  { label: 'مكتب بغداد',            officeIds: ['BGD'] },
  { label: 'مكتب صلاح الدين',       officeIds: ['SLD'] },
  { label: 'مكتب الانبار',          officeIds: ['ANB'] },
  { label: 'مكتب ديالى',            officeIds: ['DLY'] },
  { label: 'مكتب كركوك',            officeIds: ['KRK'] },
  { label: 'مكتب نينوى',            officeIds: [] }, // no office in system yet
];

/**
 * The 35 data columns (Excel columns C..AK) in template order.
 * `group` = top-level section, `sub` = mid-level (may be empty), `leaf` = column header,
 * `builtIn` = getter from a DailyReport for the standard fields,
 * `labelAliases` = extra field label variants that also feed this column.
 */
export interface TemplateColumn {
  col: string;           // Excel column letter (C..AK)
  group: string;         // top row 4/24
  sub: string;           // row 5/25 (or '')
  leaf: string;          // row 7/27 (or same as sub if leaf)
  builtIn?: (r: DailyReport) => number;
  labelAliases?: string[];
}

const num = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : 0);

export const TEMPLATE_COLUMNS: TemplateColumn[] = [
  // موارد مديرية شؤون المحافظات
  { col: 'C', group: 'موارد مديرية شؤون المحافظات', sub: '', leaf: 'ملاك منتشر',
    builtIn: r => num(r.deploymentCount), labelAliases: ['ملاك منتشر','الملاك المنتشر'] },
  { col: 'D', group: 'موارد مديرية شؤون المحافظات', sub: '', leaf: 'العجلات',
    builtIn: r => num(r.vehiclesCount), labelAliases: ['العجلات','عدد العجلات'] },
  { col: 'E', group: 'موارد مديرية شؤون المحافظات', sub: 'الوقود الموزع', leaf: 'بنزين',
    labelAliases: ['بنزين موزع','الوقود الموزع بنزين'] },
  { col: 'F', group: 'موارد مديرية شؤون المحافظات', sub: 'الوقود الموزع', leaf: 'زيت الغاز',
    labelAliases: ['زيت الغاز موزع','الوقود الموزع زيت الغاز'] },
  { col: 'G', group: 'موارد مديرية شؤون المحافظات', sub: '', leaf: 'المواكب الخاصة',
    builtIn: r => num(r.processionsCount), labelAliases: ['المواكب الخاصة','المواكب'] },
  // الجهد التنسيقي
  { col: 'H', group: 'الجهد التنسيقي', sub: 'الخدمية', leaf: 'المواكب الخدمية المُنسق معها',
    labelAliases: ['المواكب الخدمية المُنسق معها','المواكب الخدمية'] },
  { col: 'I', group: 'الجهد التنسيقي', sub: 'الخدمية', leaf: 'المواكب الثقافية المُنسق معها',
    labelAliases: ['المواكب الثقافية المُنسق معها','المواكب الثقافية'] },
  { col: 'J', group: 'الجهد التنسيقي', sub: 'الخدمية', leaf: 'بناء وتوفير الصحيات (متنقل/ ثابت)',
    labelAliases: ['بناء وتوفير الصحيات','الصحيات'] },
  { col: 'K', group: 'الجهد التنسيقي', sub: 'الخدمية', leaf: 'المتطوعين للاعمال الخدمية',
    labelAliases: ['المتطوعين للاعمال الخدمية','المتطوعين الخدميين'] },
  { col: 'L', group: 'الجهد التنسيقي', sub: 'المواد المستلمة', leaf: 'بنزين',
    labelAliases: ['بنزين مستلم','المواد المستلمة بنزين'] },
  { col: 'M', group: 'الجهد التنسيقي', sub: 'المواد المستلمة', leaf: 'زيت الغاز',
    labelAliases: ['زيت الغاز مستلم','المواد المستلمة زيت الغاز'] },
  { col: 'N', group: 'الجهد التنسيقي', sub: 'المواد المستلمة', leaf: 'عدد اسطونات الغاز',
    labelAliases: ['عدد اسطونات الغاز','اسطونات الغاز'] },
  { col: 'O', group: 'الجهد التنسيقي', sub: 'المواد المستلمة', leaf: 'النفط الأبيض',
    labelAliases: ['النفط الأبيض','النفط الابيض'] },
  { col: 'P', group: 'الجهد التنسيقي', sub: 'الطبية', leaf: 'المفارز الطبية المُنسق عليها',
    labelAliases: ['المفارز الطبية المُنسق عليها','المفارز الطبية'] },
  { col: 'Q', group: 'الجهد التنسيقي', sub: 'الطبية', leaf: 'الكادر الطبي التطوعي',
    labelAliases: ['الكادر الطبي التطوعي','الكادر الطبي'] },
  { col: 'R', group: 'الجهد التنسيقي', sub: 'الطبية', leaf: 'الإسعافات',
    labelAliases: ['الإسعافات','الاسعافات'] },
  { col: 'S', group: 'الجهد التنسيقي', sub: 'الاليات ', leaf: 'العجلات الخدمية',
    labelAliases: ['العجلات الخدمية'] },
  { col: 'T', group: 'الجهد التنسيقي', sub: 'الاليات ', leaf: 'عدد الخدمات المقدمة',
    labelAliases: ['عدد الخدمات المقدمة','الخدمات المقدمة'] },
  { col: 'U', group: 'الجهد التنسيقي', sub: 'الاليات ', leaf: 'عجلات نقل الزائرين',
    labelAliases: ['عجلات نقل الزائرين'] },
  { col: 'V', group: 'الجهد التنسيقي', sub: 'الاليات ', leaf: 'عدد الزائرين المستفيد',
    builtIn: r => num(r.visitorsIn), labelAliases: ['عدد الزائرين المستفيد','عدد الزائرين'] },
  // التواصل العام
  { col: 'W', group: 'التواصل العام', sub: '', leaf: 'الابلاغ غن الحوادث',
    builtIn: r => num(r.incidentsCount), labelAliases: ['الابلاغ عن الحوادث','الحوادث'] },
  { col: 'X', group: 'التواصل العام', sub: '', leaf: 'رصد الحركات المنحرفة والابلاغ عنها',
    builtIn: r => num(r.violationsCount), labelAliases: ['رصد الحركات المنحرفة','الخروقات'] },
  { col: 'Y', group: 'التواصل العام', sub: '', leaf: 'تأمين المواقع والشخصيات',
    labelAliases: ['تأمين المواقع والشخصيات','تأمين المواقع'] },
  // الجهد الخدمي - المياه
  { col: 'Z',  group: 'الجهد الخدمي', sub: 'المياه — مياه صالحة للشرب',    leaf: 'كارتون',
    labelAliases: ['مياه شرب كارتون'] },
  { col: 'AA', group: 'الجهد الخدمي', sub: 'المياه — مياه صالحة للشرب',    leaf: 'سيت',
    labelAliases: ['مياه شرب سيت'] },
  { col: 'AB', group: 'الجهد الخدمي', sub: 'المياه — مياه صالحة للشرب',    leaf: 'لتر',
    labelAliases: ['مياه شرب لتر'] },
  { col: 'AC', group: 'الجهد الخدمي', sub: 'المياه — مياه صالحة للاستخدام', leaf: 'لتر',
    labelAliases: ['مياه استخدام لتر','مياه صالحة للاستخدام'] },
  { col: 'AD', group: 'الجهد الخدمي', sub: 'الثلج',      leaf: 'قوالب الثلج ',
    labelAliases: ['قوالب الثلج','الثلج'] },
  { col: 'AE', group: 'الجهد الخدمي', sub: 'التنظيف',    leaf: 'عدد المتطوعين المشاركين في التنظيف',
    labelAliases: ['متطوعي التنظيف','عدد المتطوعين المشاركين في التنظيف'] },
  { col: 'AF', group: 'الجهد الخدمي', sub: 'الجانب الإعلامي', leaf: 'نشر وتوزيع (مواد أعلامية)',
    labelAliases: ['نشر وتوزيع مواد أعلامية','المواد الإعلامية'] },
  { col: 'AG', group: 'الجهد الخدمي', sub: 'الجانب الإعلامي', leaf: 'توثيق الحالات الايجابية والمبادرات',
    labelAliases: ['توثيق الحالات الايجابية والمبادرات','المبادرات الإيجابية'] },
  { col: 'AH', group: 'الجهد الخدمي', sub: 'الطعام والعصائر', leaf: 'وجبات الطعام الرئيسية',
    labelAliases: ['وجبات الطعام الرئيسية','الوجبات الرئيسية'] },
  { col: 'AI', group: 'الجهد الخدمي', sub: 'الطعام والعصائر', leaf: 'وجبات الطعام الخفيفة',
    labelAliases: ['وجبات الطعام الخفيفة','الوجبات الخفيفة'] },
  { col: 'AJ', group: 'الجهد الخدمي', sub: 'الطعام والعصائر', leaf: 'المشروبات الباردة والمثلجات',
    labelAliases: ['المشروبات الباردة والمثلجات','المشروبات'] },
  { col: 'AK', group: 'الجهد الخدمي', sub: 'الطعام والعصائر', leaf: 'فواكه "كارتون/ او كل 12كغم يحسب كارتون"',
    labelAliases: ['فواكه','الفواكه'] },
];

/** Normalise Arabic text for label matching (remove diacritics, unify alef/yaa). */
function norm(s: string): string {
  return String(s || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract a numeric value from an extra-field payload (number, string or select+qty). */
function extraNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (Array.isArray(v)) return v.reduce((s, r: any) => s + (Number(r?.qty) || 0), 0);
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Aggregate a list of reports into a matrix:
 * outer array = one entry per template office row (16 rows),
 * inner array = 35 numeric column values (C..AK).
 * Filters honor field-definition visibility (hidden = excluded).
 */
export function aggregateForTemplate(
  reports: DailyReport[],
  fieldDefs: ReportFieldDefinition[] = [],
): { rows: number[][]; totals: number[] } {
  // Build a label→fieldKey map for dynamic fields (skip hidden).
  const labelToKey = new Map<string, string>();
  for (const d of fieldDefs) {
    if (d.isHidden) continue;
    labelToKey.set(norm(d.labelAr || d.fieldKey), d.fieldKey);
  }

  const rows: number[][] = TEMPLATE_OFFICES.map(() =>
    new Array(TEMPLATE_COLUMNS.length).fill(0),
  );
  const totals: number[] = new Array(TEMPLATE_COLUMNS.length).fill(0);

  // Group reports by office row-index.
  const officeIndex = new Map<string, number>();
  TEMPLATE_OFFICES.forEach((o, i) => o.officeIds.forEach(id => officeIndex.set(id, i)));

  for (const r of reports) {
    const idx = officeIndex.get(r.officeId);
    if (idx == null) continue;
    TEMPLATE_COLUMNS.forEach((col, ci) => {
      let v = 0;
      if (col.builtIn) v = col.builtIn(r);
      // Extra-field aliases: sum first matching alias.
      if (!v && col.labelAliases && r.extraFields) {
        for (const alias of col.labelAliases) {
          const key = labelToKey.get(norm(alias));
          if (key && r.extraFields[key] != null) {
            v = extraNum(r.extraFields[key]);
            if (v) break;
          }
        }
      }
      rows[idx][ci] += v;
      totals[ci] += v;
    });
  }
  return { rows, totals };
}

/** Human date suffix for the "لغاية يوم …" totals label. */
export function formatTemplateDateArabic(iso: string): string {
  try {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return iso; }
}

export { officeById };
