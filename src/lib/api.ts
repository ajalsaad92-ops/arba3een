/**
 * Service layer — real Supabase backend.
 * التعديل 2 – احترافية / جودة / سلاسة
 */

import type {
  Profile, DailyReport, Emergency, ExtensionRequest,
  AgentLocation, VisitorFlowPath, TimeWindow, Role,
  ReportFieldGroup, ReportFieldDefinition,
} from '../data/types';
import { INITIAL_BORDER_CROSSINGS, type BorderCrossing } from '../data/borderCrossings';
import { OFFICES as OFFICES_FALLBACK, type Office } from '../data/offices';
import { isSupabaseConfigured, supabase } from './supabase';
import { operationalDate } from './opDate';
import { extraFieldDisplay, extraFieldNumericValue, normalizeSelectQuantityValue } from './extraFieldStats';

const SINGLE_TIME_WINDOW_ID = '00000000-0000-0000-0000-000000000001';

// ─── logger (no console noise in prod) ──────────────────────────
const log = import.meta.env.DEV ? (...a: any[]) => console.warn('[api]', ...a) : () => {};

// simple retry with backoff
async function withRetry<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  let err: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { err = e; if (i < tries - 1) await new Promise(r => setTimeout(r, 250 * (i + 1))); }
  }
  throw err;
}

// ─── Auth – pure Supabase, NO localStorage SESSION_KEY ──────────
function isRole(v: unknown): v is Role {
  return v === 'director' || v === 'supervisor' || v === 'manager' || v === 'agent' || v === 'viewer';
}

type ProfileRow = {
  id: string;
  full_name_ar: string;
  office_id: string | null;
  permitted_office_ids: string[] | null;
  special_permissions: any;
  is_active: boolean;
  created_at: string;
};
type UserRoleRow = { user_id: string; role: string };

function rowToProfile(p: ProfileRow, roleRow: UserRoleRow | null): Profile {
  const role: Role = isRole(roleRow?.role) ? roleRow!.role : 'agent';
  return {
    id: p.id,
    fullNameAr: p.full_name_ar,
    role,
    officeId: p.office_id ?? '',
    permittedOfficeIds: p.permitted_office_ids ?? [],
    specialPermissions: {
      canExport:         !!p.special_permissions?.canExport,
      canAddCrossings:   !!p.special_permissions?.canAddCrossings,
      canViewAllOffices: !!p.special_permissions?.canViewAllOffices,
      canOpenWindow:     !!p.special_permissions?.canOpenWindow,
      canEditReports:    !!p.special_permissions?.canEditReports,
    },
    isActive: p.is_active,
    createdAt: p.created_at,
  };
}

async function fetchProfileWithRole(userId: string): Promise<Profile | null> {
  const [{ data: p, error: pe }, { data: r, error: re }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('user_id, role').eq('user_id', userId).maybeSingle(),
  ]);
  if (pe) throw pe;
  if (re) throw re;
  if (!p) return null;
  return rowToProfile(p as ProfileRow, (r ?? null) as UserRoleRow | null);
}

async function fetchAllProfilesWithRoles(): Promise<Profile[]> {
  const [{ data: profiles, error: pe }, { data: roles, error: re }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    supabase.from('user_roles').select('user_id, role'),
  ]);
  if (pe) throw pe;
  if (re) throw re;
  const roleMap = new Map<string, UserRoleRow>();
  (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r));
  return ((profiles ?? []) as ProfileRow[]).map(p => rowToProfile(p, roleMap.get(p.id) ?? null));
}

