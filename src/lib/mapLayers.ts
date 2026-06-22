import type { ReportFieldDefinition } from '../data/types';

export interface FieldLayer {
  key: string;
  label: string;
  kind: 'location' | 'route';
}

function hasCoords(p: any): boolean {
  return !!p && typeof p.lat === 'number' && typeof p.lng === 'number';
}

/**
 * Build the list of dynamic map layers driven by actual report data.
 * Any non-builtin location / route field that has at least one entry with
 * valid coordinates becomes its own toggleable layer on the map.
 */
export function computeFieldLayers(
  defs: ReportFieldDefinition[],
  reports: any[],
): FieldLayer[] {
  const out: FieldLayer[] = [];
  const visible = (defs || []).filter(f => !f.isBuiltIn && !f.isHidden);

  for (const f of visible.filter(d => d.fieldType === 'location' || d.fieldType === 'multi_location')) {
    const has = (reports || []).some(r => {
      const v = r?.extraFields?.[f.fieldKey];
      if (!v) return false;
      const pts = Array.isArray(v) ? v : [v];
      return pts.some(hasCoords);
    });
    if (has) out.push({ key: f.fieldKey, label: f.labelAr, kind: 'location' });
  }

  for (const f of visible.filter(d => d.fieldType === 'route')) {
    const has = (reports || []).some(r => {
      const v = r?.extraFields?.[f.fieldKey];
      return Array.isArray(v) && v.filter(hasCoords).length >= 2;
    });
    if (has) out.push({ key: f.fieldKey, label: f.labelAr, kind: 'route' });
  }

  return out;
}

/** Field layers default to ON. We persist an explicit "off" marker when hidden. */
export const fieldLayerOffKey = (key: string) => `!fld:${key}`;
export const isFieldLayerOn = (active: Set<string>, key: string) =>
  !active.has(fieldLayerOffKey(key));
