import { useMemo, useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { useOps } from '../../store/opsStore';
import { useOffices } from '../../lib/offices';

export default function PreviousReportsPanel({ currentUserRole, currentUserOfficeId }: { currentUserRole: string; currentUserOfficeId: string }) {
  const { state } = useOps();
  const { officeById } = useOffices();
  const all = useMemo(() => {
    const merged = [...state.todayReports, ...state.historicalReports];
    const scoped = currentUserRole === 'manager' ? merged.filter(r => r.officeId === currentUserOfficeId) : merged;
    return scoped.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0, 20);
  }, [state.todayReports, state.historicalReports, currentUserRole, currentUserOfficeId]);
  const [open, setOpen] = useState<string | null>(null);
  return <div className="mt-4 bg-[#1a1a1a] border border-[#232323] rounded-xl overflow-hidden">
    <div className="p-4 border-b border-[#232323] flex items-center gap-2">
      <History className="w-4 h-4 text-blue-300" />
      <div className="font-bold text-sm">التقارير السابقة</div>
      <div className="text-[10px] text-slate-500 mr-auto">آخر {all.length}</div>
    </div>
    {!all.length ? <div className="p-6 text-center text-xs text-slate-500">لا توجد تقارير</div> :
      <ul className="divide-y divide-[#232323] max-h-[420px] overflow-y-auto">
        {all.map(r => {
          const isOpen = open === r.id;
          return <li key={r.id} className="p-3 hover:bg-[#232323]/30">
            <button onClick={() => setOpen(isOpen ? null : r.id)} className="w-full text-right flex items-center gap-3">
              <div className="flex-1 min-w-0"><div className="font-bold text-sm">{officeById(r.officeId)?.nameAr || r.officeId}</div>
                <div className="text-[10px] text-slate-500">{r.reportDate}</div></div>
              <div className="text-[11px] text-slate-300 font-mono">{new Date(r.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">{[
              ['زوار داخل', r.visitorsIn], ['زوار خارج', r.visitorsOut],
              ['عجلات', r.vehiclesCount], ['مواكب', r.processionsCount],
              ['حوادث', r.incidentsCount], ['وفيات', r.deathsCount],
            ].map(([l, v]) => <div key={l as string} className="bg-[#0d0d0d] border border-[#232323] rounded px-2 py-1 flex justify-between"><span className="text-slate-500">{l}</span><b>{v as number}</b></div>)}
            </div>}
          </li>;
        })}
      </ul>}
  </div>;
}