// ─── Mappers ───────────────────────────────────────────────────
function rowToReport(r: any): DailyReport {
  return {
    id: r.id,
    officeId: r.office_id,
    submittedBy: r.submitted_by,
    reportDate: r.report_date,
    submittedAt: r.submitted_at,
    isLateSubmission: !!r.is_late_submission,
    deploymentCount: r.deployment_count ?? 0,
    deploymentLocations: r.deployment_locations ?? '',
    deploymentFormations: r.deployment_formations ?? '',
    coordinationSectors: r.coordination_sectors ?? '',
    coordinationJointOps: r.coordination_joint_ops ?? '',
    incidentsCount: r.incidents_count ?? 0,
    incidentsDetails: r.incidents_details ?? '',
    violationsCount: r.violations_count ?? 0,
    violationsArea: r.violations_area ?? '',
    violationsTimeDetail: r.violations_time_detail ?? '',
    violationsDetails: r.violations_details ?? '',
    deathsCount: r.deaths_count ?? 0,
    deathsLocationMgrs: r.deaths_location_mgrs ?? '',
    deathsActionTaken: r.deaths_action_taken ?? '',
    resourcesDistributed: r.resources_distributed ?? 0,
    resourcesDetails: r.resources_details ?? '',
    eventsCount: r.events_count ?? 0,
    eventsDetails: r.events_details ?? '',
    eventsCoordinates: Array.isArray(r.events_coordinates) ? r.events_coordinates : [],
    visitsCount: r.visits_count ?? 0,
    visitsSummary: r.visits_summary ?? '',
    visitorsIn: r.visitors_in ?? 0,
    visitorsOut: r.visitors_out ?? 0,
    visitorsRoutes: r.visitors_routes ?? '',
    vehiclesCount: r.vehicles_count ?? 0,
    vehiclesDetails: r.vehicles_details ?? '',
    processionsCount: r.processions_count ?? 0,
    processionsDetails: r.processions_details ?? '',
    processionWaypoints: Array.isArray(r.procession_waypoints) ? r.procession_waypoints : [],
    otherNotes: r.other_notes ?? '',
    reporterLat: r.reporter_lat ?? undefined,
    reporterLng: r.reporter_lng ?? undefined,
    mgrsReference: r.mgrs_reference ?? undefined,
    extraFields: (r.extra_fields && typeof r.extra_fields === 'object') ? r.extra_fields : {},
  };
}

function reportToRow(rep: DailyReport): any {
  const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const txt = (v: any, max = 5000) => String(v ?? '').slice(0, max);
  const resourceItems = normalizeSelectQuantityValue((rep as any).resourcesDistributed);
  const resourceTotal = resourceItems.length ? extraFieldNumericValue(resourceItems) : num(rep.resourcesDistributed);
  const resourceDetails = resourceItems.length ? extraFieldDisplay(resourceItems) : rep.resourcesDetails;
  return {
    id: rep.id?.startsWith?.('seed-') || rep.id?.startsWith?.('r-') ? undefined : rep.id,
    office_id: rep.officeId,
    submitted_by: rep.submittedBy,
    report_date: rep.reportDate,
    submitted_at: rep.submittedAt ?? new Date().toISOString(),
    is_late_submission: !!rep.isLateSubmission,
    deployment_count: num(rep.deploymentCount),
    deployment_locations: txt(rep.deploymentLocations, 500),
    deployment_formations: txt(rep.deploymentFormations, 500),
    coordination_sectors: txt(rep.coordinationSectors, 500),
    coordination_joint_ops: txt(rep.coordinationJointOps, 500),
    incidents_count: num(rep.incidentsCount),
    incidents_details: txt(rep.incidentsDetails),
    violations_count: num(rep.violationsCount),
    violations_area: txt(rep.violationsArea, 200),
    violations_time_detail: txt(rep.violationsTimeDetail, 50),
    violations_details: txt(rep.violationsDetails),
    deaths_count: num(rep.deathsCount),
    deaths_location_mgrs: txt(rep.deathsLocationMgrs, 50),
    deaths_action_taken: txt(rep.deathsActionTaken),
    resources_distributed: resourceTotal,
    resources_details: txt(resourceDetails),
    events_count: num(rep.eventsCount),
    events_details: txt(rep.eventsDetails),
    events_coordinates: Array.isArray(rep.eventsCoordinates) ? rep.eventsCoordinates.slice(0, 50) : [],
    visits_count: num(rep.visitsCount),
    visits_summary: txt(rep.visitsSummary),
    visitors_in: num(rep.visitorsIn),
    visitors_out: num(rep.visitorsOut),
    visitors_routes: txt(rep.visitorsRoutes, 500),
    vehicles_count: num(rep.vehiclesCount),
    vehicles_details: txt(rep.vehiclesDetails),
    processions_count: num(rep.processionsCount),
    processions_details: txt(rep.processionsDetails),
    procession_waypoints: Array.isArray(rep.processionWaypoints) ? rep.processionWaypoints.slice(0, 100) : [],
    other_notes: txt(rep.otherNotes),
    reporter_lat: rep.reporterLat ?? null,
    reporter_lng: rep.reporterLng ?? null,
    mgrs_reference: rep.mgrsReference ? String(rep.mgrsReference).slice(0, 50) : null,
    extra_fields: validateExtraFields(rep.extraFields ?? {}),
  };
}

export interface ReportExtraFields { [fieldKey: string]: string | number | boolean | null | any[] | Record<string, any>; }

