import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { isSupabaseConfigured } from "./lib/supabase";
import { FoundationPage } from "./pages/FoundationPage";
import { bootstrapDemoSession } from "./services/sessionService";
type SessionState = "loading" | "ready" | "unconfigured" | "error";

export default function App() {
  const location = useLocation();
  const role = location.pathname.startsWith("/employer") ? "employer" : "student";
  const [sessionState, setSessionState] = useState<SessionState>(isSupabaseConfigured ? "loading" : "unconfigured");
  const [sessionError, setSessionError] = useState<string | null>(null);

  const connectDemoSession = useCallback(async () => {
    setSessionState(isSupabaseConfigured ? "loading" : "unconfigured");
    setSessionError(null);
    const result = await bootstrapDemoSession();
    if (!result.configured) setSessionState("unconfigured");
    else if (result.ready) setSessionState("ready");
    else {
      setSessionError(result.error ?? "云端连接失败，请稍后重试。");
      setSessionState("error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    bootstrapDemoSession().then((result) => {
      if (cancelled) return;
      if (!result.configured) setSessionState("unconfigured");
      else if (result.ready) setSessionState("ready");
      else {
        setSessionError(result.error ?? "云端连接失败，请稍后重试。");
        setSessionState("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell role={role} sessionState={sessionState}>
      <Routes>
        <Route path="/" element={<Navigate replace to="/student/jobs" />} />
        <Route
          path="/student/jobs"
          element={
            <FoundationPage
              eyebrow="学生端 · 岗位发现"
              title="把周末空闲，变成一份透明的校园零工"
              description="基于时间、距离、计价和结算规则，选择 XX大学校园快递驿站的合成演示班次。"
              sessionState={sessionState}
              sessionError={sessionError}
              onRetry={connectDemoSession}
            />
          }
        />
        <Route path="/student/compare" element={<FoundationPage eyebrow="学生端 · 岗位比较" title="关键条件，一屏比较" description="比较班次、有效时薪、预计收入和结算约定。" sessionState={sessionState} sessionError={sessionError} onRetry={connectDemoSession} />} />
        <Route path="/student/applications" element={<FoundationPage eyebrow="学生端 · 我的报名" title="每一步状态，都有清晰记录" description="报名、确认、完工和模拟结算将形成可解释的时间线。" sessionState={sessionState} sessionError={sessionError} onRetry={connectDemoSession} />} />
        <Route path="/employer/dashboard" element={<FoundationPage eyebrow="招聘方端 · 驿站工作台" title="处理报名，不让状态断在半路" description="当前招聘方为 XX大学校园快递驿站。" sessionState={sessionState} sessionError={sessionError} onRetry={connectDemoSession} />} />
        <Route path="/employer/applications" element={<FoundationPage eyebrow="招聘方端 · 报名处理" title="确认、拒绝与完工核定" description="每个操作都遵循受控状态机并写入事件记录。" sessionState={sessionState} sessionError={sessionError} onRetry={connectDemoSession} />} />
        <Route path="/employer/settlements" element={<FoundationPage eyebrow="招聘方端 · 模拟结算" title="结算规则透明，金额由系统计算" description="本页面仅演示结算状态，不发生真实支付。" sessionState={sessionState} sessionError={sessionError} onRetry={connectDemoSession} />} />
        <Route path="*" element={<Navigate replace to={role === "student" ? "/student/jobs" : "/employer/dashboard"} />} />
      </Routes>
    </AppShell>
  );
}
