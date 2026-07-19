import { OFFICES, officeById } from '../data/offices';
import type { DailyReport, Emergency, Profile, ReportFieldDefinition } from '../data/types';
import { operationalDateDaysAgo } from './opDate';
import { extraFieldNumericValue } from './extraFieldStats';
import { isBuiltInFieldHidden } from './kpiCatalog';

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

const clip = (s: string, n = 180) => {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

export function buildInsights(
  todayReports: DailyReport[],
  historicalReports: DailyReport[],
  emergencies: Emergency[],
  _users: Profile[],
  fieldDefinitions: ReportFieldDefinition[] = [],
): Insight[] {
  const out: Insight[] = [];
  const yestStr = operationalDateDaysAgo(1);
  const yReports = historicalReports.filter(r => r.reportDate === yestStr);
  const isHidden = (key: string) => isBuiltInFieldHidden(fieldDefinitions, key);
  const hiddenExtraKeys = new Set(
    fieldDefinitions.filter(f => !f.isBuiltIn && f.isHidden).map(f => f.fieldKey),
  );
  const labelForExtra = (key: string) => {
    const f = fieldDefinitions.find(d => d.fieldKey === key);
    return f?.statLabelAr || f?.labelAr || key;
  };

  // 1) Visitors trend today vs yesterday
  if (!isHidden('visitorsIn') || !isHidden('visitorsOut')) {
    const vToday = sum(todayReports, r => (isHidden('visitorsIn') ? 0 : (r.visitorsIn || 0)) + (isHidden('visitorsOut') ? 0 : (r.visitorsOut || 0)));
    const vYest  = sum(yReports,    r => (isHidden('visitorsIn') ? 0 : (r.visitorsIn || 0)) + (isHidden('visitorsOut') ? 0 : (r.visitorsOut || 0)));
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

    // Top governorate by visitors today
    if (todayReports.length > 0) {
      const byGov: Record<string, { gov: string; total: number }> = {};
      todayReports.forEach(r => {
        const off = officeById(r.officeId);
        const gov = off?.governorateAr || r.officeId;
        const t = (isHidden('visitorsIn') ? 0 : (r.visitorsIn || 0)) + (isHidden('visitorsOut') ? 0 : (r.visitorsOut || 0));
        if (!byGov[gov]) byGov[gov] = { gov, total: t };
        else byGov[gov].total += t;
      });
      const top = Object.values(byGov).sort((a, b) => b.total - a.total)[0];
      if (top && top.total > 0) {
        out.push({ id: 'v2', icon: 'star', tone: 'info', text: `أكثر محافظة استقبالاً للزوار اليوم: ${top.gov} بـ ${top.total.toLocaleString('en-US')}` });
      }
    }
  }

  // 2) Built-in numeric aggregates — one headline per active KPI
  const numericBuiltIns: { key: keyof DailyReport; label: string; tone: Insight['tone']; icon: Insight['icon'] }[] = [
    { key: 'vehiclesCount',    label: 'حركة العجلات',       tone: 'info',     icon: 'info' },
    { key: 'processionsCount', label: 'المواكب الفعّالة',    tone: 'info',     icon: 'info' },
    { key: 'deathsCount',      label: 'الوفيات',            tone: 'negative', icon: 'alert' },
    { key: 'violationsCount',  label: 'الخروقات الأمنية',   tone: 'warning',  icon: 'alert' },
    { key: 'eventsCount',      label: 'الفعاليات',          tone: 'info',     icon: 'star' },
    { key: 'incidentsCount',   label: 'الحوادث',            tone: 'warning',  icon: 'alert' },
    { key: 'deploymentCount',  label: 'القوات المنتشرة',    tone: 'info',     icon: 'info' },
  ];
  numericBuiltIns.forEach(({ key, label, tone, icon }) => {
    if (isHidden(String(key))) return;
    const total = sum(todayReports, r => Number((r as any)[key]) || 0);
    if (total > 0) {
      out.push({ id: `bi-${String(key)}`, icon, tone, text: `${label} اليوم: ${total.toLocaleString('en-US')}` });
      // top office for this metric
      const top = [...todayReports].sort((a, b) => (Number((b as any)[key]) || 0) - (Number((a as any)[key]) || 0))[0];
      const v = Number((top as any)?.[key]) || 0;
      if (top && v > 0) {
        const off = officeById(top.officeId);
        out.push({
          id: `bi-top-${String(key)}`,
          icon: 'star',
          tone: 'info',
          text: `الأعلى في ${label}: ${off?.governorateAr || top.officeId} (${v.toLocaleString('en-US')})`,
        });
      }
    }
  });

  // 3) Services / resources distributed
  if (!isHidden('resourcesDistributed')) {
    const resByOffice = todayReports
      .map(r => ({ off: officeById(r.officeId), val: extraFieldNumericValue((r as any).resourcesDistributed), r }))
      .filter(x => x.val > 0)
      .sort((a, b) => b.val - a.val);
    const totalRes = resByOffice.reduce((a, x) => a + x.val, 0);
    if (totalRes > 0) {
      out.push({ id: 's-total', icon: 'service', tone: 'positive', text: `إجمالي الخدمات الموزعة اليوم: ${totalRes.toLocaleString('en-US')}` });
    }
    if (resByOffice[0]) {
      out.push({
        id: 's1',
        icon: 'service',
        tone: 'positive',
        text: `${resByOffice[0].off?.nameAr || resByOffice[0].r.officeId} قدّم ${resByOffice[0].val.toLocaleString('en-US')} خدمة اليوم`,
      });
    }
  }

  // 4) Dynamic custom numeric / select-with-quantity fields
  fieldDefinitions
    .filter(f => !f.isBuiltIn && !f.isHidden && (f.fieldType === 'number' || (f.fieldType === 'select' && f.withQuantity)))
    .forEach(f => {
      let total = 0;
      const perOffice: { officeId: string; val: number }[] = [];
      todayReports.forEach(r => {
        const raw = r.extraFields?.[f.fieldKey];
        const val = extraFieldNumericValue(raw);
        if (val > 0) {
          total += val;
          perOffice.push({ officeId: r.officeId, val });
        }
      });
      if (total > 0) {
        const label = f.statLabelAr || f.labelAr;
        out.push({ id: `xn-${f.fieldKey}`, icon: 'info', tone: 'info', text: `${label} اليوم: ${total.toLocaleString('en-US')}` });
        const top = perOffice.sort((a, b) => b.val - a.val)[0];
        if (top) {
          out.push({
            id: `xn-top-${f.fieldKey}`,
            icon: 'star',
            tone: 'info',
            text: `الأعلى في ${label}: ${officeById(top.officeId)?.governorateAr || top.officeId} (${top.val.toLocaleString('en-US')})`,
          });
        }
      }
    });

  // 5) Active + resolved emergencies
  const active = emergencies.filter(e => e.status === 'active');
  active.slice(0, 5).forEach((e, idx) => {
    out.push({
      id: `e-a-${e.id || idx}`,
      icon: 'alert',
      tone: 'negative',
      source: officeById(e.officeId)?.governorateAr,
      text: `حالة طارئة نشطة: ${e.emergencyType}${e.description ? ' — ' + clip(e.description, 100) : ''}`,
    });
  });
  if (active.length > 1) {
    out.push({ id: 'e-sum', icon: 'alert', tone: 'negative', text: `يوجد ${active.length} حالات طارئة نشطة بحاجة معالجة` });
  }
  const resolvedToday = emergencies.filter(e => e.status === 'resolved' && e.reportedAt && String(e.reportedAt).slice(0,10) >= operationalDateDaysAgo(0));
  if (resolvedToday.length > 0) {
    out.push({ id: 'e-res', icon: 'up', tone: 'positive', text: `تم حلّ ${resolvedToday.length} حالة طارئة اليوم` });
  }

  // 6) Offices missing today's report
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

  // 7) Coverage
  out.push({ id: 'ent', icon: 'info', tone: 'info', text: `إجمالي التقارير المُدخلة اليوم: ${todayReports.length} من ${OFFICES.length} مكتب` });

  // 8) Late submissions
  const late = todayReports.filter(r => r.isLateSubmission);
  if (late.length > 0) {
    out.push({ id: 'late', icon: 'idle', tone: 'warning', text: `${late.length} تقرير وصل متأخراً اليوم` });
  }

  // 9) News-style headlines: free-text notes from data-entry, respecting hidden fields
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
      if (isHidden(String(p.key))) return;
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
    // Custom free-text / select fields added via the field manager (skip hidden).
    if (r.extraFields) {
      Object.entries(r.extraFields).forEach(([key, v], idx) => {
        if (hiddenExtraKeys.has(key)) return;
        const label = labelForExtra(key);
        if (typeof v === 'string' && v.trim().length > 2) {
          out.push({ id: `news-x-${r.officeId}-${idx}`, icon: 'news', tone: 'info', source: officeName, text: `${label}: ${clip(v)}` });
        } else if (Array.isArray(v) && v.length > 0) {
          const items = v
            .map((it: any) => typeof it === 'string' ? it : (it && it.item ? `${it.item}${it.qty ? ` (${it.qty})` : ''}` : ''))
            .filter(Boolean)
            .join('، ');
          if (items) out.push({ id: `news-xa-${r.officeId}-${idx}`, icon: 'news', tone: 'info', source: officeName, text: `${label}: ${clip(items)}` });
        }
      });
    }
  });

  return out;
}
