import { describe, expect, it } from "vitest";
import type { ApplicationStatus, EventStatus } from "../types/demo";
import { canTransition, visibleStatusLabel } from "./stateMachine";

const currentStatuses: ApplicationStatus[] = [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "pending_settlement",
  "settled_demo",
];
const eventStatuses: EventStatus[] = [...currentStatuses, "completed"];

const allowed = new Set([
  "pending→confirmed",
  "pending→rejected",
  "pending→cancelled",
  "confirmed→completed",
  "pending_settlement→settled_demo",
]);

describe("报名状态机", () => {
  it("完整枚举每个合法和非法跳转", () => {
    for (const from of currentStatuses) {
      for (const to of eventStatuses) {
        expect(canTransition(from, to), `${from}→${to}`).toBe(allowed.has(`${from}→${to}`));
      }
    }
  });

  it("禁止pending跨级到完工、待结算或已结算", () => {
    expect(canTransition("pending", "completed")).toBe(false);
    expect(canTransition("pending", "pending_settlement")).toBe(false);
    expect(canTransition("pending", "settled_demo")).toBe(false);
  });

  it("所有终态都不能继续流转", () => {
    for (const terminal of ["rejected", "cancelled", "settled_demo"] satisfies ApplicationStatus[]) {
      expect(eventStatuses.every((target) => !canTransition(terminal, target))).toBe(true);
    }
  });

  it("统一使用清晰中文状态且明确Demo模拟", () => {
    expect(visibleStatusLabel("pending")).toBe("待招聘方确认");
    expect(visibleStatusLabel("confirmed")).toBe("报名已确认");
    expect(visibleStatusLabel("settled_demo")).toBe("已结算（Demo模拟）");
  });
});
