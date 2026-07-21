import { Link } from "react-router-dom";
import { PageFeedback } from "../components/PageFeedback";
import { ApplicationBadge } from "../components/StatusBadge";
import { formatCurrency } from "../domain/calculations";
import { formatShift } from "../domain/formatters";
import { useAsyncData } from "../hooks/useAsyncData";
import { getEmployerDashboard } from "../services/demoService";

export function EmployerApplicationsPage({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error, reload } = useAsyncData(getEmployerDashboard, refreshKey);
  if (loading && !data) return <PageFeedback title="正在读取报名队列" detail="正在核对当前会话的真实报名状态。" />;
  if (error && !data) return <PageFeedback tone="error" title="报名队列读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;
  if (!data?.applications.length) return <PageFeedback tone="empty" title="当前没有报名" detail="学生完成 J-01 报名后，这里将显示待处理记录。" actionLabel="重新读取" onAction={() => void reload()} />;

  return (
    <section className="page-stack">
      <header className="page-heading compact-heading">
        <div className="eyebrow">招聘方端 · 报名处理</div>
        <h1>只允许合法的下一步</h1>
        <p className="lede">G4 只开放“待招聘方确认 → 报名已确认”，完工与结算操作不会提前出现。</p>
      </header>
      {error ? <PageFeedback tone="error" title="刷新失败" detail={`${error}。当前仍展示上次读取状态。`} actionLabel="重试" onAction={() => void reload()} /> : null}
      <div className="application-list">
        {data.applications.map((application) => (
          <article className="application-list-item detailed" key={application.id}>
            <div>
              <span className="section-kicker">演示学生 · {application.jobTitle}</span>
              <h2>{formatShift(application.shiftStart, application.shiftEnd)}</h2>
              <p>预计 {formatCurrency(application.estimatedAmountCents)} · {application.workAddress}</p>
            </div>
            <ApplicationBadge status={application.status} />
            <Link className="primary-button" to={`/employer/applications/${application.id}`}>{application.status === "pending" ? "进入确认" : "查看记录"}</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
