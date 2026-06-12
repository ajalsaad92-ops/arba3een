// Real heatmap color scale: yellow (low) → orange → red (high)
// Uses OKLCH-style perceptual interpolation for natural gradient

export interface HeatLevel {
  intensity: number; // 0-1
  count: number;
  label?: string;
}

// Heat gradient stops (from low to high)
// 0.0:  rgba(30, 41, 59, 0.4)   - empty (slate)
// 0.1:  rgba(250, 204, 21, 0.15) - very low (pale yellow)
// 0.25: rgba(250, 204, 21, 0.35) - low (yellow)
// 0.4:  rgba(245, 158, 11, 0.55) - moderate (amber)
// 0.55: rgba(249, 115, 22, 0.7)  - elevated (orange)
// 0.7:  rgba(239, 68, 68, 0.75)  - high (red)
// 0.85: rgba(220, 38, 38, 0.85)  - very high (deep red)
// 1.0:  rgba(185, 28, 28, 0.95)  - critical (darkest red)

const STOPS: { pos: number; r: number; g: number; b: number; a: number }[] = [
  { pos: 0.0, r: 30, g: 41, b: 59, a: 0.4 },
  { pos: 0.1, r: 250, g: 204, b: 21, a: 0.15 },
  { pos: 0.25, r: 250, g: 204, b: 21, a: 0.4 },
  { pos: 0.4, r: 245, g: 158, b: 11, a: 0.6 },
  { pos: 0.55, r: 249, g: 115, b: 22, a: 0.75 },
  { pos: 0.7, r: 239, g: 68, b: 68, a: 0.8 },
  { pos: 0.85, r: 220, g: 38, b: 38, a: 0.9 },
  { pos: 1.0, r: 185, g: 28, b: 28, a: 0.95 },
];

export function getHeatColor(intensity: number): { background: string; border: string; textColor: string; label: string } {
  const v = Math.max(0, Math.min(1, intensity));
  let lower = STOPS[0], upper = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (v >= STOPS[i].pos && v <= STOPS[i + 1].pos) {
      lower = STOPS[i]; upper = STOPS[i + 1]; break;
    }
  }
  const range = upper.pos - lower.pos || 1;
  const t = (v - lower.pos) / range;
  const r = Math.round(lower.r + (upper.r - lower.r) * t);
  const g = Math.round(lower.g + (upper.g - lower.g) * t);
  const b = Math.round(lower.b + (upper.b - lower.b) * t);
  const a = lower.a + (upper.a - lower.a) * t;
  const background = `rgba(${r}, ${g}, ${b}, ${a})`;
  const border = `rgba(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)}, ${Math.min(1, a + 0.1)})`;
  const textColor = v > 0.55 ? '#fff' : v > 0.25 ? '#0B0F19' : '#94A3B8';
  const label = v < 0.1 ? 'فارغ' : v < 0.25 ? 'منخفض' : v < 0.5 ? 'متوسط' : v < 0.75 ? 'مرتفع' : v < 0.9 ? 'عالي جداً' : 'حرج';
  return { background, border, textColor, label };
}

// Gradient color scales for use in Recharts/charts
export const HEAT_GRADIENT = [
  { stop: 0, color: '#FACC15' },   // yellow
  { stop: 0.33, color: '#F59E0B' }, // amber
  { stop: 0.66, color: '#F97316' }, // orange
  { stop: 1, color: '#EF4444' },    // red
];

export const VISITOR_GRADIENT = [
  { stop: 0, color: '#10B981' },  // emerald
  { stop: 0.5, color: '#F59E0B' }, // amber
  { stop: 1, color: '#EF4444' },   // red
];

// Utility: map number to a 0-1 intensity given min/max range
export function toIntensity(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
