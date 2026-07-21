import type { ApplicationStatus, EventStatus } from "../types/demo";

const transitions: Record<ApplicationStatus, readonly EventStatus[]> = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["completed"],
  rejected: [],
  cancelled: [],
  pending_settlement: ["settled_demo"],
  settled_demo: [],
};

export function canTransition(from: ApplicationStatus, to: EventStatus): boolean {
  if (from === "confirmed" && to === "completed") return true;
  return transitions[from].includes(to);
}

export function visibleStatusLabel(status: EventStatus): string {
  const labels: Record<EventStatus, string> = {
    pending: "待招聘方确认",
    confirmed: "报名已确认",
    rejected: "报名未通过",
    cancelled: "报名已取消",
    completed: "工作已完成",
    pending_settlement: "待模拟结算",
    settled_demo: "已结算（Demo模拟）",
  };
  return labels[status];
}
