export type Role = "student" | "employer";

export type PayType = "hourly" | "daily";

export type AvailabilityStatus = "open" | "full" | "expired" | "cancelled";

export type ApplicationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "pending_settlement"
  | "settled_demo";

export type EventStatus = ApplicationStatus | "completed";

export interface Job {
  id: string;
  templateId: string;
  title: string;
  workContent: string;
  requirements: string;
  workAddress: string;
  latitude: number;
  longitude: number;
  shiftStart: string;
  shiftEnd: string;
  applicationDeadline: string;
  payType: PayType;
  baseRateCents: number | null;
  nightBonusCents: number;
  dailyRateCents: number | null;
  settlementTiming: string;
  settlementConditions: string;
  capacity: number;
  remainingSlots: number;
  availabilityStatus: AvailabilityStatus;
  employerName: string;
  legalEntityName: string;
  paymentEntityName: string;
  contactDepartment: string;
  directHireDisclosure: string;
  depositRequired: boolean;
  trainingFeeRequired: boolean;
  agencyFeeRequired: boolean;
  feeDisclosure: string;
  effectiveRateCents: number | null;
  estimatedAmountCents: number;
  scenarioKind: "main" | "open" | "full" | "expired";
  publishedAt: string;
  missingFields: string[];
  riskFlags: string[];
  hasApplied: boolean;
  applicationId: string | null;
  applicationStatus: ApplicationStatus | null;
}

export interface ApplicationEvent {
  id: string;
  fromStatus: EventStatus | null;
  toStatus: EventStatus;
  actor: Role | "system";
  note: string | null;
  createdAt: string;
}

export interface SettlementRecord {
  amountCents: number;
  status: "pending" | "settled_demo";
  createdAt: string;
  settledAt: string | null;
}

export interface Application {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  jobTitle: string;
  employerName: string;
  legalEntityName: string;
  paymentEntityName: string;
  workAddress: string;
  shiftStart: string;
  shiftEnd: string;
  payType: PayType;
  baseRateCents: number | null;
  nightBonusCents: number;
  dailyRateCents: number | null;
  settlementTiming: string;
  settlementConditions: string;
  scheduledMinutes: number;
  actualMinutes: number | null;
  estimatedAmountCents: number;
  finalAmountCents: number | null;
  events: ApplicationEvent[];
  settlement: SettlementRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoCampus {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface DemoProfile {
  id: string;
  displayName: string;
  availableStart: string;
  availableEnd: string;
}

export interface DemoSessionSummary {
  id: string;
  campusId: string;
  resetVersion: number;
}

export interface JobsView {
  session: DemoSessionSummary;
  campus: DemoCampus;
  profile: DemoProfile;
  jobs: Job[];
}

export interface ApplicationsView {
  applications: Application[];
}

export interface EmployerSummary {
  id: string;
  displayName: string;
  contactDepartment: string;
  isDemo: boolean;
}

export interface EmployerJobSummary {
  id: string;
  templateId: string;
  title: string;
  shiftStart: string;
  shiftEnd: string;
  capacity: number;
  remainingSlots: number;
  availabilityStatus: AvailabilityStatus;
  applicationCount: number;
  pendingCount: number;
}

export interface EmployerDashboard {
  session: DemoSessionSummary;
  employer: EmployerSummary;
  jobs: EmployerJobSummary[];
  applications: Application[];
}

export interface ApplicationMutationResult {
  application: Application;
  repeated: boolean;
}
