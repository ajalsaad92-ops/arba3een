import { Users, Truck, Flag, AlertOctagon, Package, Skull, Calendar, Shield, Eye, BarChart3 } from 'lucide-react';
import type { ReportFieldDefinition } from '../data/types';

export type KpiId =
  | 'visitors' | 'vehicles' | 'processions' | 'emergencies'
  | 'deaths' | 'violations' | 'events' | 'incidents'
  | 'resources' | 'deployment';

export interface KpiDef {
  id: KpiId;
  label: string;
  icon: any;
  tone: 'amber' | 'blue' | 'emerald' | 'red' | 'orange' | 'purple' | 'slate';
  /** key on the aggregates object (or 'emergencies' = activeEmergencies) */
  source: string;
}

export const KPI_CATALOG: KpiDef[] = [
  { id: 'visitors',    label: 'إجمالي الزوار',    icon: Users,        tone: 'amber',   source: 'visitors' },
  { id: 'vehicles',    label: 'حركة العجلات',     icon: Truck,        tone: 'blue',    source: 'vehicles' },
  { id: 'processions', label: 'المواكب',          icon: Flag,         tone: 'emerald', source: 'processions' },
  { id: 'emergencies', label: 'التنبيهات الطارئة', icon: AlertOctagon, tone: 'red',     source: 'emergencies' },
  { id: 'deaths',      label: 'الوفيات',          icon: Skull,        tone: 'red',     source: 'deaths' },
  { id: 'violations',  label: 'الخروقات الأمنية', icon: Shield,       tone: 'orange',  source: 'violations' },
  { id: 'events',      label: 'الفعاليات',        icon: Calendar,     tone: 'purple',  source: 'events' },
  { id: 'incidents',   label: 'الحوادث',          icon: AlertOctagon, tone: 'orange',  source: 'incidents' },
  { id: 'resources',   label: 'الخدمات الموزعة',  icon: Package,      tone: 'emerald', source: 'resources' },
  { id: 'deployment',  label: 'القوات المنتشرة',  icon: Eye,          tone: 'slate',   source: 'deployment' },
];

export const kpiById = (id: string) => KPI_CATALOG.find(k => k.id === id);

/**
 * Combine the fixed KPI catalog with dynamic KPIs derived from
 * report-field definitions that have `count_in_stats=true`.
 * Numeric admin-added fields become first-class dashboard KPIs.
 * Built-in numeric fields already map to KPI ids (visitorsIn → 'visitors' etc.)
 * so we only surface NEW (non-built-in) ones here.
 */
export function getEffectiveKpiCatalog(defs: ReportFieldDefinition[]): KpiDef[] {
  const dynamic: KpiDef[] = defs
    .filter(f => f.countInStats && !f.isBuiltIn && !f.isHidden &&
      (f.fieldType === 'number' || (f.fieldType === 'select' && f.withQuantity)))
    .map(f => ({
      id: `x:${f.fieldKey}` as KpiId,
      label: f.statLabelAr || f.labelAr,
      icon: BarChart3,
      tone: 'slate',
      source: `x:${f.fieldKey}`,
    }));
  return [...KPI_CATALOG, ...dynamic];
}