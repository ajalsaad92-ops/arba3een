import type { Profile, Role } from '../data/types';

/**
 * Comprehensive, program-wide permission catalog.
 * The director (مدير عام) can toggle any of these ON/OFF for any user
 * from the Admin page. Each permission also has a role-based default
 * so existing users keep working without manual configuration.
 */

export type PermissionKey =
  // Reports
  | 'canSubmitReport'
  | 'canEditReports'
  | 'canDeleteReports'
  | 'canViewHistory'
  | 'canExport'
  | 'canRequestExtension'
  | 'canApproveExtension'
  | 'canRequestFrozenEdit'
  | 'canApproveFrozenEdit'
  // Emergencies
  | 'canCreateEmergency'
  | 'canAcknowledgeEmergency'
  | 'canResolveEmergency'
  | 'canDeleteEmergency'
  // Dashboard & Data
  | 'canViewDashboard'
  | 'canViewAnalytics'
  | 'canViewAllOffices'
  | 'canViewLiveTracking'
  | 'canViewInsights'
  // Map & Borders
  | 'canAddCrossings'
  | 'canEditCrossings'
  | 'canDeleteCrossings'
  | 'canManageMapLayers'
  // Time window
  | 'canOpenWindow'
  | 'canCloseWindow'
  | 'canOverrideWindow'
  // Admin
  | 'canManageUsers'
  | 'canManageRoles'
  | 'canManageOffices'
  | 'canManageReportFields'
  | 'canClearData'
  | 'canSeedDemoData'
  | 'canViewAuditLogs'
  // Communications
  | 'canUseWalkieTalkie'
  | 'canSendNotifications'
  | 'canManagePushSubscriptions';

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  desc: string;
  group: PermissionGroup;
}

export type PermissionGroup =
  | 'reports'
  | 'emergencies'
  | 'dashboard'
  | 'map'
  | 'window'
  | 'admin'
  | 'communications';

export const PERMISSION_GROUPS: { id: PermissionGroup; label: string }[] = [
  { id: 'reports',        label: 'التقارير' },
  { id: 'emergencies',    label: 'الحالات الطارئة' },
  { id: 'dashboard',      label: 'الداشبورد والبيانات' },
  { id: 'map',            label: 'الخريطة والمنافذ' },
  { id: 'window',         label: 'نافذة التقرير' },
  { id: 'admin',          label: 'الإدارة والأنظمة' },
  { id: 'communications', label: 'الاتصالات' },
];

export const PERMISSION_CATALOG: PermissionDef[] = [
  // ── Reports
  { key: 'canSubmitReport',        group: 'reports', label: 'إدخال التقرير اليومي', desc: 'إرسال تقرير مكتب جديد' },
  { key: 'canEditReports',         group: 'reports', label: 'تعديل التقارير',        desc: 'تعديل تقارير الآخرين بعد الإرسال' },
  { key: 'canDeleteReports',       group: 'reports', label: 'حذف التقارير',          desc: 'حذف تقارير مُرسلة' },
  { key: 'canViewHistory',         group: 'reports', label: 'مشاهدة السجل',          desc: 'الاطلاع على أرشيف التقارير' },
  { key: 'canExport',              group: 'reports', label: 'تصدير Excel',           desc: 'تصدير التقارير بصيغة القالب الرسمي' },
  { key: 'canRequestExtension',    group: 'reports', label: 'طلب تمديد النافذة',     desc: 'طلب تمديد وقت الإرسال' },
  { key: 'canApproveExtension',    group: 'reports', label: 'الموافقة على التمديد',  desc: 'قبول أو رفض طلبات التمديد' },
  { key: 'canRequestFrozenEdit',   group: 'reports', label: 'طلب تعديل حقل مجمّد',   desc: 'طلب تعديل الحقول الثابتة' },
  { key: 'canApproveFrozenEdit',   group: 'reports', label: 'الموافقة على تعديل مجمّد', desc: 'قبول أو رفض طلبات تعديل الحقول الثابتة' },

  // ── Emergencies
  { key: 'canCreateEmergency',      group: 'emergencies', label: 'إنشاء حالة طارئة',   desc: 'إطلاق تنبيه طارئ' },
  { key: 'canAcknowledgeEmergency', group: 'emergencies', label: 'تأكيد استلام الحالة', desc: 'الإشعار باستلام الحالة الطارئة' },
  { key: 'canResolveEmergency',     group: 'emergencies', label: 'حل الحالة الطارئة',   desc: 'إغلاق الحالة الطارئة' },
  { key: 'canDeleteEmergency',      group: 'emergencies', label: 'حذف الحالة الطارئة',  desc: 'حذف سجل الطارئ' },

  // ── Dashboard & data
  { key: 'canViewDashboard',    group: 'dashboard', label: 'مشاهدة الداشبورد',       desc: 'الوصول للوحة المعلومات' },
  { key: 'canViewAnalytics',    group: 'dashboard', label: 'مشاهدة التحليلات',        desc: 'الاطلاع على الرسوم والاتجاهات' },
  { key: 'canViewAllOffices',   group: 'dashboard', label: 'مشاهدة كل المكاتب',       desc: 'تجاوز قيود المكتب' },
  { key: 'canViewLiveTracking', group: 'dashboard', label: 'مشاهدة التتبّع المباشر',  desc: 'رؤية مواقع المستخدمين على الخريطة' },
  { key: 'canViewInsights',     group: 'dashboard', label: 'مشاهدة الموجز والرؤى',    desc: 'شريط الأخبار والتحليلات اللحظية' },

  // ── Map / borders
  { key: 'canAddCrossings',    group: 'map', label: 'إضافة منافذ حدودية',   desc: 'إنشاء منفذ جديد على الخريطة' },
  { key: 'canEditCrossings',   group: 'map', label: 'تعديل المنافذ',        desc: 'تعديل بيانات منفذ موجود' },
  { key: 'canDeleteCrossings', group: 'map', label: 'حذف المنافذ',          desc: 'حذف منفذ من الخريطة' },
  { key: 'canManageMapLayers', group: 'map', label: 'إدارة طبقات الخريطة',  desc: 'التحكم بطبقات وإعدادات الخريطة' },

  // ── Time window
  { key: 'canOpenWindow',     group: 'window', label: 'فتح النافذة يدوياً',   desc: 'إعادة فتح نافذة التقرير' },
  { key: 'canCloseWindow',    group: 'window', label: 'إغلاق النافذة يدوياً', desc: 'إغلاق نافذة التقرير مبكراً' },
  { key: 'canOverrideWindow', group: 'window', label: 'تجاوز النافذة',        desc: 'إرسال تقرير خارج وقت النافذة' },

  // ── Admin
  { key: 'canManageUsers',        group: 'admin', label: 'إدارة المستخدمين',    desc: 'إنشاء وتعديل الحسابات' },
  { key: 'canManageRoles',        group: 'admin', label: 'تغيير أدوار المستخدمين', desc: 'رفع أو خفض الصلاحية' },
  { key: 'canManageOffices',      group: 'admin', label: 'إدارة المكاتب',       desc: 'إضافة أو تعديل المكاتب' },
  { key: 'canManageReportFields', group: 'admin', label: 'إدارة حقول التقارير', desc: 'التحكم بمحتوى نموذج التقرير' },
  { key: 'canClearData',          group: 'admin', label: 'تفريغ البيانات',      desc: 'حذف كل التقارير والطوارئ' },
  { key: 'canSeedDemoData',       group: 'admin', label: 'تحميل بيانات تجريبية', desc: 'إدخال بيانات اختبار' },
  { key: 'canViewAuditLogs',      group: 'admin', label: 'مشاهدة سجلات التدقيق', desc: 'مراجعة العمليات الحسّاسة' },

  // ── Communications
  { key: 'canUseWalkieTalkie',        group: 'communications', label: 'استخدام الووكي توكي', desc: 'الاتصال الصوتي الفوري' },
  { key: 'canSendNotifications',      group: 'communications', label: 'إرسال إشعارات',       desc: 'بث إشعارات للمستخدمين' },
  { key: 'canManagePushSubscriptions',group: 'communications', label: 'إدارة اشتراكات الإشعار', desc: 'التحكم بتوكنات الأجهزة' },
];

