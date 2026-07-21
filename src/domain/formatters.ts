import type { ApplicationStatus, AvailabilityStatus, Job } from "../types/demo";
import { formatCurrency } from "./calculations";
import { visibleStatusLabel } from "./stateMachine";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatBeijingDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatShift(startIso: string, endIso: string): string {
  return `${formatBeijingDateTime(startIso)}–${timeFormatter.format(new Date(endIso))}`;
}

export function formatPay(job: Pick<Job, "payType" | "effectiveRateCents" | "dailyRateCents">): string {
  if (job.payType === "daily") return `${formatCurrency(job.dailyRateCents ?? 0)}/日`;
  return `${formatCurrency(job.effectiveRateCents ?? 0)}/小时`;
}

export function availabilityLabel(status: AvailabilityStatus): string {
  const labels: Record<AvailabilityStatus, string> = {
    open: "报名开放",
    full: "名额已满",
    expired: "报名已截止",
    cancelled: "岗位已取消",
  };
  return labels[status];
}

export function applicationLabel(status: ApplicationStatus): string {
  return visibleStatusLabel(status);
}
