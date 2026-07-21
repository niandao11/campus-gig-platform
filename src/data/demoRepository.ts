import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export class DemoRepositoryError extends Error {
  constructor(message: string, readonly causeMessage?: string) {
    super(message);
    this.name = "DemoRepositoryError";
  }
}

function requireClient() {
  if (!supabase) {
    throw new DemoRepositoryError("当前环境尚未配置云数据库");
  }
  return supabase;
}

async function callRpc(functionName: string, parameters?: Record<string, unknown>): Promise<unknown> {
  const client = requireClient();
  const { data, error } = await client.rpc(functionName, parameters);
  if (error) {
    throw new DemoRepositoryError("云端操作失败", error.message);
  }
  return data;
}

export async function readAuthSession(): Promise<Session | null> {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new DemoRepositoryError("读取匿名演示会话失败", error.message);
  }
  return data.session;
}

export async function createAnonymousSession(): Promise<Session> {
  const client = requireClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) {
    throw new DemoRepositoryError("匿名演示身份建立失败", error?.message);
  }
  return data.session;
}

export function initializeSession(): Promise<unknown> {
  return callRpc("initialize_demo_session");
}

export function readJobs(): Promise<unknown> {
  return callRpc("get_current_demo_jobs");
}

export function readApplications(): Promise<unknown> {
  return callRpc("get_current_demo_applications");
}

export function readEmployerDashboard(): Promise<unknown> {
  return callRpc("get_current_demo_dashboard");
}

export function applyToJob(instanceId: string): Promise<unknown> {
  return callRpc("apply_to_job", { p_instance_id: instanceId });
}

export function confirmApplication(applicationId: string): Promise<unknown> {
  return callRpc("decide_application", {
    p_application_id: applicationId,
    p_decision: "confirm",
    p_reason: null,
  });
}

export function resetSession(): Promise<unknown> {
  return callRpc("reset_demo_session");
}
