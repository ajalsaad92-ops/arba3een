import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

type GradTone = 'amber' | 'emerald' | 'red' | 'blue' | 'purple' | 'orange' | 'slate';

const GRADIENTS: Record<GradTone, { from: string; to: string; text: string; glow: string }> = {
  amber:   { from: 'from-amber-400',   to: 'to-orange-600',   text: 'text-amber-400',   glow: 'shadow-amber-500/20' },
  emerald: { from: 'from-emerald-400', to: 'to-teal-600',     text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  red:     { from: 'from-red-400',     to: 'to-rose-700',     text: 'text-red-400',     glow: 'shadow-red-500/20' },
  blue:    { from: 'from-blue-400',    to: 'to-indigo-600',   text: 'text-blue-400',    glow: 'shadow-blue-500/20' },
  purple:  { from: 'from-purple-400',  to: 'to-fuchsia-700',  text: 'text-purple-400',  glow: 'shadow-purple-500/20' },
  orange:  { from: 'from-orange-400',  to: 'to-red-600',      text: 'text-orange-400',  glow: 'shadow-orange-500/20' },
  slate:   { from: 'from-slate-400',   to: 'to-slate-600',    text: 'text-slate-300',   glow: 'shadow-slate-500/20' },
};

interface Props {
  label: string;
  value: number;
  icon?: LucideIcon;
  iconColor?: string;
  bgColor?: string;
  trend?: number;
  format?: 'short' | 'full';
  sparklineData?: number[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
  suffix?: string;
  borderGlow?: boolean;
  tone?: GradTone;
}

function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const initial = 0;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(initial + (target - initial) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function formatVal(n: number, format?: 'short' | 'full'): string {
  if (format === 'short') {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'م';
    if (n >= 10_000) return (n / 1000).toFixed(1) + 'ك';
    return Math.round(n).toLocaleString('en-US');
  }
  return Math.round(n).toLocaleString('en-US');
}

function MiniSparkline({ data, color = '#F59E0B' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const w = 80, h = 30;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r="2"
        fill={color}
      />
    </svg>
  );
}

export default function KpiCard({ label, value, icon: Icon, iconColor, bgColor, trend, format, sparklineData, size = 'md', suffix, borderGlow, tone = 'amber' }: Props) {
  const animated = useCountUp(value);
  const trendIcon = trend == null || trend === 0 ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend == null || trend === 0 ? 'text-slate-500' : trend > 0 ? 'text-emerald-400' : 'text-red-400';
  const TrendIcon = trendIcon;
  const g = GRADIENTS[tone] ?? GRADIENTS.amber;
  const finalIconColor = iconColor ?? g.text;
  const finalBgColor = bgColor ?? `bg-gradient-to-br ${g.from} ${g.to} bg-opacity-10`;

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
    xl: 'p-6',
  };
  const valueClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
    xl: 'text-5xl',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative bg-gradient-to-br from-[#111827] to-[#0B0F19] border ${borderGlow ? `border-amber-500/30 ${g.glow}` : 'border-[#1E293B]'} rounded-xl ${sizeClasses[size]} overflow-hidden`}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${g.from} ${g.to} opacity-50`} />
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-xs text-slate-400 font-semibold">{label}</div>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg ${finalBgColor} flex items-center justify-center ${finalIconColor} opacity-90`}>
            <Icon size={14} />
          </div>
        )}
      </div>

      <div className={`kpi-number bg-gradient-to-l ${g.from} ${g.to} bg-clip-text text-transparent ${valueClasses[size]} leading-none`}>
        {formatVal(animated, format)}
        {suffix && <span className="text-base text-slate-400 mr-1">{suffix}</span>}
      </div>

      <div className="flex items-end justify-between mt-2 gap-2">
        {trend != null && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span>{trend > 0 ? '+' : ''}{trend.toFixed(1)}%</span>
            <span className="text-slate-500 text-[10px]">عن أمس</span>
          </div>
        )}
        {sparklineData && (
          <div className="shrink-0 -mb-1">
            <MiniSparkline data={sparklineData} color={g.text.replace('text-', '#') === 'text-amber-400' ? '#F59E0B' : g.text.replace('text-', '#') === 'text-emerald-400' ? '#10B981' : g.text.replace('text-', '#') === 'text-red-400' ? '#EF4444' : g.text.replace('text-', '#') === 'text-blue-400' ? '#3B82F6' : g.text.replace('text-', '#') === 'text-purple-400' ? '#A855F7' : '#F97316'} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
