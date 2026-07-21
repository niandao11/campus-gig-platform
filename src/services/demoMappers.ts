import type {
  Application,
  ApplicationEvent,
  ApplicationMutationResult,
  ApplicationStatus,
  ApplicationsView,
  AvailabilityStatus,
  DemoCampus,
  DemoProfile,
  DemoSessionSummary,
  EmployerDashboard,
  EmployerJobSummary,
  EmployerSummary,
  EventStatus,
  Job,
  JobsView,
  PayType,
  Role,
  SettlementRecord,
} from "../types/demo";

type JsonObject = Record<string, unknown>;

const applicationStatuses: ApplicationStatus[] = [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "pending_settlement",
  "settled_demo",
];
const eventStatuses: EventStatus[] = [...applicationStatuses, "completed"];
const availabilityStatuses: AvailabilityStatus[] = ["open", "full", "expired", "cancelled"];

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}返回结构无效`);
  }
  return value as JsonObject;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}返回结构无效`);
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label}缺失`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return string(value, label);
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label}无效`);
  return value;
}

function nullableNumber(value: unknown, label: string): number | null {
  if (value === null) return null;
  return number(value, label);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label}无效`);
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${label}无效`);
  return value as T;
}

function stringArray(value: unknown, label: string): string[] {
  return array(value, label).map((item, index) => string(item, `${label}[${index}]`));
}

function mapSession(value: unknown): DemoSessionSummary {
  const raw = object(value, "会话");
  return {
    id: string(raw.id, "会话ID"),
    campusId: string(raw.campus_id, "校园ID"),
    resetVersion: number(raw.reset_version, "重置版本"),
  };
}

function mapCampus(value: unknown): DemoCampus {
  const raw = object(value, "校园");
  return {
    id: string(raw.id, "校园ID"),
    name: string(raw.name, "校园名称"),
    latitude: number(raw.latitude, "校园纬度"),
    longitude: number(raw.longitude, "校园经度"),
    timezone: string(raw.timezone, "校园时区"),
  };
}

function mapProfile(value: unknown): DemoProfile {
  const raw = object(value, "演示学生");
  return {
    id: string(raw.id, "学生ID"),
    displayName: string(raw.display_name, "学生名称"),
    availableStart: string(raw.available_start, "可用开始时间"),
    availableEnd: string(raw.available_end, "可用结束时间"),
  };
}

export function mapJob(value: unknown): Job {
  const raw = object(value, "岗位");
  const applicationStatus = raw.application_status === null
    ? null
    : enumValue(raw.application_status, applicationStatuses, "报名状态");
  return {
    id: string(raw.id, "岗位ID"),
    templateId: string(raw.template_id, "岗位模板ID"),
    title: string(raw.title, "岗位标题"),
    workContent: string(raw.work_content, "工作内容"),
    requirements: string(raw.requirements, "岗位要求"),
    workAddress: string(raw.work_address, "工作地址"),
    latitude: number(raw.latitude, "岗位纬度"),
    longitude: number(raw.longitude, "岗位经度"),
    shiftStart: string(raw.shift_start, "班次开始时间"),
    shiftEnd: string(raw.shift_end, "班次结束时间"),
    applicationDeadline: string(raw.application_deadline, "报名截止时间"),
    payType: enumValue(raw.pay_type, ["hourly", "daily"] satisfies PayType[], "计价类型"),
    baseRateCents: nullableNumber(raw.base_rate_cents, "基础时薪"),
    nightBonusCents: number(raw.night_bonus_cents, "夜班补贴"),
    dailyRateCents: nullableNumber(raw.daily_rate_cents, "日薪"),
    settlementTiming: string(raw.settlement_timing, "结算时间"),
    settlementConditions: string(raw.settlement_conditions, "结算条件"),
    capacity: number(raw.capacity, "岗位容量"),
    remainingSlots: number(raw.remaining_slots, "剩余名额"),
    availabilityStatus: enumValue(raw.availability_status, availabilityStatuses, "可报名状态"),
    employerName: string(raw.employer_name, "招聘主体"),
    legalEntityName: string(raw.legal_entity_name, "用工主体"),
    paymentEntityName: string(raw.payment_entity_name, "支付主体"),
    contactDepartment: string(raw.contact_department, "联系部门"),
    directHireDisclosure: string(raw.direct_hire_disclosure, "直招披露"),
    depositRequired: boolean(raw.deposit_required, "押金字段"),
    trainingFeeRequired: boolean(raw.training_fee_required, "培训费字段"),
    agencyFeeRequired: boolean(raw.agency_fee_required, "介绍费字段"),
    feeDisclosure: string(raw.fee_disclosure, "收费披露"),
    effectiveRateCents: nullableNumber(raw.effective_rate_cents, "有效时薪"),
    estimatedAmountCents: number(raw.estimated_amount_cents, "预计收入"),
    scenarioKind: enumValue(raw.scenario_kind, ["main", "open", "full", "expired"], "岗位场景"),
    publishedAt: string(raw.published_at, "发布时间"),
    missingFields: stringArray(raw.missing_fields, "缺失字段"),
    riskFlags: stringArray(raw.risk_flags, "风险线索"),
    hasApplied: boolean(raw.has_applied, "是否已报名"),
    applicationId: nullableString(raw.application_id, "报名ID"),
    applicationStatus,
  };
}

