import { describe, expect, it } from "vitest";
import { mapApplicationsView, mapEmployerDashboard, mapJobsView, mapMutationResult, mapResetResult } from "./demoMappers";

const session = {
  id: "session-1",
  campus_id: "campus-1",
  reset_version: 2,
};

const event = {
  id: "event-1",
  from_status: null,
  to_status: "pending",
  actor: "student",
  note: "学生提交演示报名",
  created_at: "2026-07-21T06:00:00Z",
};

const application = {
  id: "application-1",
  demo_job_instance_id: "job-1",
  status: "pending",
  snapshot_employer_name: "XX大学校园快递驿站",
  snapshot_legal_entity_name: "XX大学校园快递驿站（演示主体）",
  snapshot_payment_entity_name: "XX大学校园快递驿站（演示支付主体）",
  snapshot_job_title: "入库分拣",
  snapshot_work_address: "XX大学生活区东侧快递驿站（演示地址）",
  snapshot_shift_start: "2026-07-25T06:00:00Z",
  snapshot_shift_end: "2026-07-25T11:00:00Z",
  snapshot_pay_type: "hourly",
  snapshot_base_rate_cents: 1200,
  snapshot_night_bonus_cents: 0,
  snapshot_daily_rate_cents: null,
  snapshot_settlement_timing: "核定工时后当日21:00前模拟结算",
  snapshot_settlement_conditions: "招聘方确认到岗与实际工时后生成待模拟结算记录。",
  scheduled_minutes: 300,
  actual_minutes: null,
  estimated_amount_cents: 6000,
  final_amount_cents: null,
  created_at: "2026-07-21T06:00:00Z",
  updated_at: "2026-07-21T06:00:00Z",
  events: [event],
  settlement: null,
};

const job = {
  id: "job-1",
  template_id: "30000000-0000-4000-8000-000000000001",
  title: "入库分拣",
  work_content: "扫描到件并分拣",
  requirements: "按安全要求工作",
  work_address: "XX大学生活区东侧快递驿站（演示地址）",
  latitude: 30.2652,
  longitude: 120.1198,
  shift_start: "2026-07-25T06:00:00Z",
  shift_end: "2026-07-25T11:00:00Z",
  application_deadline: "2026-07-25T05:00:00Z",
  pay_type: "hourly",
  base_rate_cents: 1200,
  night_bonus_cents: 0,
  daily_rate_cents: null,
  effective_rate_cents: 1200,
  estimated_amount_cents: 6000,
  settlement_timing: "核定工时后当日21:00前模拟结算",
  settlement_conditions: "招聘方确认后生成待模拟结算记录",
  capacity: 5,
  remaining_slots: 4,
  availability_status: "open",
  scenario_kind: "main",
  published_at: "2026-07-21T06:00:00Z",
  employer_name: "XX大学校园快递驿站",
  legal_entity_name: "XX大学校园快递驿站（演示主体）",
  payment_entity_name: "XX大学校园快递驿站（演示支付主体）",
  contact_department: "驿站运营组（演示）",
  direct_hire_disclosure: "主体关系已披露",
  fee_disclosure: "不收取押金、培训费或介绍费",
  deposit_required: false,
  training_fee_required: false,
  agency_fee_required: false,
  missing_fields: [],
  risk_flags: [],
  has_applied: true,
  application_id: "application-1",
  application_status: "pending",
};

