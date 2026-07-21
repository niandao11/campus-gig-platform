import { describe, expect, it } from "vitest";
import type { Job, JobsView } from "../types/demo";
import { defaultJobFilters, filterJobs, jobCode, matchesStudentAvailability } from "./jobDiscovery";

const baseJob = {
  id: "job-1",
  templateId: "30000000-0000-4000-8000-000000000001",
  title: "入库分拣",
  shiftStart: "2026-07-25T06:00:00Z",
  shiftEnd: "2026-07-25T11:00:00Z",
  payType: "hourly",
  settlementTiming: "核定工时后当日21:00前模拟结算",
  latitude: 30.2652,
  longitude: 120.1198,
} as Job;

const view = {
  campus: { latitude: 30.2636, longitude: 120.122 },
  profile: {
    availableStart: baseJob.shiftStart,
    availableEnd: baseJob.shiftEnd,
  },
  jobs: [
    baseJob,
    {
      ...baseJob,
      id: "job-2",
      templateId: "30000000-0000-4000-8000-000000000002",
      shiftStart: "2026-07-25T14:00:00Z",
      shiftEnd: "2026-07-25T17:00:00Z",
      settlementTiming: "次日12:00前模拟结算",
    },
    {
      ...baseJob,
      id: "job-4",
      templateId: "30000000-0000-4000-8000-000000000004",
      shiftStart: "2026-07-26T01:00:00Z",
      shiftEnd: "2026-07-26T09:00:00Z",
      payType: "daily",
      settlementTiming: "次日18:00前模拟结算",
    },
  ],
} as JobsView;

describe("岗位发现规则", () => {
  it("生成稳定岗位编号", () => {
    expect(jobCode(baseJob)).toBe("J-01");
  });

  it("仅将完整落在可用时段内的岗位标为匹配", () => {
    expect(matchesStudentAvailability(view.jobs[0], view.profile)).toBe(true);
    expect(matchesStudentAvailability(view.jobs[1], view.profile)).toBe(false);
  });

  it("多条件使用AND关系", () => {
    expect(filterJobs(view, { ...defaultJobFilters, date: "sunday", pay: "daily", settlement: "next_day" }))
      .toEqual([view.jobs[2]]);
  });

  it("周六与次日结算可以组合筛选", () => {
    expect(filterJobs(view, { ...defaultJobFilters, date: "saturday", settlement: "next_day" }).map((job) => job.id))
      .toEqual(["job-2"]);
  });
});
