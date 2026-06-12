import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'م';
  if (n >= 10_000) return (n / 1000).toFixed(1) + 'ك';
  return n.toLocaleString('en-US');
}

export function formatFullNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `منذ ${d} يوم`;
}

export function formatArabicDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
}
