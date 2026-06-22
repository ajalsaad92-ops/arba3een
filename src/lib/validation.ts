/**
 * Arba3een — Central input validation
 * كل التحقق في مكان واحد، RTL messages
 */

export type FieldError = string | null;

export function validateRequired(value: any, label = 'هذا الحقل'): FieldError {
  if (value === undefined || value === null) return `${label} مطلوب`;
  if (typeof value === 'string' && value.trim() === '') return `${label} مطلوب`;
  if (Array.isArray(value) && value.length === 0) return `${label} مطلوب`;
  return null;
}

export function validateNumber(
  value: any,
  opts?: { min?: number; max?: number; integer?: boolean; label?: string }
): FieldError {
  const label = opts?.label ?? 'القيمة';
  if (value === '' || value === undefined || value === null) return null;
  const n = Number(value);
  if (!isFinite(n)) return `${label} يجب أن تكون رقماً`;
  if (opts?.integer && !Number.isInteger(n)) return `${label} يجب أن تكون عدداً صحيحاً`;
  if (opts?.min !== undefined && n < opts.min) return `${label} يجب أن تكون ≥ ${opts.min}`;
  if (opts?.max !== undefined && n > opts.max) return `${label} يجب أن تكون ≤ ${opts.max}`;
  return null;
}

export function validateText(
  value: string,
  opts?: { min?: number; max?: number; label?: string }
): FieldError {
  const label = opts?.label ?? 'النص';
  const len = (value ?? '').trim().length;
  if (opts?.min && len < opts.min) return `${label} يجب أن يكون ${opts.min} أحرف على الأقل`;
  if (opts?.max && len > opts.max) return `${label} يجب ألا يتجاوز ${opts.max} حرف`;
  return null;
}

export function validateEmail(email: string): FieldError {
  if (!email) return 'البريد الإلكتروني مطلوب';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email.trim().toLowerCase())) return 'صيغة البريد الإلكتروني غير صحيحة';
  return null;
}

export function validateUsername(u: string): FieldError {
  const v = u.trim().toLowerCase();
  if (!v) return 'اسم المستخدم مطلوب';
  if (v.length < 3) return 'اسم المستخدم 3 أحرف على الأقل';
  if (v.length > 32) return 'اسم المستخدم طويل جداً';
  if (!/^[a-z0-9._-]+$/.test(v)) return 'أحرف إنجليزية وأرقام و . _ - فقط';
  if (!/^[a-z]/.test(v)) return 'يجب أن يبدأ بحرف إنجليزي';
  return null;
}

export function passwordStrength(pw: string): { score: 0|1|2|3|4; label: string; color: string } {
  if (!pw) return { score: 0, label: '—', color: '#64748b' };
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  s = Math.min(4, s) as any;
  const map = [
    { label: 'ضعيفة', color: '#ef4444' },
    { label: 'مقبولة', color: '#f97316' },
    { label: 'جيدة', color: '#eab308' },
    { label: 'قوية', color: '#22c55e' },
    { label: 'ممتازة', color: '#10b981' },
  ];
  return { score: s as any, ...map[s] };
}

export function validatePassword(pw: string, opts?: { min?: number }): FieldError {
  const min = opts?.min ?? 6;
  if (!pw) return 'كلمة المرور مطلوبة';
  if (pw.length < min) return `كلمة المرور ${min} أحرف على الأقل`;
  if (pw.length > 128) return 'كلمة المرور طويلة جداً';
  return null;
}

// MGRS – simple but strict enough for UX
// e.g. 38SMB1234567890 / 38S MB 12345 67890
export function validateMGRS(mgrs: string, required = false): FieldError {
  if (!mgrs) return required ? 'MGRS مطلوب' : null;
  const v = mgrs.replace(/\s+/g, '').toUpperCase();
  // zone(1-2 digits) + band(A-Z except I,O) + 2 letters + even digits (2..10)
  const re = /^[0-9]{1,2}[C-HJ-NP-X][A-Z]{2}[0-9]{2,10}$/;
  if (!re.test(v)) return 'صيغة MGRS غير صحيحة';
  const numPart = v.replace(/^[0-9]{1,2}[A-Z]{3}/, '');
  if (numPart.length % 2 !== 0) return 'إحداثيات MGRS يجب أن تكون زوجية';
  return null;
}

export function validateLatLng(lat: number | undefined, lng: number | undefined, required = true): FieldError {
  if (lat == null || lng == null) return required ? 'الموقع مطلوب' : null;
  if (lat < -90 || lat > 90) return 'خط العرض غير صالح';
  if (lng < -180 || lng > 180) return 'خط الطول غير صالح';
  return null;
}

export function sanitizeText(input: string, maxLen = 2000): string {
  if (!input) return '';
  return String(input)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, maxLen);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Validate a whole form object
export function validateForm<T extends Record<string, any>>(
  values: T,
  rules: { [K in keyof T]?: (v: T[K], all: T) => FieldError }
): { valid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const key in rules) {
    const fn = rules[key];
    if (!fn) continue;
    const err = fn(values[key], values);
    if (err) errors[key] = err;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
