import type { Job } from "../types/demo";

export function calculateMinutes(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000));
}

export function effectiveHourlyRateCents(job: Pick<Job, "baseRateCents" | "nightBonusCents">): number {
  return (job.baseRateCents ?? 0) + job.nightBonusCents;
}

export function calculateAmountCents(
  payType: Job["payType"],
  minutes: number,
  baseRateCents: number | null,
  nightBonusCents: number,
  dailyRateCents: number | null,
): number {
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new Error("工时必须是正整数分钟");
  }

  if (payType === "daily") {
    if (dailyRateCents === null || dailyRateCents <= 0) {
      throw new Error("日薪配置无效");
    }
    return dailyRateCents;
  }

  if (baseRateCents === null || baseRateCents <= 0 || nightBonusCents < 0) {
    throw new Error("时薪配置无效");
  }

  return Math.round(((baseRateCents + nightBonusCents) * minutes) / 60);
}

export function haversineDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const radius = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRad(to.latitude - from.latitude);
  const deltaLongitude = toRad(to.longitude - from.longitude);
  const latitude1 = toRad(from.latitude);
  const latitude2 = toRad(to.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
