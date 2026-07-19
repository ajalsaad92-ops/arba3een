/**
 * Export reports as the official Arba3een Excel template.
 * Loads /report-template.xlsx verbatim, fills office rows (8..23) with
 * aggregated data, updates the "لغاية يوم …" label, and downloads.
 * Preserves all merges, fonts, borders, colors, column widths from the template.
 */
import ExcelJS from 'exceljs';
import type { DailyReport, ReportFieldDefinition } from '../data/types';
import {
  TEMPLATE_OFFICES,
  TEMPLATE_COLUMNS,
  aggregateForTemplate,
  formatTemplateDateArabic,
} from './arbaeenTemplate';

const TEMPLATE_URL = `${import.meta.env.BASE_URL || '/'}report-template.xlsx`;

export async function exportArbaeenTemplate(
  reports: DailyReport[],
  fieldDefs: ReportFieldDefinition[] = [],
  opts: { toDate?: string; fileName?: string } = {},
): Promise<void> {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('تعذر تحميل قالب Excel');
  const buf = await res.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];

  const { rows, totals } = aggregateForTemplate(reports, fieldDefs);

  // Fill office data rows 8..23 (16 rows) — leave cell styles intact.
  TEMPLATE_OFFICES.forEach((_, i) => {
    const r = 8 + i;
    TEMPLATE_COLUMNS.forEach((col, ci) => {
      const cell = ws.getCell(`${col.col}${r}`);
      const v = rows[i][ci];
      // Only write when non-zero to keep zeros as blanks like the template.
      cell.value = v || null;
    });
  });

  // Row 24 header label — append the "لغاية يوم …" date.
  const dateLabel = formatTemplateDateArabic(opts.toDate || new Date().toISOString().slice(0, 10));
  ws.getCell('A24').value = `الاجمالي لمديرية شؤون المحافظات لغاية يوم ${dateLabel}`;

  // Row 28 totals — the template already has SUM formulas; overwrite to keep
  // numeric consistency even if the file is opened offline.
  TEMPLATE_COLUMNS.forEach((col, ci) => {
    ws.getCell(`${col.col}28`).value = totals[ci] || null;
  });

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.fileName || `احصاء_الاربعين_${opts.toDate || new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
