/**
 * On-screen preview table that mirrors the official Arba3een Excel template.
 * Same hierarchical Arabic headers, same 16-office rows, same totals row.
 * Rendered from aggregated report data supplied by the caller.
 */
import React, { useMemo } from 'react';
import {
  TEMPLATE_OFFICES,
  TEMPLATE_COLUMNS,
  aggregateForTemplate,
} from '../lib/arbaeenTemplate';
import type { DailyReport, ReportFieldDefinition } from '../data/types';

interface Props {
  reports: DailyReport[];
  fieldDefs?: ReportFieldDefinition[];
}

/** Build header row groupings from TEMPLATE_COLUMNS (contiguous group/sub spans). */
function buildHeaderSpans() {
  const groups: { label: string; span: number }[] = [];
  const subs: { label: string; span: number }[] = [];
  let g = TEMPLATE_COLUMNS[0].group, gCount = 0;
  let s = TEMPLATE_COLUMNS[0].sub, sCount = 0;
  TEMPLATE_COLUMNS.forEach((c) => {
    if (c.group === g) gCount++;
    else { groups.push({ label: g, span: gCount }); g = c.group; gCount = 1; }
    if (c.sub === s) sCount++;
    else { subs.push({ label: s, span: sCount }); s = c.sub; sCount = 1; }
  });
  groups.push({ label: g, span: gCount });
  subs.push({ label: s, span: sCount });
  return { groups, subs };
}

const fmt = (n: number) => (n ? new Intl.NumberFormat('en-US').format(n) : '');

export function ArbaeenTemplateTable({ reports, fieldDefs = [] }: Props) {
  const { rows, totals } = useMemo(() => aggregateForTemplate(reports, fieldDefs), [reports, fieldDefs]);
  const { groups, subs } = useMemo(buildHeaderSpans, []);

  return (
    <div className="overflow-x-auto" dir="rtl">
      <table className="min-w-full text-[11px] border-collapse">
        <thead>
          {/* Row 1 — top groups */}
          <tr className="bg-amber-500/10 text-amber-300">
            <th rowSpan={3} className="border border-[#2c2c2c] px-2 py-2 sticky right-0 bg-amber-500/10 z-10">ت</th>
            <th rowSpan={3} className="border border-[#2c2c2c] px-2 py-2 sticky right-8 bg-amber-500/10 z-10 min-w-[140px]">المحافظة</th>
            {groups.map((g, i) => (
              <th key={i} colSpan={g.span} className="border border-[#2c2c2c] px-2 py-2 font-black">{g.label}</th>
            ))}
          </tr>
          {/* Row 2 — sub groups */}
          <tr className="bg-[#1a1a1a] text-slate-300">
            {subs.map((s, i) => (
              <th key={i} colSpan={s.span} className="border border-[#2c2c2c] px-2 py-2 font-bold">
                {s.label || '\u00A0'}
              </th>
            ))}
          </tr>
          {/* Row 3 — leaves */}
          <tr className="bg-[#0d0d0d] text-slate-400">
            {TEMPLATE_COLUMNS.map((c) => (
              <th key={c.col} className="border border-[#2c2c2c] px-2 py-2 font-medium whitespace-normal min-w-[70px] max-w-[110px] leading-tight">
                {c.leaf}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TEMPLATE_OFFICES.map((o, i) => (
            <tr key={i} className="hover:bg-[#232323]/40 even:bg-[#141414]">
              <td className="border border-[#2c2c2c] px-2 py-1.5 text-center text-slate-400 sticky right-0 bg-inherit">{i + 1}</td>
              <td className="border border-[#2c2c2c] px-2 py-1.5 text-slate-200 font-bold sticky right-8 bg-inherit">{o.label}</td>
              {rows[i].map((v, ci) => (
                <td key={ci} className="border border-[#2c2c2c] px-2 py-1.5 text-center tabular-nums text-slate-300">{fmt(v)}</td>
              ))}
            </tr>
          ))}
          <tr className="bg-amber-500/10 text-amber-300 font-black">
            <td colSpan={2} className="border border-[#2c2c2c] px-2 py-2 text-center sticky right-0 bg-amber-500/10">الإجمالي</td>
            {totals.map((v, ci) => (
              <td key={ci} className="border border-[#2c2c2c] px-2 py-2 text-center tabular-nums">{fmt(v)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
