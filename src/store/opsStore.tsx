import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import type {
  Profile, DailyReport, Emergency, ExtensionRequest,
  AgentLocation, VisitorFlowPath, TimeWindow, TimeWindowStatus,
  ReportFieldGroup, ReportFieldDefinition,
} from '../data/types';
import { api } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';
import EnvErrorPage from '../pages/EnvErrorPage';
import { fireAlert } from '../lib/notify';

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
  | { type: 'ADD_EMERGENCY'; emergency: Emergency }
  | { type: 'ACK_EMERGENCY'; id: string; userId: string }
  | { type: 'RESOLVE_EMERGENCY'; id: string }
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

const initialState: OpsState = {
  currentUser: null,
  authLoading: true,
  serverTime: new Date(),
  timeWindow: { windowDate: new Date().toISOString().slice(0,10), openTime: '08:00', closeTime: '09:00', isManuallyOpen: false, isManuallyClosed: false },
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
  selectedOfficeId: null,
  activeMapLayers: new Set(['offices', 'borderCrossings', 'agentGPS']),
  officeFilter: [],
  visibleProvinces: new Set(),
  customKpis: (() => {
    try {
      const v = typeof localStorage !== 'undefined' ? localStorage.getItem('ops:customKpis') : null;
      return v ? JSON.parse(v) : ['visitors', 'vehicles', 'processions', 'emergencies'];
    } catch { return ['visitors', 'vehicles', 'processions', 'emergencies']; }
  })(),
  dateRange: null,
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
  const nowMin = serverTime.getHours() * 60 + serverTime.getMinutes();
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
      return { ...state, todayReports: [...todayReports, action.report], lastActivity: [newAct, ...state.lastActivity].slice(0, 12) };
    }
    case 'ADD_EMERGENCY': {
      const newAct = { id: `a-${Date.now()}`, type: 'emergency' as const, text: `حالة طارئة: ${action.emergency.emergencyType}`, officeId: action.emergency.officeId, createdAt: action.emergency.createdAt };
      return { ...state, emergencies: [action.emergency, ...state.emergencies], unreadNotifications: state.unreadNotifications + 1, lastActivity: [newAct, ...state.lastActivity].slice(0, 12) };
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
          e.id === action.id ? { ...e, status: 'resolved', resolvedAt: new Date().toISOString() } : e
        ),
      };
    case 'ADD_EXTENSION': {
      const newAct = { id: `a-${Date.now()}`, type: 'extension' as const, text: `طلب تمديد من ${action.extension.requestedByName}`, officeId: action.extension.officeId, createdAt: action.extension.requestTime };
      return { ...state, extensions: [action.extension, ...state.extensions], unreadNotifications: state.unreadNotifications + 1, lastActivity: [newAct, ...state.lastActivity].slice(0, 12) };
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
    case 'SELECT_OFFICE':
      return { ...state, selectedOfficeId: action.id };
    case 'TOGGLE_LAYER': {
      const next = new Set(state.activeMapLayers);
      if (next.has(action.layer)) next.delete(action.layer);
      else next.add(action.layer);
      return { ...state, activeMapLayers: next };
    }
    case 'SET_OFFICE_FILTER':
      return { ...state, officeFilter: action.ids };
    case 'TOGGLE_PROVINCE': {
      const next = new Set(state.visibleProvinces);
      if (next.has(action.code)) next.delete(action.code);
      else next.add(action.code);
      return { ...state, visibleProvinces: next };
    }
    case 'SET_PROVINCES':
      return { ...state, visibleProvinces: new Set(action.codes) };
    case 'SET_CUSTOM_KPIS': {
      try { localStorage.setItem('ops:customKpis', JSON.stringify(action.ids)); } catch {}
      return { ...state, customKpis: action.ids };
    }
    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.range };
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.user] };
    case 'UPDATE_USER':
      return { ...state, users: state.users.map(u => u.id === action.id ? { ...u, ...action.patch } : u) };
    case 'ADD_BORDER_CROSSING':
      return { ...state, borderCrossings: [...state.borderCrossings, action.crossing] };
    case 'ADD_ACTIVITY':
      return { ...state, lastActivity: [action.activity, ...state.lastActivity.slice(0, 11)] };
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
  async resolveEmergency(id: string) {
    await api.updateEmergency(id, { status: 'resolved', resolvedAt: new Date().toISOString() });
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

  // Initial load
  useEffect(() => {
    (async () => {
      dispatch({ type: 'AUTH_START' });
      try {
        const user = await api.getSession();
        // Load all data
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
        // Load dynamic report-field definitions in parallel; fail silently
        // so a permission issue doesn't block the rest of the dashboard.
        try {
          const [fg, fd] = await Promise.all([api.getFieldGroups(), api.getFieldDefinitions()]);
          dispatch({ type: 'SET_FIELD_DEFS', groups: fg, definitions: fd });
        } catch (e) { console.warn('[opsStore] field defs load failed', e); }
        if (user) dispatch({ type: 'AUTH_SUCCESS', user });
        else dispatch({ type: 'AUTH_FAIL' });
      } catch (e) {
        console.error('Failed to load initial data', e);
        dispatch({ type: 'AUTH_FAIL' });
      } finally {
        setReady(true);
      }
    })();
  }, []);

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
      const today = new Date().toISOString().slice(0, 10);
      if (today !== state.timeWindow.windowDate) {
        const tw = await api.getTimeWindow();
        dispatch({ type: 'SET_TIME_WINDOW', window: { ...tw, windowDate: today } });
      }
    };
    const id = setInterval(rollIfNewDay, 60_000);
    return () => clearInterval(id);
  }, [state.timeWindow.windowDate]);

  // Live subscriptions (mimic Supabase realtime)
  useEffect(() => {
    const unsub = api.subscribe((event) => {
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
      if (event.table === 'daily_reports' && event.payload?.new) {
        dispatch({ type: 'ADD_REPORT', report: event.payload.new });
        const r = event.payload.new;
        fireAlert('report', 'تقرير جديد', `${r.officeId} — تم استلام تقرير جديد`);
      } else if (event.table === 'emergencies') {
        if (event.type === 'INSERT' && event.payload?.new) {
          dispatch({ type: 'ADD_EMERGENCY', emergency: event.payload.new });
          const e = event.payload.new;
          fireAlert('emergency', '🚨 حالة طارئة', `${e.emergencyType} — ${e.reportedByName || e.officeId}`);
        }
        else if (event.type === 'UPDATE' && event.payload?.new) {
          if (event.payload.new.status === 'resolved') dispatch({ type: 'RESOLVE_EMERGENCY', id: event.payload.new.id });
          else if (event.payload.new.status === 'acknowledged') dispatch({ type: 'ACK_EMERGENCY', id: event.payload.new.id, userId: event.payload.new.acknowledgedById || '' });
        }
      } else if (event.table === 'extension_requests') {
        if (event.type === 'INSERT' && event.payload?.new) {
          dispatch({ type: 'ADD_EXTENSION', extension: event.payload.new });
          const x = event.payload.new;
          fireAlert('extension', 'طلب تمديد جديد', `${x.requestedByName || x.officeId} يطلب تمديد الوقت`);
        }
        else if (event.type === 'UPDATE' && event.payload?.new) dispatch({ type: 'UPDATE_EXTENSION', id: event.payload.new.id, patch: event.payload.new });
      } else if (event.table === 'time_windows' && event.payload?.new) {
        dispatch({ type: 'SET_TIME_WINDOW', window: event.payload.new });
      } else if (event.table === 'agent_locations' && event.payload?.new) {
        dispatch({ type: 'UPDATE_AGENT_LOCATION', location: event.payload.new });
      } else if (event.table === 'border_crossings' && event.type === 'INSERT' && event.payload?.new) {
        dispatch({ type: 'ADD_BORDER_CROSSING', crossing: event.payload.new });
      } else if (event.table === 'profiles' && event.type === 'UPDATE' && event.payload?.new) {
        dispatch({ type: 'UPDATE_USER', id: event.payload.new.id, patch: event.payload.new });
      }
    });
    return unsub;
  }, []);

  // Simulate live agent GPS jitter (15s)
  const tickRef = useRef(0);
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      tickRef.current += 1;
      state.agentLocations.slice(0, 5).forEach(loc => {
        const jitter = () => (Math.random() - 0.5) * 0.002;
        actions.updateAgentLocation({
          ...loc,
          lat: loc.lat + jitter(),
          lng: loc.lng + jitter(),
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      });
    }, 15_000);
    return () => clearInterval(interval);
  }, [ready, state.agentLocations.length]);

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
