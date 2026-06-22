import { createContext, useContext, useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import type {
  Profile, DailyReport, Emergency, ExtensionRequest,
  AgentLocation, VisitorFlowPath, TimeWindow, TimeWindowStatus,
  ReportFieldGroup, ReportFieldDefinition,
} from '../data/types';
import { api } from '../lib/api';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import EnvErrorPage from '../pages/EnvErrorPage';
import { fireAlert } from '../lib/notify';
import { operationalDate, baghdadMinutes } from '../lib/opDate';

interface OpsState {
  // Auth
  currentUser: Profile | null;
  authLoading: boolean;

  // Server time
  serverTime: Date;
  timeWindow: TimeWindow;
  timeWindowStatus: TimeWindowStatus;

  // Data
  users: Profile[];
  todayReports: DailyReport[];
  historicalReports: DailyReport[];
  emergencies: Emergency[];
  extensions: ExtensionRequest[];
  agentLocations: AgentLocation[];
  flowPaths: VisitorFlowPath[];
  borderCrossings: any[];
  fieldGroups: ReportFieldGroup[];
  fieldDefinitions: ReportFieldDefinition[];

  // UI
  selectedOfficeId: string | null;
  activeMapLayers: Set<string>;
  officeFilter: string[];
  visibleProvinces: Set<string>; // empty = show all
  customKpis: string[]; // ordered list of KPI ids visible in dashboards
  dateRange: { from: string; to: string } | null; // null = cumulative-today
  unreadNotifications: number;
  lastActivity: { id: string; type: 'report' | 'emergency' | 'extension' | 'system'; text: string; officeId?: string; createdAt: string }[];

  // Per-action loading/error
  loadingFlags: Record<string, boolean>;
  errors: Record<string, string | null>;
}

type Action =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; user: Profile }
  | { type: 'AUTH_FAIL' }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'SET_LOADING'; key: string; loading: boolean }
  | { type: 'SET_ERROR'; key: string; error: string | null }
  | { type: 'SET_DATA'; users?: Profile[]; todayReports?: DailyReport[]; historicalReports?: DailyReport[]; emergencies?: Emergency[]; extensions?: ExtensionRequest[]; agentLocations?: AgentLocation[]; flowPaths?: VisitorFlowPath[]; borderCrossings?: any[]; timeWindow?: TimeWindow }
  | { type: 'SET_FIELD_DEFS'; groups: ReportFieldGroup[]; definitions: ReportFieldDefinition[] }
  | { type: 'SET_SERVER_TIME'; time: Date }
  | { type: 'SET_TIME_WINDOW'; window: Partial<TimeWindow> }
  | { type: 'FORCE_OPEN_WINDOW' }
  | { type: 'FORCE_CLOSE_WINDOW' }
  | { type: 'ADD_REPORT'; report: DailyReport }
  | { type: 'REMOVE_REPORT'; id: string }
  | { type: 'ADD_EMERGENCY'; emergency: Emergency; silent?: boolean }
  | { type: 'ACK_EMERGENCY'; id: string; userId: string }
  | { type: 'RESOLVE_EMERGENCY'; id: string; userId?: string }
  | { type: 'REMOVE_EMERGENCY'; id: string }
  | { type: 'ADD_EXTENSION'; extension: ExtensionRequest }
  | { type: 'UPDATE_EXTENSION'; id: string; patch: Partial<ExtensionRequest> }
  | { type: 'UPDATE_AGENT_LOCATION'; location: AgentLocation }
  | { type: 'SELECT_OFFICE'; id: string | null }
  | { type: 'TOGGLE_LAYER'; layer: string }
  | { type: 'SET_OFFICE_FILTER'; ids: string[] }
  | { type: 'TOGGLE_PROVINCE'; code: string }
  | { type: 'SET_PROVINCES'; codes: string[] }
  | { type: 'SET_CUSTOM_KPIS'; ids: string[] }
  | { type: 'SET_DATE_RANGE'; range: { from: string; to: string } | null }
  | { type: 'ADD_USER'; user: Profile }
  | { type: 'UPDATE_USER'; id: string; patch: Partial<Profile> }
  | { type: 'ADD_BORDER_CROSSING'; crossing: any }
  | { type: 'ADD_ACTIVITY'; activity: OpsState['lastActivity'][number] }
  | { type: 'CLEAR_UNREAD' }
  | { type: 'MARK_NOTIFICATION_READ'; id: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' };

// ─── User UI preferences persistence (per-browser session) ─────────
const PREFS_KEY = 'ops:uiPrefs';
interface UiPrefs {
  activeMapLayers?: string[];
  officeFilter?: string[];
  visibleProvinces?: string[];
  dateRange?: { from: string; to: string } | null;
  selectedOfficeId?: string | null;
}
function loadPrefs(): UiPrefs {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PREFS_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function savePrefs(state: OpsState) {
  try {
    if (typeof localStorage === 'undefined') return;
    const prefs: UiPrefs = {
      activeMapLayers: Array.from(state.activeMapLayers),
      officeFilter: state.officeFilter,
      visibleProvinces: Array.from(state.visibleProvinces),
      dateRange: state.dateRange,
      selectedOfficeId: state.selectedOfficeId,
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}
const _prefs = loadPrefs();

const initialState: OpsState = {
  currentUser: null,
  authLoading: true,
  serverTime: new Date(),
  timeWindow: { windowDate: operationalDate(), openTime: '00:00', closeTime: '23:59', isManuallyOpen: false, isManuallyClosed: false },
  timeWindowStatus: 'open',
  users: [],
  todayReports: [],
  historicalReports: [],
  emergencies: [],
  extensions: [],
  agentLocations: [],
  flowPaths: [],
  borderCrossings: [],
  fieldGroups: [],
  fieldDefinitions: [],
  selectedOfficeId: _prefs.selectedOfficeId ?? null,
  activeMapLayers: new Set(_prefs.activeMapLayers ?? ['offices', 'borderCrossings', 'agentGPS', 'flowPaths']),
  officeFilter: _prefs.officeFilter ?? [],
  visibleProvinces: new Set(_prefs.visibleProvinces ?? []),
  customKpis: (() => {
    try {
      const v = typeof localStorage !== 'undefined' ? localStorage.getItem('ops:customKpis') : null;
      return v ? JSON.parse(v) : ['visitors', 'vehicles', 'processions', 'emergencies'];
    } catch { return ['visitors', 'vehicles', 'processions', 'emergencies']; }
  })(),
  dateRange: _prefs.dateRange ?? null,
  unreadNotifications: 0,
  lastActivity: [],
  loadingFlags: {},
  errors: {},
};

function computeTimeWindowStatus(serverTime: Date, window: TimeWindow): TimeWindowStatus {
  if (window.isManuallyClosed) return 'locked';
  if (window.isManuallyOpen) return 'open';
  const [openH, openM] = window.openTime.split(':').map(Number);
  const [closeH, closeM] = window.closeTime.split(':').map(Number);
  // Use Baghdad wall-clock time so the window is identical for every user
  // regardless of their device timezone.
  const nowMin = baghdadMinutes(serverTime);
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;
  const preWarnMin = closeMin - 30;
  if (nowMin < openMin) return 'closed';
  if (nowMin >= closeMin) return 'locked';
  if (nowMin >= preWarnMin) return 'pre_warning';
  return 'open';
}

function reducer(state: OpsState, action: Action): OpsState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, authLoading: true, errors: { ...state.errors, auth: null } };
    case 'AUTH_SUCCESS':
      return { ...state, currentUser: action.user, authLoading: false, unreadNotifications: 0, errors: { ...state.errors, auth: null } };
    case 'AUTH_FAIL':
      return { ...state, authLoading: false };
    case 'AUTH_LOGOUT':
      return { ...initialState, authLoading: false };
    case 'SET_LOADING':
      return { ...state, loadingFlags: { ...state.loadingFlags, [action.key]: action.loading } };
    case 'SET_ERROR':
      return { ...state, errors: { ...state.errors, [action.key]: action.error } };
    case 'SET_DATA':
      return {
        ...state,
        users: action.users ?? state.users,
        todayReports: action.todayReports ?? state.todayReports,
        historicalReports: action.historicalReports ?? state.historicalReports,
        emergencies: action.emergencies ?? state.emergencies,
        extensions: action.extensions ?? state.extensions,
        agentLocations: action.agentLocations ?? state.agentLocations,
        flowPaths: action.flowPaths ?? state.flowPaths,
        borderCrossings: action.borderCrossings ?? state.borderCrossings,
        timeWindow: action.timeWindow ?? state.timeWindow,
      };
    case 'SET_FIELD_DEFS':
      return { ...state, fieldGroups: action.groups, fieldDefinitions: action.definitions };
    case 'SET_SERVER_TIME': {
      const status = computeTimeWindowStatus(action.time, state.timeWindow);
      return { ...state, serverTime: action.time, timeWindowStatus: status };
    }
    case 'SET_TIME_WINDOW': {
      const tw = { ...state.timeWindow, ...action.window };
      const status = computeTimeWindowStatus(state.serverTime, tw);
      return { ...state, timeWindow: tw, timeWindowStatus: status };
    }
    case 'FORCE_OPEN_WINDOW': {
      const tw = { ...state.timeWindow, isManuallyOpen: true, isManuallyClosed: false };
      return { ...state, timeWindow: tw, timeWindowStatus: 'open' };
    }
    case 'FORCE_CLOSE_WINDOW': {
      const tw = { ...state.timeWindow, isManuallyClosed: true, isManuallyOpen: false };
      return { ...state, timeWindow: tw, timeWindowStatus: 'locked' };
    }
    case 'ADD_REPORT': {
      const todayReports = state.todayReports.filter(r => r.officeId !== action.report.officeId);
      const newAct = { id: `a-${Date.now()}`, type: 'report' as const, text: `${action.report.officeId} - تقرير جديد مُرسل`, officeId: action.report.officeId, createdAt: new Date().toISOString() };
      return { ...state, todayReports: [...todayReports, action.report], lastActivity: [newAct, ...state.lastActivity].slice(0, 50) };
    }
    case 'REMOVE_REPORT':
      return { ...state, todayReports: state.todayReports.filter(r => r.id !== action.id) };
    case 'ADD_EMERGENCY': {
      const newAct = { id: `a-${Date.now()}`, type: 'emergency' as const, text: `حالة طارئة: ${action.emergency.emergencyType}`, officeId: action.emergency.officeId, createdAt: action.emergency.createdAt };
      // Viewers must not receive critical/emergency notifications, so skip the
      // unread badge bump and the activity-feed entry for them.
      if (action.silent) {
        return { ...state, emergencies: [action.emergency, ...state.emergencies] };
      }
      return { ...state, emergencies: [action.emergency, ...state.emergencies], unreadNotifications: state.unreadNotifications + 1, lastActivity: [newAct, ...state.lastActivity].slice(0, 50) };
    }
    case 'ACK_EMERGENCY':
      return {
        ...state,
        emergencies: state.emergencies.map(e =>
          e.id === action.id ? { ...e, status: 'acknowledged', acknowledgedById: action.userId, acknowledgedAt: new Date().toISOString() } : e
        ),
      };
    case 'RESOLVE_EMERGENCY':
      return {
        ...state,
        emergencies: state.emergencies.map(e =>
          e.id === action.id ? { ...e, status: 'resolved', resolvedById: action.userId ?? e.resolvedById, resolvedAt: new Date().toISOString() } : e
        ),
      };
    case 'REMOVE_EMERGENCY':
      return { ...state, emergencies: state.emergencies.filter(e => e.id !== action.id) };
    case 'ADD_EXTENSION': {
      const newAct = { id: `a-${Date.now()}`, type: 'extension' as const, text: `طلب تمديد من ${action.extension.requestedByName}`, officeId: action.extension.officeId, createdAt: action.extension.requestTime };
      return { ...state, extensions: [action.extension, ...state.extensions], unreadNotifications: state.unreadNotifications + 1, lastActivity: [newAct, ...state.lastActivity].slice(0, 50) };
    }
    case 'UPDATE_EXTENSION':
      return {
        ...state,
        extensions: state.extensions.map(e => e.id === action.id ? { ...e, ...action.patch } : e),
      };
    case 'UPDATE_AGENT_LOCATION': {
      const exists = state.agentLocations.find(a => a.agentId === action.location.agentId);
      const updated = exists ? state.agentLocations.map(a => a.agentId === action.location.agentId ? action.location : a) : [...state.agentLocations, action.location];
      return { ...state, agentLocations: updated };
    }
    case 'SELECT_OFFICE': {
      const next = { ...state, selectedOfficeId: action.id };
      savePrefs(next);
      return next;
    }
    case 'TOGGLE_LAYER': {
      const layers = new Set(state.activeMapLayers);
      if (layers.has(action.layer)) layers.delete(action.layer);
      else layers.add(action.layer);
      const next = { ...state, activeMapLayers: layers };
      savePrefs(next);
      return next;
    }
    case 'SET_OFFICE_FILTER': {
      const next = { ...state, officeFilter: action.ids };
      savePrefs(next);
      return next;
    }
    case 'TOGGLE_PROVINCE': {
      const provinces = new Set(state.visibleProvinces);
      if (provinces.has(action.code)) provinces.delete(action.code);
      else provinces.add(action.code);
      const next = { ...state, visibleProvinces: provinces };
      savePrefs(next);
      return next;
    }
    case 'SET_PROVINCES': {
      const next = { ...state, visibleProvinces: new Set(action.codes) };
      savePrefs(next);
      return next;
    }
    case 'SET_CUSTOM_KPIS': {
      try { localStorage.setItem('ops:customKpis', JSON.stringify(action.ids)); } catch {}
      return { ...state, customKpis: action.ids };
    }
    case 'SET_DATE_RANGE': {
      const next = { ...state, dateRange: action.range };
      savePrefs(next);
      return next;
    }
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.user] };
    case 'UPDATE_USER':
      return { ...state, users: state.users.map(u => u.id === action.id ? { ...u, ...action.patch } : u) };
    case 'ADD_BORDER_CROSSING':
      return { ...state, borderCrossings: [...state.borderCrossings, action.crossing] };
    case 'ADD_ACTIVITY':
      return { ...state, lastActivity: [action.activity, ...state.lastActivity].slice(0, 50) };
    case 'CLEAR_UNREAD':
      return { ...state, unreadNotifications: 0 };
    case 'MARK_NOTIFICATION_READ':
      return { ...state, lastActivity: state.lastActivity.map(a => a.id === action.id ? { ...a, read: true } : a) };
    case 'MARK_ALL_NOTIFICATIONS_READ':
      return { ...state, lastActivity: state.lastActivity.map(a => ({ ...a, read: true })), unreadNotifications: 0 };
    default:
      return state;
  }
}

