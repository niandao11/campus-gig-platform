import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { isSupabaseConfigured } from "./lib/supabase";
import { EmployerApplicationDetailPage } from "./pages/EmployerApplicationDetailPage";
import { EmployerApplicationsPage } from "./pages/EmployerApplicationsPage";
import { EmployerDashboardPage } from "./pages/EmployerDashboardPage";
import { FoundationPage } from "./pages/FoundationPage";
import { StagePlaceholderPage } from "./pages/StagePlaceholderPage";
import { StudentApplicationsPage } from "./pages/StudentApplicationsPage";
import { StudentJobDetailPage } from "./pages/StudentJobDetailPage";
import { StudentJobsPage } from "./pages/StudentJobsPage";
import { resetCurrentDemo } from "./services/demoService";
import { bootstrapDemoSession } from "./services/sessionService";

type SessionState = "loading" | "ready" | "unconfigured" | "error";

export default function App() {
  const location = useLocation();
  const role = location.pathname.startsWith("/employer") ? "employer" : "student";
  const [sessionState, setSessionState] = useState<SessionState>(isSupabaseConfigured ? "loading" : "unconfigured");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
    void connectDemoSession();
  }, [connectDemoSession]);

  function guard(content: ReactNode): ReactNode {
    if (sessionState === "ready") return content;
    return (
      <FoundationPage
        eyebrow="校园零工平台 · 云端会话"
        title="先建立当前浏览器的匿名演示会话"
        description="会话建立后，学生端与招聘方端将读写同一份隔离的 Supabase 数据。"
        sessionState={sessionState}
        sessionError={sessionError}
        onRetry={connectDemoSession}
      />
    );
  }

  async function handleReset() {
    await resetCurrentDemo();
    setRefreshKey((current) => current + 1);
  }

  return (
    <AppShell
      role={role}
      sessionState={sessionState}
      onRoleSwitch={() => setRefreshKey((current) => current + 1)}
      onReset={handleReset}
    >
      <Routes>
        <Route path="/" element={<Navigate replace to="/student/jobs" />} />
        <Route path="/student/jobs" element={guard(<StudentJobsPage refreshKey={refreshKey} />)} />
        <Route path="/student/jobs/:jobId" element={guard(<StudentJobDetailPage refreshKey={refreshKey} />)} />
        <Route
          path="/student/compare"
          element={guard(<StagePlaceholderPage role="student" eyebrow="学生端 · 岗位比较" title="完整比较将在 G5 开放" detail="当前阶段先把一条 J-01 岗位的报名与确认闭环做透。" />)}
        />
        <Route path="/student/applications" element={guard(<StudentApplicationsPage refreshKey={refreshKey} />)} />
        <Route path="/employer/dashboard" element={guard(<EmployerDashboardPage refreshKey={refreshKey} />)} />
        <Route path="/employer/applications" element={guard(<EmployerApplicationsPage refreshKey={refreshKey} />)} />
        <Route path="/employer/applications/:applicationId" element={guard(<EmployerApplicationDetailPage refreshKey={refreshKey} />)} />
        <Route
          path="/employer/settlements"
          element={guard(<StagePlaceholderPage role="employer" eyebrow="招聘方端 · 模拟结算" title="完工与模拟结算将在 G5 开放" detail="G4 不提供跨级按钮，也不会用静态状态伪造结算能力。" />)}
        />
        <Route path="*" element={<Navigate replace to={role === "student" ? "/student/jobs" : "/employer/dashboard"} />} />
      </Routes>
    </AppShell>
  );
}
