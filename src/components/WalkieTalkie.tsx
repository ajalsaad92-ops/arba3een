import { useState, useMemo } from 'react';
import { useOps } from '../store/opsStore';
import { useWalkie, ROLE_LABELS, type Target } from '../store/walkieStore';
import { Radio, Mic, Users, ChevronDown, Volume2, Wifi, WifiOff, Loader2, Headphones, HeadphoneOff } from 'lucide-react';
import type { Role } from '../data/types';

export default function WalkieTalkie() {
  const { state } = useOps();
  const me = state.currentUser;
  const {
    connected, transmitting, incoming,
    target, setTarget,
    bgEnabled, toggleBackground,
    directorListening, setDirectorListening,
    isDirector,
    startTalking, stopTalking,
  } = useWalkie();

  const [pickerOpen, setPickerOpen] = useState(false);

  const targetLabel = (() => {
    if (target.mode === 'all') return 'الجميع المتصلون';
    if (target.mode === 'role') return ROLE_LABELS[target.value as Role] ?? 'مجموعة';
    const u = state.users.find((x) => x.id === target.value);
    return u ? u.fullNameAr : 'شخص محدد';
  })();

  // Everyone who can be called (the director can never be a recipient).
  const callableUsers = useMemo(
    () => state.users.filter((u) => u.id !== me?.id && u.role !== 'director'),
    [state.users, me?.id],
  );
  const callableRoles = (Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== 'director');

  // How many people will actually hear this call, broken down by category.
  const recipients = useMemo(() => {
    let list = callableUsers;
    if (target.mode === 'role') list = callableUsers.filter((u) => u.role === target.value);
    else if (target.mode === 'user') list = callableUsers.filter((u) => u.id === target.value);
    const count = (r: Role) => list.filter((u) => u.role === r).length;
    return {
      supervisor: count('supervisor'),
      manager: count('manager'),
      agent: count('agent'),
      other: list.filter((u) => !['supervisor', 'manager', 'agent'].includes(u.role)).length,
      total: list.length,
    };
  }, [callableUsers, target]);

  const pick = (t: Target) => { setTarget(t); setPickerOpen(false); };

  return (
    <div className="bg-gradient-to-br from-indigo-950/40 to-[#0B0F19] border-2 border-indigo-500/30 rounded-2xl p-5 md:p-6 mt-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
          <Radio className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="text-lg font-display font-black text-indigo-200">اتصال صوتي مباشر (لاسلكي)</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            {connected
              ? <><Wifi className="w-3 h-3 text-emerald-400" /> متصل بالقناة</>
              : <><WifiOff className="w-3 h-3 text-slate-500" /> جاري الاتصال...</>}
          </div>
        </div>
      </div>

      {/* Recipient picker */}
      <div className="relative mb-4">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 bg-[#1E293B] border border-[#263244] rounded-lg px-3 py-3 text-sm text-white hover:border-indigo-500/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-300" />
            <span className="text-slate-300">المستلِم:</span>
            <span className="font-bold">{targetLabel}</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
        </button>

        {pickerOpen && (
          <div className="absolute z-20 mt-1 w-full bg-[#111827] border border-[#1E293B] rounded-lg shadow-2xl max-h-72 overflow-y-auto p-1 animate-fade-in-up">
            <button
              onClick={() => pick({ mode: 'all' })}
              className="w-full text-right px-3 py-2 rounded-md text-sm text-slate-200 hover:bg-indigo-500/15"
            >
              📢 الجميع المتصلون
            </button>
            <div className="px-3 pt-2 pb-1 text-[10px] text-slate-500 font-bold">حسب الصلاحية</div>
            {callableRoles.map((r) => (
              <button
                key={r}
                onClick={() => pick({ mode: 'role', value: r })}
                className="w-full text-right px-3 py-2 rounded-md text-sm text-slate-200 hover:bg-indigo-500/15"
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
            <div className="px-3 pt-2 pb-1 text-[10px] text-slate-500 font-bold">شخص محدد</div>
            {callableUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => pick({ mode: 'user', value: u.id })}
                className="w-full text-right px-3 py-2 rounded-md text-sm text-slate-200 hover:bg-indigo-500/15 flex items-center justify-between"
              >
                <span>{u.fullNameAr}</span>
                <span className="text-[10px] text-slate-500">{ROLE_LABELS[u.role]}</span>
              </button>
            ))}
            {callableUsers.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500">لا يوجد مستخدمون آخرون</div>
            )}
          </div>
        )}
      </div>

      {/* Who will hear this call (recipient breakdown) */}
      <div className="mb-4 rounded-lg bg-[#0B0F19] border border-[#1E293B] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-slate-400 font-bold">عدد من سيسمع النداء</span>
          <span className="text-xs font-black text-indigo-300">{recipients.total} شخص</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'مشرفون', value: recipients.supervisor },
            { label: 'مدراء مكاتب', value: recipients.manager },
            { label: 'مدخلو البيانات', value: recipients.agent },
            { label: 'غيرهم', value: recipients.other },
          ].map((c) => (
            <div key={c.label} className="rounded-md bg-[#111827] border border-[#1E293B] px-2 py-1.5 text-center">
              <div className="text-base font-black text-slate-100">{c.value}</div>
              <div className="text-[10px] text-slate-500">{c.label}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          لا يمكن توجيه النداء للمدير العام؛ المدير العام يستمع فقط عند تفعيل زر الاستماع لديه.
        </p>
      </div>

      {/* Director-only listen toggle */}
      {isDirector && (
        <button
          type="button"
          onClick={() => setDirectorListening(!directorListening)}
          className={`w-full mb-3 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 border ${
            directorListening
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-[#1E293B] border-[#263244] text-slate-400 hover:text-slate-200'
          }`}
        >
          {directorListening ? <Headphones className="w-4 h-4" /> : <HeadphoneOff className="w-4 h-4" />}
          {directorListening ? 'الاستماع مُفعّل — تسمع كل النداءات' : 'تفعيل الاستماع لكل النداءات'}
        </button>
      )}

      {/* Incoming indicator */}
      {incoming && (
        <div className="mb-3 flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 animate-fade-in-up">
          <Volume2 className="w-4 h-4 animate-pulse" />
          <span>يتحدث الآن: <b>{incoming}</b></span>
        </div>
      )}

      {/* Push to talk */}
      <button
        type="button"
        disabled={!connected}
        onMouseDown={startTalking}
        onMouseUp={stopTalking}
        onMouseLeave={stopTalking}
        onTouchStart={(e) => { e.preventDefault(); startTalking(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopTalking(); }}
        className={`w-full py-6 rounded-2xl font-display font-black text-base transition-all flex flex-col items-center justify-center gap-2 select-none touch-none disabled:opacity-40 ${
          transmitting
            ? 'bg-gradient-to-l from-red-600 to-red-700 text-white shadow-xl shadow-red-500/40 scale-[0.98] animate-pulse-alert'
            : 'bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-xl shadow-indigo-500/30'
        }`}
      >
        <Mic className={`w-8 h-8 ${transmitting ? 'animate-pulse' : ''}`} />
        {transmitting ? 'جارٍ الإرسال... اترك للإيقاف' : 'اضغط مع الاستمرار للتحدث'}
      </button>
      <p className="text-center text-[10px] text-slate-500 mt-2">
        يصل الصوت مباشرة لكل من تختاره ممن لديه التطبيق مفتوحاً
      </p>

      {/* Background mode */}
      <button
        type="button"
        onClick={toggleBackground}
        className={`w-full mt-3 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 border ${
          bgEnabled
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            : 'bg-[#1E293B] border-[#263244] text-slate-400 hover:text-slate-200'
        }`}
      >
        {bgEnabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
        {bgEnabled ? 'وضع العمل بالخلفية مُفعّل' : 'تفعيل العمل بالخلفية (إبقاء الاستقبال نشطاً)'}
      </button>
    </div>
  );
}
