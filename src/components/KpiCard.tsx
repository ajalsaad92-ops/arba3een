import React from 'react';
import { formatNumber } from '../lib/utils';

type Props = {
  label: string;
  value: number;
  icon: React.ElementType;
  trend?: number;
  tone?: 'amber'|'blue'|'emerald'|'red'|'orange'|'purple'|'slate';
  size?: 'sm'|'lg';
  borderGlow?: boolean;
  sparklineData?: number[];
};

const toneMap: Record<string, { text: string; gradient: string; bg: string }> = {
  amber:   { text: 'text-amber-400', gradient: 'from-amber-400 to-orange-600', bg: 'bg-amber-500/10' },
  blue:    { text: 'text-blue-400', gradient: 'from-blue-400 to-indigo-600', bg: 'bg-blue-500/10' },
  emerald: { text: 'text-emerald-400', gradient: 'from-emerald-400 to-teal-600', bg: 'bg-emerald-500/10' },
  red:     { text: 'text-red-300', gradient: 'from-red-400 to-rose-700', bg: 'bg-red-500/10' },
  orange:  { text: 'text-orange-400', gradient: 'from-orange-400 to-red-600', bg: 'bg-orange-500/10' },
  purple:  { text: 'text-purple-400', gradient: 'from-purple-400 to-fuchsia-700', bg: 'bg-purple-500/10' },
  slate:   { text: 'text-slate-300', gradient: 'from-slate-400 to-slate-600', bg: 'bg-slate-500/10' },
};

function KpiCardBase({ label, value, icon: Icon, trend = 0, tone = 'amber', size = 'sm', borderGlow }: Props) {
  const t = toneMap[tone] || toneMap.amber;
  const trendUp = trend > 0;
  const trendDown = trend < 0;
  return (
    <div className={`relative bg-[#111827] border border-[#1E293B] rounded-xl p-3 overflow-hidden ${borderGlow ? 'ring-1 ring-amber-500/20' : ''}`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${t.gradient}`} />
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] text-slate-400 truncate">{label}</div>
        <div className={`w-7 h-7 rounded-lg ${t.bg} flex items-center justify-center ${t.text}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className={`kpi-number ${size==='lg' ? 'text-2xl' : 'text-xl'} ${t.text}`}>{formatNumber(value)}</div>
      {!!trend && (
        <div className={`text-[10px] mt-1 ${trendUp ? 'text-emerald-400' : trendDown ? 'text-red-400' : 'text-slate-500'}`}>
          {trendUp ? '▲' : trendDown ? '▼' : '—'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

export default React.memo(KpiCardBase);
