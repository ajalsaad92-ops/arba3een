import { OFFICES, officeById } from './offices';
import { INITIAL_BORDER_CROSSINGS } from './borderCrossings';
import type {
  Profile, DailyReport, Emergency, ExtensionRequest,
  AgentLocation, VisitorFlowPath, TimeWindow
} from './types';

// Seeded pseudo-random for stable mock data
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

function timeAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function inRange(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ─── USERS ────────────────────────────────────────────────────────────
export const MOCK_USERS: Profile[] = [
  {
    id: 'u-director', fullNameAr: 'أبو علي المهداوي', role: 'director',
    officeId: 'HQ', permittedOfficeIds: OFFICES.map(o => o.id),
    specialPermissions: { canExport: true, canAddCrossings: true, canViewAllOffices: true, canOpenWindow: true, canEditReports: true },
    isActive: true, createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'u-supervisor', fullNameAr: 'الحاج كاظم العبيدي', role: 'supervisor',
    officeId: 'HQ', permittedOfficeIds: ['KRB', 'NJF', 'BBL', 'BGD', 'HQ'],
    specialPermissions: { canExport: true, canAddCrossings: false, canViewAllOffices: false, canOpenWindow: true, canEditReports: false },
    isActive: true, createdAt: '2025-01-05T00:00:00Z',
  },
  {
    id: 'u-manager', fullNameAr: 'أحمد محمد الجبوري', role: 'manager',
    officeId: 'KRB', permittedOfficeIds: ['KRB'],
    specialPermissions: { canExport: false, canAddCrossings: false, canViewAllOffices: false, canOpenWindow: false, canEditReports: false },
    isActive: true, createdAt: '2025-02-01T00:00:00Z',
  },
  {
    id: 'u-manager2', fullNameAr: 'سعد عبدالله الفتلاوي', role: 'manager',
    officeId: 'NJF', permittedOfficeIds: ['NJF'],
    specialPermissions: { canExport: false, canAddCrossings: false, canViewAllOffices: false, canOpenWindow: false, canEditReports: false },
    isActive: true, createdAt: '2025-02-10T00:00:00Z',
  },
  {
    id: 'u-agent', fullNameAr: 'محمد علي الحسناوي', role: 'agent',
    officeId: 'KRB', permittedOfficeIds: ['KRB'],
    specialPermissions: { canExport: false, canAddCrossings: false, canViewAllOffices: false, canOpenWindow: false, canEditReports: false },
    isActive: true, createdAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'u-agent2', fullNameAr: 'علي حسين العامري', role: 'agent',
    officeId: 'NJF', permittedOfficeIds: ['NJF'],
    specialPermissions: { canExport: false, canAddCrossings: false, canViewAllOffices: false, canOpenWindow: false, canEditReports: false },
    isActive: true, createdAt: '2025-03-02T00:00:00Z',
  },
  {
    id: 'u-agent3', fullNameAr: 'حسن كاظم البياتي', role: 'agent',
    officeId: 'KRB', permittedOfficeIds: ['KRB'],
    specialPermissions: { canExport: false, canAddCrossings: false, canViewAllOffices: false, canOpenWindow: false, canEditReports: false },
    isActive: true, createdAt: '2025-03-05T00:00:00Z',
  },
];

// Generate historical reports (14 days for analytics)
function generateHistoricalReports(): DailyReport[] {
  const reports: DailyReport[] = [];
  const rng = seededRandom(42);

  for (let dayOffset = 14; dayOffset >= 1; dayOffset--) {
    for (const office of OFFICES) {
      // 80% chance office submitted
      if (rng() < 0.2) continue;

      const visitorsIn = inRange(rng, 30000, 280000);
      const visitorsOut = Math.floor(visitorsIn * (0.85 + rng() * 0.1));
      const isLate = rng() < 0.15;

      reports.push({
        id: `r-${office.id}-${dayOffset}`,
        officeId: office.id,
        submittedBy: 'u-agent',
        reportDate: todayStr(dayOffset),
        submittedAt: timeAgo(dayOffset * 24 * 60 + inRange(rng, 5, 55)),
        isLateSubmission: isLate,
        deploymentCount: inRange(rng, 50, 1500),
        deploymentLocations: 'المنطقة المحيطة بالمكتب',
        deploymentFormations: 'تشكيلات دعم لوجستي',
        coordinationSectors: 'تنسيق مع قطاعات المرور والصحة',
        coordinationJointOps: 'غرفة عمليات مشتركة',
        incidentsCount: inRange(rng, 0, 8),
        incidentsDetails: 'بلاغات متعددة تم التعامل معها',
        violationsCount: inRange(rng, 0, 5),
        violationsArea: 'منطقة سكنية',
        violationsTimeDetail: '14:30',
        violationsDetails: 'مخالفة مرورية',
        deathsCount: inRange(rng, 0, 2),
        deathsLocationMgrs: '38SMB1234567890',
        deathsActionTaken: 'تم نقل الحالة للمستشفى',
        resourcesDistributed: inRange(rng, 100, 5000),
        resourcesDetails: 'مياه ووجبات غذائية',
        eventsCount: inRange(rng, 2, 30),
        eventsDetails: 'فعاليات دينية وخدمية',
        eventsCoordinates: [],
        visitsCount: inRange(rng, 1, 15),
        visitsSummary: 'زيارات ميدانية للجهات الخدمية',
        visitorsIn,
        visitorsOut,
        visitorsRoutes: 'محاور بغداد - كربلاء',
        vehiclesCount: inRange(rng, 500, 8000),
        vehiclesDetails: 'عجلات نقل الزائرين',
        processionsCount: inRange(rng, 10, 200),
        processionsDetails: 'مواكب عزاء متجهة',
        processionWaypoints: [],
        otherNotes: 'لا توجد ملاحظات إضافية',
      });
    }
  }
  return reports;
}

// Generate TODAY's reports with realistic Arbaeen scale numbers
function generateTodayReports(): DailyReport[] {
  const reports: DailyReport[] = [];
  const rng = seededRandom(99);

  // Strategic offices report much higher numbers
  const HIGH_TRAFFIC: Record<string, number> = {
    KRB: 5.0, NJF: 4.5, BBL: 3.0, BGD: 4.0, HQ: 1.5,
    WST: 2.0, MYS: 1.5, DHQ: 1.2, MTH: 1.0, QDS: 1.0,
    BAS: 2.5, DLY: 0.8, SLD: 0.6, ANB: 0.8, KRK: 0.5,
  };

  for (const office of OFFICES) {
    // 70% submitted by default for today
    if (rng() < 0.3) continue;

    const scale = HIGH_TRAFFIC[office.id] || 1.0;
    const visitorsIn = inRange(rng, Math.floor(40000 * scale), Math.floor(180000 * scale));
    const visitorsOut = Math.floor(visitorsIn * (0.7 + rng() * 0.2));
    const hour = 8 + Math.floor(rng() * 1); // 08-09
    const minute = inRange(rng, 5, 55);
    const submittedAt = new Date();
    submittedAt.setHours(hour, minute, 0, 0);
    const isLate = minute > 30;

    reports.push({
      id: `r-today-${office.id}`,
      officeId: office.id,
      submittedBy: 'u-agent',
      reportDate: todayStr(0),
      submittedAt: submittedAt.toISOString(),
      isLateSubmission: isLate,
      deploymentCount: inRange(rng, 80, 800),
      deploymentLocations: `${office.governorateAr} - المنطقة المحيطة`,
      deploymentFormations: 'تشكيلات دعم ومراقبة',
      coordinationSectors: 'تنسيق مع المرور والصحة والدفاع المدني',
      coordinationJointOps: 'غرفة عمليات مشتركة نشطة',
      incidentsCount: inRange(rng, 0, 6),
      incidentsDetails: 'بلاغات تم التعامل معها ميدانياً',
      violationsCount: inRange(rng, 0, 4),
      violationsArea: office.governorateAr,
      violationsTimeDetail: '14:30',
      violationsDetails: 'مخالفات مرورية وثقافية',
      deathsCount: inRange(rng, 0, 2),
      deathsLocationMgrs: '38SMB' + inRange(rng, 1000000, 9999999),
      deathsActionTaken: 'نقل للمستشفى والإجراءات الطبية مكتملة',
      resourcesDistributed: inRange(rng, 500, 8000),
      resourcesDetails: 'مياه، وجبات، مستلزمات طبية',
      eventsCount: inRange(rng, 5, 35),
      eventsDetails: 'فعاليات دينية وخدمية متنوعة',
      eventsCoordinates: [],
      visitsCount: inRange(rng, 2, 12),
      visitsSummary: 'زيارات ميدانية تنسيقية',
      visitorsIn,
      visitorsOut,
      visitorsRoutes: 'محاور رئيسية وفرعية',
      vehiclesCount: inRange(rng, 800, 12000),
      vehiclesDetails: 'عجلات نقل الزائرين، حافلات، سيارات خاصة',
      processionsCount: inRange(rng, 15, 250),
      processionsDetails: 'مواكب عزاء متجهة نحو كربلاء',
      processionWaypoints: [],
      otherNotes: 'الوضع العام مستقر',
      reporterLat: office.lat + (rng() - 0.5) * 0.02,
      reporterLng: office.lng + (rng() - 0.5) * 0.02,
      mgrsReference: '38SMB' + inRange(rng, 1000000, 9999999),
    });
  }
  return reports;
}

export const MOCK_TODAY_REPORTS: DailyReport[] = generateTodayReports();
export const MOCK_HISTORICAL_REPORTS: DailyReport[] = generateHistoricalReports();
export const MOCK_ALL_REPORTS: DailyReport[] = [...MOCK_TODAY_REPORTS, ...MOCK_HISTORICAL_REPORTS];

// ─── EMERGENCIES ─────────────────────────────────────────────────────
export const MOCK_EMERGENCIES: Emergency[] = [
  {
    id: 'em1',
    reportedById: 'u-agent', reportedByName: 'محمد علي الحسناوي',
    officeId: 'KRB',
    emergencyType: 'حاجة لدعم طبي عاجل',
    description: 'حالة طبية طارئة عند مدخل كربلاء تتطلب إرسال فريق طبي إضافي وسيارة إسعاف فوراً',
    locationMgrs: '38SMB1234567890',
    lat: 32.6200, lng: 44.0300,
    status: 'active',
    createdAt: timeAgo(8),
  },
  {
    id: 'em2',
    reportedById: 'u-agent2', reportedByName: 'علي حسين العامري',
    officeId: 'NJF',
    emergencyType: 'نقص إمداد غذائي',
    description: 'نقص حاد في المياه والوجبات في أحد المواكب الكبيرة بسبب ارتفاع عدد الزائرين',
    locationMgrs: '38SMB9876543210',
    lat: 32.0050, lng: 44.3400,
    status: 'active',
    createdAt: timeAgo(15),
  },
  {
    id: 'em3',
    reportedById: 'u-agent', reportedByName: 'محمد علي الحسناوي',
    officeId: 'BBL',
    emergencyType: 'حادث أمني',
    description: 'محاولة سرقة في أحد المخيمات تم التعامل معها من قبل القوات',
    lat: 32.4800, lng: 44.4300,
    status: 'acknowledged',
    acknowledgedById: 'u-director',
    acknowledgedAt: timeAgo(20),
    createdAt: timeAgo(35),
  },
  {
    id: 'em4',
    reportedById: 'u-agent2', reportedByName: 'علي حسين العامري',
    officeId: 'WST',
    emergencyType: 'حاجة عجلات مياه إضافية',
    description: 'نفاد المياه في المنطقة الجنوبية يتطلب إرسال 5 عجلات مياه خلال ساعة',
    lat: 32.5400, lng: 45.8200,
    status: 'resolved',
    resolvedAt: timeAgo(45),
    acknowledgedById: 'u-supervisor',
    acknowledgedAt: timeAgo(60),
    createdAt: timeAgo(75),
  },
];

// ─── EXTENSION REQUESTS ─────────────────────────────────────────────
export const MOCK_EXTENSIONS: ExtensionRequest[] = [
  {
    id: 'ex1',
    requestedById: 'u-agent', requestedByName: 'محمد علي الحسناوي',
    officeId: 'KRB',
    requestTime: timeAgo(25),
    reason: 'ظرف ميداني طارئ - ازدحام شديد في مدخل كربلاء',
    status: 'pending',
  },
  {
    id: 'ex2',
    requestedById: 'u-agent3', requestedByName: 'حسن كاظم البياتي',
    officeId: 'KRB',
    requestTime: timeAgo(45),
    reason: 'تأخر وصول البيانات من التشكيلات',
    status: 'forwarded_to_supervisor',
    managerReviewedById: 'u-manager',
    managerReviewedAt: timeAgo(40),
  },
];

// ─── AGENT LOCATIONS (live GPS) ──────────────────────────────────────
export const MOCK_AGENT_LOCATIONS: AgentLocation[] = OFFICES.map((office, i) => {
  const rng = seededRandom(i + 100);
  return {
    agentId: `agent-live-${office.id}`,
    agentName: ['أحمد علي', 'محمد حسن', 'علي كاظم', 'حسن عبدالله', 'كاظم جواد', 'جواد حسن', 'عباس علي', 'مرتضى كاظm', 'حسين علي', 'مهند جواد', 'سعد حسن', 'علي كاظم', 'رياض محمد', 'كرار علي', 'محمد علي'][i],
    officeId: office.id,
    lat: office.lat + (rng() - 0.5) * 0.05,
    lng: office.lng + (rng() - 0.5) * 0.05,
    accuracyMeters: rng() * 20,
    updatedAt: timeAgo(Math.floor(rng() * 4)),
  };
});

// ─── VISITOR FLOW PATHS ─────────────────────────────────────────────
export const MOCK_FLOW_PATHS: VisitorFlowPath[] = [
  { id: 'fp1', officeId: 'KRB', fromLat: 33.3152, fromLng: 44.3661, toLat: 32.6161, toLng: 44.0248, visitorCount: 145000, density: 'high', pathNameAr: 'بغداد ← كربلاء' },
  { id: 'fp2', officeId: 'NJF', fromLat: 33.3152, fromLng: 44.3661, toLat: 32.0017, toLng: 44.3369, visitorCount: 128000, density: 'high', pathNameAr: 'بغداد ← النجف' },
  { id: 'fp3', officeId: 'BBL', fromLat: 32.0017, fromLng: 44.3369, toLat: 32.6161, toLng: 44.0248, visitorCount: 96000, density: 'high', pathNameAr: 'النجف ← كربلاء' },
  { id: 'fp4', officeId: 'BAS', fromLat: 30.5085, fromLng: 47.7804, toLat: 31.8432, toLng: 47.1433, visitorCount: 45000, density: 'medium', pathNameAr: 'البصرة ← ميسان' },
  { id: 'fp5', officeId: 'MYS', fromLat: 31.8432, fromLng: 47.1433, toLat: 32.0017, toLng: 44.3369, visitorCount: 38000, density: 'medium', pathNameAr: 'ميسان ← النجف' },
  { id: 'fp6', officeId: 'WST', fromLat: 32.5405, fromLng: 45.8201, toLat: 32.0017, toLng: 44.3369, visitorCount: 28000, density: 'normal', pathNameAr: 'واسط ← النجف' },
  { id: 'fp7', officeId: 'DHQ', fromLat: 31.0626, fromLng: 46.2754, toLat: 31.3299, toLng: 45.2839, visitorCount: 22000, density: 'normal', pathNameAr: 'ذي قار ← المثنى' },
  { id: 'fp8', officeId: 'BGD', fromLat: 33.3406, fromLng: 44.4009, toLat: 32.4785, toLng: 44.4284, visitorCount: 62000, density: 'high', pathNameAr: 'بغداد ← بابل' },
  { id: 'fp9', officeId: 'QDS', fromLat: 31.9919, fromLng: 44.9200, toLat: 32.0017, toLng: 44.3369, visitorCount: 34000, density: 'medium', pathNameAr: 'الديوانية ← النجف' },
  { id: 'fp10', officeId: 'MTH', fromLat: 31.3299, fromLng: 45.2839, toLat: 32.0017, toLng: 44.3369, visitorCount: 41000, density: 'medium', pathNameAr: 'المثنى ← النجف' },
];

// ─── TIME WINDOW ────────────────────────────────────────────────────
export const MOCK_TIME_WINDOWS: TimeWindow[] = [
  { windowDate: todayStr(0), openTime: '08:00', closeTime: '09:00', isManuallyOpen: false, isManuallyClosed: false },
  { windowDate: todayStr(1), openTime: '08:00', closeTime: '09:00', isManuallyOpen: false, isManuallyClosed: false },
];

export { INITIAL_BORDER_CROSSINGS };

// ─── HELPERS ─────────────────────────────────────────────────────────
export function getOfficeName(officeId: string): string {
  return officeById(officeId)?.nameAr ?? '—';
}
export function getGovernorateName(officeId: string): string {
  return officeById(officeId)?.governorateAr ?? '—';
}