const OpsContext = createContext<{
  state: OpsState;
  dispatch: React.Dispatch<Action>;
  actions: typeof actions;
} | null>(null);

// ─── Action API (side-effectful operations) ───────────────────────
const actions = {
  async signIn(email: string, password: string) {
    const { user, error } = await api.signIn(email, password);
    return { user, error };
  },
  async signUp(input: { fullNameAr: string; email: string; password: string; role: Profile['role']; officeId: string }) {
    const { user, error } = await api.signUp(input);
    return { user, error };
  },
  async signOut() {
    await api.signOut();
  },
  async submitReport(report: DailyReport) {
    await api.insertReport(report);
  },
  async submitEmergency(em: Emergency) {
    await api.insertEmergency(em);
  },
  async ackEmergency(id: string, userId: string) {
    await api.updateEmergency(id, { status: 'acknowledged', acknowledgedById: userId, acknowledgedAt: new Date().toISOString() });
  },
  async resolveEmergency(id: string, userId?: string) {
    await api.updateEmergency(id, { status: 'resolved', resolvedById: userId, resolvedAt: new Date().toISOString() });
  },
  async submitExtension(ex: ExtensionRequest) {
    await api.insertExtension(ex);
  },
  async updateExtension(id: string, patch: Partial<ExtensionRequest>) {
    await api.updateExtension(id, patch);
  },
  async updateTimeWindow(patch: Partial<TimeWindow>) {
    const updated = await api.updateTimeWindow(patch);
    return updated;
  },
  async updateAgentLocation(loc: AgentLocation) {
    await api.upsertAgentLocation(loc);
  },
  async updateUser(id: string, patch: Partial<Profile>) {
    return api.updateUser(id, patch);
  },
  async addBorderCrossing(crossing: any) {
    return api.insertBorderCrossing(crossing);
  },
  async seedDemoData() {
    return api.seedDemoData();
  },
  async reloadFieldDefs(dispatch?: React.Dispatch<Action>) {
    const [groups, definitions] = await Promise.all([api.getFieldGroups(), api.getFieldDefinitions()]);
    dispatch?.({ type: 'SET_FIELD_DEFS', groups, definitions });
    return { groups, definitions };
  },
  async upsertFieldGroup(g: Partial<ReportFieldGroup> & { titleAr: string }) {
    return api.upsertFieldGroup(g);
  },
  async deleteFieldGroup(id: string) {
    return api.deleteFieldGroup(id);
  },
  async upsertFieldDefinition(f: Partial<ReportFieldDefinition> & { fieldKey: string; labelAr: string; groupId: string }) {
    return api.upsertFieldDefinition(f);
  },
  async deleteFieldDefinition(id: string) {
    return api.deleteFieldDefinition(id);
  },
};

