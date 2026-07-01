import { OFFICES, officeById } from '../data/offices';
import type { DailyReport, Emergency, Profile } from '../data/types';
import { operationalDateDaysAgo } from './opDate';
import { extraFieldNumericValue } from './extraFieldStats';

export interface Insight {
  id: string;
  icon: 'up' | 'down' | 'alert' | 'star' | 'info' | 'idle' | 'service' | 'news';
  tone: 'positive' | 'negative' | 'warning' | 'info';
  text: string;
  /** Optional office/source name shown as a leading badge (TV-headline style). */
  source?: string;
}

function sum(rs: DailyReport[], key: (r: DailyReport) => number) {
  return rs.reduce((a, r) => a + (key(r) || 0), 0);
}

export function buildInsights(
  todayReports: DailyReport[],
  historicalReports: DailyReport[],
  emergencies: Emergency[],
  _users: Profile[],
): Insight[] {
  const out: Insight[] = [];
  const yestStr = operationalDateDaysAgo(1);
  const yReports = historicalReports.filter(r => r.reportDate === yestStr);

  // 1) Visitors trend today vs yesterday
  const vToday = sum(todayReports, r => (r.visitorsIn || 0) + (r.visitorsOut || 0));
  const vYest  = sum(yReports,    r => (r.visitorsIn || 0) + (r.visitorsOut || 0));
  if (vToday > 0 || vYest > 0) {
    if (vYest === 0) {
      out.push({ id: 'v0', icon: 'up', tone: 'info', text: `إجمالي زوار اليوم: ${vToday.toLocaleString('en-US')}` });
    } else {
      const diff = vToday - vYest;
      const pct = Math.round((diff / vYest) * 100);
      out.push({
        id: 'v1',
        icon: diff >= 0 ? 'up' : 'down',
        tone: diff >= 0 ? 'positive' : 'negative',
        text: diff >= 0
          ? `زيادة في عدد الزوار اليوم عن أمس بـ ${Math.abs(pct)}% (+${Math.abs(diff).toLocaleString('en-US')})`
          : `انخفاض في عدد الزوار اليوم عن أمس بـ ${Math.abs(pct)}% (-${Math.abs(diff).toLocaleString('en-US')})`,
      });
    }
  }

  // 2) Top governorate by visitors today
  if (todayReports.length > 0) {
    const byGov: Record<string, { gov: string; total: number; officeId: string }> = {};
    todayReports.forEach(r => {
      const off = officeById(r.officeId);
      const gov = off?.governorateAr || r.officeId;
      const t = (r.visitorsIn || 0) + (r.visitorsOut || 0);
      if (!byGov[gov] || byGov[gov].total < t) byGov[gov] = { gov, total: t, officeId: r.officeId };
      else byGov[gov].total += t;
    });
    const top = Object.values(byGov).sort((a, b) => b.total - a.total)[0];
    if (top && top.total > 0) {
      out.push({ id: 'v2', icon: 'star', tone: 'info', text: `أكثر محافظة استقبالاً للزوار اليوم: ${top.gov} بـ ${top.total.toLocaleString('en-US')}` });
    }
  }

  // 3) Top services / resources
  const resByOffice = todayReports
    .map(r => ({ off: officeById(r.officeId), val: extraFieldNumericValue((r as any).resourcesDistributed), r }))
    .filter(x => x.val > 0)
    .sort((a, b) => b.val - a.val);
  if (resByOffice[0]) {
    out.push({
      id: 's1',
      icon: 'service',
      tone: 'positive',
      text: `${resByOffice[0].off?.nameAr || resByOffice[0].r.officeId} قدّم ${resByOffice[0].val.toLocaleString('en-US')} خدمة اليوم`,
    });
  }

  // 4) Active emergencies
  const active = emergencies.filter(e => e.status === 'active');
  if (active.length > 0) {
    const e = active[0];
    out.push({
      id: 'e1',
      icon: 'alert',
      tone: 'negative',
      text: `خرق أمني نشط في ${officeById(e.officeId)?.governorateAr || e.officeId}: ${e.emergencyType}`,
    });
    if (active.length > 1) {
      out.push({ id: 'e2', icon: 'alert', tone: 'negative', text: `يوجد ${active.length} حالات طارئة نشطة بحاجة معالجة` });
    }
  }

  // 5) Offices missing today's report
  const submittedIds = new Set(todayReports.map(r => r.officeId));
  const missing = OFFICES.filter(o => !submittedIds.has(o.id));
  if (missing.length > 0) {
    out.push({
      id: 'm1',
      icon: 'idle',
      tone: 'warning',
      text: `${missing.length} مكتب لم يُرسل تقرير اليوم${missing.length <= 3 ? ' — ' + missing.map(m => m.nameAr.replace('مكتب ', '')).join('، ') : ''}`,
    });
  }

  // 6) Vehicles total + processions
  const vehTotal = sum(todayReports, r => r.vehiclesCount);
  const procTotal = sum(todayReports, r => r.processionsCount);
  if (vehTotal > 0) out.push({ id: 'veh', icon: 'info', tone: 'info', text: `إجمالي حركة العجلات اليوم: ${vehTotal.toLocaleString('en-US')}` });
  if (procTotal > 0) out.push({ id: 'pro', icon: 'info', tone: 'info', text: `عدد المواكب الفعّالة اليوم: ${procTotal.toLocaleString('en-US')}` });

  // 7) Total entries (offices that submitted)
  out.push({ id: 'ent', icon: 'info', tone: 'info', text: `إجمالي التقارير المُدخلة اليوم: ${todayReports.length} من ${OFFICES.length} مكتب` });

  // 8) Office with highest violations
  const viol = todayReports.filter(r => (r.violationsCount || 0) > 0).sort((a, b) => b.violationsCount - a.violationsCount)[0];
  if (viol) {
    out.push({
      id: 'viol',
      icon: 'alert',
      tone: 'warning',
      text: `أعلى نسبة خروقات أمنية اليوم: ${officeById(viol.officeId)?.governorateAr} (${viol.violationsCount})`,
    });
  }

  // 9) Late submissions
  const late = todayReports.filter(r => r.isLateSubmission);
  if (late.length > 0) {
    out.push({ id: 'late', icon: 'idle', tone: 'warning', text: `${late.length} تقرير وصل متأخراً اليوم` });
  }

  // 10) News-style headlines: free-text notes entered by data-entry users,
  //     attributed to their office and shown like a TV ticker headline.
  const clip = (s: string, n = 160) => {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  };
  const textParts: { key: keyof DailyReport; label: string }[] = [
    { key: 'eventsDetails', label: 'فعاليات' },
    { key: 'incidentsDetails', label: 'حوادث' },
    { key: 'violationsDetails', label: 'خروقات' },
    { key: 'visitsSummary', label: 'زيارات' },
    { key: 'deploymentLocations', label: 'انتشار' },
    { key: 'otherNotes', label: 'ملاحظات' },
  ];
  todayReports.forEach(r => {
    const officeName = (officeById(r.officeId)?.nameAr || r.officeId).replace('مكتب ', '');
    textParts.forEach(p => {
      const raw = (r as any)[p.key];
      if (typeof raw === 'string' && raw.trim().length > 2) {
        out.push({
          id: `news-${r.officeId}-${String(p.key)}`,
          icon: 'news',
          tone: 'info',
          source: officeName,
          text: `${p.label}: ${clip(raw)}`,
        });
      }
    });
    // Custom free-text fields added via the field manager.
    if (r.extraFields) {
      Object.values(r.extraFields).forEach((v, idx) => {
        if (typeof v === 'string' && v.trim().length > 2) {
          out.push({ id: `news-x-${r.officeId}-${idx}`, icon: 'news', tone: 'info', source: officeName, text: clip(v) });
        }
      });
    }
  });

  return out;
}