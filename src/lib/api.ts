/**
 * Service layer — real Supabase backend.
 *
 * Replaces the previous localStorage mock. The exported `api` object keeps the
 * same surface so consumers (OpsProvider, LoginPage, AdminPage) need zero
 * changes. Subscriptions now use Supabase Realtime (postgres_changes).
 *
 * Required env vars (set in Lovable → Project Settings → Env):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See `supabase/lovable_bundle.sql` for the schema/RLS/seed to run once.
 */

import type {
  Profile, DailyReport, Emergency, ExtensionRequest,
  AgentLocation, VisitorFlowPath, TimeWindow, Role,
  ReportFieldGroup, ReportFieldDefinition,
} from '../data/types';
import { INITIAL_BORDER_CROSSINGS, type BorderCrossing } from '../data/borderCrossings';
import { isSupabaseConfigured, supabase } from './supabase';

const SESSION_KEY = 'ops:session:v1';
const SINGLE_TIME_WINDOW_ID = '00000000-0000-0000-0000-000000000001';

// ─── Static hints for the login quick-access tiles ─────────────────────
// Real passwords are never sent to the browser. We expose one hint per role
// so the demo login tiles can fill in the form (password = 123456 for all).
export type DemoCredHint = { userId: string; email: string; password: string; fullName: string; role: Role; officeId: string };
export const DEMO_LOGIN_HINTS: DemoCredHint[] = [
  { userId: 'u-director',   email: 'u-director@ops.iq',   password: '123456', fullName: 'أبو علي المهداوي',     role: 'director',   officeId: 'HQ'  },
  { userId: 'u-supervisor', email: 'u-supervisor@ops.iq', password: '123456', fullName: 'الحاج كاظم العبيدي',   role: 'supervisor', officeId: 'HQ'  },
  { userId: 'u-manager',    email: 'u-manager@ops.iq',    password: '123456', fullName: 'أحمد محمد الجبوري',    role: 'manager',    officeId: 'KRB' },
  { userId: 'u-agent',      email: 'u-agent@ops.iq',      password: '123456', fullName: 'محمد علي الحسناوي',    role: 'agent',      officeId: 'KRB' },
];

// ─── Type guards / row mappers ────────────────────────────────────────
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
  return {
    id: rep.id?.startsWith?.('seed-') || rep.id?.startsWith?.('r-') ? undefined : rep.id,
    office_id: rep.officeId,
    submitted_by: rep.submittedBy,
    report_date: rep.reportDate,
    submitted_at: rep.submittedAt,
    is_late_submission: rep.isLateSubmission,
    deployment_count: rep.deploymentCount,
    deployment_locations: rep.deploymentLocations,
    deployment_formations: rep.deploymentFormations,
    coordination_sectors: rep.coordinationSectors,
    coordination_joint_ops: rep.coordinationJointOps,
    incidents_count: rep.incidentsCount,
    incidents_details: rep.incidentsDetails,
    violations_count: rep.violationsCount,
    violations_area: rep.violationsArea,
    violations_time_detail: rep.violationsTimeDetail,
    violations_details: rep.violationsDetails,
    deaths_count: rep.deathsCount,
    deaths_location_mgrs: rep.deathsLocationMgrs,
    deaths_action_taken: rep.deathsActionTaken,
    resources_distributed: rep.resourcesDistributed,
    resources_details: rep.resourcesDetails,
    events_count: rep.eventsCount,
    events_details: rep.eventsDetails,
    events_coordinates: rep.eventsCoordinates,
    visits_count: rep.visitsCount,
    visits_summary: rep.visitsSummary,
    visitors_in: rep.visitorsIn,
    visitors_out: rep.visitorsOut,
    visitors_routes: rep.visitorsRoutes,
    vehicles_count: rep.vehiclesCount,
    vehicles_details: rep.vehiclesDetails,
    processions_count: rep.processionsCount,
    processions_details: rep.processionsDetails,
    procession_waypoints: rep.processionWaypoints,
    other_notes: rep.otherNotes,
    reporter_lat: rep.reporterLat ?? null,
    reporter_lng: rep.reporterLng ?? null,
    mgrs_reference: rep.mgrsReference ?? null,
    extra_fields: rep.extraFields ?? {},
  };
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
  };
}