export function OpsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);

  // Keep a live ref to the current user so the realtime subscription (which is
  // set up once) can read the latest role/id without re-subscribing.
  const currentUserRef = useRef(state.currentUser);
  useEffect(() => { currentUserRef.current = state.currentUser; }, [state.currentUser]);

  // Keep a live ref to the full state so realtime callbacks can resolve names
  // (e.g. who resolved an emergency) without re-subscribing.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Reusable loader for all dashboard data (used on first load and whenever
  // the auth session becomes available/refreshes).
  const loadAllData = useCallback(async () => {
    const [users, todayReports, historicalReports, emergencies, extensions, agentLocations, flowPaths, borderCrossings, timeWindow, serverTime] = await Promise.all([
      api.getUsers(),
      api.getTodayReports(),
      api.getHistoricalReports(),
      api.getEmergencies(),
      api.getExtensions(),
      api.getAgentLocations(),
      api.getFlowPaths(),
      api.getBorderCrossings(),
      api.getTimeWindow(),
      api.getServerTime(),
    ]);
    dispatch({ type: 'SET_DATA', users, todayReports, historicalReports, emergencies, extensions, agentLocations, flowPaths, borderCrossings, timeWindow });
    dispatch({ type: 'SET_SERVER_TIME', time: serverTime });
    // Load dynamic report-field definitions; fail silently so a permission
    // issue doesn't block the rest of the dashboard.
    try {
      const [fg, fd] = await Promise.all([api.getFieldGroups(), api.getFieldDefinitions()]);
      dispatch({ type: 'SET_FIELD_DEFS', groups: fg, definitions: fd });
    } catch (e) { console.warn('[opsStore] field defs load failed', e); }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      dispatch({ type: 'AUTH_START' });
      try {
        const user = await api.getSession();
        await loadAllData();
        if (user) dispatch({ type: 'AUTH_SUCCESS', user });
        else dispatch({ type: 'AUTH_FAIL' });
      } catch (e) {
        console.error('Failed to load initial data', e);
        dispatch({ type: 'AUTH_FAIL' });
      } finally {
        setReady(true);
      }
    })();
  }, [loadAllData]);

  // Auto-reload once the auth session is truly ready. On a cold open the very
  // first queries can race ahead of the restored session token, so RLS returns
  // empty rows and the dashboard shows 0 until a manual refresh. Listening for
  // the session here re-fetches automatically. Supabase calls are deferred with
  // setTimeout to avoid the known deadlock inside the auth callback.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        setTimeout(() => {
          (async () => {
            try {
              const user = await api.getSession();
              await loadAllData();
              if (user) dispatch({ type: 'AUTH_SUCCESS', user });
            } catch (e) { console.warn('[opsStore] auth-change reload failed', e); }
          })();
        }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadAllData]);

  // Server time sync every 60s
  useEffect(() => {
    const tick = async () => {
      const t = await api.getServerTime();
      dispatch({ type: 'SET_SERVER_TIME', time: t });
    };
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  // H4: refresh timeWindow.date at midnight so reports submitted after 00:00
  // don't get tagged with yesterday's date. Runs every 60s and compares the
  // current YYYY-MM-DD against the one in state; updates only if changed.
  useEffect(() => {
    const rollIfNewDay = async () => {
      const today = operationalDate();
      if (today !== state.timeWindow.windowDate) {
        const tw = await api.getTimeWindow();
        dispatch({ type: 'SET_TIME_WINDOW', window: { ...tw, windowDate: today } });
      }
    };
    const id = setInterval(rollIfNewDay, 60_000);
    return () => clearInterval(id);
  }, [state.timeWindow.windowDate]);

  // Live subscriptions (Supabase realtime).
  //
  // CRITICAL: postgres_changes evaluates RLS against the JWT that was active
  // when the channel SUBSCRIBED. If we open the channel before the auth session
  // is restored, it binds as the anon role → RLS hides every row → NO realtime
  // events reach anyone (managers/supervisors never see new emergencies, time
  // window changes don't propagate, etc.). So we (re)create the channel keyed
  // on the logged-in user id and push the fresh access token into the realtime
  // socket via setAuth BEFORE subscribing.
  const userId = state.currentUser?.id;
  useEffect(() => {
    if (!userId) return;
    let unsub = () => {};
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        // Bind the realtime socket to the authenticated user so RLS lets the
        // right rows through to this subscriber.
        if (token) {
          try { await (supabase.realtime as any).setAuth(token); } catch { /* noop */ }
        }
      } catch { /* noop */ }
      if (cancelled) return;

      unsub = api.subscribe((event) => {
      // Viewers must never hear any sound or receive any alert. Route every
      // alert through this helper so a single role check silences them entirely.
      const alert = (kind: Parameters<typeof fireAlert>[0], title: string, body: string) => {
        if (currentUserRef.current?.role === 'viewer') return;
        fireAlert(kind, title, body);
      };
      // Resolve a user id → Arabic name from the loaded users list.
      const nameOf = (id?: string) => {
        if (!id) return '';
        return stateRef.current.users.find(u => u.id === id)?.fullNameAr ?? '';
      };
      if (event.table === '*') {
        // Full refresh signal
        (async () => {
          const [users, todayReports, historicalReports, emergencies, extensions, agentLocations, flowPaths, borderCrossings, timeWindow] = await Promise.all([
            api.getUsers(), api.getTodayReports(), api.getHistoricalReports(),
            api.getEmergencies(), api.getExtensions(), api.getAgentLocations(),
            api.getFlowPaths(), api.getBorderCrossings(), api.getTimeWindow(),
          ]);
          dispatch({ type: 'SET_DATA', users, todayReports, historicalReports, emergencies, extensions, agentLocations, flowPaths, borderCrossings, timeWindow });
        })();
        return;
      }
      if (event.table === 'daily_reports') {
        if (event.type === 'DELETE' && event.payload?.old?.id) {
          dispatch({ type: 'REMOVE_REPORT', id: event.payload.old.id });
        } else if (event.payload?.new) {
          dispatch({ type: 'ADD_REPORT', report: event.payload.new });
          const r = event.payload.new;
          // The author of the report shouldn't be alerted about their own submit.
          if (currentUserRef.current?.id !== r.submittedBy) {
            alert('report', 'تقرير جديد', `${r.officeId} — تم استلام تقرير جديد`);
          }
        }
      } else if (event.table === 'emergencies') {
        if (event.type === 'DELETE' && event.payload?.old?.id) {
          dispatch({ type: 'REMOVE_EMERGENCY', id: event.payload.old.id });
        } else if (event.type === 'INSERT' && event.payload?.new) {
          const e = event.payload.new;
          const me = currentUserRef.current;
          const isViewer = me?.role === 'viewer';
          // The person who raised the emergency gets a confirmation toast from
          // the form itself — don't blast them with the incoming-emergency siren
          // for their own action. Viewers never get critical alerts either.
          const isOwn = !!me && e.reportedById === me.id;
          dispatch({ type: 'ADD_EMERGENCY', emergency: e, silent: isViewer || isOwn });
          if (!isViewer && !isOwn) {
            alert('emergency', '🚨 حالة طارئة', `${e.emergencyType} — ${e.reportedByName || e.officeId}`);
          }
        }
        else if (event.type === 'UPDATE' && event.payload?.new) {
          const e = event.payload.new;
          if (e.status === 'resolved') dispatch({ type: 'RESOLVE_EMERGENCY', id: e.id, userId: e.resolvedById });
          else if (e.status === 'acknowledged') dispatch({ type: 'ACK_EMERGENCY', id: e.id, userId: e.acknowledgedById || '' });
          // Notify the person who created the emergency when it's acknowledged/resolved,
          // naming who handled it.
          const me = currentUserRef.current;
          if (me && e.reportedById === me.id) {
            if (e.status === 'acknowledged' && me.id !== e.acknowledgedById) {
              const who = nameOf(e.acknowledgedById);
              alert('extension', '✅ تم استلام حالتك الطارئة', `${e.emergencyType} — تم تأكيد الاستلام${who ? ` من ${who}` : ' من القيادة'}`);
            } else if (e.status === 'resolved' && me.id !== e.resolvedById) {
              const who = nameOf(e.resolvedById);
              alert('report', '✔ تم حل حالتك الطارئة', `${e.emergencyType} — تم حل الحالة${who ? ` بواسطة ${who}` : ''}`);
            }
          }
        }
      } else if (event.table === 'extension_requests') {
        if (event.type === 'INSERT' && event.payload?.new) {
          dispatch({ type: 'ADD_EXTENSION', extension: event.payload.new });
          const x = event.payload.new;
          if (currentUserRef.current?.id !== x.requestedById) {
            alert('extension', 'طلب تمديد جديد', `${x.requestedByName || x.officeId} يطلب تمديد الوقت`);
          }
        }
        else if (event.type === 'UPDATE' && event.payload?.new) {
          const x = event.payload.new;
          dispatch({ type: 'UPDATE_EXTENSION', id: x.id, patch: x });
          // Tell the requester when their extension is approved/rejected.
          const me = currentUserRef.current;
          if (me && x.requestedById === me.id) {
            if (x.status === 'approved') alert('extension', '✅ تمت الموافقة على التمديد', 'تم فتح نافذة إضافية للإرسال');
            else if (x.status === 'rejected') alert('system', '❌ تم رفض طلب التمديد', 'لم تتم الموافقة على طلبك');
          }
        }
      } else if (event.table === 'time_windows' && event.payload?.new) {
        // Row is already mapped to camelCase by api.subscribe → use it directly.
        dispatch({ type: 'SET_TIME_WINDOW', window: event.payload.new as TimeWindow });
      } else if (event.table === 'agent_locations' && event.payload?.new) {
        dispatch({ type: 'UPDATE_AGENT_LOCATION', location: event.payload.new });
      } else if (event.table === 'border_crossings' && event.type === 'INSERT' && event.payload?.new) {
        dispatch({ type: 'ADD_BORDER_CROSSING', crossing: event.payload.new });
      } else if (event.table === 'profiles' && event.type === 'UPDATE' && event.payload?.new) {
        // profiles is NOT mapped by api.subscribe (needs role row) → map the
        // snake_case fields we care about here so UPDATE_USER gets camelCase.
        const p = event.payload.new;
        dispatch({ type: 'UPDATE_USER', id: p.id, patch: {
          fullNameAr: p.full_name_ar,
          officeId: p.office_id ?? '',
          permittedOfficeIds: p.permitted_office_ids ?? [],
          specialPermissions: p.special_permissions ?? undefined,
          isActive: p.is_active,
        } as Partial<Profile> });
      }
      });
    })();

    return () => { cancelled = true; unsub(); };
  }, [userId]);

  if (!ready) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-[#0B0F19]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <div className="text-xs text-slate-500 font-display">جاري تهيئة منظومة الرصد...</div>
        </div>
      </div>
    );
  }

  // C1: show clear env-var error instead of an infinite spinner when the
  // project is missing Supabase config.
  if (!isSupabaseConfigured) {
    return <EnvErrorPage />;
  }

  return <OpsContext.Provider value={{ state, dispatch, actions }}>{children}</OpsContext.Provider>;
}

export function useOps() {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error('useOps must be used inside OpsProvider');
  return ctx;
}

export function useAuth() {
  const { state } = useOps();
  return { user: state.currentUser, authLoading: state.authLoading };
}
