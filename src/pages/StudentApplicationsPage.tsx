import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApplicationTimeline } from "../components/ApplicationTimeline";
import { PageFeedback } from "../components/PageFeedback";
import { ApplicationBadge } from "../components/StatusBadge";
import { formatCurrency } from "../domain/calculations";
import { formatBeijingDateTime, formatShift } from "../domain/formatters";
import { useAsyncData } from "../hooks/useAsyncData";
import { cancelApplication, getApplications } from "../services/demoService";
import type { Application } from "../types/demo";

function nextStep(application: Application): string {
  const messages: Record<Application["status"], string> = {
    pending: "等待招聘方确认报名",
    confirmed: "按班次到岗，等待招聘方核定实际工时",
    pending_settlement: "工作已完成，等待招聘方确认 Demo 模拟结算",
    settled_demo: "流程已闭环，当前记录只读",
    rejected: "报名未通过，当前记录只读",
    cancelled: "报名已取消，当前记录只读",
  };
  return messages[application.status];
}

export function StudentApplicationsPage({ refreshKey }: { refreshKey: number }) {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsyncData(getApplications, refreshKey);
  const [cancelTarget, setCancelTarget] = useState<Application | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelSubmitting(true);
    setCancelError(null);
    setCancelSuccess(null);
    try {
      const result = await cancelApplication(cancelTarget.id);
      setCancelSuccess(result.repeated ? "该报名此前已取消，当前状态未重复变更。" : "报名已取消，名额已按云端规则释放一次。");
      setCancelTarget(null);
      await reload();
    } catch (mutationError) {
      setCancelError(mutationError instanceof Error ? mutationError.message : "取消报名失败，请重试");
    } finally {
      setCancelSubmitting(false);
    }
  }

  if (loading && !data) return <PageFeedback title="正在读取报名状态" detail="每次进入都会从 Supabase 重新读取，不使用静态假状态。" />;
  if (error && !data) return <PageFeedback tone="error" title="报名记录读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;
  if (!data?.applications.length) {
    return <PageFeedback tone="empty" title="当前还没有报名" detail="先查看开放岗位详情并提交报名，随后可在这里查看完整时间线。" actionLabel="去找零工" onAction={() => navigate("/student/jobs")} />;
  }

  return (
    <section className="page-stack">
      <header className="page-heading compact-heading">
        <div className="eyebrow">学生端 · 我的报名</div>
        <h1>从报名到模拟结算，每一步都有事件</h1>
        <p className="lede">角色切换、刷新或直接访问后都会重读同一条云端记录；最终金额由数据库按招聘方核定分钟计算。</p>
      </header>
      {error ? <PageFeedback tone="error" title="刷新失败" detail={`${error}。当前仍展示上次读取状态。`} actionLabel="重试" onAction={() => void reload()} /> : null}
      {cancelError ? <PageFeedback tone="error" title="取消未完成" detail={`${cancelError} 当前真实状态未被覆盖，确认窗口中的报名仍可重试。`} actionLabel="重新读取" onAction={() => void reload()} /> : null}
      {cancelSuccess ? <PageFeedback tone="success" title="操作完成" detail={cancelSuccess} /> : null}
      {data.applications.map((application) => (
        <article className="application-card" key={application.id}>
          <div className="application-header">
            <div>
              <span className="section-kicker">报名记录 · {application.employerName}</span>
              <h2>{application.jobTitle}</h2>
              <p>{formatShift(application.shiftStart, application.shiftEnd)} · {application.workAddress}</p>
            </div>
            <ApplicationBadge status={application.status} />
          </div>
          <div className="application-summary lifecycle-summary">
            <div><span>预计收入</span><strong>{formatCurrency(application.estimatedAmountCents)}</strong></div>
            <div><span>计划 / 核定工时</span><strong>{application.scheduledMinutes} / {application.actualMinutes ?? "—"} 分钟</strong></div>
            <div><span>最终模拟金额</span><strong>{application.finalAmountCents === null ? "待数据库核定" : formatCurrency(application.finalAmountCents)}</strong></div>
            <div><span>当前下一步</span><strong>{nextStep(application)}</strong></div>
          </div>
          <dl className="application-contract">
            <div><dt>结算时间</dt><dd>{application.settlementTiming}</dd></div>
            <div><dt>结算前提</dt><dd>{application.settlementConditions}</dd></div>
            {application.settlement ? <div><dt>模拟结算记录</dt><dd>{application.settlement.status === "pending" ? "待模拟结算" : `已结算（Demo模拟）${application.settlement.settledAt ? ` · ${formatBeijingDateTime(application.settlement.settledAt)}` : ""}`}</dd></div> : null}
          </dl>
          {application.status === "pending" ? (
            <div className="application-actions">
              <div><strong>仍可取消报名</strong><p>仅“待招聘方确认”阶段可以取消，取消后该记录进入只读终态。</p></div>
              <button className="secondary-button" type="button" disabled={cancelSubmitting} onClick={() => { setCancelError(null); setCancelTarget(application); }}>取消报名</button>
            </div>
          ) : null}
          {application.status === "confirmed" ? <p className="demo-notice">招聘方已确认，当前不可取消；请按班次到岗并等待工时核定。</p> : null}
          {application.status === "rejected" ? <p className="demo-notice"><strong>报名未通过</strong>：{application.events.find((event) => event.toStatus === "rejected")?.note ?? "招聘方未通过该报名。"}</p> : null}
          {application.status === "cancelled" ? <p className="demo-notice"><strong>报名已取消</strong>：该记录已终止，名额已释放，不能继续推进。</p> : null}
          <section className="timeline-section">
            <div className="section-heading small">
              <div><span className="section-kicker">状态事件</span><h3>报名时间线</h3></div>
              <button className="text-button" type="button" disabled={loading} onClick={() => void reload()}>{loading ? "读取中…" : "刷新状态"}</button>
            </div>
            <ApplicationTimeline events={application.events} />
          </section>
          {application.status === "settled_demo" ? <p className="demo-notice"><strong>已结算（Demo模拟）</strong>：展示金额与状态闭环，不发生真实支付。</p> : null}
          {application.status === "pending_settlement" ? <p className="demo-notice">数据库已生成唯一待模拟结算记录；等待招聘方在“模拟结算”页确认。</p> : null}
        </article>
      ))}
      <Link className="back-link" to="/student/jobs">← 返回岗位列表</Link>
      {cancelTarget ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !cancelSubmitting && setCancelTarget(null)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="cancel-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="section-kicker">取消报名</span>
            <h2 id="cancel-title">确认取消这条报名？</h2>
            <p>取消后报名进入“报名已取消”终态，当前班次名额只释放一次；招聘方不会再看到待处理动作。</p>
            <dl className="confirmation-list">
              <div><dt>岗位</dt><dd>{cancelTarget.jobTitle}</dd></div>
              <div><dt>当前状态</dt><dd>待招聘方确认</dd></div>
            </dl>
            {cancelError ? <p className="inline-error" role="alert">{cancelError}。当前状态未被伪造，可再次提交。</p> : null}
            <div className="modal-actions">
              <button className="secondary-button" type="button" disabled={cancelSubmitting} onClick={() => setCancelTarget(null)}>保留报名</button>
              <button className="danger-button" type="button" disabled={cancelSubmitting} onClick={() => void handleCancel()}>{cancelSubmitting ? "正在取消…" : "确认取消报名"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
