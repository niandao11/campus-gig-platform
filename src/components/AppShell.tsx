import type { PropsWithChildren } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { Role } from "../types/demo";
import { BrandMark } from "./BrandMark";

interface AppShellProps extends PropsWithChildren {
  role: Role;
  sessionState: "loading" | "ready" | "unconfigured" | "error";
}

export function AppShell({ children, role, sessionState }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  function switchRole(nextRole: Role) {
    navigate(nextRole === "student" ? "/student/jobs" : "/employer/dashboard");
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
          </div>
          <p className="mobile-demo-note">演示环境 · 角色切换非生产权限 · 结算仅为Demo模拟</p>
        </aside>

        <main key={location.pathname} className="page-area">
          {children}
        </main>
      </div>
    </div>
  );
}
