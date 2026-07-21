import { Link } from "react-router-dom";

interface StagePlaceholderPageProps {
  role: "student" | "employer";
  eyebrow: string;
  title: string;
  detail: string;
}

export function StagePlaceholderPage({ role, eyebrow, title, detail }: StagePlaceholderPageProps) {
  return (
    <section className="page-stack placeholder-page">
      <header className="page-heading compact-heading">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="lede">{detail}</p>
      </header>
      <div className="placeholder-card">
        <span>G5</span>
        <h2>当前阶段尚未开放</h2>
        <p>G4 专注把学生报名、招聘方确认和学生回读做成真实云端闭环，不用静态页面冒充后续能力。</p>
        <Link className="primary-button" to={role === "student" ? "/student/jobs" : "/employer/dashboard"}>返回当前主流程</Link>
      </div>
    </section>
  );
}
