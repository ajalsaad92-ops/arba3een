import { z } from 'zod';
import type { ReportFieldDefinition } from '../data/types';

/**
 * Zod-backed validators for daily-report fields.
 * Returns a map { fieldKey: errorMessageAr } — empty when valid.
 */

const numberField = z
  .union([z.number(), z.string()])
  .transform((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)))
  .refine((v) => v === undefined || !Number.isNaN(v), { message: 'رقم غير صالح' })
  .refine((v) => v === undefined || v >= 0, { message: 'لا يمكن أن تكون سالبة' })
  .refine((v) => v === undefined || v <= 999_999_999, { message: 'قيمة كبيرة جداً' })
  .refine((v) => v === undefined || Number.isFinite(v), { message: 'قيمة غير صالحة' });

const textField = (max?: number | null) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === null || v === undefined ? '' : String(v)))
    .refine((s) => !max || s.length <= max, { message: max ? `الحد ${max} حرف` : '' });

export function validateReportField(
  field: ReportFieldDefinition,
  value: unknown,
): string | null {
  if (field.fieldType === 'number') {
    const r = numberField.safeParse(value);
    if (!r.success) return r.error.issues[0]?.message ?? 'قيمة غير صالحة';
    return null;
  }
  if (field.fieldType === 'text' || field.fieldType === 'textarea') {
    const r = textField(field.maxLength).safeParse(value);
    if (!r.success) return r.error.issues[0]?.message ?? 'نص غير صالح';
    return null;
  }
  return null;
}

export function validateReportForm(
  fields: ReportFieldDefinition[],
  form: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = form[f.fieldKey];
    if (v === undefined || v === '') continue;
    const err = validateReportField(f, v);
    if (err) errors[f.fieldKey] = err;
  }
  return errors;
}

const MGRS_RE = /^[0-9]{1,2}[C-HJ-NP-X][A-Z]{2}[0-9]{2,10}$/i;
export function validateMgrs(value: string): boolean {
  if (!value) return true;
  return MGRS_RE.test(value.replace(/\s+/g, ''));
}
