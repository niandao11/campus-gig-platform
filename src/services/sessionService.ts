import * as repository from "../data/demoRepository";
import { isSupabaseConfigured } from "../lib/supabase";
import { mapJobsView } from "./demoMappers";

export interface SessionBootstrapResult {
  configured: boolean;
  ready: boolean;
  error: string | null;
}

export async function bootstrapDemoSession(): Promise<SessionBootstrapResult> {
  if (!isSupabaseConfigured) {
    return { configured: false, ready: false, error: null };
  }

  try {
    const existing = await repository.readAuthSession();
    if (!existing) await repository.createAnonymousSession();
    await repository.initializeSession();
    const jobs = mapJobsView(await repository.readJobs());
    if (jobs.campus.name !== "XX大学" || jobs.jobs.length !== 5) {
      return { configured: true, ready: false, error: "云端岗位基线不完整，应返回5条演示班次" };
    }
  } catch (error) {
    const detail = error instanceof repository.DemoRepositoryError ? error.causeMessage : null;
    return { configured: true, ready: false, error: detail || "云端连接失败，请稍后重试。" };
  }

  return { configured: true, ready: true, error: null };
}
