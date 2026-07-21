import * as repository from "../data/demoRepository";
import type { ApplicationMutationResult, ApplicationsView, EmployerDashboard, JobsView } from "../types/demo";
import {
  mapApplicationsView,
  mapEmployerDashboard,
  mapJobsView,
  mapMutationResult,
  mapResetResult,
} from "./demoMappers";

export class DemoServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoServiceError";
  }
}

async function execute<T>(operation: () => Promise<unknown>, map: (value: unknown) => T, fallback: string): Promise<T> {
  try {
    return map(await operation());
  } catch (error) {
    const detail = error instanceof repository.DemoRepositoryError ? error.causeMessage : null;
    const userSafeDetail = detail && /[\u3400-\u9fff]/u.test(detail) ? detail : null;
    throw new DemoServiceError(userSafeDetail || fallback);
  }
}

export function getJobs(): Promise<JobsView> {
  return execute(repository.readJobs, mapJobsView, "岗位读取失败，请稍后重试");
}

export function getApplications(): Promise<ApplicationsView> {
  return execute(repository.readApplications, mapApplicationsView, "报名记录读取失败，请稍后重试");
}

export function getEmployerDashboard(): Promise<EmployerDashboard> {
  return execute(repository.readEmployerDashboard, mapEmployerDashboard, "招聘方工作台读取失败，请稍后重试");
}

export function submitApplication(instanceId: string): Promise<ApplicationMutationResult> {
  return execute(
    () => repository.applyToJob(instanceId),
    (value) => mapMutationResult(value, "already_existed"),
    "报名提交失败，请稍后重试",
  );
}

export function approveApplication(applicationId: string): Promise<ApplicationMutationResult> {
  return execute(
    () => repository.confirmApplication(applicationId),
    (value) => mapMutationResult(value, "already_applied"),
    "报名确认失败，请稍后重试",
  );
}

export function rejectApplication(applicationId: string, reason: string): Promise<ApplicationMutationResult> {
  return execute(
    () => repository.rejectApplication(applicationId, reason),
    (value) => mapMutationResult(value, "already_applied"),
    "报名拒绝失败，请核对原因后重试",
  );
}

export function cancelApplication(applicationId: string): Promise<ApplicationMutationResult> {
  return execute(
    () => repository.cancelApplication(applicationId),
    (value) => mapMutationResult(value, "already_cancelled"),
    "取消报名失败，请稍后重试",
  );
}

export function finishApplication(applicationId: string, actualMinutes: number): Promise<ApplicationMutationResult> {
  return execute(
    () => repository.completeApplication(applicationId, actualMinutes),
    (value) => mapMutationResult(value, "already_completed"),
    "完工核定失败，请核对实际分钟后重试",
  );
}

export function confirmDemoSettlement(applicationId: string): Promise<ApplicationMutationResult> {
  return execute(
    () => repository.settleDemo(applicationId),
    (value) => mapMutationResult(value, "already_settled"),
    "Demo模拟结算失败，请稍后重试",
  );
}

export async function resetCurrentDemo(): Promise<void> {
  await execute(repository.resetSession, mapResetResult, "Demo重置失败，请稍后重试");
}