function mapEvent(value: unknown): ApplicationEvent {
  const raw = object(value, "报名事件");
  const actor = enumValue(raw.actor, ["student", "employer", "system"] satisfies Array<Role | "system">, "事件角色");
  return {
    id: string(raw.id, "事件ID"),
    fromStatus: raw.from_status === null ? null : enumValue(raw.from_status, eventStatuses, "事件原状态"),
    toStatus: enumValue(raw.to_status, eventStatuses, "事件目标状态"),
    actor,
    note: nullableString(raw.note, "事件说明"),
    createdAt: string(raw.created_at, "事件时间"),
  };
}

function mapSettlement(value: unknown): SettlementRecord | null {
  if (value === null) return null;
  const raw = object(value, "结算记录");
  return {
    amountCents: number(raw.amount_cents, "结算金额"),
    status: enumValue(raw.status, ["pending", "settled_demo"], "结算状态"),
    createdAt: string(raw.created_at, "结算创建时间"),
    settledAt: nullableString(raw.settled_at, "结算完成时间"),
  };
}

export function mapApplication(value: unknown): Application {
  const raw = object(value, "报名");
  return {
    id: string(raw.id, "报名ID"),
    jobId: string(raw.demo_job_instance_id, "岗位ID"),
    status: enumValue(raw.status, applicationStatuses, "报名状态"),
    jobTitle: string(raw.snapshot_job_title, "岗位标题"),
    employerName: string(raw.snapshot_employer_name, "招聘主体"),
    legalEntityName: string(raw.snapshot_legal_entity_name, "用工主体"),
    paymentEntityName: string(raw.snapshot_payment_entity_name, "支付主体"),
    workAddress: string(raw.snapshot_work_address, "工作地址"),
    shiftStart: string(raw.snapshot_shift_start, "班次开始时间"),
    shiftEnd: string(raw.snapshot_shift_end, "班次结束时间"),
    payType: enumValue(raw.snapshot_pay_type, ["hourly", "daily"] satisfies PayType[], "计价类型"),
    baseRateCents: nullableNumber(raw.snapshot_base_rate_cents, "基础时薪"),
    nightBonusCents: number(raw.snapshot_night_bonus_cents, "夜班补贴"),
    dailyRateCents: nullableNumber(raw.snapshot_daily_rate_cents, "日薪"),
    settlementTiming: string(raw.snapshot_settlement_timing, "结算时间"),
    settlementConditions: string(raw.snapshot_settlement_conditions, "结算条件"),
    scheduledMinutes: number(raw.scheduled_minutes, "计划分钟"),
    actualMinutes: nullableNumber(raw.actual_minutes, "实际分钟"),
    estimatedAmountCents: number(raw.estimated_amount_cents, "预计金额"),
    finalAmountCents: nullableNumber(raw.final_amount_cents, "最终金额"),
    events: array(raw.events, "事件列表").map(mapEvent),
    settlement: mapSettlement(raw.settlement),
    createdAt: string(raw.created_at, "报名创建时间"),
    updatedAt: string(raw.updated_at, "报名更新时间"),
  };
}

export function mapJobsView(value: unknown): JobsView {
  const raw = object(value, "岗位视图");
  return {
    session: mapSession(raw.session),
    campus: mapCampus(raw.campus),
    profile: mapProfile(raw.profile),
    jobs: array(raw.jobs, "岗位列表").map(mapJob),
  };
}

export function mapApplicationsView(value: unknown): ApplicationsView {
  const raw = object(value, "报名视图");
  return { applications: array(raw.applications, "报名列表").map(mapApplication) };
}

function mapEmployer(value: unknown): EmployerSummary {
  const raw = object(value, "招聘方");
  return {
    id: string(raw.id, "招聘方ID"),
    displayName: string(raw.display_name, "招聘方名称"),
    contactDepartment: string(raw.contact_department, "联系部门"),
    isDemo: boolean(raw.is_demo, "演示标记"),
  };
}

function mapEmployerJob(value: unknown): EmployerJobSummary {
  const raw = object(value, "招聘方岗位");
  return {
    id: string(raw.id, "岗位ID"),
    templateId: string(raw.template_id, "岗位模板ID"),
    title: string(raw.title, "岗位标题"),
    shiftStart: string(raw.shift_start, "班次开始时间"),
    shiftEnd: string(raw.shift_end, "班次结束时间"),
    capacity: number(raw.capacity, "岗位容量"),
    remainingSlots: number(raw.remaining_slots, "剩余名额"),
    availabilityStatus: enumValue(raw.availability_status, availabilityStatuses, "可报名状态"),
    applicationCount: number(raw.application_count, "报名数"),
    pendingCount: number(raw.pending_count, "待处理数"),
  };
}

export function mapEmployerDashboard(value: unknown): EmployerDashboard {
  const raw = object(value, "招聘方工作台");
  return {
    session: mapSession(raw.session),
    employer: mapEmployer(raw.employer),
    jobs: array(raw.jobs, "招聘方岗位列表").map(mapEmployerJob),
    applications: array(raw.applications, "招聘方报名列表").map(mapApplication),
  };
}

export function mapMutationResult(value: unknown, repeatedKey: string): ApplicationMutationResult {
  const raw = object(value, "操作结果");
  return {
    application: mapApplication(raw.application),
    repeated: boolean(raw[repeatedKey], "幂等标记"),
  };
}

export function mapResetResult(value: unknown): number {
  const raw = object(value, "重置结果");
  const resetSession = mapSession(raw.session);
  const campus = object(raw.campus, "重置校园");
  const profile = object(raw.profile, "重置学生");
  string(campus.name, "重置校园名称");
  string(profile.id, "重置学生ID");
  string(profile.available_start, "重置学生可用开始时间");
  string(profile.available_end, "重置学生可用结束时间");
  return resetSession.resetVersion;
}
