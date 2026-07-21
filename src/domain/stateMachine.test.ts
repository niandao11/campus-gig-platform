import { describe, expect, it } from "vitest";
import { canTransition, visibleStatusLabel } from "./stateMachine";

describe("application state machine", () => {
  it("允许主流程合法跳转", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "completed")).toBe(true);
    expect(canTransition("pending_settlement", "settled_demo")).toBe(true);
  });

  it("拒绝跨级跳转", () => {
    expect(canTransition("pending", "settled_demo")).toBe(false);
    expect(canTransition("confirmed", "cancelled")).toBe(false);
  });

  it("使用统一模拟结算文案", () => {
    expect(visibleStatusLabel("settled_demo")).toContain("Demo模拟");
  });
});
