import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { useOps } from '../store/opsStore';
import { useOffices } from '../lib/offices';
import { MapPin, ChevronDown, Send, MapPinned, X, AlertTriangle, Lock, Timer, Check, Crosshair, Info, Route as RouteIcon, History, User as UserIcon, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import TimeLockBar from '../components/TimeLockBar';
import MapPicker from '../components/MapPicker';
import type { ReportFieldDefinition, ReportFieldGroup } from '../data/types';
import { operationalDate } from '../lib/opDate';
import { validateExtraFields } from '../lib/api';

type Pt = { lat: number; lng: number };
const LOC_EVENTS = 'eventsLocation';
const ROUTE_PROC = 'processionRoute';

export default function ReportPage() {
  const { state, actions } = useOps();
  const user = state.currentUser;
  const { officeById } = useOffices();
  if (!user) return <div className="h-full flex items-center justify-center text-slate-500">جاري التحميل...</div>;
  const office = officeById(user.officeId);
  if (!office) return <div className="h-full flex items-center justify-center text-red-400">المكتب غير موجود</div>;

  const plan = useMemo(() => buildPlan(state.fieldGroups, state.fieldDefinitions, user.id), [state.fieldGroups, state.fieldDefinitions, user.id]);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  useEffect(() => { if (plan.length > 0 && expandedCards.size === 0) setExpandedCards(new Set([plan[0].group.id])); }, [plan]);

  const [form, setForm] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, Pt | null>>({});
  const [routes, setRoutes] = useState<Record<string, Pt[]>>({});
  const [picker, setPicker] = useState<{ fieldKey: string; mode: 'single' | 'multi' | 'route'; label: string } | null>(null);

  const [showExtension, setShowExtension] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');
  const [mgrs, setMgrs] = useState('');
  const [mgrsError, setMgrsError] = useState('');
  const [reporterLat, setReporterLat] = useState<number | null>(null);
  const [reporterLng, setReporterLng] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(false);

  const reportExists = state.todayReports.find(r => r.officeId === user.officeId);
  const today = operationalDate();
  const extensionActive = state.extensions.find(e =>
    e.officeId === user.officeId && e.status === 'approved' && !e.consumedAt && (!e.targetReportDate || e.targetReportDate === today)
  );
  const status = state.timeWindowStatus;
  const canSubmit = status === 'open' || status === 'pre_warning' || !!extensionActive;

  const DRAFT_KEY = `ops:report-draft:${user.id}:${today}`;
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) { const d = JSON.parse(raw); const hasContent = Object.keys(d.form||{}).length || Object.keys(d.locations||{}).length; if (hasContent) setDraftAvailable(true); }
    } catch {}
  }, [DRAFT_KEY]);
  useEffect(() => {
    const empty = !Object.keys(form).length && !Object.keys(locations).length && !Object.keys(routes).length && !mgrs;
    if (empty) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, locations, routes, mgrs, ts: Date.now() })); } catch {}
    }, 800);
    return () => window.clearTimeout(saveTimer.current);
  }, [form, locations, routes, mgrs, DRAFT_KEY]);

  const restoreDraft = () => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      setForm(d.form ?? {}); setLocations(d.locations ?? {}); setRoutes(d.routes ?? {}); setMgrs(d.mgrs ?? '');
      toast.success('تمت استعادة المسودة');
    } catch { toast.error('تعذّر استعادة المسودة'); }
    setDraftAvailable(false);
  };
  const discardDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} setDraftAvailable(false); };

  // beforeunload
  useEffect(() => {
    const dirty = Object.keys(form).length > 0 || Object.keys(locations).length > 0;
    const handler = (e: BeforeUnloadEvent) => { if (dirty && !submitting) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [form, locations, submitting]);

  // GPS
  const watchIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (user.role === 'agent' && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setReporterLat(pos.coords.latitude); setReporterLng(pos.coords.longitude);
          actions.updateAgentLocation({
            agentId: user.id, agentName: user.fullNameAr, officeId: user.officeId,
            lat: pos.coords.latitude, lng: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy, updatedAt: new Date().toISOString(),
          }).catch(()=>{});
        }, null, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
      );
    }
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [user.id, user.role]);

  const updateField = (key: string, value: any, field?: ReportFieldDefinition) => {
    setForm(f => ({ ...f, [key]: value }));
    if (field) {
      let err: string | null = null;
      if (field.fieldType === 'number' && value !== '' && value !== undefined) {
        const n = Number(value); if (isNaN(n)) err = 'رقم غير صالح'; else if (n < 0) err = 'لا يمكن أن تكون سالبة'; else if (n > 999999999) err = 'قيمة كبيرة جداً';
      }
      if ((field.fieldType === 'text' || field.fieldType === 'textarea') && field.maxLength) {
        if (String(value || '').length > field.maxLength) err = `الحد ${field.maxLength} حرف`;
      }
      setFormErrors(e => { const n = { ...e }; if (err) n[key] = err; else delete n[key]; return n; });
    } else if (formErrors[key]) {
      setFormErrors(e => { const n = { ...e }; delete n[key]; return n; });
    }
  };

  const isFieldFilled = (f: ReportFieldDefinition) => {
    if (f.fieldType === 'location') return !!locations[f.fieldKey];
    if (f.fieldType === 'multi_location' || f.fieldType === 'route') return (routes[f.fieldKey]?.length ?? 0) > 0;
    const v = form[f.fieldKey]; return v !== undefined && v !== null && v !== '';
  };

  const totalFields = plan.reduce((a,g)=>a+g.fields.length,0);
  const filledFields = plan.reduce((a,g)=>a+g.fields.filter(isFieldFilled).length,0);
  const completionPct = totalFields ? Math.round(filledFields/totalFields*100) : 0;

  const validateMgrsLocal = (val: string) => {
    if (!val) { setMgrsError(''); return true; }
    const re = /^[0-9]{1,2}[C-HJ-NP-X][A-Z]{2}[0-9]{2,10}$/i;
    const ok = re.test(val.replace(/\s+/g,''));
    setMgrsError(ok ? '' : 'صيغة MGRS غير صحيحة');
    return ok;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!canSubmit && !extensionActive) { setShowExtension(true); return; }
    if (mgrs && !validateMgrsLocal(mgrs)) { toast.error('MGRS غير صحيح'); return; }
    if (!mgrs && (reporterLat == null || reporterLng == null)) { toast.error('حدد موقعك'); return; }

    const newErr: Record<string,string> = {};
    for (const grp of plan) for (const f of grp.fields) {
      const v = form[f.fieldKey];
      if (f.fieldType === 'number' && v !== '' && v !== undefined) { const n = Number(v); if (isNaN(n) || n < 0) newErr[f.fieldKey] = 'قيمة غير صالحة'; }
      if ((f.fieldType === 'text' || f.fieldType === 'textarea') && f.maxLength && String(v||'').length > f.maxLength) newErr[f.fieldKey] = 'تجاوز الحد المسموح';
    }
    if (Object.keys(newErr).length) { setFormErrors(newErr); toast.error(`يوجد ${Object.keys(newErr).length} أخطاء`); return; }

    const rawExtra: Record<string,any> = {};
    for (const grp of plan) for (const f of grp.fields) {
      if (f.isBuiltIn) continue;
      if (f.fieldType === 'location') { if (locations[f.fieldKey]) rawExtra[f.fieldKey] = locations[f.fieldKey]; }
      else if (f.fieldType === 'multi_location' || f.fieldType === 'route') { if ((routes[f.fieldKey]?.length ?? 0) > 0) rawExtra[f.fieldKey] = routes[f.fieldKey].slice(0,100); }
      else if (f.fieldType === 'number') { const v = form[f.fieldKey]; if (v !== undefined && v !== '') rawExtra[f.fieldKey] = Number(v) || 0; }
      else if (f.fieldType === 'select' && f.withQuantity) {
        const arr = Array.isArray(form[f.fieldKey]) ? form[f.fieldKey] : [];
        const clean = arr.filter((r:any)=> r && String(r.item).trim() && Number(r.qty)>0).slice(0,50)
          .map((r:any)=>({ item: String(r.item).trim().slice(0,200), qty: Math.min(999999, Number(r.qty)) }));
        if (clean.length) rawExtra[f.fieldKey] = clean;
      } else if (form[f.fieldKey] !== undefined && form[f.fieldKey] !== '') {
        rawExtra[f.fieldKey] = typeof form[f.fieldKey] === 'string' ? form[f.fieldKey].slice(0, f.maxLength || 2000) : form[f.fieldKey];
      }
    }
    const extraFields = validateExtraFields(rawExtra, state.fieldDefinitions);
    const num = (k:string)=> Math.max(0, Math.min(999999999, Number(form[k] || 0)));
    const str = (k:string, max=2000)=> String(form[k] ?? '').slice(0, max);

    const t = toast.loading('جاري الإرسال...');
    setSubmitting(true);
    try {
      await actions.submitReport({
        id: `r-new-${Date.now()}`,
        officeId: office.id, submittedBy: user.id,
        reportDate: operationalDate(), submittedAt: new Date().toISOString(),
        isLateSubmission: status === 'pre_warning' || status === 'locked',
        deploymentCount: num('deploymentCount'),
        deploymentLocations: str('deploymentLocations',500),
        deploymentFormations: str('deploymentFormations',500),
        coordinationSectors: str('coordinationSectors',500),
        coordinationJointOps: str('coordinationJointOps',500),
        incidentsCount: num('incidentsCount'), incidentsDetails: str('incidentsDetails'),
        violationsCount: num('violationsCount'), violationsArea: str('violationsArea',200),
        violationsTimeDetail: str('violationsTimeDetail',50), violationsDetails: str('violationsDetails'),
        deathsCount: num('deathsCount'), deathsLocationMgrs: str('deathsLocationMgrs',50), deathsActionTaken: str('deathsActionTaken'),
        resourcesDistributed: num('resourcesDistributed'), resourcesDetails: str('resourcesDetails'),
        eventsCount: num('eventsCount'), eventsDetails: str('eventsDetails'),
        eventsCoordinates: locations['eventsLocation'] ? [locations['eventsLocation'] as Pt] : [],
        visitsCount: num('visitsCount'), visitsSummary: str('visitsSummary'),
        visitorsIn: num('visitorsIn'), visitorsOut: num('visitorsOut'), visitorsRoutes: str('visitorsRoutes',500),
        vehiclesCount: num('vehiclesCount'), vehiclesDetails: str('vehiclesDetails'),
        processionsCount: num('processionsCount'), processionsDetails: str('processionsDetails'),
        processionWaypoints: (routes['processionRoute'] ?? []).slice(0,100),
        otherNotes: str('otherNotes'),
        reporterLat: reporterLat ?? undefined, reporterLng: reporterLng ?? undefined,
        mgrsReference: mgrs.slice(0,50),
        extraFields,
      });
      toast.success('✅ تم إرسال التقرير', { id: t });
      if (extensionActive && status !== 'open') { actions.updateExtension(extensionActive.id, { consumedAt: new Date().toISOString() }).catch(()=>{}); }
      setForm({}); setLocations({}); setRoutes({}); setMgrs(''); setFormErrors({});
      discardDraft();
    } catch (e:any) { toast.error(e?.message || 'فشل الإرسال', { id: t }); }
    finally { setSubmitting(false); }
  };

  const submitExtension = async () => {
    const reason = extensionReason.trim();
    if (reason.length < 5) { toast.error('السبب 5 أحرف على الأقل'); return; }
    const t = toast.loading('جاري رفع الطلب...');
    try {
      await actions.submitExtension({
        id: `ex-${Date.now()}`, requestedById: user.id, requestedByName: user.fullNameAr,
        officeId: office.id, requestTime: new Date().toISOString(),
        reason: reason.slice(0,1000), status: 'pending',
      });
      toast.success('تم رفع طلب التمديد', { id: t });
      setShowExtension(false); setExtensionReason('');
    } catch (e:any) { toast.error(e?.message || 'فشل', { id: t }); }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0B0F19]">
      <div className="lg:hidden p-3 bg-[#111827] border-b border-[#1E293B]"><TimeLockBar /></div>
      <div className="max-w-3xl mx-auto p-3 md:p-4">
        <div className="bg-gradient-to-l from-[#111827] to-[#0B0F19] border border-[#1E293B] rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400"><Send className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-display font-black text-amber-400">التقرير اليومي الميداني</div>
              <div className="text-xs text-slate-400">{office?.nameAr} — {office?.governorateAr} • {new Date().toLocaleDateString('ar-IQ')}</div>
            </div>
            <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${status==='open'?'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30':status==='pre_warning'?'bg-amber-500/20 text-amber-300 border border-amber-500/30':'bg-red-500/20 text-red-300 border border-red-500/30'}`}>{status==='open'?'مفتوحة':status==='pre_warning'?'تحذير':'مغلقة'}</div>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1 text-[10px] text-slate-500">
              <span>اكتمال: <b className="text-amber-300">{filledFields}/{totalFields}</b></span>
              <span className="font-mono">{completionPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#1E293B] overflow-hidden"><div className="h-full bg-gradient-to-l from-amber-500 to-amber-300 transition-all" style={{ width: `${completionPct}%` }} /></div>
            {!!Object.keys(formErrors).length && <div className="mt-2 text-[10px] text-red-300">⚠ {Object.keys(formErrors).length} أخطاء</div>}
          </div>
          {reportExists && <div className="mt-3 p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2"><Check className="w-3.5 h-3.5" /> تم إرسال تقرير اليوم</div>}
          {draftAvailable && (
            <div className="mt-3 p-3 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200">
              <div className="flex items-center gap-2 mb-2 font-bold"><History className="w-3.5 h-3.5" /> مسودة غير مُرسلة</div>
              <div className="flex gap-2">
                <button onClick={restoreDraft} className="flex-1 py-1.5 rounded-md bg-blue-500 text-black font-bold">استئناف</button>
                <button onClick={discardDraft} className="px-3 py-1.5 rounded-md bg-[#1E293B] text-slate-300">تجاهل</button>
              </div>
            </div>
          )}
        </div>

        {plan.length === 0 ? (
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-8 text-center text-sm text-slate-500">لا توجد حقول مفعّلة</div>
        ) : (
          <div className="space-y-3">
            {plan.map(({ group, fields }) => {
              const expanded = expandedCards.has(group.id);
              const filledHere = fields.filter(isFieldFilled).length;
              const hasErr = fields.some(f => formErrors[f.fieldKey]);
              return (
                <div key={group.id} className={`bg-[#111827] border rounded-xl overflow-hidden ${hasErr ? 'border-red-500/40' : 'border-[#1E293B]'}`}>
                  <button onClick={()=>{ const n=new Set(expandedCards); n.has(group.id)?n.delete(group.id):n.add(group.id); setExpandedCards(n); }}
                    className="w-full p-4 flex items-center gap-3 hover:bg-[#1E293B]/40">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-sm font-black">{group.sortOrder}</div>
                    <div className="flex-1 text-right"><div className="font-bold text-sm">{group.titleAr} {hasErr && <span className="text-red-400 text-[10px]">⚠</span>}</div>
                      <div className="text-[10px] text-slate-500">{filledHere}/{fields.length}</div></div>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded?'rotate-180':''}`} />
                  </button>
                  {expanded && (
                    <div className="p-4 pt-0 space-y-3">
                      {fields.map(field => (
                        <MemoField key={field.id} field={field} value={form[field.fieldKey]} error={formErrors[field.fieldKey]}
                          onChange={(v:any)=>updateField(field.fieldKey, v, field)}
                          location={locations[field.fieldKey] ?? null}
                          route={routes[field.fieldKey] ?? []}
                          onOpenPicker={(mode,label)=>setPicker({ fieldKey: field.fieldKey, mode, label })}
                          onRemoveRoutePoint={(i:number)=> setRoutes(r=>({...r,[field.fieldKey]:(r[field.fieldKey]||[]).filter((_,idx)=>idx!==i)}))}
                          onClearLocation={()=> setLocations(l=>({...l,[field.fieldKey]:null}))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
          <div className="text-xs text-slate-400 font-bold">بيانات الموقع</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={()=>{ if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(p=>{ setReporterLat(p.coords.latitude); setReporterLng(p.coords.longitude); toast.success('تم تحديد موقعك'); }, ()=>toast.error('فشل')); }}}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-sm font-bold">
              <Crosshair className="w-4 h-4" /> تحديد تلقائي
            </button>
            <div>
              <input placeholder="MGRS (اختياري)" value={mgrs} onChange={e=>{ setMgrs(e.target.value); validateMgrsLocal(e.target.value); }}
                className={`w-full bg-[#1E293B] border rounded-lg px-3 py-2.5 text-sm text-white ${mgrsError ? 'border-red-500/60':'border-[#263244] focus:border-amber-500/40'} focus:outline-none`} />
              {mgrsError && <div className="text-[10px] text-red-400 mt-1">{mgrsError}</div>}
            </div>
          </div>
          {reporterLat != null && <div className="text-[10px] text-slate-500 bg-[#0B0F19] border border-[#1E293B] rounded p-2">📍 {reporterLat.toFixed(5)}, {reporterLng?.toFixed(5)}</div>}
          <div className="text-[10px] text-slate-500">السيرفر: <span className="text-slate-300 font-mono">{state.serverTime.toLocaleTimeString('en-GB',{hour12:false})}</span></div>
          {extensionActive && <div className="p-2.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">تمديد نشط</div>}
          <button onClick={handleSubmit} disabled={submitting || (status==='locked' && !extensionActive) || !!Object.keys(formErrors).length}
            className="w-full py-3.5 rounded-lg font-black text-base disabled:opacity-60 bg-amber-500 hover:bg-amber-400 text-black">
            {submitting ? 'جاري الإرسال...' : Object.keys(formErrors).length ? `صحّح الأخطاء (${Object.keys(formErrors).length})` : status==='locked' && !extensionActive ? 'انتهى الوقت — طلب تمديد' : 'إرسال التقرير'}
          </button>
        </div>
        {user.role !== 'agent' && <PreviousReportsPanel currentUserRole={user.role} currentUserOfficeId={user.officeId} />}
      </div>

      {picker && (
        <MapPicker mode={picker.mode} title={picker.label} subtitle="اختر من الخريطة"
          initialSingle={locations[picker.fieldKey] ?? null}
          initialMulti={routes[picker.fieldKey] ?? []}
          userLocation={reporterLat!=null && reporterLng!=null ? { lat: reporterLat, lng: reporterLng } : null}
          focusPoint={office ? { lat: office.lat, lng: office.lng } : null}
          onCancel={()=>setPicker(null)}
          onConfirmSingle={(p)=>{ setLocations(l=>({...l, [picker.fieldKey]: p})); setPicker(null); toast.success('تم التحديد'); }}
          onConfirmMulti={(pts)=>{ setRoutes(r=>({...r, [picker.fieldKey]: pts.slice(0,100)})); setPicker(null); toast.success(`تم تثبيت ${pts.length} نقاط`); }}
        />
      )}
      {showExtension && (
        <div className="fixed inset-0 z-[600] bg-black/60 flex items-end justify-center" onClick={()=>setShowExtension(false)}>
          <div onClick={e=>e.stopPropagation()} className="w-full max-w-lg bg-[#0B0F19] border-t-2 border-red-500/50 rounded-t-2xl p-5">
            <div className="text-lg font-black text-red-300 mb-2">انتهى وقت الإرسال</div>
            <textarea value={extensionReason} onChange={e=>setExtensionReason(e.target.value.slice(0,1000))} maxLength={1000}
              placeholder="سبب طلب التمديد..." className="w-full bg-[#1E293B] border border-[#263244] rounded-lg p-3 text-sm text-white min-h-20" />
            <div className="text-[10px] text-slate-500 mb-3">{extensionReason.length}/1000</div>
            <div className="flex gap-2">
              <button onClick={()=>setShowExtension(false)} className="flex-1 py-2.5 rounded-lg bg-[#1E293B] text-slate-300">إلغاء</button>
              <button onClick={submitExtension} disabled={extensionReason.trim().length < 5} className="flex-1 py-2.5 rounded-lg bg-amber-500 text-black font-black disabled:opacity-50">رفع الطلب</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildPlan(groups: ReportFieldGroup[], defs: ReportFieldDefinition[], userId: string) {
  const visibleDefs = defs.filter(f => !f.isHidden && (f.allowedUserIds.length === 0 || f.allowedUserIds.includes(userId)));
  return groups.filter(g => !g.isHidden).map(g => ({
    group: g, fields: visibleDefs.filter(f => f.groupId === g.id).sort((a,b)=>a.sortOrder-b.sortOrder)
  })).filter(x => x.fields.length > 0).sort((a,b)=>a.group.sortOrder-b.group.sortOrder);
}

const MemoField = memo(DynamicFieldRenderer, (p,n)=> p.field.id===n.field.id && p.value===n.value && p.error===n.error && p.location===n.location && (p.route?.length??0)===(n.route?.length??0));

function DynamicFieldRenderer({ field, value, error, onChange, location, route, onOpenPicker, onRemoveRoutePoint, onClearLocation }:{
  field: ReportFieldDefinition; value:any; error?:string; onChange:(v:any)=>void;
  location: Pt | null; route: Pt[]; onOpenPicker:(m:'single'|'multi'|'route',l:string)=>void;
  onRemoveRoutePoint:(i:number)=>void; onClearLocation:()=>void;
}) {
  const inputCls = `w-full bg-[#1E293B] border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 ${error ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20' : 'border-[#263244] focus:border-amber-500/40 focus:ring-amber-500/20'}`;
  const Label = <label className="text-xs text-slate-300 mb-1.5 block font-semibold flex items-center justify-between"><span>{field.labelAr}</span>{field.maxLength && <span className="text-[10px] text-slate-500">{String(value??'').length}/{field.maxLength}</span>}</label>;
  const helper = field.descriptionAr ? <div className="text-[10px] text-slate-500 mt-1">{field.descriptionAr}</div> : null;

  if (field.fieldType === 'number') return <div>{Label}<input type="text" inputMode="numeric" value={value ?? ''} onChange={e=>onChange(e.target.value.replace(/[^0-9]/g,'').slice(0,12))} placeholder={field.placeholderAr ?? ''} className={inputCls} />{error ? <div className="text-[10px] text-red-400 mt-1">{error}</div> : helper}</div>;
  if (field.fieldType === 'textarea') return <div>{Label}<textarea value={value ?? ''} onChange={e=>onChange(e.target.value.slice(0, field.maxLength || 2000))} className={inputCls + ' min-h-20 resize-none'} placeholder={field.placeholderAr ?? ''} />{error ? <div className="text-[10px] text-red-400 mt-1">{error}</div> : helper}</div>;
  if (['text','date','time'].includes(field.fieldType)) return <div>{Label}<input type={field.fieldType==='text'?'text':field.fieldType} value={value ?? ''} onChange={e=>onChange(e.target.value)} placeholder={field.placeholderAr ?? ''} className={inputCls} />{error ? <div className="text-[10px] text-red-400 mt-1">{error}</div> : helper}</div>;
  if (field.fieldType === 'select') return <div>{Label}<SelectField field={field} value={value} onChange={onChange} />{error ? <div className="text-[10px] text-red-400 mt-1">{error}</div> : helper}</div>;
  if (field.fieldType === 'location') return (
    <div>{Label}{location ? (
      <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs">
        <MapPin className="w-4 h-4 text-emerald-400" /><span className="flex-1 font-mono text-emerald-200">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
        <button onClick={()=>onOpenPicker('single', field.labelAr)} className="text-emerald-400 text-[11px] font-bold">تعديل</button>
        <button onClick={onClearLocation} className="text-red-400"><X className="w-3.5 h-3.5" /></button>
      </div>
    ) : (
      <button onClick={()=>onOpenPicker('single', field.labelAr)} className="w-full flex items-center justify-center gap-2 p-2.5 bg-[#1E293B] border border-dashed border-[#263244] rounded-lg text-slate-400 hover:text-amber-400 text-xs">
        <MapPinned className="w-4 h-4" /> فتح الخريطة
      </button>
    )}{helper}</div>
  );
  if (field.fieldType === 'multi_location' || field.fieldType === 'route') {
    const isRoute = field.fieldType === 'route';
    return <div>{Label}
      <div className="space-y-1.5">
        {route.map((wp,i)=>(
          <div key={i} className="flex items-center gap-2 p-2 bg-[#1E293B] border border-[#263244] rounded-lg text-xs">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">{i+1}</div>
            <span className="flex-1 font-mono">{wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}</span>
            <button onClick={()=>onRemoveRoutePoint(i)} className="text-red-400"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <button onClick={()=>onOpenPicker(isRoute?'route':'multi', field.labelAr)} className="w-full p-2 bg-[#1E293B] border border-dashed border-[#263244] rounded-lg text-slate-400 hover:text-amber-400 text-xs">
          {route.length ? `تعديل (${route.length} نقطة)` : 'فتح الخريطة'}
        </button>
      </div>{helper}</div>;
  }
  return <div>{Label}<input type="text" value={value ?? ''} onChange={e=>onChange(e.target.value)} className={inputCls} />{helper}</div>;
}

function SelectField({ field, value, onChange }:{ field: ReportFieldDefinition; value:any; onChange:(v:any)=>void }) {
  const options = field.options ?? [];
  const allowFree = field.allowFreeText;
  const cls = 'flex-1 bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/40 focus:outline-none';
  if (!field.withQuantity) {
    const v = typeof value === 'string' ? value : '';
    const isFree = v && !options.includes(v);
    return <div className="space-y-1.5">
      <select value={isFree ? '__other__' : v} onChange={e=>onChange(e.target.value==='__other__'?'':e.target.value)} className={cls+' w-full'}>
        <option value="">— اختر —</option>
        {options.map(o=> <option key={o} value={o}>{o}</option>)}
        {allowFree && <option value="__other__">أخرى…</option>}
      </select>
      {allowFree && isFree && <input type="text" value={v} onChange={e=>onChange(e.target.value.slice(0,200))} className={cls+' w-full'} placeholder="اكتب…" />}
    </div>;
  }
  const list = Array.isArray(value) ? value : [];
  const rows = list.length ? list : [{item:'',qty:1}];
  const update = (next:any[])=> onChange(next.filter((r:any)=>r.item && r.qty>0).slice(0,50));
  return <div className="space-y-2">
    {rows.map((r:any,i:number)=>{
      const isFree = r.item && !options.includes(r.item);
      return <div key={i} className="flex flex-wrap items-center gap-1.5 bg-[#0B0F19] border border-[#1E293B] rounded-lg p-2">
        <select value={isFree ? '__other__' : r.item} onChange={e=>{ const n=[...rows]; n[i]={...n[i], item: e.target.value==='__other__'?'':e.target.value}; update(n); }} className={cls}>
          <option value="">— اختر —</option>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
          {allowFree && <option value="__other__">أخرى…</option>}
        </select>
        {allowFree && isFree && <input type="text" value={r.item} onChange={e=>{ const n=[...rows]; n[i]={...n[i], item: e.target.value.slice(0,200)}; update(n); }} placeholder="اسم المادة" className={cls} />}
        <input type="number" min={1} max={999999} value={r.qty} onChange={e=>{ const n=[...rows]; n[i]={...n[i], qty: Math.max(1, Math.min(999999, Number(e.target.value)||1))}; update(n); }} className="w-20 bg-[#1E293B] border border-[#263244] rounded-lg px-2 py-2.5 text-sm text-center" />
        {rows.length > 1 && <button onClick={()=>update(rows.filter((_,idx)=>idx!==i))} className="p-2 rounded bg-red-500/10 text-red-300"><X className="w-4 h-4" /></button>}
      </div>;
    })}
    <button onClick={()=> rows.length<50 && onChange([...rows.filter((r:any)=>r.item), {item:'',qty:1}])} disabled={rows.length>=50}
      className="w-full p-2 bg-[#1E293B] border border-dashed border-[#263244] rounded-lg text-amber-400 text-xs font-bold disabled:opacity-40">
      <Plus className="w-4 h-4 inline ml-1" /> إضافة مادة {rows.length>0 && `(${rows.length}/50)`}
    </button>
  </div>;
}

function PreviousReportsPanel({ currentUserRole, currentUserOfficeId }:{ currentUserRole:string; currentUserOfficeId:string }) {
  const { state } = useOps();
  const { officeById } = useOffices();
  const all = useMemo(()=>{
    const merged=[...state.todayReports, ...state.historicalReports];
    const scoped = currentUserRole==='manager' ? merged.filter(r=>r.officeId===currentUserOfficeId) : merged;
    return scoped.sort((a,b)=> new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0,20);
  }, [state.todayReports, state.historicalReports, currentUserRole, currentUserOfficeId]);
  const [open, setOpen] = useState<string|null>(null);
  return <div className="mt-4 bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
    <div className="p-4 border-b border-[#1E293B] flex items-center gap-2">
      <History className="w-4 h-4 text-blue-300" />
      <div className="font-bold text-sm">التقارير السابقة</div>
      <div className="text-[10px] text-slate-500 mr-auto">آخر {all.length}</div>
    </div>
    {!all.length ? <div className="p-6 text-center text-xs text-slate-500">لا توجد تقارير</div> :
    <ul className="divide-y divide-[#1E293B] max-h-[420px] overflow-y-auto">
      {all.map(r=>{
        const isOpen = open===r.id;
        return <li key={r.id} className="p-3 hover:bg-[#1E293B]/30">
          <button onClick={()=>setOpen(isOpen?null:r.id)} className="w-full text-right flex items-center gap-3">
            <div className="flex-1 min-w-0"><div className="font-bold text-sm">{officeById(r.officeId)?.nameAr || r.officeId}</div>
              <div className="text-[10px] text-slate-500">{r.reportDate}</div></div>
            <div className="text-[11px] text-slate-300 font-mono">{new Date(r.submittedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen?'rotate-180':''}`} />
          </button>
          {isOpen && <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">{[
            ['زوار داخل', r.visitorsIn], ['زوار خارج', r.visitorsOut],
            ['عجلات', r.vehiclesCount], ['مواكب', r.processionsCount],
            ['حوادث', r.incidentsCount], ['وفيات', r.deathsCount],
          ].map(([l,v])=> <div key={l as string} className="bg-[#0B0F19] border border-[#1E293B] rounded px-2 py-1 flex justify-between"><span className="text-slate-500">{l}</span><b>{v as number}</b></div>)}
          </div>}
        </li>;
      })}
    </ul>}
  </div>;
}
