import { describe, it, expect } from 'vitest';
import { validateReportField, validateReportForm, validateMgrs } from './reportValidation';
import type { ReportFieldDefinition } from '../data/types';

const f = (overrides: Partial<ReportFieldDefinition>): ReportFieldDefinition => ({
  id: 'x', groupId: 'g', fieldKey: 'k', labelAr: 'L',
  fieldType: 'number', sortOrder: 0, isHidden: false, isBuiltIn: false,
  countInStats: false, allowedUserIds: [], options: [],
  withQuantity: false, allowFreeText: false, isFrozen: false,
  ...overrides,
});

describe('validateReportField (number)', () => {
  const nf = f({ fieldType: 'number', fieldKey: 'n' });
  it('accepts positive integers', () => {
    expect(validateReportField(nf, 5)).toBeNull();
    expect(validateReportField(nf, '12')).toBeNull();
  });
  it('rejects negatives', () => {
    expect(validateReportField(nf, -1)).toMatch(/سالبة/);
    expect(validateReportField(nf, '-3')).toMatch(/سالبة/);
  });
  it('rejects NaN / garbage', () => {
    expect(validateReportField(nf, 'abc')).toBeTruthy();
  });
  it('rejects excessively large values', () => {
    expect(validateReportField(nf, 1_000_000_000)).toMatch(/كبيرة/);
  });
});

describe('validateReportField (text)', () => {
  it('enforces maxLength', () => {
    const tf = f({ fieldType: 'text', maxLength: 5, fieldKey: 't' });
    expect(validateReportField(tf, 'hi')).toBeNull();
    expect(validateReportField(tf, 'toolong')).toMatch(/الحد/);
  });
  it('ignores empty text without maxLength', () => {
    const tf = f({ fieldType: 'textarea', fieldKey: 't' });
    expect(validateReportField(tf, '')).toBeNull();
  });
});

describe('validateReportForm', () => {
  it('collects errors for invalid entries only', () => {
    const fields = [
      f({ fieldKey: 'a', fieldType: 'number' }),
      f({ fieldKey: 'b', fieldType: 'text', maxLength: 3 }),
      f({ fieldKey: 'c', fieldType: 'number' }),
    ];
    const errs = validateReportForm(fields, { a: -2, b: 'ok', c: 'oops' });
    expect(Object.keys(errs).sort()).toEqual(['a', 'c']);
  });
});

describe('validateMgrs', () => {
  it('accepts empty', () => expect(validateMgrs('')).toBe(true));
  it('accepts a valid MGRS', () => expect(validateMgrs('38SMB4484')).toBe(true));
  it('rejects garbage', () => expect(validateMgrs('hello world')).toBe(false));
});
