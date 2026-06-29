import { createContext, useContext, useCallback, useEffect, useReducer, useRef, useState, useMemo, type ReactNode } from 'react';
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
  currentUser: Profile | null;
  authLoading: boolean;
  serverTime: Date;
  timeWindow: TimeWindow;
  timeWindowStatus: TimeWindowStatus;
  users: Profile[];
  todayReports: DailyReport[];
  historicalReports: DailyReport[];
  historicalMeta: { total: number; page: number; pageSize: number };
  emergencies: Emergency[];
  extensions: ExtensionRequest[];
  agentLocations: AgentLocation[];
  flowPaths: VisitorFlowPath[];
  borderCrossings: any[];
  fieldGroups: ReportFieldGroup[];
  fieldDefinitions: ReportFieldDefinition[];
  selectedOfficeId: string | null;
  activeMapLayers: Set<string>;
  officeFilter: string[];
  visibleProvinces: Set<string>;
  customKpis: string[];
  hiddenKpis: string[];
  dateRange: { from: string; to: string } | null;
  unreadNotifications: number;
  lastActivity: { id: string; type: 'report' | 'emergency' | 'extension' | 'system'; text: string; officeId?: string; createdAt: string; read?: boolean }[];
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
  | { type: 'SET_HISTORICAL'; reports: DailyReport[]; total: number; page: number; pageSize: number }
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
  | { type: 'SET_AGENT_LOCATIONS'; locations: AgentLocation[] }
  | { type: 'SELECT_OFFICE'; id: string | null }
  | { type: 'TOGGLE_LAYER'; layer: string }
  | { type: 'SET_OFFICE_FILTER'; ids: string[] }
  | { type: 'TOGGLE_PROVINCE'; code: string }
  | { type: 'SET_PROVINCES'; codes: string[] }
  | { type: 'SET_CUSTOM_KPIS'; ids: string[] }
  | { type: 'SET_HIDDEN_KPIS'; ids: string[] }
  | { type: 'SET_DATE_RANGE'; range: { from: string; to: string } | null }
  | { type: 'ADD_USER'; user: Profile }
  | { type: 'UPDATE_USER'; id: string; patch: Partial<Profile> }
  | { type: 'ADD_BORDER_CROSSING'; crossing: any }
  | { type: 'ADD_ACTIVITY'; activity: OpsState['lastActivity'][number] }
  | { type: 'MARK_NOTIFICATION_READ'; id: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'CLEAR_UNREAD' };

