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
  /** Day-scope badge shown at the start of each headline. */
  source?: string;
  day?: 'today' | 'yesterday';
}

const clip = (s: string, n = 220) => {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

const fmt = (n: number) => n.toLocaleString('en-US');

/** Aggregate a numeric metric per-governorate. */
function perGov(reports: DailyReport[], pick: (r: DailyReport) => number) {
  const map = new Map<string, number>();
  reports.forEach(r => {
    const v = pick(r) || 0;
    if (v <= 0) return;
    const gov = officeById(r.officeId)?.governorateAr || r.officeId;
    map.set(gov, (map.get(gov) || 0) + v);
  });
  return [...map.entries()]
    .map(([gov, total]) => ({ gov, total }))
    .sort((a, b) => b.total - a.total);
}

function govPhrase(list: { gov: string; total: number }[]): string {
  if (list.length === 0) return '';
  if (list.length === 1) return `في محافظة ${list[0].gov}`;
  if (list.length === 2) return `في محافظتَي ${list[0].gov} و${list[1].gov}`;
  const head = list.slice(0, 3).map(x => x.gov).join('، ');
  const rest = list.length - 3;
  return rest > 0
    ? `في محافظات ${head} و${rest} محافظات أخرى`
    : `في محافظات ${head}`;
}

function compareText(today: number, yest: number): string {
  if (yest <= 0) return today > 0 ? ' (بدون بيانات مقارنة من أمس)' : '';
  const diff = today - yest;
  if (diff === 0) return ' — بنفس مستوى أمس';
  const pct = Math.round((Math.abs(diff) / yest) * 100);
  return diff > 0
    ? ` — بزيادة ${pct}% عن أمس (+${fmt(diff)})`
    : ` — بانخفاض ${pct}% عن أمس (${fmt(diff)})`;
}

interface MetricSpec {
  key: string;
  pick: (r: DailyReport) => number;
  narrate: (total: number, top: { gov: string; total: number }[]) => string;
  tone: Insight['tone'];
  icon: Insight['icon'];
}

function buildMetricSpecs(
  fieldDefinitions: ReportFieldDefinition[],
): MetricSpec[] {
  const isHidden = (k: string) => isBuiltInFieldHidden(fieldDefinitions, k);
  const specs: MetricSpec[] = [];

  if (!isHidden('visitorsIn')) specs.push({
    key: 'visitorsIn',
    pick: r => r.visitorsIn || 0,
    narrate: (t, g) => `توافد ${fmt(t)} زائر قادم إلى مواقع مقر المديرية ${govPhrase(g)}`,
    tone: 'positive', icon: 'up',
  });
  if (!isHidden('visitorsOut')) specs.push({
    key: 'visitorsOut',
    pick: r => r.visitorsOut || 0,
    narrate: (t, g) => `غادر ${fmt(t)} زائر عائد ${govPhrase(g)}`,
    tone: 'info', icon: 'down',
  });
  if (!isHidden('vehiclesCount')) specs.push({
    key: 'vehiclesCount',
    pick: r => r.vehiclesCount || 0,
    narrate: (t, g) => `رُصدت حركة ${fmt(t)} عجلة ${govPhrase(g)}`,
    tone: 'info', icon: 'info',
  });
  if (!isHidden('processionsCount')) specs.push({
    key: 'processionsCount',
    pick: r => r.processionsCount || 0,
    narrate: (t, g) => `شهدت الساحات انطلاق ${fmt(t)} موكب ${govPhrase(g)}`,
    tone: 'info', icon: 'star',
  });
  if (!isHidden('deploymentCount')) specs.push({
    key: 'deploymentCount',
    pick: r => r.deploymentCount || 0,
    narrate: (t, g) => `تم نشر ${fmt(t)} من عناصر الأمن والمتطوعين ${govPhrase(g)}`,
    tone: 'info', icon: 'info',
  });
  if (!isHidden('violationsCount')) specs.push({
    key: 'violationsCount',
    pick: r => r.violationsCount || 0,
    narrate: (t, g) => `تم رصد ${fmt(t)} خرق أمني ${govPhrase(g)}`,
    tone: 'warning', icon: 'alert',
  });
  if (!isHidden('incidentsCount')) specs.push({
    key: 'incidentsCount',
    pick: r => r.incidentsCount || 0,
    narrate: (t, g) => `وقعت ${fmt(t)} حادثة ${govPhrase(g)}`,
    tone: 'warning', icon: 'alert',
  });
  if (!isHidden('eventsCount')) specs.push({
    key: 'eventsCount',
    pick: r => r.eventsCount || 0,
    narrate: (t, g) => `أُقيمت ${fmt(t)} فعالية ${govPhrase(g)}`,
    tone: 'info', icon: 'star',
  });
  if (!isHidden('deathsCount')) specs.push({
    key: 'deathsCount',
    pick: r => r.deathsCount || 0,
    narrate: (t, g) => `سُجّلت ${fmt(t)} حالة وفاة ${govPhrase(g)}`,
    tone: 'negative', icon: 'alert',
  });
  if (!isHidden('resourcesDistributed')) specs.push({
    key: 'resourcesDistributed',
    pick: r => extraFieldNumericValue((r as any).resourcesDistributed),
    narrate: (t, g) => `قُدّمت ${fmt(t)} خدمة للزوار ${govPhrase(g)}`,
    tone: 'positive', icon: 'service',
  });

  // Dynamic custom numeric / select-with-quantity fields
  fieldDefinitions
    .filter(f => !f.isBuiltIn && !f.isHidden && (f.fieldType === 'number' || (f.fieldType === 'select' && f.withQuantity)))
    .forEach(f => {
      const label = f.statLabelAr || f.labelAr || f.fieldKey;
      specs.push({
        key: `x:${f.fieldKey}`,
        pick: r => extraFieldNumericValue(r.extraFields?.[f.fieldKey]),
        narrate: (t, g) => `تم تسجيل ${fmt(t)} ${label} ${govPhrase(g)}`,
        tone: 'info', icon: 'info',
      });
    });

  return specs;
}

/** Narrate a single day's reports as news headlines. */
function narrateDay(
  reports: DailyReport[],
  compareTo: DailyReport[],
  specs: MetricSpec[],
  day: 'today' | 'yesterday',
): Insight[] {
  const out: Insight[] = [];
  const label = day === 'today' ? 'اليوم' : 'أمس';
  const source = day === 'today' ? 'موجز اليوم' : 'موجز أمس';

  specs.forEach(spec => {
    const totalToday = reports.reduce((a, r) => a + (spec.pick(r) || 0), 0);
    if (totalToday <= 0) return;
    const top = perGov(reports, spec.pick).slice(0, 4);
    const totalYest = compareTo.reduce((a, r) => a + (spec.pick(r) || 0), 0);
    const sentence = spec.narrate(totalToday, top) + ` ${label}` + compareText(totalToday, totalYest);
    out.push({
      id: `${day}-${spec.key}`,
      icon: spec.icon,
      tone: spec.tone,
      text: sentence,
      source,
      day,
    });
  });

  // Coverage headline
  const submitted = reports.length;
  if (submitted > 0) {
    out.push({
      id: `${day}-coverage`,
      icon: 'info',
      tone: 'info',
      source,
      day,
      text: `استلمت غرفة العمليات ${submitted} تقريراً من أصل ${OFFICES.length} مكتباً ${label}`,
    });
  }

  return out;
}

export function buildInsights(
  todayReports: DailyReport[],
  historicalReports: DailyReport[],
  emergencies: Emergency[],
  _users: Profile[],
  fieldDefinitions: ReportFieldDefinition[] = [],
): Insight[] {
  const today0 = operationalDateDaysAgo(0);
  const yest0 = operationalDateDaysAgo(1);
  const dayBefore = operationalDateDaysAgo(2);
  const yReports = historicalReports.filter(r => r.reportDate === yest0);
  const dbReports = historicalReports.filter(r => r.reportDate === dayBefore);

  const isHidden = (key: string) => isBuiltInFieldHidden(fieldDefinitions, key);
  const hiddenExtraKeys = new Set(
    fieldDefinitions.filter(f => !f.isBuiltIn && f.isHidden).map(f => f.fieldKey),
  );
  const labelForExtra = (key: string) => {
    const f = fieldDefinitions.find(d => d.fieldKey === key);
    return f?.statLabelAr || f?.labelAr || key;
  };

  const specs = buildMetricSpecs(fieldDefinitions);

  // ===== TODAY BLOCK =====
  const todayBlock: Insight[] = [];

  // Lead: active emergencies for today first (top of newscast)
  const active = emergencies.filter(e => e.status === 'active');
  active.slice(0, 3).forEach((e, idx) => {
    todayBlock.push({
      id: `today-e-${e.id || idx}`,
      icon: 'alert',
      tone: 'negative',
      source: 'عاجل',
      day: 'today',
      text: `حالة طارئة نشطة في محافظة ${officeById(e.officeId)?.governorateAr || e.officeId}: ${e.emergencyType}${e.description ? ' — ' + clip(e.description, 120) : ''}`,
    });
  });
  if (active.length > 3) {
    todayBlock.push({
      id: 'today-e-more',
      icon: 'alert',
      tone: 'negative',
      source: 'عاجل',
      day: 'today',
      text: `يوجد ${active.length} حالات طارئة نشطة تحتاج إلى معالجة في هذه اللحظة`,
    });
  }
  const resolvedToday = emergencies.filter(e => e.status === 'resolved' && (e.resolvedAt || e.createdAt) && String(e.resolvedAt || e.createdAt).slice(0, 10) >= today0);
  if (resolvedToday.length > 0) {
    todayBlock.push({
      id: 'today-e-res',
      icon: 'up',
      tone: 'positive',
      source: 'موجز اليوم',
      day: 'today',
      text: `تمّت معالجة ${resolvedToday.length} حالة طارئة اليوم بنجاح`,
    });
  }

  // Metric headlines for today (compare vs yesterday)
  todayBlock.push(...narrateDay(todayReports, yReports, specs, 'today'));

  // Field notes as news (today)
  const textParts: { key: keyof DailyReport; label: string }[] = [
    { key: 'eventsDetails', label: 'فعاليات' },
    { key: 'incidentsDetails', label: 'حوادث' },
    { key: 'violationsDetails', label: 'خروقات' },
    { key: 'visitsSummary', label: 'زيارات' },
    { key: 'deploymentLocations', label: 'مواقع الانتشار الميداني' },
    { key: 'otherNotes', label: 'ملاحظات' },
  ];
  todayReports.forEach(r => {
    const gov = officeById(r.officeId)?.governorateAr || r.officeId;
    textParts.forEach(p => {
      if (isHidden(String(p.key))) return;
      const raw = (r as any)[p.key];
      if (typeof raw === 'string' && raw.trim().length > 2) {
        todayBlock.push({
          id: `today-news-${r.officeId}-${String(p.key)}`,
          icon: 'news',
          tone: 'info',
          source: `محافظة ${gov}`,
          day: 'today',
          text: `${p.label}: ${clip(raw)}`,
        });
      }
    });
    if (r.extraFields) {
      Object.entries(r.extraFields).forEach(([key, v], idx) => {
        if (hiddenExtraKeys.has(key)) return;
        const label = labelForExtra(key);
        if (typeof v === 'string' && v.trim().length > 2) {
          todayBlock.push({ id: `today-nx-${r.officeId}-${idx}`, icon: 'news', tone: 'info', source: `محافظة ${gov}`, day: 'today', text: `${label}: ${clip(v)}` });
        } else if (Array.isArray(v) && v.length > 0) {
          const items = v
            .map((it: any) => typeof it === 'string' ? it : (it && it.item ? `${it.item}${it.qty ? ` (${it.qty})` : ''}` : ''))
            .filter(Boolean)
            .join('، ');
          if (items) todayBlock.push({ id: `today-nxa-${r.officeId}-${idx}`, icon: 'news', tone: 'info', source: `محافظة ${gov}`, day: 'today', text: `${label}: ${clip(items)}` });
        }
      });
    }
  });

  // Missing offices today
  const submittedIds = new Set(todayReports.map(r => r.officeId));
  const missing = OFFICES.filter(o => !submittedIds.has(o.id));
  if (missing.length > 0) {
    todayBlock.push({
      id: 'today-missing',
      icon: 'idle',
      tone: 'warning',
      source: 'موجز اليوم',
      day: 'today',
      text: `${missing.length} مكتب لم يُرسل تقرير اليوم بعد${missing.length <= 4 ? ' — ' + missing.map(m => m.nameAr.replace('مكتب ', '')).join('، ') : ''}`,
    });
  }

  // ===== YESTERDAY BLOCK =====
  const yestBlock: Insight[] = [];
  yestBlock.push(...narrateDay(yReports, dbReports, specs, 'yesterday'));

  // Yesterday's headlines from text fields (only the most informative)
  yReports.forEach(r => {
    const gov = officeById(r.officeId)?.governorateAr || r.officeId;
    textParts.forEach(p => {
      if (isHidden(String(p.key))) return;
      const raw = (r as any)[p.key];
      if (typeof raw === 'string' && raw.trim().length > 2) {
        yestBlock.push({
          id: `yest-news-${r.officeId}-${String(p.key)}`,
          icon: 'news',
          tone: 'info',
          source: `أمس · محافظة ${gov}`,
          day: 'yesterday',
          text: `${p.label}: ${clip(raw)}`,
        });
      }
    });
  });

  // If today has zero data, still show a friendly lead-in so ticker isn't empty.
  if (todayBlock.length === 0 && yestBlock.length === 0) {
    return [{
      id: 'idle',
      icon: 'info',
      tone: 'info',
      source: 'موجز',
      day: 'today',
      text: 'لا توجد بيانات جديدة حتى الآن — سيتم تحديث الموجز فور استلام أول تقرير.',
    }];
  }

  // Sequence: today → yesterday, then CSS marquee repeats infinitely.
  return [...todayBlock, ...yestBlock];
}
