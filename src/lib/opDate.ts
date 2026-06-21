/**
 * Central "Operational Date" logic — Asia/Baghdad timezone.
 *
 * The whole operation runs on Baghdad local time. Relying on the device clock
 * or UTC means a report submitted just after midnight (or on a phone with the
 * wrong timezone) gets tagged with the wrong operational day. Every place that
 * needs "today" / "what day does this report belong to" MUST use these helpers
 * instead of `new Date().toISOString().slice(0,10)`.
 */
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const OP_TZ = 'Asia/Baghdad';

/** Current (or given) operational date as YYYY-MM-DD in Baghdad time. */
export function operationalDate(d: Date = new Date()): string {
  return formatInTimeZone(d, OP_TZ, 'yyyy-MM-dd');
}

/** Operational date N days before today (Baghdad), as YYYY-MM-DD. */
export function operationalDateDaysAgo(n: number, base: Date = new Date()): string {
  const d = new Date(base.getTime() - n * 86_400_000);
  return operationalDate(d);
}

/** Shift an operational date string by N days, returning YYYY-MM-DD. */
export function shiftOperationalDate(dateStr: string, days: number): string {
  // Parse as Baghdad-noon to avoid DST/midnight edge cases, then shift.
  const base = new Date(`${dateStr}T12:00:00`);
  return operationalDate(new Date(base.getTime() + days * 86_400_000));
}

/** Minutes since midnight in Baghdad local time (for time-window status). */
export function baghdadMinutes(d: Date = new Date()): number {
  const hhmm = formatInTimeZone(d, OP_TZ, 'HH:mm');
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** A Date object shifted to represent Baghdad wall-clock time. */
export function nowBaghdad(d: Date = new Date()): Date {
  return toZonedTime(d, OP_TZ);
}