/** Role-based defaults: applied when a permission is not explicitly set on the profile. */
const ROLE_DEFAULTS: Record<Role, Partial<Record<PermissionKey, boolean>>> = {
  director: Object.fromEntries(PERMISSION_CATALOG.map(p => [p.key, true])) as any,
  supervisor: {
    canSubmitReport: true, canEditReports: true, canViewHistory: true, canExport: true,
    canRequestExtension: true, canApproveExtension: true,
    canRequestFrozenEdit: true, canApproveFrozenEdit: true,
    canCreateEmergency: true, canAcknowledgeEmergency: true, canResolveEmergency: true,
    canViewDashboard: true, canViewAnalytics: true, canViewAllOffices: true,
    canViewLiveTracking: true, canViewInsights: true,
    canManageMapLayers: true,
    canOpenWindow: true, canCloseWindow: true,
    canManageReportFields: true,
    canUseWalkieTalkie: true, canSendNotifications: true,
  },
  manager: {
    canSubmitReport: true, canViewHistory: true, canExport: true,
    canRequestExtension: true, canRequestFrozenEdit: true,
    canCreateEmergency: true, canAcknowledgeEmergency: true, canResolveEmergency: true,
    canViewDashboard: true, canViewAnalytics: true, canViewInsights: true,
    canViewLiveTracking: true, canManageMapLayers: true,
    canUseWalkieTalkie: true,
  },
  agent: {
    canSubmitReport: true, canRequestExtension: true, canRequestFrozenEdit: true,
    canCreateEmergency: true, canViewInsights: true,
    canUseWalkieTalkie: true,
  },
  viewer: {
    canViewDashboard: true, canViewAnalytics: true, canViewInsights: true,
  },
};

/** Returns true if the user has the given permission (explicit override wins over role default). */
export function hasPerm(
  user: Pick<Profile, 'role' | 'specialPermissions'> | null | undefined,
  key: PermissionKey,
): boolean {
  if (!user) return false;
  const explicit = (user.specialPermissions as any)?.[key];
  if (typeof explicit === 'boolean') return explicit;
  return !!ROLE_DEFAULTS[user.role]?.[key];
}

/** Build an object with every permission set to `value`. Useful for "enable all / disable all". */
export function allPermissions(value: boolean): Record<PermissionKey, boolean> {
  return Object.fromEntries(PERMISSION_CATALOG.map(p => [p.key, value])) as any;
}

/** Default permission object for a newly created user of a given role. */
export function defaultPermissionsForRole(role: Role): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const p of PERMISSION_CATALOG) {
    out[p.key] = !!ROLE_DEFAULTS[role]?.[p.key];
  }
  return out;
}