const PREFS_KEY = 'ops:uiPrefs';
function loadPrefs() {
  try { const raw = localStorage.getItem(PREFS_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function savePrefs(state: OpsState) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      activeMapLayers: Array.from(state.activeMapLayers),
      officeFilter: state.officeFilter,
      visibleProvinces: Array.from(state.visibleProvinces),
      dateRange: state.dateRange,
      selectedOfficeId: state.selectedOfficeId,
    }));
  } catch {}
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
  historicalMeta: { total: 0, page: 1, pageSize: 50 },
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
  customKpis: (() => { try { const v = localStorage.getItem('ops:customKpis'); return v ? JSON.parse(v) : ['visitors', 'vehicles', 'processions', 'emergencies']; } catch { return ['visitors','vehicles','processions','emergencies']; } })(),
  hiddenKpis: (() => { try { const v = localStorage.getItem('ops:hiddenKpis'); return v ? JSON.parse(v) : []; } catch { return []; } })(),
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
    case 'AUTH_START': return { ...state, authLoading: true, errors: { ...state.errors, auth: null } };
    case 'AUTH_SUCCESS': return { ...state, currentUser: action.user, authLoading: false, unreadNotifications: 0, errors: { ...state.errors, auth: null } };
    case 'AUTH_FAIL': return { ...state, authLoading: false };
    case 'AUTH_LOGOUT': return { ...initialState, authLoading: false };
    case 'SET_LOADING': return { ...state, loadingFlags: { ...state.loadingFlags, [action.key]: action.loading } };
    case 'SET_ERROR': return { ...state, errors: { ...state.errors, [action.key]: action.error } };
    case 'SET_DATA':
      return { ...state,
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
    case 'SET_HISTORICAL':
      return { ...state, historicalReports: action.reports, historicalMeta: { total: action.total, page: action.page, pageSize: action.pageSize } };
    case 'SET_FIELD_DEFS': return { ...state, fieldGroups: action.groups, fieldDefinitions: action.definitions };
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
      const newAct = { id: `a-${Date.now()}`, type: 'report' as const, text: `${action.report.officeId} - تقرير جديد`, officeId: action.report.officeId, createdAt: new Date().toISOString() };
      return { ...state, todayReports: [...todayReports, action.report], lastActivity: [newAct, ...state.lastActivity].slice(0, 50) };
    }
    case 'REMOVE_REPORT': return { ...state, todayReports: state.todayReports.filter(r => r.id !== action.id) };
    case 'ADD_EMERGENCY': {
      const newAct = { id: `a-${Date.now()}`, type: 'emergency' as const, text: `حالة طارئة: ${action.emergency.emergencyType}`, officeId: action.emergency.officeId, createdAt: action.emergency.createdAt };
      if (action.silent) return { ...state, emergencies: [action.emergency, ...state.emergencies] };
      return { ...state, emergencies: [action.emergency, ...state.emergencies], unreadNotifications: state.unreadNotifications + 1, lastActivity: [newAct, ...state.lastActivity].slice(0, 50) };
    }
    case 'ACK_EMERGENCY':
      return { ...state, emergencies: state.emergencies.map(e => e.id === action.id ? { ...e, status: 'acknowledged', acknowledgedById: action.userId, acknowledgedAt: new Date().toISOString() } : e) };
    case 'RESOLVE_EMERGENCY':
      return { ...state, emergencies: state.emergencies.map(e => e.id === action.id ? { ...e, status: 'resolved', resolvedById: action.userId ?? e.resolvedById, resolvedAt: new Date().toISOString() } : e) };
    case 'REMOVE_EMERGENCY': return { ...state, emergencies: state.emergencies.filter(e => e.id !== action.id) };
    case 'ADD_EXTENSION': {
      const newAct = { id: `a-${Date.now()}`, type: 'extension' as const, text: `طلب تمديد من ${action.extension.requestedByName}`, officeId: action.extension.officeId, createdAt: action.extension.requestTime };
      return { ...state, extensions: [action.extension, ...state.extensions], unreadNotifications: state.unreadNotifications + 1, lastActivity: [newAct, ...state.lastActivity].slice(0, 50) };
    }
    case 'UPDATE_EXTENSION':
      return { ...state, extensions: state.extensions.map(e => e.id === action.id ? { ...e, ...action.patch } : e) };
    case 'UPDATE_AGENT_LOCATION': {
      const exists = state.agentLocations.find(a => a.agentId === action.location.agentId);
      if (exists) {
        const dt = new Date(action.location.updatedAt).getTime() - new Date(exists.updatedAt).getTime();
        const dist = Math.hypot(action.location.lat - exists.lat, action.location.lng - exists.lng);
        if (dt < 2000 && dist < 0.00005) return state;
      }
      const updated = exists ? state.agentLocations.map(a => a.agentId === action.location.agentId ? action.location : a) : [...state.agentLocations, action.location];
      return { ...state, agentLocations: updated };
    }
    case 'SET_AGENT_LOCATIONS': return { ...state, agentLocations: action.locations };
    case 'SELECT_OFFICE': { const next = { ...state, selectedOfficeId: action.id }; savePrefs(next); return next; }
    case 'TOGGLE_LAYER': { const layers = new Set(state.activeMapLayers); layers.has(action.layer) ? layers.delete(action.layer) : layers.add(action.layer); const next = { ...state, activeMapLayers: layers }; savePrefs(next); return next; }
    case 'SET_OFFICE_FILTER': { const next = { ...state, officeFilter: action.ids }; savePrefs(next); return next; }
    case 'TOGGLE_PROVINCE': { const provinces = new Set(state.visibleProvinces); provinces.has(action.code) ? provinces.delete(action.code) : provinces.add(action.code); const next = { ...state, visibleProvinces: provinces }; savePrefs(next); return next; }
    case 'SET_PROVINCES': { const next = { ...state, visibleProvinces: new Set(action.codes) }; savePrefs(next); return next; }
    case 'SET_CUSTOM_KPIS': { try { localStorage.setItem('ops:customKpis', JSON.stringify(action.ids)); } catch {} return { ...state, customKpis: action.ids }; }
    case 'SET_HIDDEN_KPIS': { try { localStorage.setItem('ops:hiddenKpis', JSON.stringify(action.ids)); } catch {} return { ...state, hiddenKpis: action.ids }; }
    case 'SET_DATE_RANGE': { const next = { ...state, dateRange: action.range }; savePrefs(next); return next; }
    case 'ADD_USER': return { ...state, users: [...state.users, action.user] };
    case 'UPDATE_USER': return { ...state, users: state.users.map(u => u.id === action.id ? { ...u, ...action.patch } : u) };
    case 'ADD_BORDER_CROSSING': return { ...state, borderCrossings: [...state.borderCrossings, action.crossing] };
    case 'ADD_ACTIVITY': return { ...state, lastActivity: [action.activity, ...state.lastActivity].slice(0, 50) };
    case 'MARK_NOTIFICATION_READ': return { ...state, lastActivity: state.lastActivity.map(a => a.id === action.id ? { ...a, read: true } : a), unreadNotifications: Math.max(0, state.unreadNotifications - 1) };
    case 'MARK_ALL_NOTIFICATIONS_READ': return { ...state, lastActivity: state.lastActivity.map(a => ({ ...a, read: true })), unreadNotifications: 0 };
    case 'CLEAR_UNREAD': return { ...state, unreadNotifications: 0 };
    default: return state;
  }
}

