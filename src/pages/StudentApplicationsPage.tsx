import { Link, useNavigate } from "react-router-dom";
import { ApplicationTimeline } from "../components/ApplicationTimeline";
import { PageFeedback } from "../components/PageFeedback";
import { ApplicationBadge } from "../components/StatusBadge";
import { formatCurrency } from "../domain/calculations";
import { formatShift } from "../domain/formatters";
import { useAsyncData } from "../hooks/useAsyncData";
import { getApplications } from "../services/demoService";

export function StudentApplicationsPage({ refreshKey }: { refreshKey: number }) {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsyncData(getApplications, refreshKey);

  if (loading && !data) return <PageFeedback title="正在读取报名状态" detail="每次进入都会从 Supabase 重新读取，不使用静态假状态。" />;
  if (error && !data) return <PageFeedback tone="error" title="报名记录读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;
  if (!data?.applications.length) {
    return <PageFeedback tone="empty" title="当前还没有报名" detail="先查看 J-01 岗位详情并提交报名，随后可在这里查看时间线。" actionLabel="去找零工" onAction={() => navigate("/student/jobs")} />;
  }

  return (
    <section className="page-stack">
      <header className="page-heading compact-heading">
        <div className="eyebrow">学生端 · 我的报名</div>
        <h1>每一步状态，都能回到同一份云端记录</h1>
        <p className="lede">切换角色或刷新后重新读取；当前 G4 只演示报名与招聘方确认。</p>
      </header>
      {error ? <PageFeedback tone="error" title="刷新失败" detail={`${error}。当前仍展示上次读取状态。`} actionLabel="重试" onAction={() => void reload()} /> : null}
      {data.applications.map((application) => (
        <article className="application-card" key={application.id}>
          <div className="application-header">
            <div>
              <span className="section-kicker">J-01 · {application.employerName}</span>
              <h2>{application.jobTitle}</h2>
              <p>{formatShift(application.shiftStart, application.shiftEnd)} · {application.workAddress}</p>
            </div>
            <ApplicationBadge status={application.status} />
          </div>
          <div className="application-summary">
            <div><span>预计收入</span><strong>{formatCurrency(application.estimatedAmountCents)}</strong></div>
            <div><span>当前下一步</span><strong>{application.status === "pending" ? "等待招聘方处理" : application.status === "confirmed" ? "按班次到岗，完工流程将在G5开放" : "当前状态只读"}</strong></div>
            <div><span>结算约定</span><strong>{application.settlementTiming}</strong></div>
          </div>
          <section className="timeline-section">
            <div className="section-heading small">
              <div><span className="section-kicker">状态事件</span><h3>报名时间线</h3></div>
              <button className="text-button" type="button" disabled={loading} onClick={() => void reload()}>{loading ? "读取中…" : "刷新状态"}</button>
            </div>
            <ApplicationTimeline events={application.events} />
          </section>
          {application.status === "confirmed" ? <p className="demo-notice">报名已由招聘方确认。G4 不开放取消、完工或结算操作，后续履约流程将在 G5 实现。</p> : null}
        </article>
      ))}
      <Link className="back-link" to="/student/jobs">← 返回岗位列表</Link>
    </section>
  );
}
