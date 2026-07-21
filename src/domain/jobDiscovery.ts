import type { DemoProfile, Job, JobsView } from "../types/demo";
import { haversineDistanceKm } from "./calculations";

export type DateFilter = "all" | "matches" | "saturday" | "sunday";
export type PayFilter = "all" | "hourly" | "daily";
export type SettlementFilter = "all" | "same_day" | "next_day";

export interface JobFilters {
  date: DateFilter;
  pay: PayFilter;
  settlement: SettlementFilter;
  withinFiveKm: boolean;
}

export const defaultJobFilters: JobFilters = {
  date: "all",
  pay: "all",
  settlement: "all",
  withinFiveKm: false,
};

export function jobCode(job: Pick<Job, "templateId">): string {
  const sequence = Number.parseInt(job.templateId.slice(-4), 10);
  return Number.isFinite(sequence) ? `J-${String(sequence).padStart(2, "0")}` : "岗位";
}

export function matchesStudentAvailability(job: Pick<Job, "shiftStart" | "shiftEnd">, profile: Pick<DemoProfile, "availableStart" | "availableEnd">): boolean {
  return Date.parse(job.shiftStart) >= Date.parse(profile.availableStart)
    && Date.parse(job.shiftEnd) <= Date.parse(profile.availableEnd);
}

function beijingWeekday(iso: string): "saturday" | "sunday" | "other" {
  const label = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "long",
  }).format(new Date(iso));
  if (label.includes("六")) return "saturday";
  if (label.includes("日") || label.includes("天")) return "sunday";
  return "other";
}

function settlementGroup(timing: string): Exclude<SettlementFilter, "all"> {
  return timing.includes("次日") ? "next_day" : "same_day";
}

export function filterJobs(view: JobsView, filters: JobFilters): Job[] {
  return view.jobs.filter((job) => {
    const dateMatches = filters.date === "all"
      || (filters.date === "matches" && matchesStudentAvailability(job, view.profile))
      || beijingWeekday(job.shiftStart) === filters.date;
    const payMatches = filters.pay === "all" || job.payType === filters.pay;
    const settlementMatches = filters.settlement === "all" || settlementGroup(job.settlementTiming) === filters.settlement;
    const distanceMatches = !filters.withinFiveKm || haversineDistanceKm(view.campus, job) <= 5;
    return dateMatches && payMatches && settlementMatches && distanceMatches;
  });
}