const OpsContext = createContext<{
  state: OpsState;
  dispatch: React.Dispatch<Action>;
  actions: typeof actions;
} | null>(null);

const actions = {
  async signIn(email: string, password: string) { const { user, error } = await api.signIn(email, password); return { user, error }; },
  async signUp(input: { fullNameAr: string; email: string; password: string; role: Profile['role']; officeId: string }) { const { user, error } = await api.signUp(input); return { user, error }; },
  async signOut() { await api.signOut(); },
  async submitReport(report: DailyReport) { return api.insertReport(report); },
  async submitEmergency(em: Emergency) { await api.insertEmergency(em); },
  async ackEmergency(id: string, userId: string) { await api.updateEmergency(id, { status: 'acknowledged', acknowledgedById: userId, acknowledgedAt: new Date().toISOString() }); },
  async resolveEmergency(id: string, userId?: string) { await api.updateEmergency(id, { status: 'resolved', resolvedById: userId, resolvedAt: new Date().toISOString() }); },
  async submitExtension(ex: ExtensionRequest) { await api.insertExtension(ex); },
  async updateExtension(id: string, patch: Partial<ExtensionRequest>) { await api.updateExtension(id, patch); },
  async updateTimeWindow(patch: Partial<TimeWindow>) { return api.updateTimeWindow(patch); },
  async updateAgentLocation(loc: AgentLocation) { await api.upsertAgentLocation(loc); },
  async updateUser(id: string, patch: Partial<Profile>) { return api.updateUser(id, patch); },
  async addBorderCrossing(crossing: any) { return api.insertBorderCrossing(crossing); },
  async seedDemoData() { return api.seedDemoData(); },
  async loadHistoricalPage(page: number, pageSize = 50, filters?: any, dispatch?: React.Dispatch<Action>) {
    if (dispatch) dispatch({ type: 'SET_LOADING', key: 'historical', loading: true });
    try {
      const res = await api.getHistoricalReports(page, pageSize, filters);
      dispatch?.({ type: 'SET_HISTORICAL', reports: res.data, total: res.total, page: res.page, pageSize: res.pageSize });
      return res;
    } finally { dispatch?.({ type: 'SET_LOADING', key: 'historical', loading: false }); }
  },
  async reloadFieldDefs(dispatch?: React.Dispatch<Action>) {
    const [groups, definitions] = await Promise.all([api.getFieldGroups(), api.getFieldDefinitions()]);
    dispatch?.({ type: 'SET_FIELD_DEFS', groups, definitions });
    return { groups, definitions };
  },
  async upsertFieldGroup(g: Partial<ReportFieldGroup> & { titleAr: string }) { return api.upsertFieldGroup(g); },
  async deleteFieldGroup(id: string) { return api.deleteFieldGroup(id); },
  async upsertFieldDefinition(f: Partial<ReportFieldDefinition> & { fieldKey: string; labelAr: string; groupId: string }) { return api.upsertFieldDefinition(f); },
  async deleteFieldDefinition(id: string) { return api.deleteFieldDefinition(id); },
};

