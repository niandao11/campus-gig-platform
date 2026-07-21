import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApplicationTimeline } from "../components/ApplicationTimeline";
import { PageFeedback } from "../components/PageFeedback";
import { ApplicationBadge } from "../components/StatusBadge";
import { formatCurrency } from "../domain/calculations";
import { formatShift } from "../domain/formatters";
import { useAsyncData } from "../hooks/useAsyncData";
import { approveApplication, getEmployerDashboard } from "../services/demoService";

export function EmployerApplicationDetailPage({ refreshKey }: { refreshKey: number }) {
  const { applicationId } = useParams();
  const { data, loading, error, reload } = useAsyncData(getEmployerDashboard, refreshKey);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (loading && !data) return <PageFeedback title="正在读取报名详情" detail="正在从招聘方受控视角读取同一条报名。" />;
  if (error && !data) return <PageFeedback tone="error" title="报名详情读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;

  const application = data?.applications.find((item) => item.id === applicationId);
  if (!data || !application) return <PageFeedback tone="empty" title="报名不存在或已被重置" detail="请返回报名列表读取当前会话的最新记录。" />;
  const currentApplicationId = application.id;

  async function handleApprove() {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await approveApplication(currentApplicationId);
      setActionSuccess(result.repeated ? "该报名此前已确认，已读取当前真实状态。" : "报名已确认，学生端现在可以读取新状态。" );
      await reload();
    } catch (mutationError) {
      setActionError(mutationError instanceof Error ? mutationError.message : "确认失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack detail-page">
      <Link className="back-link" to="/employer/applications">← 返回报名列表</Link>
      <header className="application-detail-hero">
        <div>
          <span className="section-kicker">招聘方报名处理 · 演示学生</span>
          <h1>{application.jobTitle}</h1>
          <p>{formatShift(application.shiftStart, application.shiftEnd)} · {application.workAddress}</p>
        </div>
        <ApplicationBadge status={application.status} />
      </header>

      {error ? <PageFeedback tone="error" title="刷新失败" detail={`${error}。当前仍展示上次读取状态。`} actionLabel="重试" onAction={() => void reload()} /> : null}
      {actionError ? <PageFeedback tone="error" title="操作未完成" detail={`${actionError}。数据库真实状态未被覆盖。`} actionLabel="重新读取状态" onAction={() => void reload()} /> : null}
      {actionSuccess ? <PageFeedback tone="success" title="操作完成" detail={actionSuccess} /> : null}

      <section className="detail-grid employer-detail-grid">
        <article className="content-card">
          <span className="section-kicker">报名快照</span>
          <h2>确认前核对关键约定</h2>
          <dl className="evidence-list">
            <div><dt>招聘主体</dt><dd>{application.employerName}</dd></div>
            <div><dt>用工主体</dt><dd>{application.legalEntityName}</dd></div>
            <div><dt>工资支付主体</dt><dd>{application.paymentEntityName}</dd></div>
            <div><dt>计划工时</dt><dd>{application.scheduledMinutes} 分钟</dd></div>
            <div><dt>预计收入</dt><dd>{formatCurrency(application.estimatedAmountCents)}</dd></div>
            <div><dt>结算约定</dt><dd>{application.settlementTiming}</dd></div>
          </dl>
        </article>
        <article className="content-card action-card">
          <span className="section-kicker">合法下一步</span>
          <h2>{application.status === "pending" ? "确认学生报名" : "报名已确认"}</h2>
          <p>{application.status === "pending" ? "确认后状态进入“报名已确认”，招聘方确认不会再次扣减名额。" : "G4 到此完成最小双端闭环。实际工时、完工和模拟结算将在 G5 开放。"}</p>
          {application.status === "pending" ? (
            <button className="primary-button wide-button" type="button" disabled={submitting} onClick={() => void handleApprove()}>{submitting ? "正在确认…" : "确认报名"}</button>
          ) : (
            <Link className="secondary-button wide-button" to="/student/applications">切回学生端查看</Link>
          )}
          <small>该操作通过 `decide_application` RPC 校验会话归属、当前状态与幂等。</small>
        </article>
      </section>

      <section className="content-card timeline-section standalone">
        <div className="section-heading small">
          <div><span className="section-kicker">状态事件</span><h2>报名时间线</h2></div>
          <button className="text-button" type="button" disabled={loading} onClick={() => void reload()}>{loading ? "读取中…" : "刷新状态"}</button>
        </div>
        <ApplicationTimeline events={application.events} />
      </section>
    </section>
  );
}