function rowToAgentLocation(r: any): AgentLocation {
  return {
    agentId: r.agent_id,
    agentName: r.agent_name ?? '',
    officeId: r.office_id,
    lat: r.lat,
    lng: r.lng,
    accuracyMeters: r.accuracy_meters ?? 0,
    updatedAt: r.updated_at,
  };
}

function rowToFlowPath(r: any): VisitorFlowPath {
  return {
    id: r.id,
    officeId: r.office_id,
    fromLat: r.from_lat,
    fromLng: r.from_lng,
    toLat: r.to_lat,
    toLng: r.to_lng,
    visitorCount: r.visitor_count ?? 0,
    density: (r.density as VisitorFlowPath['density']) ?? 'normal',
    pathNameAr: r.path_name_ar ?? '',
  };
}

function rowToBorderCrossing(r: any): BorderCrossing {
  return {
    id: r.id,
    nameAr: r.name_ar,
    lat: r.lat,
    lng: r.lng,
    neighboringCountryAr: r.neighboring_country_ar ?? '',
    countryFlag: '',
    nearestOfficeId: r.nearest_office_id ?? '',
    dailyIn: r.daily_in ?? 0,
    dailyOut: r.daily_out ?? 0,
  };
}

function rowToTimeWindow(r: any): TimeWindow {
  return {
    windowDate: r.window_date,
    openTime: r.open_time,
    closeTime: r.close_time,
    isManuallyOpen: !!r.is_manually_open,
    isManuallyClosed: !!r.is_manually_closed,
  };
}

function rowToFieldGroup(r: any): ReportFieldGroup {
  return {
    id: r.id,
    titleAr: r.title_ar,
    sortOrder: r.sort_order ?? 0,
    isHidden: !!r.is_hidden,
  };
}

function rowToFieldDefinition(r: any): ReportFieldDefinition {
  return {
    id: r.id,
    groupId: r.group_id,
    fieldKey: r.field_key,
    labelAr: r.label_ar,
    descriptionAr: r.description_ar ?? null,
    placeholderAr: r.placeholder_ar ?? null,
    fieldType: r.field_type,
    sortOrder: r.sort_order ?? 0,
    maxLength: r.max_length ?? null,
    isHidden: !!r.is_hidden,
    isBuiltIn: !!r.is_built_in,
    countInStats: !!r.count_in_stats,
    statLabelAr: r.stat_label_ar ?? null,
    allowedUserIds: Array.isArray(r.allowed_user_ids) ? r.allowed_user_ids : [],
  };
}

async function safe<T>(p: Promise<{ data: T | null; error: any }>, fallback: T): Promise<T> {
  const { data, error } = await p;
  if (error) { console.warn('[api]', error.message); return fallback; }
  return (data ?? fallback) as T;
}

// Tiny helper: just check we're configured at all
function isConfigured(): boolean {
  return isSupabaseConfigured;
}

