import { Link } from "react-router-dom";
import { PageFeedback } from "../components/PageFeedback";
import { ApplicationBadge } from "../components/StatusBadge";
import { formatShift } from "../domain/formatters";
import { useAsyncData } from "../hooks/useAsyncData";
import { getEmployerDashboard } from "../services/demoService";

export function EmployerDashboardPage({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error, reload } = useAsyncData(getEmployerDashboard, refreshKey);

  if (loading && !data) return <PageFeedback title="正在读取驿站工作台" detail="正在从同一匿名会话读取班次与待处理报名。" />;
  if (error && !data) return <PageFeedback tone="error" title="工作台读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;
  if (!data) return null;

  const mainJob = data.jobs.find((job) => job.templateId.endsWith("0001"));
  const pendingApplications = data.applications.filter((application) => application.status === "pending");

  return (
    <section className="page-stack">
      <header className="page-heading compact-heading employer-heading">
        <div className="eyebrow">招聘方端 · 驿站工作台</div>
        <h1>同一条报名，从学生提交走到招聘方确认</h1>
        <p className="lede">当前身份为 {data.employer.displayName}；角色切换仅用于演示，不代表生产级招聘方权限。</p>
      </header>
      {error ? <PageFeedback tone="error" title="刷新失败" detail={`${error}。当前仍展示上次读取状态。`} actionLabel="重试" onAction={() => void reload()} /> : null}

      <section className="metric-grid" aria-label="招聘方工作台概览">
        <article><span>待处理报名</span><strong>{pendingApplications.length}</strong><small>当前匿名会话</small></article>
        <article><span>J-01 剩余名额</span><strong>{mainJob?.remainingSlots ?? "—"}</strong><small>报名时原子扣减</small></article>
        <article><span>已确认报名</span><strong>{data.applications.filter((item) => item.status === "confirmed").length}</strong><small>确认不重复扣名额</small></article>
      </section>

      <div className="section-heading">
        <div><span className="section-kicker">待处理队列</span><h2>学生报名</h2></div>
        <Link className="text-button" to="/employer/applications">查看全部</Link>
      </div>

      {data.applications.length === 0 ? (
        <PageFeedback tone="empty" title="当前没有报名" detail="请切换到学生端完成 J-01 报名，再返回这里读取同一条云端记录。" />
      ) : (
        <div className="application-list">
          {data.applications.map((application) => (
            <article className="application-list-item" key={application.id}>
              <div>
                <span className="section-kicker">演示学生 · {formatShift(application.shiftStart, application.shiftEnd)}</span>
                <h3>{application.jobTitle}</h3>
                <p>{application.employerName}</p>
              </div>
              <ApplicationBadge status={application.status} />
              <Link className="secondary-button" to={`/employer/applications/${application.id}`}>处理报名</Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
