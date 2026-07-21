import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  readAuthSession: vi.fn(),
  createAnonymousSession: vi.fn(),
  initializeSession: vi.fn(),
  readJobs: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({ isSupabaseConfigured: true }));

vi.mock("../data/demoRepository", () => {
  class DemoRepositoryError extends Error {
    constructor(message: string, readonly causeMessage?: string) {
      super(message);
      this.name = "DemoRepositoryError";
    }
  }
  return { ...repositoryMocks, DemoRepositoryError };
});

import * as repository from "../data/demoRepository";
import { bootstrapDemoSession } from "./sessionService";

describe("匿名演示会话故障反馈", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("保留云端中文错误且不伪造ready", async () => {
    repositoryMocks.readAuthSession.mockRejectedValue(
      new repository.DemoRepositoryError("读取失败", "匿名登录服务暂时不可用"),
    );

    await expect(bootstrapDemoSession()).resolves.toEqual({
      configured: true,
      ready: false,
      error: "匿名登录服务暂时不可用",
    });
    expect(repositoryMocks.initializeSession).not.toHaveBeenCalled();
  });

  it("未知网络错误返回安全重试文案", async () => {
    repositoryMocks.readAuthSession.mockRejectedValue(new Error("fetch failed: internal details"));

    await expect(bootstrapDemoSession()).resolves.toEqual({
      configured: true,
      ready: false,
      error: "云端连接失败，请稍后重试。",
    });
  });
});