export function validateExtraFields(
  fields: Record<string, any>,
  definitions?: ReportFieldDefinition[]
): ReportExtraFields {
  const validated: ReportExtraFields = {};
  if (!fields || typeof fields !== 'object') return validated;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    const def = definitions?.find(d => d.fieldKey === key);
    if (def) {
      switch (def.fieldType) {
        case 'number':
          const num = Number(value);
          validated[key] = isFinite(num) ? Math.max(0, Math.min(num, 999999999)) : 0;
          break;
        case 'text':
        case 'textarea':
          validated[key] = String(value).slice(0, def.maxLength || 2000);
          break;
        case 'date':
          validated[key] = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value : null;
          break;
        case 'time':
          validated[key] = /^\d{2}:\d{2}$/.test(String(value)) ? value : null;
          break;
        case 'select':
          validated[key] = def.withQuantity ? normalizeSelectQuantityValue(value) : value;
          break;
        case 'location':
          if (value && typeof value.lat === 'number' && typeof value.lng === 'number') {
            validated[key] = { lat: Math.max(-90, Math.min(90, value.lat)), lng: Math.max(-180, Math.min(180, value.lng)) };
          }
          break;
        case 'multi_location':
        case 'route':
          if (Array.isArray(value)) {
            validated[key] = value
              .filter((p: any) => p && typeof p.lat === 'number' && typeof p.lng === 'number')
              .slice(0, 100)
              .map((p: any) => ({ lat: Math.max(-90, Math.min(90, p.lat)), lng: Math.max(-180, Math.min(180, p.lng)) }));
          }
          break;
        default:
          validated[key] = typeof value === 'string' ? String(value).slice(0, 2000) : value;
      }
    } else {
      if (typeof value === 'string') validated[key] = value.slice(0, 2000);
      else if (typeof value === 'number' && isFinite(value)) validated[key] = value;
      else if (typeof value === 'boolean') validated[key] = value;
      else if (Array.isArray(value)) validated[key] = value.slice(0, 100);
    }
  }
  return validated;
}

function rowToEmergency(r: any): Emergency {
  return {
    id: r.id,
    reportedById: r.reported_by,
    reportedByName: r.reported_by_name ?? '',
    officeId: r.office_id,
    emergencyType: r.emergency_type,
    description: r.description,
    locationMgrs: r.location_mgrs ?? undefined,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    status: (r.status as Emergency['status']) ?? 'active',
    acknowledgedById: r.acknowledged_by ?? undefined,
    acknowledgedAt: r.acknowledged_at ?? undefined,
    resolvedById: r.resolved_by ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    createdAt: r.created_at,
  };
}
function rowToExtension(r: any): ExtensionRequest {
  return {
    id: r.id,
    requestedById: r.requested_by,
    requestedByName: r.requested_by_name ?? '',
    officeId: r.office_id,
    requestTime: r.request_time,
    reason: r.reason ?? '',
    status: (r.status as ExtensionRequest['status']) ?? 'pending',
    managerReviewedById: r.manager_reviewed_by ?? undefined,
    managerReviewedAt: r.manager_reviewed_at ?? undefined,
    supervisorApprovedById: r.supervisor_approved_by ?? undefined,
    supervisorApprovedAt: r.supervisor_approved_at ?? undefined,
    extensionWindowEnd: r.extension_window_end ?? undefined,
    targetReportDate: r.target_report_date ?? undefined,
    consumedAt: r.consumed_at ?? undefined,
  };
}
function rowToAgentLocation(r: any): AgentLocation {
  return { agentId: r.agent_id, agentName: r.agent_name ?? '', officeId: r.office_id, lat: r.lat, lng: r.lng, accuracyMeters: r.accuracy_meters ?? 0, updatedAt: r.updated_at };
}
function rowToFlowPath(r: any): VisitorFlowPath {
  return { id: r.id, officeId: r.office_id, fromLat: r.from_lat, fromLng: r.from_lng, toLat: r.to_lat, toLng: r.to_lng, visitorCount: r.visitor_count ?? 0, density: (r.density as VisitorFlowPath['density']) ?? 'normal', pathNameAr: r.path_name_ar ?? '' };
}
function rowToBorderCrossing(r: any): BorderCrossing {
  return { id: r.id, nameAr: r.name_ar, lat: r.lat, lng: r.lng, neighboringCountryAr: r.neighboring_country_ar ?? '', countryFlag: '', nearestOfficeId: r.nearest_office_id ?? '', dailyIn: r.daily_in ?? 0, dailyOut: r.daily_out ?? 0 };
}
function rowToTimeWindow(r: any): TimeWindow {
  return { windowDate: r.window_date, openTime: r.open_time, closeTime: r.close_time, isManuallyOpen: !!r.is_manually_open, isManuallyClosed: !!r.is_manually_closed };
}
function rowToFieldGroup(r: any): ReportFieldGroup {
  return { id: r.id, titleAr: r.title_ar, sortOrder: r.sort_order ?? 0, isHidden: !!r.is_hidden };
}
function rowToFieldDefinition(r: any): ReportFieldDefinition {
  return {
    id: r.id, groupId: r.group_id, fieldKey: r.field_key, labelAr: r.label_ar,
    descriptionAr: r.description_ar ?? null, placeholderAr: r.placeholder_ar ?? null,
    fieldType: r.field_type, sortOrder: r.sort_order ?? 0, maxLength: r.max_length ?? null,
    isHidden: !!r.is_hidden, isBuiltIn: !!r.is_built_in, countInStats: !!r.count_in_stats,
    statLabelAr: r.stat_label_ar ?? null,
    allowedUserIds: Array.isArray(r.allowed_user_ids) ? r.allowed_user_ids : [],
    options: Array.isArray(r.options) ? r.options : [],
    withQuantity: !!r.with_quantity, allowFreeText: !!r.allow_free_text,
  };
}
function rowToOffice(r: any): Office {
  return { id: r.id, code: r.code ?? r.id, nameAr: r.name_ar, governorateAr: r.governorate_ar ?? '', lat: Number(r.lat), lng: Number(r.lng) };
}

