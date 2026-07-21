import { describe, expect, it } from "vitest";
import { calculateAmountCents, haversineDistanceKm } from "./calculations";

describe("calculateAmountCents", () => {
  it("按分钟四舍五入计算时薪", () => {
    expect(calculateAmountCents("hourly", 61, 1200, 0, null)).toBe(1220);
  });

  it("将夜班补贴用于全部分钟", () => {
    expect(calculateAmountCents("hourly", 180, 1200, 400, null)).toBe(4800);
  });

  it("日薪不重复乘工时", () => {
    expect(calculateAmountCents("daily", 480, null, 0, 8800)).toBe(8800);
  });

  it("拒绝无效工时", () => {
    expect(() => calculateAmountCents("hourly", 0, 1200, 0, null)).toThrow();
  });
});

describe("haversineDistanceKm", () => {
  it("相同坐标距离为零", () => {
    expect(haversineDistanceKm({ latitude: 30, longitude: 120 }, { latitude: 30, longitude: 120 })).toBe(0);
  });
});
