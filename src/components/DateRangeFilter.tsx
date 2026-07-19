import { useState, useMemo } from 'react';
import { useOps } from '../store/opsStore';
import { Calendar as CalendarIcon, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { operationalDate, shiftOperationalDate } from '../lib/opDate';

type Mode = 'range' | 'cumulative';

const AR_MONTHS = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];
const AR_WEEKDAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

function todayStr() { return operationalDate(); }
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function parseYmd(s: string) { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d }; }
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function cmp(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }

function MonthGrid({
  year, month, selectedFrom, selectedTo, hover, onPick, onHover, mode,
}: {
  year: number; month: number;
  selectedFrom: string | null; selectedTo: string | null;
  hover: string | null;
  onPick: (d: string) => void;
  onHover: (d: string | null) => void;
  mode: Mode;
}) {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const total = daysInMonth(year, month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const today = todayStr();

  const inPreviewRange = (day: string) => {
    if (mode === 'cumulative' && selectedFrom) return day >= selectedFrom && day <= today;
    if (mode === 'range') {
      if (selectedFrom && selectedTo) return day >= selectedFrom && day <= selectedTo;
      if (selectedFrom && hover) {
        const lo = cmp(selectedFrom, hover) <= 0 ? selectedFrom : hover;
        const hi = cmp(selectedFrom, hover) <= 0 ? hover : selectedFrom;
        return day >= lo && day <= hi;
      }
    }
    return false;
  };

  return (
    <div className="grid grid-cols-7 gap-0.5">
      {AR_WEEKDAYS.map(w => (
        <div key={w} className="text-[9px] text-slate-500 text-center py-1">{w}</div>
      ))}
      {cells.map((d, i) => {
        if (d === null) return <div key={i} />;
        const day = ymd(year, month, d);
        const isFrom = selectedFrom === day;
        const isTo = mode === 'range' && selectedTo === day;
        const isToday = day === today;
        const isFuture = day > today;
        const isRange = inPreviewRange(day);
        const isEndpoint = isFrom || isTo;
        return (
          <button
            key={i}
            disabled={isFuture}
            onClick={() => onPick(day)}
            onMouseEnter={() => onHover(day)}
            onMouseLeave={() => onHover(null)}
            className={[
              'h-7 text-[11px] rounded transition-colors tabular-nums',
              isFuture ? 'text-slate-700 cursor-not-allowed' : 'text-slate-300 hover:bg-amber-500/20',
              isRange && !isEndpoint ? 'bg-amber-500/15 text-amber-200' : '',
              isEndpoint ? 'bg-amber-500 text-black font-bold hover:bg-amber-400' : '',
              isToday && !isEndpoint ? 'ring-1 ring-amber-500/50' : '',
            ].join(' ')}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export default function DateRangeFilter() {
  const { state, dispatch } = useOps();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('range');
  const [hover, setHover] = useState<string | null>(null);

  // Draft selection (not yet applied)
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);

  const today = todayStr();
  const initialCursor = useMemo(() => {
    const anchor = state.dateRange?.from ?? today;
    const { y, m } = parseYmd(anchor);
    return { y, m };
  }, [state.dateRange, today, open]);
  const [cursor, setCursor] = useState(initialCursor);

  const r = state.dateRange;
  const label = !r
    ? 'اليوم'
    : r.to === today && r.from !== r.to
      ? `تراكمي منذ ${r.from}`
      : r.from === r.to
        ? r.from
        : `${r.from} → ${r.to}`;

  const openPanel = () => {
    setDraftFrom(r?.from ?? null);
    setDraftTo(r && r.from !== r.to ? r.to : null);
    setMode(r && r.to === today && r.from !== r.to ? 'cumulative' : 'range');
    setCursor(initialCursor);
    setOpen(true);
  };

  const pick = (day: string) => {
    if (mode === 'cumulative') {
      setDraftFrom(day);
      setDraftTo(today);
      return;
    }
    // range mode
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo(null);
    } else {
      if (day < draftFrom) { setDraftTo(draftFrom); setDraftFrom(day); }
      else { setDraftTo(day); }
    }
  };

  const apply = () => {
    if (!draftFrom) return;
    const from = draftFrom;
    const to = mode === 'cumulative' ? today : (draftTo ?? draftFrom);
    dispatch({ type: 'SET_DATE_RANGE', range: { from, to } });
    setOpen(false);
  };

  const clear = () => {
    dispatch({ type: 'SET_DATE_RANGE', range: null });
    setDraftFrom(null); setDraftTo(null);
    setOpen(false);
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const monthTitle = `${AR_MONTHS[cursor.m]} ${cursor.y}`;

  return (
    <div className="relative">
      <button
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#232323] text-xs text-slate-300 hover:border-amber-500/30 transition-colors"
      >
        <CalendarIcon className="w-3.5 h-3.5 text-amber-400" />
        <span>التاريخ:</span>
        <span className="text-amber-400 font-bold tabular-nums">{label}</span>
        {r && (
          <span
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="w-4 h-4 rounded-full bg-[#232323] flex items-center justify-center hover:bg-red-500/30"
            role="button"
          >
            <X className="w-2.5 h-2.5" />
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[800]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-[#1a1a1a] border border-[#232323] rounded-xl shadow-2xl z-[801] p-3 space-y-3">
            {/* Mode tabs */}
            <div className="grid grid-cols-2 gap-1 bg-[#0d0d0d] border border-[#232323] rounded-lg p-1">
              <button
                onClick={() => { setMode('range'); setDraftFrom(null); setDraftTo(null); }}
                className={`py-1.5 rounded-md text-[11px] font-bold transition-colors ${mode === 'range' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-slate-200'}`}
              >
                مدة محددة
              </button>
              <button
                onClick={() => { setMode('cumulative'); setDraftTo(today); }}
                className={`py-1.5 rounded-md text-[11px] font-bold transition-colors ${mode === 'cumulative' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-slate-200'}`}
              >
                تراكمي حتى الآن
              </button>
            </div>

            {/* Hint */}
            <div className="text-[10px] text-slate-500 leading-relaxed">
              {mode === 'range'
                ? 'اختر يوماً واحداً أو اضغط بداية ثم نهاية المدة.'
                : 'اختر تاريخ البداية — سيُحسب التراكم من ذلك اليوم حتى اليوم الحالي.'}
            </div>

            {/* Month header */}
            <div className="flex items-center justify-between">
              <button onClick={() => shiftMonth(-1)} className="w-7 h-7 rounded-md bg-[#0d0d0d] border border-[#232323] flex items-center justify-center text-slate-400 hover:text-amber-400">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <div className="text-xs font-bold text-slate-200">{monthTitle}</div>
              <button onClick={() => shiftMonth(1)} className="w-7 h-7 rounded-md bg-[#0d0d0d] border border-[#232323] flex items-center justify-center text-slate-400 hover:text-amber-400">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <MonthGrid
              year={cursor.y}
              month={cursor.m}
              selectedFrom={draftFrom}
              selectedTo={draftTo}
              hover={hover}
              onPick={pick}
              onHover={setHover}
              mode={mode}
            />

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5 border-t border-[#232323] pt-2">
              {[
                { l: 'اليوم', from: today, m: 'range' as Mode },
                { l: '7 أيام', from: shiftOperationalDate(today, -6), m: 'cumulative' as Mode },
                { l: '30 يوم', from: shiftOperationalDate(today, -29), m: 'cumulative' as Mode },
              ].map(p => (
                <button
                  key={p.l}
                  onClick={() => { setMode(p.m); setDraftFrom(p.from); setDraftTo(p.m === 'cumulative' ? today : p.from); }}
                  className="px-2 py-1 rounded-md bg-[#0d0d0d] border border-[#232323] text-[10px] text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
                >
                  {p.l}
                </button>
              ))}
            </div>

            {/* Selection summary */}
            <div className="bg-[#0d0d0d] border border-[#232323] rounded-md px-2 py-1.5 text-[11px] text-slate-300 tabular-nums text-center">
              {draftFrom
                ? (mode === 'cumulative'
                    ? `تراكمي منذ ${draftFrom} حتى ${today}`
                    : draftTo && draftTo !== draftFrom
                      ? `${draftFrom} → ${draftTo}`
                      : draftFrom)
                : 'لم يتم اختيار تاريخ'}
            </div>

            <div className="flex gap-2">
              <button
                onClick={clear}
                className="flex-1 py-1.5 rounded-md bg-[#0d0d0d] border border-[#232323] text-[11px] text-slate-300 hover:border-red-500/40 hover:text-red-300"
              >
                إعادة تعيين
              </button>
              <button
                onClick={apply}
                disabled={!draftFrom}
                className="flex-1 py-1.5 rounded-md bg-amber-500 text-black text-[11px] font-bold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                تطبيق
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
