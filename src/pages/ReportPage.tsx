import { useState, useEffect, useRef, useMemo } from 'react';
import { useOps } from '../store/opsStore';
import { officeById } from '../data/offices';
import { MapPin, ChevronDown, Send, MapPinned, X, AlertTriangle, Lock, Timer, Check, Crosshair, Info, Route as RouteIcon, History, User as UserIcon, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import TimeLockBar from '../components/TimeLockBar';
import MapPicker from '../components/MapPicker';
import type { ReportFieldDefinition, ReportFieldGroup } from '../data/types';

type Pt = { lat: number; lng: number };

// Built-in field-keys whose value is a geo location/route.
const LOC_EVENTS = 'eventsLocation';        // → eventsCoordinates: [Pt]
const ROUTE_PROC = 'processionRoute';       // → processionWaypoints: Pt[]

// ─── Page ────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { state, actions } = useOps();
  const user = state.currentUser;
  if (!user) return <div className="h-full flex items-center justify-center text-slate-500">جاري التحميل...</div>;
  const office = officeById(user.officeId);
  if (!office) return <div className="h-full flex items-center justify-center text-red-400">المكتب غير موجود</div>;

  // ─── Dynamic field plan (filtered by hidden + allowedUserIds) ──────
  const plan = useMemo(() => buildPlan(state.fieldGroups, state.fieldDefinitions, user.id), [state.fieldGroups, state.fieldDefinitions, user.id]);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  // Expand the first available group by default the first time the plan loads
  useEffect(() => {
    if (plan.length > 0 && expandedCards.size === 0) {
      setExpandedCards(new Set([plan[0].group.id]));
    }
  }, [plan]); // eslint-disable-line

  const [form, setForm] = useState<Record<string, any>>({});
  const [locations, setLocations] = useState<Record<string, Pt | null>>({});
  const [routes, setRoutes] = useState<Record<string, Pt[]>>({});
  const [picker, setPicker] = useState<{ fieldKey: string; mode: 'single' | 'multi' | 'route'; label: string } | null>(null);

  const [showExtension, setShowExtension] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');
  const [mgrs, setMgrs] = useState('');
  const [reporterLat, setReporterLat] = useState<number | null>(null);
  const [reporterLng, setReporterLng] = useState<number | null>(null);

  const reportExists = state.todayReports.find(r => r.officeId === user.officeId);
  const extensionActive = state.extensions.find(e => e.officeId === user.officeId && e.status === 'approved');
  const status = state.timeWindowStatus;
  const canSubmit = status === 'open' || status === 'pre_warning' || (extensionActive !== undefined);

  // ─── Live GPS for agents (unchanged) ───────────────────────────────
  const watchIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (user.role === 'agent' && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setReporterLat(pos.coords.latitude);
          setReporterLng(pos.coords.longitude);
          actions.updateAgentLocation({
            agentId: user.id, agentName: user.fullNameAr, officeId: user.officeId,
            lat: pos.coords.latitude, lng: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy, updatedAt: new Date().toISOString(),
          }).catch(() => {});
        },
        null,
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
      );
    }
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [user.id, user.role]);

  const updateField = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  // Count completed (any non-empty entry, including selected location/route)
  const isFieldFilled = (f: ReportFieldDefinition) => {
    if (f.fieldType === 'location') return !!locations[f.fieldKey];
    if (f.fieldType === 'multi_location' || f.fieldType === 'route') return (routes[f.fieldKey]?.length ?? 0) > 0;
    const v = form[f.fieldKey];
    return v !== undefined && v !== null && v !== '';
  };

  const totalFields = plan.reduce((acc, g) => acc + g.fields.length, 0);
  const filledFields = plan.reduce((acc, g) => acc + g.fields.filter(isFieldFilled).length, 0);
  const completionPct = totalFields === 0 ? 0 : Math.round((filledFields / totalFields) * 100);

  // ─── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit && !extensionActive) { setShowExtension(true); return; }
    if (!office) return;
    if (!mgrs && (reporterLat == null || reporterLng == null)) {
      toast.error('الرجاء تحديد موقعك قبل إرسال التقرير');
      return;
    }
    // numeric validation for any visible numeric field (built-in or extra)
    for (const grp of plan) {
      for (const f of grp.fields) {
        if (f.fieldType === 'number') {
          const v = form[f.fieldKey];
          if (v !== undefined && v !== '' && (isNaN(Number(v)) || Number(v) < 0)) {
            toast.error(`قيمة غير صالحة في حقل: ${f.labelAr}`);
            return;
          }
        }
      }
    }

    // Build extra_fields jsonb bag from non-built-in fields
    const extraFields: Record<string, any> = {};
    for (const grp of plan) {
      for (const f of grp.fields) {
        if (f.isBuiltIn) continue;
        if (f.fieldType === 'location') {
          if (locations[f.fieldKey]) extraFields[f.fieldKey] = locations[f.fieldKey];
        } else if (f.fieldType === 'multi_location' || f.fieldType === 'route') {
          if ((routes[f.fieldKey]?.length ?? 0) > 0) extraFields[f.fieldKey] = routes[f.fieldKey];
        } else if (f.fieldType === 'number') {
          const v = form[f.fieldKey];
          if (v !== undefined && v !== '') extraFields[f.fieldKey] = Number(v) || 0;
        } else if (f.fieldType === 'select' && f.withQuantity) {
          const arr = Array.isArray(form[f.fieldKey]) ? form[f.fieldKey] : [];
          const clean = arr.filter((r: any) => r && String(r.item).trim() !== '' && Number(r.qty) > 0)
            .map((r: any) => ({ item: String(r.item).trim(), qty: Number(r.qty) }));
          if (clean.length > 0) extraFields[f.fieldKey] = clean;
        } else {
          if (form[f.fieldKey] !== undefined && form[f.fieldKey] !== '') {
            extraFields[f.fieldKey] = form[f.fieldKey];
          }
        }
      }
    }

    const num = (k: string) => Number(form[k] || 0);
    const str = (k: string) => form[k] ?? '';

    const t = toast.loading('جاري إرسال التقرير...');
    try {
      await actions.submitReport({
        id: `r-new-${Date.now()}`,
        officeId: office.id,
        submittedBy: user.id,
        reportDate: new Date().toISOString().slice(0, 10),
        submittedAt: new Date().toISOString(),
        isLateSubmission: status === 'pre_warning' || status === 'locked',
        deploymentCount: num('deploymentCount'),
        deploymentLocations: str('deploymentLocations'),
        deploymentFormations: str('deploymentFormations'),
        coordinationSectors: str('coordinationSectors'),
        coordinationJointOps: str('coordinationJointOps'),
        incidentsCount: num('incidentsCount'),
        incidentsDetails: str('incidentsDetails'),
        violationsCount: num('violationsCount'),
        violationsArea: str('violationsArea'),
        violationsTimeDetail: str('violationsTimeDetail'),
        violationsDetails: str('violationsDetails'),
        deathsCount: num('deathsCount'),
        deathsLocationMgrs: str('deathsLocationMgrs'),
        deathsActionTaken: str('deathsActionTaken'),
        resourcesDistributed: num('resourcesDistributed'),
        resourcesDetails: str('resourcesDetails'),
        eventsCount: num('eventsCount'),
        eventsDetails: str('eventsDetails'),
        eventsCoordinates: locations[LOC_EVENTS] ? [locations[LOC_EVENTS] as Pt] : [],
        visitsCount: num('visitsCount'),
        visitsSummary: str('visitsSummary'),
        visitorsIn: num('visitorsIn'),
        visitorsOut: num('visitorsOut'),
        visitorsRoutes: str('visitorsRoutes'),
        vehiclesCount: num('vehiclesCount'),
        vehiclesDetails: str('vehiclesDetails'),
        processionsCount: num('processionsCount'),
        processionsDetails: str('processionsDetails'),
        processionWaypoints: routes[ROUTE_PROC] ?? [],
        otherNotes: str('otherNotes'),
        reporterLat: reporterLat ?? undefined,
        reporterLng: reporterLng ?? undefined,
        mgrsReference: mgrs,
        extraFields,
      });
      toast.success('✅ تم إرسال التقرير بنجاح', { id: t, description: 'تم إخطار المشرف والمدير' });
      setForm({}); setLocations({}); setRoutes({});
    } catch (e: any) {
      toast.error(e?.message || 'فشل إرسال التقرير', { id: t });
    }
  };

  const submitExtension = async () => {
    if (!office) return;
    if (!extensionReason.trim()) { toast.error('الرجاء كتابة سبب طلب التمديد'); return; }
    const t = toast.loading('جاري رفع الطلب...');
    try {
      await actions.submitExtension({
        id: `ex-${Date.now()}`,
        requestedById: user.id, requestedByName: user.fullNameAr,
        officeId: office.id, requestTime: new Date().toISOString(),
        reason: extensionReason, status: 'pending' as const,
      });
      toast.success('تم رفع طلب التمديد إلى مدير المكتب', { id: t });
      setShowExtension(false); setExtensionReason('');
    } catch (e: any) {
      toast.error(e?.message || 'فشل رفع الطلب', { id: t });
    }
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-[#0B0F19]">
      <div className="lg:hidden p-3 bg-[#111827] border-b border-[#1E293B]">
        <TimeLockBar />
      </div>

      <div className="max-w-3xl mx-auto p-3 md:p-4">
        {/* Header card */}
        <div className="bg-gradient-to-l from-[#111827] to-[#0B0F19] border border-[#1E293B] rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Send className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-display font-black text-amber-400 truncate">التقرير اليومي الميداني</div>
              <div className="text-xs text-slate-400 truncate">{office?.nameAr} — {office?.governorateAr} • {new Date().toLocaleDateString('ar-IQ')}</div>
            </div>
            <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
              status === 'open' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              status === 'pre_warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse-alert' :
              'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}>
              {status === 'open' ? 'مفتوحة' : status === 'pre_warning' ? 'تحذير' : 'مغلقة'}
            </div>
          </div>

          {/* Live completion bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1 text-[10px] text-slate-500">
              <span>اكتمال التقرير: <span className="text-amber-300 font-bold">{filledFields}/{totalFields}</span></span>
              <span className="font-mono">{completionPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#1E293B] overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-amber-500 to-amber-300 transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          {reportExists && (
            <div className="mt-3 p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-3.5 h-3.5" /> تم إرسال تقرير اليوم — {new Date(reportExists.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* Form groups */}
        {plan.length === 0 ? (
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-8 text-center text-sm text-slate-500">
            لا توجد حقول مفعّلة لك حالياً. تواصل مع المشرف لتخصيص الحقول.
          </div>
        ) : (
          <div className="space-y-3">
            {plan.map(({ group, fields }) => {
              const expanded = expandedCards.has(group.id);
              const filledHere = fields.filter(isFieldFilled).length;
              const allDone = filledHere === fields.length && fields.length > 0;
              return (
                <div key={group.id} className="bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
                  <button
                    onClick={() => {
                      const next = new Set(expandedCards);
                      if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                      setExpandedCards(next);
                    }}
                    className="w-full p-4 flex items-center gap-3 hover:bg-[#1E293B]/40 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-display font-black text-sm shrink-0">
                      {String(group.sortOrder).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="font-bold text-sm">{group.titleAr}</div>
                      <div className="text-[10px] text-slate-500">{filledHere}/{fields.length} حقول</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${allDone ? 'bg-emerald-500/20 text-emerald-400' : filledHere > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50'}`}>
                      {allDone ? <Check className="w-3 h-3" /> : <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && (
                    <div className="p-4 pt-0 space-y-3 animate-fade-in-up">
                      {fields.map(field => (
                        <DynamicFieldRenderer
                          key={field.id}
                          field={field}
                          value={form[field.fieldKey]}
                          onChange={(v: any) => updateField(field.fieldKey, v)}
                          location={locations[field.fieldKey] ?? null}
                          route={routes[field.fieldKey] ?? []}
                          onOpenPicker={(mode, label) => setPicker({ fieldKey: field.fieldKey, mode, label })}
                          onRemoveRoutePoint={(i: number) =>
                            setRoutes(r => ({ ...r, [field.fieldKey]: (r[field.fieldKey] || []).filter((_, idx) => idx !== i) }))
                          }
                          onClearLocation={() => setLocations(l => ({ ...l, [field.fieldKey]: null }))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Submit area */}
        <div className="mt-4 bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
          <div className="text-xs text-slate-400 font-bold mb-1">بيانات الموقع</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (p) => { setReporterLat(p.coords.latitude); setReporterLng(p.coords.longitude); toast.success('تم تحديد موقعك'); },
                    () => toast.error('فشل تحديد الموقع')
                  );
                }
              }}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-sm font-bold hover:bg-blue-500/25 transition-colors"
            >
              <Crosshair className="w-4 h-4" /> تحديد الموقع تلقائياً
            </button>
            <input
              placeholder="MGRS (اختياري)"
              value={mgrs}
              onChange={e => setMgrs(e.target.value)}
              className="bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500/40 focus:outline-none"
            />
          </div>
          {(reporterLat != null && reporterLng != null) && (
            <div className="text-[10px] text-slate-500 bg-[#0B0F19] border border-[#1E293B] rounded p-2">
              📍 {reporterLat.toFixed(5)}, {reporterLng.toFixed(5)}
            </div>
          )}

          <div className="text-[10px] text-slate-500">
            التوقيت العسكري: <span className="text-slate-300 font-mono">{state.serverTime.toLocaleTimeString('en-GB', { hour12: false })} بتوقيت السيرفر</span>
          </div>

          {extensionActive && (
            <div className="p-2.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-2">
              <Timer className="w-3.5 h-3.5" /> تمديد نشط — يمكنك الإرسال الآن
            </div>
          )}

          {status === 'pre_warning' && canSubmit && (
            <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2 animate-pulse-alert">
              <AlertTriangle className="w-3.5 h-3.5" /> تحذير — متبقي وقت محدود على إغلاق نافذة التقرير
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={status === 'locked' && !extensionActive}
            className={`w-full py-3.5 rounded-lg font-display font-black text-base transition-all ${
              status === 'locked' && !extensionActive
                ? 'bg-red-600/80 hover:bg-red-500 text-white'
                : extensionActive
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30'
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/30'
            }`}
          >
            {status === 'locked' && !extensionActive ? (
              <span className="flex items-center justify-center gap-2"><Lock className="w-4 h-4" /> انتهى وقت الإرسال — طلب تمديد</span>
            ) : extensionActive ? (
              <span className="flex items-center justify-center gap-2"><Timer className="w-4 h-4" /> إرسال التقرير (تمديد نشط)</span>
            ) : (
              <span className="flex items-center justify-center gap-2"><Send className="w-4 h-4" /> إرسال التقرير اليومي</span>
            )}
          </button>
        </div>

        {/* Past reports — visible only to office manager / supervisor / director */}
        {user.role !== 'agent' && (
          <PreviousReportsPanel currentUserRole={user.role} currentUserOfficeId={user.officeId} />
        )}
      </div>

      {/* Real Leaflet map picker */}
      {picker && (
        <MapPicker
          mode={picker.mode}
          title={picker.label}
          subtitle={
            picker.mode === 'single' ? 'انقر على الخريطة لتحديد موقع واحد' :
            picker.mode === 'route'  ? 'انقر لإضافة نقاط للمسار (سيتم رسم الخط بين النقاط)' :
                                       'انقر لإضافة عدة نقاط'
          }
          initialSingle={locations[picker.fieldKey] ?? null}
          initialMulti={routes[picker.fieldKey] ?? []}
          userLocation={reporterLat != null && reporterLng != null ? { lat: reporterLat, lng: reporterLng } : null}
          focusPoint={office ? { lat: office.lat, lng: office.lng } : null}
          onCancel={() => setPicker(null)}
          onConfirmSingle={(p) => {
            setLocations(l => ({ ...l, [picker.fieldKey]: p }));
            setPicker(null);
            toast.success('تم تحديد الموقع على الخريطة');
          }}
          onConfirmMulti={(pts) => {
            setRoutes(r => ({ ...r, [picker.fieldKey]: pts }));
            setPicker(null);
            toast.success(`تم تثبيت ${pts.length} نقاط`);
          }}
        />
      )}

      {/* Extension sheet */}
      {showExtension && (
        <div className="fixed inset-0 z-[600] bg-black/60 flex items-end justify-center animate-fade-in-up" onClick={() => setShowExtension(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#0B0F19] border-t-2 border-red-500/50 rounded-t-2xl p-5 shadow-2xl animate-slide-up">
            <div className="w-12 h-1 bg-slate-600 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-red-400" />
              <div className="text-lg font-display font-black text-red-300">انتهى وقت إرسال التقرير</div>
            </div>
            <div className="text-sm text-slate-400 mb-4">الوقت المحدد لإرسال التقرير قد انتهى. يمكنك رفع طلب تمديد لمدير مكتبك للموافقة عليه.</div>
            <textarea
              value={extensionReason}
              onChange={e => setExtensionReason(e.target.value)}
              placeholder="سبب طلب التمديد (اختياري)..."
              className="w-full bg-[#1E293B] border border-[#263244] rounded-lg p-3 text-sm text-white placeholder-slate-500 mb-3 min-h-20"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowExtension(false)} className="flex-1 py-2.5 rounded-lg bg-[#1E293B] hover:bg-[#263244] text-slate-300 text-sm font-bold">إلغاء</button>
              <button onClick={submitExtension} className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-display font-black">رفع طلب التمديد ←</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Plan builder ────────────────────────────────────────────────────
function buildPlan(groups: ReportFieldGroup[], defs: ReportFieldDefinition[], userId: string) {
  const visibleDefs = defs.filter(f =>
    !f.isHidden &&
    (f.allowedUserIds.length === 0 || f.allowedUserIds.includes(userId))
  );
  return groups
    .filter(g => !g.isHidden)
    .map(g => ({
      group: g,
      fields: visibleDefs.filter(f => f.groupId === g.id).sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter(x => x.fields.length > 0)
    .sort((a, b) => a.group.sortOrder - b.group.sortOrder);
}

// ─── Field renderer ──────────────────────────────────────────────────
function DynamicFieldRenderer({
  field, value, onChange, location, route,
  onOpenPicker, onRemoveRoutePoint, onClearLocation,
}: {
  field: ReportFieldDefinition;
  value: any;
  onChange: (v: any) => void;
  location: Pt | null;
  route: Pt[];
  onOpenPicker: (mode: 'single' | 'multi' | 'route', label: string) => void;
  onRemoveRoutePoint: (i: number) => void;
  onClearLocation: () => void;
}) {
  const helper = field.descriptionAr ? (
    <div className="text-[10px] text-slate-500 mt-1 flex items-start gap-1">
      <Info className="w-3 h-3 mt-0.5 shrink-0 text-slate-600" />
      <span>{field.descriptionAr}</span>
    </div>
  ) : null;

  const Label = (
    <label className="text-xs text-slate-300 mb-1.5 block font-semibold flex items-center justify-between">
      <span>{field.labelAr}</span>
      {field.maxLength ? <span className="text-[10px] text-slate-500">{(value?.length || 0)}/{field.maxLength}</span> : null}
    </label>
  );

  if (field.fieldType === 'number') {
    return (
      <div>
        {Label}
        <input
          type="text" inputMode="numeric" pattern="[0-9]*"
          value={value ?? ''}
          onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder={field.placeholderAr ?? ''}
          className="w-full bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
        />
        {helper}
      </div>
    );
  }
  if (field.fieldType === 'textarea') {
    return (
      <div>
        {Label}
        <textarea
          value={value ?? ''}
          onChange={e => onChange(e.target.value.slice(0, field.maxLength || 10000))}
          maxLength={field.maxLength ?? undefined}
          placeholder={field.placeholderAr ?? ''}
          className="w-full bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 min-h-20 resize-none"
        />
        {helper}
      </div>
    );
  }
  if (field.fieldType === 'text') {
    return (
      <div>
        {Label}
        <input
          type="text"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholderAr ?? ''}
          className="w-full bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
        />
        {helper}
      </div>
    );
  }
  if (field.fieldType === 'date') {
    return (
      <div>
        {Label}
        <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)}
          className="w-full bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/40 focus:outline-none" />
        {helper}
      </div>
    );
  }
  if (field.fieldType === 'time') {
    return (
      <div>
        {Label}
        <input type="time" value={value ?? ''} onChange={e => onChange(e.target.value)}
          className="w-full bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/40 focus:outline-none" />
        {helper}
      </div>
    );
  }
  if (field.fieldType === 'select') {
    return (
      <div>
        {Label}
        <SelectFieldInput field={field} value={value} onChange={onChange} />
        {helper}
      </div>
    );
  }
  if (field.fieldType === 'location') {
    return (
      <div>
        {Label}
        {location ? (
          <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span className="flex-1 text-emerald-200 font-mono">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
            <button onClick={() => onOpenPicker('single', field.labelAr)} className="text-emerald-400 hover:text-emerald-300 text-[11px] font-bold">تعديل</button>
            <button onClick={onClearLocation} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => onOpenPicker('single', field.labelAr)} className="w-full flex items-center justify-center gap-2 p-2.5 bg-[#1E293B] border border-dashed border-[#263244] rounded-lg text-slate-400 hover:border-amber-500/30 hover:text-amber-400 text-xs">
            <MapPinned className="w-4 h-4" /> اضغط لفتح الخريطة وتحديد الموقع
          </button>
        )}
        {helper}
      </div>
    );
  }
  if (field.fieldType === 'multi_location' || field.fieldType === 'route') {
    const isRoute = field.fieldType === 'route';
    return (
      <div>
        {Label}
        <div className="space-y-1.5">
          {route.map((wp, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-[#1E293B] border border-[#263244] rounded-lg text-xs">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</div>
              <span className="flex-1 text-slate-300 font-mono">{wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}</span>
              <button onClick={() => onRemoveRoutePoint(i)} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button
            onClick={() => onOpenPicker(isRoute ? 'route' : 'multi', field.labelAr)}
            className="w-full flex items-center justify-center gap-2 p-2 bg-[#1E293B] border border-dashed border-[#263244] rounded-lg text-slate-400 hover:border-amber-500/30 hover:text-amber-400 text-xs"
          >
            {isRoute ? <RouteIcon className="w-4 h-4" /> : <MapPinned className="w-4 h-4" />}
            {route.length > 0 ? 'تعديل النقاط على الخريطة' : (isRoute ? 'فتح الخريطة ورسم المسار' : 'فتح الخريطة وإضافة نقاط')}
          </button>
        </div>
        {helper}
      </div>
    );
  }
  return null;
}

// ─── Dropdown (select) field with optional quantity + multi-item ─────
const OTHER = '__other__';
type QtyItem = { item: string; qty: number };

function SelectFieldInput({ field, value, onChange }: {
  field: ReportFieldDefinition;
  value: any;
  onChange: (v: any) => void;
}) {
  const options: string[] = field.options ?? [];
  const allowFree = field.allowFreeText;
  const selCls = 'flex-1 bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/40 focus:outline-none';

  // ── Single select (no quantity) ──
  if (!field.withQuantity) {
    const v: string = typeof value === 'string' ? value : '';
    const isFree = v !== '' && !options.includes(v);
    const dropdownVal = isFree ? OTHER : v;
    return (
      <div className="space-y-1.5">
        <select
          value={dropdownVal}
          onChange={e => onChange(e.target.value === OTHER ? '' : e.target.value)}
          className={selCls + ' w-full'}
        >
          <option value="">— اختر —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
          {allowFree && <option value={OTHER}>أخرى (كتابة مباشرة)</option>}
        </select>
        {allowFree && dropdownVal === OTHER && (
          <input
            type="text"
            value={v}
            onChange={e => onChange(e.target.value)}
            placeholder="اكتب القيمة هنا…"
            className={selCls + ' w-full'}
          />
        )}
      </div>
    );
  }

  // ── With quantity → repeatable list of {item, qty} ──
  const list: QtyItem[] = Array.isArray(value) ? value : [];
  const rows = list.length > 0 ? list : [{ item: '', qty: 1 }];
  const update = (next: QtyItem[]) => onChange(next.filter(r => r.item !== '' && r.qty > 0));
  const setRow = (i: number, patch: Partial<QtyItem>) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    update(next);
  };
  const addRow = () => onChange([...rows.filter(r => r.item !== ''), { item: '', qty: 1 }]);
  const removeRow = (i: number) => update(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const isFree = r.item !== '' && !options.includes(r.item);
        const dv = isFree ? OTHER : r.item;
        return (
          <div key={i} className="flex flex-wrap items-center gap-1.5 bg-[#0B0F19] border border-[#1E293B] rounded-lg p-2">
            <select
              value={dv}
              onChange={e => setRow(i, { item: e.target.value === OTHER ? ' ' : e.target.value })}
              className={selCls}
            >
              <option value="">— اختر مادة —</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
              {allowFree && <option value={OTHER}>أخرى…</option>}
            </select>
            {allowFree && dv === OTHER && (
              <input
                type="text"
                value={r.item.trim()}
                onChange={e => setRow(i, { item: e.target.value })}
                placeholder="اسم المادة"
                className={selCls}
              />
            )}
            <input
              type="number" min={1}
              value={r.qty}
              onChange={e => setRow(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
              className="w-20 bg-[#1E293B] border border-[#263244] rounded-lg px-2 py-2.5 text-sm text-white text-center focus:border-amber-500/40 focus:outline-none"
              title="الكمية"
            />
            {rows.length > 1 && (
              <button onClick={() => removeRow(i)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
      <button
        onClick={addRow}
        className="w-full flex items-center justify-center gap-2 p-2 bg-[#1E293B] border border-dashed border-[#263244] rounded-lg text-amber-400 hover:border-amber-500/40 text-xs font-bold"
      >
        <Plus className="w-4 h-4" /> إضافة مادة أخرى
      </button>
    </div>
  );
}


// ─── Previous-reports panel (manager/supervisor/director only) ──────
function PreviousReportsPanel({ currentUserRole, currentUserOfficeId }: { currentUserRole: string; currentUserOfficeId: string }) {
  const { state } = useOps();
  const all = useMemo(() => {
    const merged = [...state.todayReports, ...state.historicalReports];
    // Office managers only see their own office; supervisors+directors see all
    const scoped = currentUserRole === 'manager'
      ? merged.filter(r => r.officeId === currentUserOfficeId)
      : merged;
    return scoped
      .slice()
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 20);
  }, [state.todayReports, state.historicalReports, currentUserRole, currentUserOfficeId]);

  const [open, setOpen] = useState<string | null>(null);
  const userById = (id: string) => state.users.find(u => u.id === id);

  return (
    <div className="mt-4 bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#1E293B] flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-300">
          <History className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="font-display font-black text-sm">التقارير السابقة</div>
          <div className="text-[10px] text-slate-500">آخر {all.length} تقرير — يظهر فقط للمدير العام والمشرف ومدير المكتب</div>
        </div>
      </div>
      {all.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">لا توجد تقارير سابقة بعد</div>
      ) : (
        <ul className="divide-y divide-[#1E293B] max-h-[420px] overflow-y-auto">
          {all.map(r => {
            const submitter = userById(r.submittedBy);
            const office = officeById(r.officeId);
            const isOpen = open === r.id;
            const t = new Date(r.submittedAt);
            return (
              <li key={r.id} className="p-3 hover:bg-[#1E293B]/30 transition-colors">
                <button onClick={() => setOpen(isOpen ? null : r.id)} className="w-full text-right flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{submitter?.fullNameAr || r.submittedBy}</div>
                    <div className="text-[10px] text-slate-500 truncate">{office?.nameAr || r.officeId} • {r.reportDate}</div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-[11px] text-slate-300 font-mono flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {r.reporterLat != null && r.reporterLng != null && (
                      <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 justify-end mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {r.reporterLat.toFixed(3)}, {r.reporterLng.toFixed(3)}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="mt-3 pl-12 grid grid-cols-2 gap-2 text-[11px] animate-fade-in-up">
                    <Stat label="انتشار" v={r.deploymentCount} />
                    <Stat label="حوادث" v={r.incidentsCount} />
                    <Stat label="مخالفات" v={r.violationsCount} />
                    <Stat label="وفيات" v={r.deathsCount} />
                    <Stat label="زوار داخل" v={r.visitorsIn} />
                    <Stat label="زوار خارج" v={r.visitorsOut} />
                    <Stat label="عجلات" v={r.vehiclesCount} />
                    <Stat label="مواكب" v={r.processionsCount} />
                    {r.isLateSubmission && (
                      <div className="col-span-2 mt-1 p-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> إرسال متأخر
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="bg-[#0B0F19] border border-[#1E293B] rounded px-2 py-1 flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-bold text-slate-200">{v ?? 0}</span>
    </div>
  );
}