// ─── Public API ───────────────────────────────────────────────────────
export const api = {
  // ─── Auth ───────────────────────────────────────────────────────
  async signIn(email: string, password: string): Promise<{ user: Profile | null; error: string | null }> {
    if (!isConfigured()) return { user: null, error: 'لم يتم إعداد Supabase — تأكد من VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY' };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password });
    if (error || !data.user) return { user: null, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    const profile = await fetchProfileWithRole(data.user.id);
    if (!profile) return { user: null, error: 'حساب المستخدم غير موجود' };
    if (!profile.isActive) return { user: null, error: 'هذا الحساب معطّل. تواصل مع المدير' };
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: profile.id, ts: Date.now() }));
    return { user: profile, error: null };
  },

  async signUp(input: { fullNameAr: string; email: string; password: string; role: Role; officeId: string }): Promise<{ user: Profile | null; error: string | null }> {
    if (!isConfigured()) return { user: null, error: 'لم يتم إعداد Supabase' };
    const email = input.email.toLowerCase().trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: { data: { full_name_ar: input.fullNameAr } },
    });
    if (error || !data.user) return { user: null, error: error?.message ?? 'فشل إنشاء الحساب' };

    // Profile row
    const permitted = input.role === 'director'
      ? [] // will be widened via separate query below
      : [input.officeId];

    const { error: profileErr } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name_ar: input.fullNameAr,
      office_id: input.officeId,
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

    // Role row
    const { error: roleErr } = await supabase.from('user_roles').insert({ user_id: data.user.id, role: input.role });
    if (roleErr) return { user: null, error: roleErr.message };

    const profile = await fetchProfileWithRole(data.user.id);
    if (profile) localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: profile.id, ts: Date.now() }));
    return { user: profile, error: null };
  },

  async signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
  },

  async getSession(): Promise<Profile | null> {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      // also try the local marker (signIn sets it, signOut clears it)
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
    }
    const userId = data.session?.user?.id ?? JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.userId;
    if (!userId) return null;
    return fetchProfileWithRole(userId);
  },

  // ─── Server time ────────────────────────────────────────────────
  async getServerTime(): Promise<Date> {
    // Supabase doesn't expose a server time endpoint; client clock is fine.
    return new Date();
  },

  // ─── Demo credentials hint (consumed by LoginPage quick-access) ──
  async getAllCredentials(): Promise<Record<string, { password: string; userId: string }> | null> {
    // Real passwords must not be sent to the browser. We return a flat hints
    // structure keyed by email so LoginPage can render one tile per role.
    const map: Record<string, { password: string; userId: string }> = {};
    DEMO_LOGIN_HINTS.forEach(h => { map[h.email] = { password: h.password, userId: h.userId }; });
    return map;
  },

  async getDemoLoginHints(): Promise<DemoCredHint[]> {
    return [...DEMO_LOGIN_HINTS];
  },

  // ─── Daily reports ──────────────────────────────────────────────
  async getTodayReports(): Promise<DailyReport[]> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('report_date', today)
      .order('submitted_at', { ascending: false });
    if (error) { console.warn('[api] getTodayReports', error.message); return []; }
    return (data ?? []).map(rowToReport);
  },

  async getHistoricalReports(): Promise<DailyReport[]> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .lt('report_date', today)
      .order('report_date', { ascending: false });
    if (error) { console.warn('[api] getHistoricalReports', error.message); return []; }
    return (data ?? []).map(rowToReport);
  },

  async insertReport(report: DailyReport): Promise<DailyReport> {
    // Upsert by (office_id, report_date) — one report per office per day.
    const row: any = reportToRow(report);
    delete row.id;
    const { data, error } = await supabase
      .from('daily_reports')
      .upsert(row, { onConflict: 'office_id,report_date' })
      .select('*')
      .single();
    if (error) throw error;
    return rowToReport(data);
  },

  // ─── Emergencies ────────────────────────────────────────────────
  async getEmergencies(): Promise<Emergency[]> {
    const { data, error } = await supabase
      .from('emergencies')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.warn('[api] getEmergencies', error.message); return []; }
    return (data ?? []).map(rowToEmergency);
  },

  async insertEmergency(em: Emergency): Promise<Emergency> {
    const { data, error } = await supabase
      .from('emergencies')
      .insert({
        reported_by: em.reportedById,
        reported_by_name: em.reportedByName,
        office_id: em.officeId,
        emergency_type: em.emergencyType,
        description: em.description,
        location_mgrs: em.locationMgrs ?? null,
        lat: em.lat ?? null,
        lng: em.lng ?? null,
        status: em.status ?? 'active',
      })
      .select('*')
      .single();
    if (error) throw error;
    return rowToEmergency(data);
  },

  async updateEmergency(id: string, patch: Partial<Emergency>): Promise<void> {
    const row: any = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.acknowledgedById !== undefined) row.acknowledged_by = patch.acknowledgedById;
    if (patch.acknowledgedAt !== undefined) row.acknowledged_at = patch.acknowledgedAt;
    if (patch.resolvedAt !== undefined) row.resolved_at = patch.resolvedAt;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.emergencyType !== undefined) row.emergency_type = patch.emergencyType;
    const { error } = await supabase.from('emergencies').update(row).eq('id', id);
    if (error) throw error;
  },

  // ─── Extension requests ─────────────────────────────────────────
  async getExtensions(): Promise<ExtensionRequest[]> {
    const { data, error } = await supabase
      .from('extension_requests')
      .select('*')
      .order('request_time', { ascending: false });
    if (error) { console.warn('[api] getExtensions', error.message); return []; }
    return (data ?? []).map(rowToExtension);
  },

  async insertExtension(ex: ExtensionRequest): Promise<ExtensionRequest> {
    // M5: pre-check for an open request from the same office to avoid
    // double-clicks and network retries producing duplicate rows. The
    // SQL partial unique index in lovable_bundle.sql is the authoritative
    // backstop; this is a friendly client-side guard.
    const { data: existing } = await supabase
      .from('extension_requests')
      .select('id, status')
      .eq('office_id', ex.officeId)
      .in('status', ['pending', 'forwarded_to_supervisor', 'approved'])
      .maybeSingle();
    if (existing) {
      throw new Error('يوجد طلب تمديد مفتوح مسبقاً لهذا المكتب');
    }
    const { data, error } = await supabase
      .from('extension_requests')
      .insert({
        requested_by: ex.requestedById,
        requested_by_name: ex.requestedByName,
        office_id: ex.officeId,
        reason: ex.reason,
        status: ex.status ?? 'pending',
        request_time: ex.requestTime,
        extension_window_end: ex.extensionWindowEnd ?? null,
      })
      .select('*')
      .single();
    if (error) {
      // Treat Postgres unique-violation as a duplicate (race condition between
      // the pre-check above and the insert) and surface a friendly message.
      if (error.code === '23505') throw new Error('يوجد طلب تمديد مفتوح مسبقاً لهذا المكتب');
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
    if (patch.reason !== undefined) row.reason = patch.reason;
    const { error } = await supabase.from('extension_requests').update(row).eq('id', id);
    if (error) throw error;
  },

  // ─── Time window ────────────────────────────────────────────────
  async getTimeWindow(): Promise<TimeWindow> {
    const { data, error } = await supabase
      .from('time_windows')
      .select('*')
      .eq('id', SINGLE_TIME_WINDOW_ID)
      .maybeSingle();
    if (error || !data) {
      // fallback to today's date
      return { windowDate: new Date().toISOString().slice(0, 10), openTime: '08:00', closeTime: '09:00', isManuallyOpen: false, isManuallyClosed: false };
    }
    return rowToTimeWindow(data);
  },

  async updateTimeWindow(patch: Partial<TimeWindow>): Promise<TimeWindow> {
    const row: any = {};
    if (patch.windowDate !== undefined) row.window_date = patch.windowDate;
    if (patch.openTime !== undefined) row.open_time = patch.openTime;
    if (patch.closeTime !== undefined) row.close_time = patch.closeTime;
    if (patch.isManuallyOpen !== undefined) row.is_manually_open = patch.isManuallyOpen;
    if (patch.isManuallyClosed !== undefined) row.is_manually_closed = patch.isManuallyClosed;
    row.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('time_windows')
      .update(row)
      .eq('id', SINGLE_TIME_WINDOW_ID)
      .select('*')
      .single();
    if (error) throw error;
    return rowToTimeWindow(data);
  },

  // ─── Agent locations ────────────────────────────────────────────
  async getAgentLocations(): Promise<AgentLocation[]> {
    const { data, error } = await supabase
      .from('agent_locations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) { console.warn('[api] getAgentLocations', error.message); return []; }
    return (data ?? []).map(rowToAgentLocation);
  },

  async upsertAgentLocation(loc: AgentLocation): Promise<void> {
    const { error } = await supabase
      .from('agent_locations')
      .upsert({
        agent_id: loc.agentId,
        agent_name: loc.agentName,
        office_id: loc.officeId,
        lat: loc.lat,
        lng: loc.lng,
        accuracy_meters: loc.accuracyMeters,
        updated_at: loc.updatedAt,
      }, { onConflict: 'agent_id' });
    if (error) throw error;
  },

  // ─── Flow paths ─────────────────────────────────────────────────
  async getFlowPaths(): Promise<VisitorFlowPath[]> {
    const { data, error } = await supabase
      .from('visitor_flow_paths')
      .select('*')
      .order('recorded_at', { ascending: false });
    if (error) { console.warn('[api] getFlowPaths', error.message); return []; }
    return (data ?? []).map(rowToFlowPath);
  },

  // ─── Border crossings ───────────────────────────────────────────
  async getBorderCrossings(): Promise<BorderCrossing[]> {
    const { data, error } = await supabase
      .from('border_crossings')
      .select('*')
      .order('name_ar', { ascending: true });
    if (error) {
      console.warn('[api] getBorderCrossings', error.message);
      return [...INITIAL_BORDER_CROSSINGS];
    }
    if (!data || data.length === 0) return [...INITIAL_BORDER_CROSSINGS];
    return (data as any[]).map(rowToBorderCrossing);
  },

  async insertBorderCrossing(bc: BorderCrossing): Promise<BorderCrossing> {
    const { data, error } = await supabase
      .from('border_crossings')
      .insert({
        name_ar: bc.nameAr,
        lat: bc.lat,
        lng: bc.lng,
        neighboring_country_ar: bc.neighboringCountryAr,
        nearest_office_id: bc.nearestOfficeId || null,
        daily_in: bc.dailyIn,
        daily_out: bc.dailyOut,
      })
      .select('*')
      .single();
    if (error) throw error;
    return rowToBorderCrossing(data);
  },

  // ─── Users (admin) ──────────────────────────────────────────────
  async getUsers(): Promise<Profile[]> {
    return fetchAllProfilesWithRoles();
  },

  async updateUser(id: string, patch: Partial<Profile>): Promise<Profile | null> {
    const row: any = {};
    if (patch.fullNameAr !== undefined) row.full_name_ar = patch.fullNameAr;
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

  // ─── Seed (director "load demo data" button) ────────────────────
  async seedDemoData(): Promise<{ added: number; error?: string }> {
    // Insert ~30 days × ~15 offices of historical reports. Done client-side in
    // a single batched upsert so the director doesn't have to wait forever.
    const offices = ['HQ','BGD','KRB','NJF','BBL','QDS','MTH','DHQ','MYS','BAS','WST','SLD','ANB','DLY','KRK'];
    const rng = (() => { let s = 1234567; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
    const rows: any[] = [];
    const submittedBy = (await supabase.auth.getUser()).data.user?.id;
    // H3: surface the failure mode (no session) instead of silently returning 0
    if (!submittedBy) return { added: 0, error: 'الجلسة منتهية — أعد تسجيل الدخول ثم حاول مرة أخرى' };
    for (let dOff = 30; dOff >= 0; dOff--) {
      const dt = new Date(); dt.setDate(dt.getDate() - dOff);
      const dateStr = dt.toISOString().slice(0, 10);
      for (const office of offices) {
        if (rng() < 0.15) continue;
        rows.push({
          office_id: office,
          submitted_by: submittedBy,
          report_date: dateStr,
          submitted_at: new Date(dt.getTime() + 8.5 * 3600 * 1000).toISOString(),
          is_late_submission: rng() < 0.2,
          deployment_count: Math.floor(rng() * 1000),
          deployment_locations: 'مواقع ميدانية',
          deployment_formations: 'تشكيلات دعم',
          coordination_sectors: 'تنسيق قطاعات',
          coordination_joint_ops: 'عمليات مشتركة',
          incidents_count: Math.floor(rng() * 8),
          incidents_details: 'تفاصيل الحوادث',
          violations_count: Math.floor(rng() * 5),
          violations_area: 'منطقة',
          violations_time_detail: '14:30',
          violations_details: 'تفاصيل',
          deaths_count: Math.floor(rng() * 2),
          deaths_location_mgrs: '38SMB1234567890',
          deaths_action_taken: 'إجراء طبي',
          resources_distributed: Math.floor(rng() * 5000),
          resources_details: 'موارد متنوعة',
          events_count: Math.floor(rng() * 30),
          events_details: 'فعاليات',
          events_coordinates: [],
          visits_count: Math.floor(rng() * 15),
          visits_summary: 'زيارات',
          visitors_in: Math.floor(rng() * 250000),
          visitors_out: Math.floor(rng() * 200000),
          visitors_routes: 'محاور',
          vehicles_count: Math.floor(rng() * 8000),
          vehicles_details: 'عجلات',
          processions_count: Math.floor(rng() * 200),
          processions_details: 'مواكب',
          procession_waypoints: [],
          other_notes: 'ملاحظات',
        });
      }
    }
    if (rows.length === 0) return { added: 0 };
    const { error } = await supabase
      .from('daily_reports')
      .upsert(rows, { onConflict: 'office_id,report_date' });
    if (error) return { added: 0, error: error.message };
    return { added: rows.length };
  },

  // ─── Subscriptions (Supabase Realtime) ──────────────────────────
  subscribe(fn: (event: { type: string; table: string; payload: any }) => void): () => void {
    // Realtime delivers RAW database rows (snake_case). Map them to the typed
    // shapes the reducer expects so newly-inserted reports/emergencies/etc.
    // show up live in the dashboard instead of arriving in the wrong shape.
    const mapRow = (table: string, row: any) => {
      if (!row) return row;
      switch (table) {
        case 'daily_reports':      return rowToReport(row);
        case 'emergencies':        return rowToEmergency(row);
        case 'extension_requests': return rowToExtension(row);
        case 'agent_locations':    return rowToAgentLocation(row);
        case 'time_windows':       return rowToTimeWindow(row);
        default:                   return row;
      }
    };
    const emit = (table: string) => (p: any) => fn({
      type: p.eventType,
      table,
      payload: { new: mapRow(table, p.new), old: mapRow(table, p.old) },
    });
    const ch = supabase
      .channel('ops:realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' },      emit('daily_reports'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergencies' },        emit('emergencies'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'extension_requests' }, emit('extension_requests'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_windows' },       emit('time_windows'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_locations' },    emit('agent_locations'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'border_crossings' },   emit('border_crossings'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' },           emit('profiles'))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  },

  // ─── Reset (kept for parity; does nothing in the backend) ───────
  async resetDb() { /* no-op against real backend */ },

  // ─── Dynamic report field definitions ───────────────────────────
  async getFieldGroups(): Promise<ReportFieldGroup[]> {
    const { data, error } = await supabase
      .from('report_field_groups')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) { console.warn('[api] getFieldGroups', error.message); return []; }
    return (data ?? []).map(rowToFieldGroup);
  },

  async getFieldDefinitions(): Promise<ReportFieldDefinition[]> {
    const { data, error } = await supabase
      .from('report_field_definitions')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) { console.warn('[api] getFieldDefinitions', error.message); return []; }
    return (data ?? []).map(rowToFieldDefinition);
  },

  async upsertFieldGroup(g: Partial<ReportFieldGroup> & { titleAr: string }): Promise<ReportFieldGroup> {
    const row: any = {
      title_ar: g.titleAr,
      sort_order: g.sortOrder ?? 99,
      is_hidden: g.isHidden ?? false,
    };
    if (g.id) row.id = g.id;
    const { data, error } = await supabase
      .from('report_field_groups')
      .upsert(row)
      .select('*')
      .single();
    if (error) throw error;
    return rowToFieldGroup(data);
  },

  async deleteFieldGroup(id: string): Promise<void> {
    const { error } = await supabase.from('report_field_groups').delete().eq('id', id);
    if (error) throw error;
  },

  async upsertFieldDefinition(f: Partial<ReportFieldDefinition> & { fieldKey: string; labelAr: string; groupId: string }): Promise<ReportFieldDefinition> {
    const row: any = {
      group_id: f.groupId,
      field_key: f.fieldKey,
      label_ar: f.labelAr,
      description_ar: f.descriptionAr ?? null,
      placeholder_ar: f.placeholderAr ?? null,
      field_type: f.fieldType ?? 'text',
      sort_order: f.sortOrder ?? 99,
      max_length: f.maxLength ?? null,
      is_hidden: f.isHidden ?? false,
      is_built_in: f.isBuiltIn ?? false,
      count_in_stats: f.countInStats ?? false,
      stat_label_ar: f.statLabelAr ?? null,
      allowed_user_ids: f.allowedUserIds ?? [],
    };
    if (f.id) row.id = f.id;
    const { data, error } = await supabase
      .from('report_field_definitions')
      .upsert(row)
      .select('*')
      .single();
    if (error) throw error;
    return rowToFieldDefinition(data);
  },

  async deleteFieldDefinition(id: string): Promise<void> {
    const { error } = await supabase.from('report_field_definitions').delete().eq('id', id);
    if (error) throw error;
  },
};

// Suppress the unused-import linter for safe helper in case future refactors
void safe;