// Offline queue
const OFFLINE_Q_KEY = 'ops:offlineQueue';
function pushOffline(kind: string, payload: any) {
  try {
    const q = JSON.parse(localStorage.getItem(OFFLINE_Q_KEY) || '[]');
    q.push({ kind, payload, ts: Date.now() });
    localStorage.setItem(OFFLINE_Q_KEY, JSON.stringify(q.slice(-50)));
  } catch {}
}
async function flushOffline() {
  try {
    const raw = localStorage.getItem(OFFLINE_Q_KEY);
    if (!raw) return;
    const q = JSON.parse(raw);
    if (!q.length) return;
    const remaining = [];
    for (const item of q) {
      try {
        if (item.kind === 'report') await api.insertReport(item.payload);
        else if (item.kind === 'emergency') await api.insertEmergency(item.payload);
        else if (item.kind === 'extension') await api.insertExtension(item.payload);
      } catch { remaining.push(item); }
    }
    localStorage.setItem(OFFLINE_Q_KEY, JSON.stringify(remaining));
  } catch {}
}

export function OpsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);
  const currentUserRef = useRef(state.currentUser);
  useEffect(() => { currentUserRef.current = state.currentUser; }, [state.currentUser]);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const loadAllData = useCallback(async () => {
    const [users, todayReports, histRes, emergencies, extensions, agentLocations, flowPaths, borderCrossings, timeWindow, serverTime] = await Promise.all([
      api.getUsers(), api.getTodayReports(), api.getHistoricalReports(1, 50),
      api.getEmergencies(), api.getExtensions(), api.getAgentLocations(),
      api.getFlowPaths(), api.getBorderCrossings(), api.getTimeWindow(), api.getServerTime(),
    ]);
    dispatch({ type: 'SET_DATA', users, todayReports, emergencies, extensions, agentLocations, flowPaths, borderCrossings, timeWindow });
    dispatch({ type: 'SET_HISTORICAL', reports: histRes.data, total: histRes.total, page: histRes.page, pageSize: histRes.pageSize });
    dispatch({ type: 'SET_SERVER_TIME', time: serverTime });
    try {
      const [fg, fd] = await Promise.all([api.getFieldGroups(), api.getFieldDefinitions()]);
      dispatch({ type: 'SET_FIELD_DEFS', groups: fg, definitions: fd });
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      dispatch({ type: 'AUTH_START' });
      try {
        const user = await api.getSession();
        await loadAllData();
        if (user) dispatch({ type: 'AUTH_SUCCESS', user }); else dispatch({ type: 'AUTH_FAIL' });
        flushOffline();
      } catch { dispatch({ type: 'AUTH_FAIL' }); } finally { setReady(true); }
    })();
  }, [loadAllData]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) return;
      if (['SIGNED_IN','TOKEN_REFRESHED','INITIAL_SESSION'].includes(event)) {
        setTimeout(async () => {
          try { const user = await api.getSession(); await loadAllData(); if (user) dispatch({ type: 'AUTH_SUCCESS', user }); } catch {}
        }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadAllData]);

  // server time
  useEffect(() => {
    const tick = async () => { const t = await api.getServerTime(); dispatch({ type: 'SET_SERVER_TIME', time: t }); };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // midnight roll
  useEffect(() => {
    const roll = async () => {
      const today = operationalDate();
      if (today !== state.timeWindow.windowDate) {
        const tw = await api.getTimeWindow();
        dispatch({ type: 'SET_TIME_WINDOW', window: { ...tw, windowDate: today } });
      }
    };
    const id = setInterval(roll, 60_000);
    return () => clearInterval(id);
  }, [state.timeWindow.windowDate]);

  // online flush
  useEffect(() => {
    const h = () => flushOffline();
    window.addEventListener('online', h);
    return () => window.removeEventListener('online', h);
  }, []);

  // granular realtime
  const userId = state.currentUser?.id;
  useEffect(() => {
    if (!userId) return;
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) { try { await (supabase.realtime as any).setAuth(token); } catch {} }
      } catch {}
      if (cancelled) return;
      const alert = (kind: Parameters<typeof fireAlert>[0], title: string, body: string) => {
        if (currentUserRef.current?.role === 'viewer') return;
        fireAlert(kind, title, body);
      };
      const nameOf = (id?: string) => !id ? '' : stateRef.current.users.find(u => u.id === id)?.fullNameAr ?? '';
      unsub = api.subscribe({
        onReportChange: ev => {
          if (ev.type === 'DELETE' && ev.old?.id) dispatch({ type: 'REMOVE_REPORT', id: ev.old.id });
          else if (ev.new) {
            dispatch({ type: 'ADD_REPORT', report: ev.new });
            if (currentUserRef.current?.id !== ev.new.submittedBy) alert('report', 'تقرير جديد', `${ev.new.officeId} — تم استلام تقرير`);
          }
        },
        onEmergencyChange: ev => {
          const e = ev.new; if (!e) return;
          if (ev.type === 'INSERT') {
            const me = currentUserRef.current;
            const silent = me?.role === 'viewer' || e.reportedById === me?.id;
            dispatch({ type: 'ADD_EMERGENCY', emergency: e, silent });
            if (!silent) alert('emergency', '🚨 حالة طارئة', `${e.emergencyType} — ${e.reportedByName || e.officeId}`);
          } else if (ev.type === 'UPDATE') {
            if (e.status === 'resolved') dispatch({ type: 'RESOLVE_EMERGENCY', id: e.id, userId: e.resolvedById });
            else if (e.status === 'acknowledged') dispatch({ type: 'ACK_EMERGENCY', id: e.id, userId: e.acknowledgedById || '' });
            const me = currentUserRef.current;
            if (me && e.reportedById === me.id) {
              if (e.status === 'acknowledged') alert('extension', '✅ تم استلام حالتك', `${e.emergencyType} — ${nameOf(e.acknowledgedById) || 'القيادة'}`);
              else if (e.status === 'resolved') alert('report', '✔ تم حل حالتك', `${e.emergencyType}`);
            }
          }
        },
        onExtensionChange: ev => {
          const x = ev.new; if (!x) return;
          if (ev.type === 'INSERT') {
            dispatch({ type: 'ADD_EXTENSION', extension: x });
            if (currentUserRef.current?.id !== x.requestedById) alert('extension', 'طلب تمديد', `${x.requestedByName || x.officeId}`);
          } else if (ev.type === 'UPDATE') {
            dispatch({ type: 'UPDATE_EXTENSION', id: x.id, patch: x });
            const me = currentUserRef.current;
            if (me && x.requestedById === me.id) {
              if (x.status === 'approved') alert('extension', '✅ تمت الموافقة', 'تم فتح نافذة إضافية');
              else if (x.status === 'rejected') alert('system', '❌ تم الرفض', 'لم تتم الموافقة');
            }
          }
        },
        onTimeWindowChange: tw => dispatch({ type: 'SET_TIME_WINDOW', window: tw }),
        onAgentLocationChange: loc => dispatch({ type: 'UPDATE_AGENT_LOCATION', location: loc }),
        onBorderCrossingChange: bc => dispatch({ type: 'ADD_BORDER_CROSSING', crossing: bc }),
        onProfileChange: p => {
          const upd = p.new;
          if (upd?.id) dispatch({ type: 'UPDATE_USER', id: upd.id, patch: {
            fullNameAr: upd.full_name_ar, officeId: upd.office_id ?? '',
            permittedOfficeIds: upd.permitted_office_ids ?? [],
            specialPermissions: upd.special_permissions ?? undefined,
            isActive: upd.is_active,
          }});
        }
      });
    })();
    return () => { cancelled = true; unsub(); };
  }, [userId]);

  const contextValue = useMemo(() => ({ state, dispatch, actions: {
    ...actions,
    // wrap submit with offline queue
    submitReport: async (report: DailyReport) => {
      if (!navigator.onLine) { pushOffline('report', report); throw new Error('غير متصل — تم حفظ التقرير محلياً وسيُرسل تلقائياً'); }
      return actions.submitReport(report);
    },
    submitEmergency: async (em: Emergency) => {
      if (!navigator.onLine) { pushOffline('emergency', em); throw new Error('غير متصل — تم حفظ البلاغ محلياً'); }
      return actions.submitEmergency(em);
    },
    submitExtension: async (ex: ExtensionRequest) => {
      if (!navigator.onLine) { pushOffline('extension', ex); throw new Error('غير متصل — تم حفظ الطلب محلياً'); }
      return actions.submitExtension(ex);
    },
  } }), [state]);

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
  if (!isSupabaseConfigured) return <EnvErrorPage />;
  return <OpsContext.Provider value={contextValue}>{children}</OpsContext.Provider>;
}

