import { supabase } from "../lib/supabase";

export interface SessionBootstrapResult {
  configured: boolean;
  ready: boolean;
  error: string | null;
}

export async function bootstrapDemoSession(): Promise<SessionBootstrapResult> {
  if (!supabase) {
    return { configured: false, ready: false, error: null };
  }

  const existing = await supabase.auth.getSession();
  if (existing.error) {
    return { configured: true, ready: false, error: "读取匿名演示会话失败，请重试。" };
  }

  if (!existing.data.session) {
    const signIn = await supabase.auth.signInAnonymously();
    if (signIn.error) {
      return { configured: true, ready: false, error: "匿名演示身份建立失败，请确认云端已开启匿名登录。" };
    }
  }

  const initialization = await supabase.rpc("initialize_demo_session");
  if (initialization.error) {
    return { configured: true, ready: false, error: "演示数据初始化失败，请检查云端数据库配置。" };
  }

  const initialized = initialization.data as { session?: { id?: unknown }; campus?: { name?: unknown } } | null;
  if (typeof initialized?.session?.id !== "string" || initialized.campus?.name !== "XX大学") {
    return { configured: true, ready: false, error: "云端会话返回结构不完整" };
  }

  const jobsResult = await supabase.rpc("get_current_demo_jobs");
  if (jobsResult.error) {
    return { configured: true, ready: false, error: "演示岗位读取失败，请稍后重试。" };
  }

  const jobsPayload = jobsResult.data as { jobs?: unknown[] } | null;
  if (!Array.isArray(jobsPayload?.jobs) || jobsPayload.jobs.length !== 5) {
    return { configured: true, ready: false, error: "云端岗位基线不完整，应返回5条演示班次" };
  }

  return { configured: true, ready: true, error: null };
}