describe("Supabase RPC 输出映射", () => {
  it("将岗位snake_case响应映射为受控前端模型", () => {
    const result = mapJobsView({
      session,
      campus: { id: "campus-1", name: "XX大学", latitude: 30.2636, longitude: 120.122, timezone: "Asia/Shanghai" },
      profile: { id: "profile-1", display_name: "陈同学（演示）", available_start: job.shift_start, available_end: job.shift_end },
      jobs: [job],
    });
    expect(result.jobs[0]).toMatchObject({
      title: "入库分拣",
      estimatedAmountCents: 6000,
      remainingSlots: 4,
      hasApplied: true,
      applicationStatus: "pending",
    });
    expect(result.profile.displayName).toBe("陈同学（演示）");
  });

  it("映射报名、null到pending事件与空结算", () => {
    const result = mapApplicationsView({ applications: [application] });
    expect(result.applications[0].status).toBe("pending");
    expect(result.applications[0].events).toEqual([
      expect.objectContaining({ fromStatus: null, toStatus: "pending", actor: "student" }),
    ]);
    expect(result.applications[0].settlement).toBeNull();
  });

  it("映射招聘方工作台并保留同一报名", () => {
    const result = mapEmployerDashboard({
      session,
      employer: { id: "employer-1", display_name: "XX大学校园快递驿站", contact_department: "驿站运营组（演示）", is_demo: true },
      jobs: [{
        id: "job-1",
        template_id: job.template_id,
        title: "入库分拣",
        shift_start: job.shift_start,
        shift_end: job.shift_end,
        capacity: 5,
        remaining_slots: 4,
        availability_status: "open",
        application_count: 1,
        pending_count: 1,
      }],
      applications: [application],
    });
    expect(result.jobs[0]).toMatchObject({ applicationCount: 1, pendingCount: 1, remainingSlots: 4 });
    expect(result.applications[0].id).toBe("application-1");
  });

  it("映射报名和确认RPC的幂等标记", () => {
    expect(mapMutationResult({ application, already_existed: false }, "already_existed").repeated).toBe(false);
    expect(mapMutationResult({ application: { ...application, status: "confirmed" }, already_applied: true }, "already_applied").repeated).toBe(true);
  });

  it("映射完工、待结算金额与严格事件顺序", () => {
    const completedEvent = {
      ...event,
      id: "event-3",
      from_status: "confirmed",
      to_status: "completed",
      actor: "employer",
      note: "招聘方核定完工：270分钟",
      created_at: "2026-07-25T11:00:00Z",
    };
    const pendingSettlementEvent = {
      ...event,
      id: "event-4",
      from_status: "completed",
      to_status: "pending_settlement",
      actor: "system",
      note: "系统自动生成待模拟结算记录",
      created_at: "2026-07-25T11:00:00.001Z",
    };
    const result = mapApplicationsView({
      applications: [{
        ...application,
        status: "pending_settlement",
        actual_minutes: 270,
        final_amount_cents: 5400,
        events: [event, { ...event, id: "event-2", from_status: "pending", to_status: "confirmed", actor: "employer" }, completedEvent, pendingSettlementEvent],
        settlement: { amount_cents: 5400, status: "pending", created_at: "2026-07-25T11:00:00Z", settled_at: null },
      }],
    });
    expect(result.applications[0]).toMatchObject({
      status: "pending_settlement",
      actualMinutes: 270,
      finalAmountCents: 5400,
      settlement: { amountCents: 5400, status: "pending", settledAt: null },
    });
    expect(result.applications[0].events.map((item) => item.toStatus)).toEqual(["pending", "confirmed", "completed", "pending_settlement"]);
  });

  it("映射完工与结算RPC各自的幂等标记", () => {
    expect(mapMutationResult({ application: { ...application, status: "pending_settlement" }, already_completed: true }, "already_completed").repeated).toBe(true);
    expect(mapMutationResult({ application: { ...application, status: "settled_demo" }, already_settled: false }, "already_settled").repeated).toBe(false);
  });

  it("拒绝未知状态，避免前端伪造可见成功", () => {
    expect(() => mapApplicationsView({ applications: [{ ...application, status: "unexpected" }] })).toThrow("报名状态无效");
  });

  it("重置结果必须包含版本、校园和同步后的学生可用时间", () => {
    expect(mapResetResult({
      session,
      campus: { id: "campus-1", name: "XX大学" },
      profile: { id: "profile-1", available_start: job.shift_start, available_end: job.shift_end },
    })).toBe(2);
    expect(() => mapResetResult({ session, campus: { name: "XX大学" }, profile: null })).toThrow("重置学生返回结构无效");
  });
});