export function useOps() {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error('useOps must be used inside OpsProvider');
  return ctx;
}

// ─── Selectors — لتقليل re-renders ───────────────────────────
export function useAuth() {
  const { state } = useOps();
  return useMemo(() => ({ user: state.currentUser, authLoading: state.authLoading }), [state.currentUser, state.authLoading]);
}
export function useReports() {
  const { state } = useOps();
  return useMemo(() => ({ today: state.todayReports, historical: state.historicalReports, meta: state.historicalMeta }), [state.todayReports, state.historicalReports, state.historicalMeta]);
}
export function useEmergencies() {
  const { state } = useOps();
  return useMemo(() => state.emergencies, [state.emergencies]);
}
export function useMapData() {
  const { state } = useOps();
  return useMemo(() => ({
    agentLocations: state.agentLocations,
    borderCrossings: state.borderCrossings,
    flowPaths: state.flowPaths,
    activeMapLayers: state.activeMapLayers,
    fieldDefinitions: state.fieldDefinitions,
  }), [state.agentLocations, state.borderCrossings, state.flowPaths, state.activeMapLayers, state.fieldDefinitions]);
}
export function useUI() {
  const { state, dispatch } = useOps();
  return useMemo(() => ({
    officeFilter: state.officeFilter,
    selectedOfficeId: state.selectedOfficeId,
    customKpis: state.customKpis,
    hiddenKpis: state.hiddenKpis,
    dateRange: state.dateRange,
    dispatch
  }), [state.officeFilter, state.selectedOfficeId, state.customKpis, state.hiddenKpis, state.dateRange, dispatch]);
}