export const api = {
  async signIn(email: string, password: string): Promise<{ user: Profile | null; error: string | null }> {
    if (!isSupabaseConfigured) return { user: null, error: 'لم يتم إعداد Supabase' };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password });
    if (error || !data.user) return { user: null, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    const profile = await fetchProfileWithRole(data.user.id);
    if (!profile) return { user: null, error: 'حساب المستخدم غير موجود' };
    if (!profile.isActive) return { user: null, error: 'هذا الحساب معطّل' };
    return { user: profile, error: null };
  },

  async signUp(input: { fullNameAr: string; email: string; password: string; role: Role; officeId: string }): Promise<{ user: Profile | null; error: string | null }> {
    if (!isSupabaseConfigured) return { user: null, error: 'لم يتم إعداد Supabase' };
    const email = input.email.toLowerCase().trim();
    const { data, error } = await supabase.auth.signUp({ email, password: input.password, options: { data: { full_name_ar: input.fullNameAr } } });
    if (error || !data.user) return { user: null, error: error?.message ?? 'فشل إنشاء الحساب' };
    const permitted = input.role === 'director' ? [] : [input.officeId];
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: data.user.id, full_name_ar: input.fullNameAr, office_id: input.officeId,
      permitted_office_ids: permitted,
      special_permissions: {
        canExport: input.role === 'director',
        canAddCrossings: input.role === 'director',
        canViewAllOffices: input.role === 'director',
        canOpenWindow: input.role === 'director' || input.role === 'supervisor',
        canEditReports: input.role === 'director',
      },
      is_active: true,
    });
    if (profileErr) return { user: null, error: profileErr.message };
    const { error: roleErr } = await supabase.from('user_roles').insert({ user_id: data.user.id, role: input.role });
    if (roleErr) return { user: null, error: roleErr.message };
    const profile = await fetchProfileWithRole(data.user.id);
    return { user: profile, error: null };
  },

  async signOut() { await supabase.auth.signOut(); },

  async getSession(): Promise<Profile | null> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return null;
    try { return await fetchProfileWithRole(userId); } catch { return null; }
  },

  async getServerTime(): Promise<Date> {
    try {
      const { data, error } = await supabase.rpc('get_server_time');
      if (error || !data) throw error ?? new Error('no data');
      return new Date(data as string);
    } catch (e) {
      log('getServerTime fallback', e);
      return new Date();
    }
  },

  async getOffices(): Promise<Office[]> {
    try {
      const { data, error } = await supabase.from('offices').select('*').eq('is_active', true).order('name_ar');
      if (error) throw error;
      if (data && data.length > 0) return data.map(rowToOffice);
      return OFFICES_FALLBACK;
    } catch (e) {
      log('getOffices fallback', e);
      return OFFICES_FALLBACK;
    }
  },

  async getTodayReports(): Promise<DailyReport[]> {
    try {
      const today = operationalDate();
      const { data, error } = await withRetry(async () =>
        await supabase.from('daily_reports').select('*').eq('report_date', today).order('submitted_at', { ascending: false })
      );
      if (error) throw error;
      return (data ?? []).map(rowToReport);
    } catch (e) { log('getTodayReports', e); return []; }
  },

  async getHistoricalReports(
    page = 1, pageSize = 50,
    filters?: { officeId?: string; fromDate?: string; toDate?: string }
  ): Promise<{ data: DailyReport[]; total: number; page: number; pageSize: number }> {
    try {
      const today = operationalDate();
      let query = supabase.from('daily_reports').select('*', { count: 'exact' })
        .lt('report_date', today)
        .order('report_date', { ascending: false })
        .order('submitted_at', { ascending: false });
      if (filters?.officeId) query = query.eq('office_id', filters.officeId);
      if (filters?.fromDate) query = query.gte('report_date', filters.fromDate);
      if (filters?.toDate) query = query.lte('report_date', filters.toDate);
      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      return { data: (data ?? []).map(rowToReport), total: count ?? 0, page, pageSize };
    } catch (e) { log('getHistoricalReports', e); return { data: [], total: 0, page, pageSize }; }
  },

  async insertReport(report: DailyReport): Promise<DailyReport> {
    if (!report.officeId) throw new Error('المكتب مطلوب');
    if (!report.submittedBy) throw new Error('معرّف المُرسِل مطلوب');
    if (!report.reportDate) throw new Error('تاريخ التقرير مطلوب');
    const fieldDefs = await this.getFieldDefinitions().catch(() => []);
    report.extraFields = validateExtraFields(report.extraFields ?? {}, fieldDefs);
    const row = reportToRow(report);
    delete row.id;
    const { data, error } = await supabase.from('daily_reports')
      .upsert(row, { onConflict: 'office_id,report_date' })
      .select('*').single();
    if (error) throw error;
    return rowToReport(data);
  },

  async getEmergencies(): Promise<Emergency[]> {
    try {
      const { data, error } = await supabase.from('emergencies').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []).map(rowToEmergency);
    } catch (e) { log('getEmergencies', e); return []; }
  },

  async insertEmergency(em: Emergency): Promise<Emergency> {
    if (!em.emergencyType) throw new Error('نوع الطارئ مطلوب');
    if (!em.description || em.description.trim().length < 20) throw new Error('الوصف يجب أن يكون 20 حرف على الأقل');
    if (!em.lat && !em.lng && !em.locationMgrs) throw new Error('الموقع مطلوب');
    const { data, error } = await supabase.from('emergencies').insert({
      reported_by: em.reportedById,
      reported_by_name: (em.reportedByName || '').slice(0, 200),
      office_id: em.officeId,
      emergency_type: em.emergencyType.slice(0, 200),
      description: em.description.slice(0, 2000),
      location_mgrs: em.locationMgrs ? String(em.locationMgrs).slice(0, 100) : null,
      lat: em.lat ?? null, lng: em.lng ?? null,
      status: em.status ?? 'active',
    }).select('*').single();
    if (error) throw error;
    return rowToEmergency(data);
  },

  async updateEmergency(id: string, patch: Partial<Emergency>): Promise<void> {
    const row: any = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.acknowledgedById !== undefined) row.acknowledged_by = patch.acknowledgedById;
    if (patch.acknowledgedAt !== undefined) row.acknowledged_at = patch.acknowledgedAt;
    if (patch.resolvedById !== undefined) row.resolved_by = patch.resolvedById;
    if (patch.resolvedAt !== undefined) row.resolved_at = patch.resolvedAt;
    if (patch.description !== undefined) row.description = patch.description.slice(0, 2000);
    if (patch.emergencyType !== undefined) row.emergency_type = patch.emergencyType.slice(0, 200);
    const { error } = await supabase.from('emergencies').update(row).eq('id', id);
    if (error) throw error;
  },

  async getExtensions(): Promise<ExtensionRequest[]> {
    try {
      const { data, error } = await supabase.from('extension_requests').select('*').order('request_time', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []).map(rowToExtension);
    } catch (e) { log('getExtensions', e); return []; }
  },

  async insertExtension(ex: ExtensionRequest): Promise<ExtensionRequest> {
    const reason = (ex.reason || '').trim();
    if (reason.length < 5) throw new Error('سبب طلب التمديد مطلوب (5 أحرف على الأقل)');
    const { data: existing } = await supabase.from('extension_requests')
      .select('id').eq('office_id', ex.officeId)
      .in('status', ['pending', 'forwarded_to_supervisor', 'approved']).is('consumed_at', null).maybeSingle();
    if (existing) throw new Error('يوجد طلب تمديد مفتوح مسبقاً لهذا المكتب');
    const { data, error } = await supabase.from('extension_requests').insert({
      requested_by: ex.requestedById,
      requested_by_name: (ex.requestedByName || '').slice(0, 200),
      office_id: ex.officeId,
      reason: reason.slice(0, 1000),
      status: ex.status ?? 'pending',
      request_time: ex.requestTime,
      extension_window_end: ex.extensionWindowEnd ?? null,
      target_report_date: ex.targetReportDate ?? operationalDate(),
    } as any).select('*').single();
    if (error) {
      if ((error as any).code === '23505') throw new Error('يوجد طلب تمديد مفتوح مسبقاً لهذا المكتب');
      throw error;
    }
    return rowToExtension(data);
  },

  async updateExtension(id: string, patch: Partial<ExtensionRequest>): Promise<void> {
    const row: any = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.managerReviewedById !== undefined) row.manager_reviewed_by = patch.managerReviewedById;
    if (patch.managerReviewedAt !== undefined) row.manager_reviewed_at = patch.managerReviewedAt;
    if (patch.supervisorApprovedById !== undefined) row.supervisor_approved_by = patch.supervisorApprovedById;
    if (patch.supervisorApprovedAt !== undefined) row.supervisor_approved_at = patch.supervisorApprovedAt;
    if (patch.extensionWindowEnd !== undefined) row.extension_window_end = patch.extensionWindowEnd;
    if (patch.targetReportDate !== undefined) row.target_report_date = patch.targetReportDate;
    if (patch.consumedAt !== undefined) row.consumed_at = patch.consumedAt;
    if (patch.reason !== undefined) row.reason = patch.reason.slice(0, 1000);
    const { error } = await supabase.from('extension_requests').update(row).eq('id', id);
    if (error) throw error;
  },

  async getTimeWindow(): Promise<TimeWindow> {
    try {
      const { data, error } = await supabase.from('time_windows').select('*').eq('id', SINGLE_TIME_WINDOW_ID).maybeSingle();
      if (error || !data) throw error || new Error('no data');
      return rowToTimeWindow(data);
    } catch {
      return { windowDate: operationalDate(), openTime: '00:00', closeTime: '23:59', isManuallyOpen: false, isManuallyClosed: false };
    }
  },

  async updateTimeWindow(patch: Partial<TimeWindow>): Promise<TimeWindow> {
    const current = await this.getTimeWindow();
    const merged = { ...current, ...patch };
    const row = {
      id: SINGLE_TIME_WINDOW_ID,
      window_date: merged.windowDate || operationalDate(),
      open_time: merged.openTime,
      close_time: merged.closeTime,
      is_manually_open: merged.isManuallyOpen,
      is_manually_closed: merged.isManuallyClosed,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('time_windows').upsert(row, { onConflict: 'id' }).select('*').single();
    if (error) throw error;
    return rowToTimeWindow(data);
  },

  async getAgentLocations(): Promise<AgentLocation[]> {
    try {
      const { data, error } = await supabase.from('agent_locations').select('*').order('updated_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []).map(rowToAgentLocation);
    } catch (e) { log('getAgentLocations', e); return []; }
  },

  async upsertAgentLocation(loc: AgentLocation): Promise<void> {
    const { error } = await supabase.from('agent_locations').upsert({
      agent_id: loc.agentId,
      agent_name: (loc.agentName || '').slice(0, 200),
      office_id: loc.officeId,
      lat: Math.max(-90, Math.min(90, loc.lat)),
      lng: Math.max(-180, Math.min(180, loc.lng)),
      accuracy_meters: Math.max(0, loc.accuracyMeters || 0),
      updated_at: loc.updatedAt,
    }, { onConflict: 'agent_id' });
    if (error) throw error;
  },

  async getFlowPaths(): Promise<VisitorFlowPath[]> {
    try {
      const { data, error } = await supabase.from('visitor_flow_paths').select('*').order('recorded_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []).map(rowToFlowPath);
    } catch (e) { log('getFlowPaths', e); return []; }
  },

  async getBorderCrossings(): Promise<BorderCrossing[]> {
    try {
      const { data, error } = await supabase.from('border_crossings').select('*').eq('is_active', true).order('name_ar');
      if (error) throw error;
      if (!data || data.length === 0) return [...INITIAL_BORDER_CROSSINGS];
      return (data as any[]).map(rowToBorderCrossing);
    } catch (e) { log('getBorderCrossings', e); return [...INITIAL_BORDER_CROSSINGS]; }
  },

  async insertBorderCrossing(bc: BorderCrossing): Promise<BorderCrossing> {
    const { data, error } = await supabase.from('border_crossings').insert({
      name_ar: bc.nameAr.slice(0, 200),
      lat: Math.max(-90, Math.min(90, bc.lat)),
      lng: Math.max(-180, Math.min(180, bc.lng)),
      neighboring_country_ar: (bc.neighboringCountryAr || '').slice(0, 100),
      nearest_office_id: bc.nearestOfficeId || null,
      daily_in: Math.max(0, bc.dailyIn || 0),
      daily_out: Math.max(0, bc.dailyOut || 0),
    }).select('*').single();
    if (error) throw error;
    return rowToBorderCrossing(data);
  },

  async getUsers(): Promise<Profile[]> { return fetchAllProfilesWithRoles(); },

  async updateUser(id: string, patch: Partial<Profile>): Promise<Profile | null> {
    const row: any = {};
    if (patch.fullNameAr !== undefined) row.full_name_ar = patch.fullNameAr.slice(0, 200);
    if (patch.officeId !== undefined) row.office_id = patch.officeId;
    if (patch.permittedOfficeIds !== undefined) row.permitted_office_ids = patch.permittedOfficeIds;
    if (patch.specialPermissions !== undefined) row.special_permissions = patch.specialPermissions;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    row.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('profiles').update(row).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const roleRow = await supabase.from('user_roles').select('user_id, role').eq('user_id', id).maybeSingle();
    return rowToProfile(data as ProfileRow, (roleRow.data ?? null) as UserRoleRow | null);
  },

  async seedDemoData(): Promise<{ added: number; error?: string }> {
    const offices = ['HQ','BGD','KRB','NJF','BBL','QDS','MTH','DHQ','MYS','BAS','WST','SLD','ANB','DLY','KRK'];
    const rng = (() => { let s = 1234567; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
    const rows: any[] = [];
    const submittedBy = (await supabase.auth.getUser()).data.user?.id;
    if (!submittedBy) return { added: 0, error: 'الجلسة منتهية — أعد تسجيل الدخول' };
    for (let dOff = 30; dOff >= 0; dOff--) {
      const dt = new Date(); dt.setDate(dt.getDate() - dOff);
      const dateStr = operationalDate(dt);
      for (const office of offices) {
        if (rng() < 0.15) continue;
        rows.push({
          office_id: office, submitted_by: submittedBy, report_date: dateStr,
          submitted_at: new Date(dt.getTime() + 8.5 * 3600 * 1000).toISOString(),
          is_late_submission: rng() < 0.2,
          deployment_count: Math.floor(rng() * 100), deployment_locations: 'مواقع', deployment_formations: 'تشكيلات',
          coordination_sectors: 'تنسيق', coordination_joint_ops: 'عمليات',
          incidents_count: Math.floor(rng() * 8), incidents_details: 'تفاصيل',
          violations_count: Math.floor(rng() * 5), violations_area: 'منطقة', violations_time_detail: '14:30', violations_details: 'تفاصيل',
          deaths_count: Math.floor(rng() * 2), deaths_location_mgrs: '38SMB123456', deaths_action_taken: 'إجراء',
          resources_distributed: Math.floor(rng() * 500), resources_details: 'موارد',
          events_count: Math.floor(rng() * 10), events_details: 'فعاليات', events_coordinates: [],
          visits_count: Math.floor(rng() * 15), visits_summary: 'زيارات',
          visitors_in: Math.floor(rng() * 50000), visitors_out: Math.floor(rng() * 30000), visitors_routes: 'محاور',
          vehicles_count: Math.floor(rng() * 800), vehicles_details: 'عجلات',
          processions_count: Math.floor(rng() * 50), processions_details: 'مواكب', procession_waypoints: [],
          other_notes: 'ملاحظات',
        });
      }
    }
    if (rows.length === 0) return { added: 0 };
    const { error } = await supabase.from('daily_reports').upsert(rows, { onConflict: 'office_id,report_date' });
    if (error) return { added: 0, error: error.message };
    return { added: rows.length };
  },

  // granular realtime
  subscribe(callbacks: {
    onReportChange?: (payload: { type: string; new?: DailyReport; old?: DailyReport }) => void;
    onEmergencyChange?: (payload: { type: string; new?: Emergency; old?: Emergency }) => void;
    onExtensionChange?: (payload: { type: string; new?: ExtensionRequest; old?: ExtensionRequest }) => void;
    onTimeWindowChange?: (payload: TimeWindow) => void;
    onAgentLocationChange?: (payload: AgentLocation) => void;
    onBorderCrossingChange?: (payload: BorderCrossing) => void;
    onProfileChange?: (payload: any) => void;
  }): () => void {
    const mapRow = (table: string, row: any) => {
      if (!row) return row;
      switch (table) {
        case 'daily_reports': return rowToReport(row);
        case 'emergencies': return rowToEmergency(row);
        case 'extension_requests': return rowToExtension(row);
        case 'agent_locations': return rowToAgentLocation(row);
        case 'time_windows': return rowToTimeWindow(row);
        case 'border_crossings': return rowToBorderCrossing(row);
        default: return row;
      }
    };
    const ch = supabase.channel('ops:realtime-v2');
    if (callbacks.onReportChange) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' },
        (p: any) => callbacks.onReportChange!({ type: p.eventType, new: mapRow('daily_reports', p.new), old: mapRow('daily_reports', p.old) }));
    }
    if (callbacks.onEmergencyChange) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'emergencies' },
        (p: any) => callbacks.onEmergencyChange!({ type: p.eventType, new: mapRow('emergencies', p.new), old: mapRow('emergencies', p.old) }));
    }
    if (callbacks.onExtensionChange) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'extension_requests' },
        (p: any) => callbacks.onExtensionChange!({ type: p.eventType, new: mapRow('extension_requests', p.new), old: mapRow('extension_requests', p.old) }));
    }
    if (callbacks.onTimeWindowChange) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'time_windows' },
        (p: any) => { if (p.new) callbacks.onTimeWindowChange!(mapRow('time_windows', p.new)); });
    }
    if (callbacks.onAgentLocationChange) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'agent_locations' },
        (p: any) => { if (p.new) callbacks.onAgentLocationChange!(mapRow('agent_locations', p.new)); });
    }
    if (callbacks.onBorderCrossingChange) {
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'border_crossings' },
        (p: any) => { if (p.new) callbacks.onBorderCrossingChange!(mapRow('border_crossings', p.new)); });
    }
    if (callbacks.onProfileChange) {
      ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (p: any) => callbacks.onProfileChange!(p));
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  },

  async getFieldGroups(): Promise<ReportFieldGroup[]> {
    try {
      const { data, error } = await supabase.from('report_field_groups').select('*').order('sort_order');
      if (error) throw error;
      return (data ?? []).map(rowToFieldGroup);
    } catch (e) { log('getFieldGroups', e); return []; }
  },

  async getFieldDefinitions(): Promise<ReportFieldDefinition[]> {
    try {
      const { data, error } = await supabase.from('report_field_definitions').select('*').order('sort_order');
      if (error) throw error;
      return (data ?? []).map(rowToFieldDefinition);
    } catch (e) { log('getFieldDefinitions', e); return []; }
  },

  async upsertFieldGroup(g: Partial<ReportFieldGroup> & { titleAr: string }): Promise<ReportFieldGroup> {
    if (!g.titleAr || g.titleAr.trim().length < 2) throw new Error('عنوان المجموعة مطلوب');
    const row: any = {
      title_ar: g.titleAr.trim().slice(0, 200),
      sort_order: Math.max(0, Math.min(999, g.sortOrder ?? 99)),
      is_hidden: g.isHidden ?? false,
    };
    if (g.id) row.id = g.id;
    const { data, error } = await supabase.from('report_field_groups').upsert(row).select('*').single();
    if (error) throw error;
    return rowToFieldGroup(data);
  },

  async deleteFieldGroup(id: string): Promise<void> {
    const { error } = await supabase.from('report_field_groups').delete().eq('id', id);
    if (error) throw error;
  },

  async upsertFieldDefinition(f: Partial<ReportFieldDefinition> & { fieldKey: string; labelAr: string; groupId: string }): Promise<ReportFieldDefinition> {
    if (!/^[a-z][a-z0-9_]{2,40}$/.test(f.fieldKey)) throw new Error('مفتاح الحقل غير صالح');
    if (!f.labelAr || f.labelAr.trim().length < 2) throw new Error('تسمية الحقل مطلوبة');
    const row: any = {
      group_id: f.groupId,
      field_key: f.fieldKey,
      label_ar: f.labelAr.trim().slice(0, 200),
      description_ar: f.descriptionAr ? f.descriptionAr.slice(0, 500) : null,
      placeholder_ar: f.placeholderAr ? f.placeholderAr.slice(0, 200) : null,
      field_type: f.fieldType ?? 'text',
      sort_order: Math.max(0, Math.min(999, f.sortOrder ?? 99)),
      max_length: f.maxLength ? Math.max(1, Math.min(5000, f.maxLength)) : null,
      is_hidden: f.isHidden ?? false,
      is_built_in: f.isBuiltIn ?? false,
      count_in_stats: f.countInStats ?? false,
      stat_label_ar: f.statLabelAr ? f.statLabelAr.slice(0, 100) : null,
      allowed_user_ids: Array.isArray(f.allowedUserIds) ? f.allowedUserIds.slice(0, 100) : [],
      options: Array.isArray(f.options) ? f.options.slice(0, 50).map((o: any) => String(o).slice(0, 200)) : [],
      with_quantity: f.withQuantity ?? false,
      allow_free_text: f.allowFreeText ?? false,
    };
    if (f.id) row.id = f.id;
    const { data, error } = await supabase.from('report_field_definitions').upsert(row).select('*').single();
    if (error) throw error;
    return rowToFieldDefinition(data);
  },

  async deleteFieldDefinition(id: string): Promise<void> {
    const { error } = await supabase.from('report_field_definitions').delete().eq('id', id);
    if (error) throw error;
  },
};
