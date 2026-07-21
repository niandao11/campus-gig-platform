import { useState, type PropsWithChildren } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { Role } from "../types/demo";
import { BrandMark } from "./BrandMark";

interface AppShellProps extends PropsWithChildren {
  role: Role;
  sessionState: "loading" | "ready" | "unconfigured" | "error";
  onRoleSwitch: () => void;
  onReset: () => Promise<void>;
}

export function AppShell({ children, role, sessionState, onRoleSwitch, onReset }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchRole(nextRole: Role) {
    onRoleSwitch();
    setNotice(null);
    navigate(nextRole === "student" ? "/student/jobs" : "/employer/dashboard");
  }

  async function confirmReset() {
    setResetting(true);
    setResetError(null);
    try {
      await onReset();
      setShowReset(false);
      setNotice("当前匿名会话已重置，岗位名额与报名状态已恢复基线。");
      navigate("/student/jobs", { replace: true });
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Demo重置失败，请稍后重试");
    } finally {
      setResetting(false);
    }
  }

  const studentLinks = [
    ["/student/jobs", "找零工"],
    ["/student/compare", "岗位比较"],
    ["/student/applications", "我的报名"],
  ];
  const employerLinks = [
    ["/employer/dashboard", "驿站工作台"],
    ["/employer/applications", "报名处理"],
    ["/employer/settlements", "模拟结算"],
  ];
  const links = role === "student" ? studentLinks : employerLinks;

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to={role === "student" ? "/student/jobs" : "/employer/dashboard"}>
          <BrandMark />
          <span>
            <strong>校园零工平台</strong>
            <small>XX大学 · 演示环境</small>
          </span>
        </NavLink>

        <div className="role-switch" aria-label="演示角色切换">
          <button className={role === "student" ? "active" : ""} type="button" aria-pressed={role === "student"} onClick={() => switchRole("student")}>
            学生端
          </button>
          <button className={role === "employer" ? "active" : ""} type="button" aria-pressed={role === "employer"} onClick={() => switchRole("employer")}>
            招聘方端
          </button>
        </div>
      </header>

      <div className="content-grid">
        <aside className="sidebar" aria-label="主导航">
          <div className="role-note">
            <span className={`status-dot ${sessionState}`} />
            {sessionState === "ready"
              ? "云端演示已连接"
              : sessionState === "loading"
                ? "正在连接云端"
                : sessionState === "error"
                  ? "云端连接失败"
                  : "等待云端配置"}
          </div>
          <nav>
            {links.map(([href, label]) => (
              <NavLink key={href} className={({ isActive }) => (isActive ? "active" : "")} to={href}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="demo-disclaimer">
            <strong>Demo说明</strong>
            <p>角色切换仅用于演示业务闭环，不代表生产级权限。</p>
            <button className="reset-link" type="button" disabled={sessionState !== "ready"} onClick={() => { setResetError(null); setShowReset(true); }}>
              重置当前Demo
            </button>
          </div>
          <div className="mobile-demo-note">
            <span>演示环境 · 角色切换非生产权限 · 结算仅为Demo模拟</span>
            <button type="button" disabled={sessionState !== "ready"} onClick={() => { setResetError(null); setShowReset(true); }}>重置Demo</button>
          </div>
        </aside>

        <main key={location.pathname} className="page-area">
          {notice ? <div className="global-notice" role="status"><span>✓</span>{notice}<button type="button" aria-label="关闭提示" onClick={() => setNotice(null)}>×</button></div> : null}
          {children}
        </main>
      </div>

      {showReset ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !resetting && setShowReset(false)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="reset-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="section-kicker">重置当前匿名会话</span>
            <h2 id="reset-title">确认恢复演示基线？</h2>
            <p>当前会话的报名、事件和班次实例会被清除并重建；岗位模板和其他访问者的会话不会受影响。</p>
            <ul className="reset-list">
              <li>J-01 名额恢复为 5 人</li>
              <li>当前报名与时间线清空</li>
              <li>学生可工作时间同步到新 J-01 班次</li>
            </ul>
            {resetError ? <p className="inline-error" role="alert">{resetError}。未显示成功，当前真实状态保持不变。</p> : null}
            <div className="modal-actions">
              <button className="secondary-button" type="button" disabled={resetting} onClick={() => setShowReset(false)}>取消</button>
              <button className="danger-button" type="button" disabled={resetting} onClick={() => void confirmReset()}>{resetting ? "正在重置…" : "确认重置"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
