import type { ReportFieldDefinition } from '../data/types';

/**
 * Numeric value of a dynamic (extra) field value.
 * - plain number  → the number
 * - select+qty array [{item, qty}] → sum of quantities
 * - anything else → 0
 */
export function extraFieldNumericValue(val: any): number {
  if (val == null) return 0;
  if (Array.isArray(val)) {
    return val.reduce((s, r) => s + (Number(r?.qty) || 0), 0);
  }
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/** True when a value is the app's select-with-quantity structure. */
export function isSelectQuantityValue(val: any): boolean {
  return Array.isArray(val) && val.some((r) => r && typeof r === 'object' && 'item' in r && 'qty' in r);
}

/** Clean and clamp a select-with-quantity array before saving/exporting. */
export function normalizeSelectQuantityValue(val: any, maxRows = 50): { item: string; qty: number }[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((r: any) => r && String(r.item ?? '').trim() && r.item !== '__other__' && Number(r.qty) > 0)
    .slice(0, maxRows)
    .map((r: any) => ({
      item: String(r.item).trim().slice(0, 200),
      qty: Math.max(1, Math.min(999999, Number(r.qty) || 1)),
    }));
}

/**
 * Field keys that should be counted in dashboard statistics:
 * numeric fields, OR select fields with quantity enabled.
 */
export function statExtraKeys(defs: ReportFieldDefinition[]): string[] {
  return defs
    .filter(
      f =>
        f.countInStats &&
        !f.isBuiltIn &&
        !f.isHidden &&
        (f.fieldType === 'number' || (f.fieldType === 'select' && f.withQuantity)),
    )
    .map(f => f.fieldKey);
}

/** Human-readable rendering of an extra field value for exports/tables. */
export function extraFieldDisplay(val: any): string {
  if (val == null) return '';
  if (Array.isArray(val)) {
    // select+qty list
    if (val.length && typeof val[0] === 'object' && 'item' in val[0]) {
      const total = val.reduce((s, r) => s + (Number(r?.qty) || 0), 0);
      const items = val.map((r: any) => `${r.item} (${r.qty})`).join('، ');
      return `${items} — الإجمالي: ${total}`;
    }
    return JSON.stringify(val);
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
