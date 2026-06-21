export type Role = 'director' | 'supervisor' | 'manager' | 'agent' | 'viewer';

export interface Profile {
  id: string;
  fullNameAr: string;
  role: Role;
  officeId: string;
  permittedOfficeIds: string[];
  specialPermissions: {
    canExport: boolean;
    canAddCrossings: boolean;
    canViewAllOffices: boolean;
    canOpenWindow: boolean;
    canEditReports: boolean;
  };
  isActive: boolean;
  createdAt: string;
  password?: string; // For admin management only
}

export interface DailyReport {
  id: string;
  officeId: string;
  submittedBy: string;
  reportDate: string; // YYYY-MM-DD
  submittedAt: string;
  isLateSubmission: boolean;
  deploymentCount: number;
  deploymentLocations: string;
  deploymentFormations: string;
  coordinationSectors: string;
  coordinationJointOps: string;
  incidentsCount: number;
  incidentsDetails: string;
  violationsCount: number;
  violationsArea: string;
  violationsTimeDetail: string;
  violationsDetails: string;
  deathsCount: number;
  deathsLocationMgrs: string;
  deathsActionTaken: string;
  resourcesDistributed: number;
  resourcesDetails: string;
  eventsCount: number;
  eventsDetails: string;
  eventsCoordinates: { lat: number; lng: number; label?: string }[];
  visitsCount: number;
  visitsSummary: string;
  visitorsIn: number;
  visitorsOut: number;
  visitorsRoutes: string;
  vehiclesCount: number;
  vehiclesDetails: string;
  processionsCount: number;
  processionsDetails: string;
  processionWaypoints: { lat: number; lng: number }[];
  otherNotes: string;
  reporterLat?: number;
  reporterLng?: number;
  mgrsReference?: string;
  /** Free-form values for dynamically added (non-built-in) fields. */
  extraFields?: Record<string, any>;
}

export interface ExtensionRequest {
  id: string;
  requestedById: string;
  requestedByName: string;
  officeId: string;
  requestTime: string;
  reason: string;
  status: 'pending' | 'forwarded_to_supervisor' | 'approved' | 'rejected';
  managerReviewedById?: string;
  managerReviewedAt?: string;
  supervisorApprovedById?: string;
  supervisorApprovedAt?: string;
  extensionWindowEnd?: string;
  /** The operational day (YYYY-MM-DD) this extension applies to. */
  targetReportDate?: string;
  /** Set once a report is submitted using this extension — prevents reuse. */
  consumedAt?: string;
}

export interface Emergency {
  id: string;
  reportedById: string;
  reportedByName: string;
  officeId: string;
  emergencyType: string;
  description: string;
  locationMgrs?: string;
  lat?: number;
  lng?: number;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedById?: string;
  acknowledgedAt?: string;
  resolvedById?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface AgentLocation {
  agentId: string;
  agentName: string;
  officeId: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  updatedAt: string;
}

export interface VisitorFlowPath {
  id: string;
  officeId: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  visitorCount: number;
  density: 'high' | 'medium' | 'normal';
  pathNameAr: string;
}

export interface TimeWindow {
  windowDate: string;
  openTime: string;   // HH:MM
  closeTime: string;  // HH:MM
  isManuallyOpen: boolean;
  isManuallyClosed: boolean;
}

export type TimeWindowStatus = 'closed' | 'open' | 'pre_warning' | 'locked';

// ─── Dynamic report-field definitions (admin-editable) ───────────────
export type ReportFieldType =
  | 'number' | 'text' | 'textarea'
  | 'location' | 'multi_location' | 'route'
  | 'date' | 'time' | 'select';

export interface ReportFieldGroup {
  id: string;
  titleAr: string;
  sortOrder: number;
  isHidden: boolean;
}

export interface ReportFieldDefinition {
  id: string;
  groupId: string;
  fieldKey: string;
  labelAr: string;
  descriptionAr?: string | null;
  placeholderAr?: string | null;
  fieldType: ReportFieldType;
  sortOrder: number;
  maxLength?: number | null;
  isHidden: boolean;
  isBuiltIn: boolean;
  countInStats: boolean;
  statLabelAr?: string | null;
  allowedUserIds: string[]; // empty = visible to all
  /** For `select` fields: the allowed options the data-entry user can pick. */
  options: string[];
  /** For `select` fields: show a quantity input + allow adding multiple items. */
  withQuantity: boolean;
  /** For `select` fields: add an "أخرى" option that lets the user type freely. */
  allowFreeText: boolean;
}

/** A single picked item for a `select`+quantity field. */
export interface SelectQtyItem {
  item: string;
  qty: number;
}
