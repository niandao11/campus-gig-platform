import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApplicationTimeline } from "../components/ApplicationTimeline";
import { PageFeedback } from "../components/PageFeedback";
import { ApplicationBadge } from "../components/StatusBadge";
import { formatCurrency, isValidActualMinutes, isValidRejectionReason } from "../domain/calculations";
import { formatShift } from "../domain/formatters";
import { useAsyncData } from "../hooks/useAsyncData";
import { approveApplication, finishApplication, getEmployerDashboard, rejectApplication } from "../services/demoService";

export function EmployerApplicationDetailPage({ refreshKey }: { refreshKey: number }) {
  const { applicationId } = useParams();
  const { data, loading, error, reload } = useAsyncData(getEmployerDashboard, refreshKey);
  const [submitting, setSubmitting] = useState(false);
  const [actualMinutesInput, setActualMinutesInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (loading && !data) return <PageFeedback title="正在读取报名详情" detail="正在从招聘方受控视角读取同一条报名。" />;
  if (error && !data) return <PageFeedback tone="error" title="报名详情读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;

  const application = data?.applications.find((item) => item.id === applicationId);
  if (!data || !application) return <PageFeedback tone="empty" title="报名不存在或已被重置" detail="请返回报名列表读取当前会话的最新记录。" />;
  const currentApplicationId = application.id;
  const scheduledMinutes = application.scheduledMinutes;
  const parsedMinutes = Number(actualMinutesInput);
  const minutesValid = /^\d+$/.test(actualMinutesInput)
    && isValidActualMinutes(parsedMinutes, scheduledMinutes);

  async function handleApprove() {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await approveApplication(currentApplicationId);
      setActionSuccess(result.repeated ? "该报名此前已确认，已读取当前真实状态。" : "报名已确认，学生端现在可以读取新状态。");
      await reload();
    } catch (mutationError) {
      setActionError(mutationError instanceof Error ? mutationError.message : "确认失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete() {
    if (!minutesValid) {
      setActionError(`请输入 1–${scheduledMinutes} 之间的正整数分钟。`);
      return;
    }
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await finishApplication(currentApplicationId, parsedMinutes);
      setActionSuccess(result.repeated ? "该报名此前已核定完工，未生成重复事件或结算记录。" : "完工已核定，数据库已原子生成唯一待模拟结算记录。");
      await reload();
    } catch (mutationError) {
      setActionError(mutationError instanceof Error ? mutationError.message : "完工核定失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    const reason = rejectReason.trim();
    if (!isValidRejectionReason(reason)) {
      setActionError("请填写 1–500 字的拒绝原因。");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await rejectApplication(currentApplicationId, reason);
      setActionSuccess(result.repeated ? "该报名此前已拒绝，已读取当前真实状态。" : "报名已拒绝，原因和名额变化已写入云端事件。");
      setShowReject(false);
      await reload();
    } catch (mutationError) {
      setActionError(mutationError instanceof Error ? mutationError.message : "拒绝报名失败，请重试");
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
      {actionError ? <PageFeedback tone="error" title="操作未完成" detail={`${actionError} 数据库真实状态未被覆盖。`} actionLabel="重新读取状态" onAction={() => void reload()} /> : null}
      {actionSuccess ? <PageFeedback tone="success" title="操作完成" detail={actionSuccess} /> : null}

      <section className="detail-grid employer-detail-grid">
        <article className="content-card">
          <span className="section-kicker">报名快照</span>
          <h2>核对班次与计价约定</h2>
          <dl className="evidence-list">
            <div><dt>招聘主体</dt><dd>{application.employerName}</dd></div>
            <div><dt>用工主体</dt><dd>{application.legalEntityName}</dd></div>
            <div><dt>工资支付主体</dt><dd>{application.paymentEntityName}</dd></div>
            <div><dt>计划工时</dt><dd>{application.scheduledMinutes} 分钟</dd></div>
            <div><dt>核定实际工时</dt><dd>{application.actualMinutes === null ? "尚未核定" : `${application.actualMinutes} 分钟`}</dd></div>
            <div><dt>预计收入</dt><dd>{formatCurrency(application.estimatedAmountCents)}</dd></div>
            <div><dt>最终模拟金额</dt><dd>{application.finalAmountCents === null ? "完工后由数据库计算" : formatCurrency(application.finalAmountCents)}</dd></div>
            <div><dt>结算约定</dt><dd>{application.settlementTiming}；{application.settlementConditions}</dd></div>
          </dl>
        </article>

        <article className="content-card action-card">
          <span className="section-kicker">唯一合法下一步</span>
          {application.status === "pending" ? (
            <>
              <h2>确认学生报名</h2>
              <p>确认后状态进入“报名已确认”；如不符合要求，应填写原因并拒绝，名额只释放一次。</p>
              <div className="action-buttons">
                <button className="primary-button" type="button" disabled={submitting} onClick={() => void handleApprove()}>{submitting ? "正在确认…" : "确认报名"}</button>
                <button className="secondary-button" type="button" disabled={submitting} onClick={() => { setActionError(null); setShowReject(true); }}>拒绝报名</button>
              </div>
              <small>通过 decide_application 校验会话归属、当前状态与幂等。</small>
            </>
          ) : null}
          {application.status === "confirmed" ? (
            <>
              <h2>核定实际工时并确认完工</h2>
              <p>输入正整数分钟，不得超过计划工时 {application.scheduledMinutes} 分钟。最终金额只由数据库计算，前端不能填写。</p>
              <label className="field-label" htmlFor="actual-minutes">核定实际分钟</label>
              <div className="minutes-field">
                <input id="actual-minutes" inputMode="numeric" min="1" max={application.scheduledMinutes} step="1" value={actualMinutesInput} placeholder="例如 270" onChange={(event) => { setActualMinutesInput(event.target.value.trim()); setActionError(null); }} />
                <span>分钟</span>
              </div>
              {actualMinutesInput && !minutesValid ? <p className="field-hint error-text">请输入 1–{application.scheduledMinutes} 之间的正整数。</p> : <p className="field-hint">提交后将一次完成“工作已完成事件 → 待模拟结算”。</p>}
              <button className="primary-button wide-button" type="button" disabled={submitting || !minutesValid} onClick={() => void handleComplete()}>{submitting ? "正在核定…" : "确认完工并生成待结算"}</button>
              <small>complete_application 在单个数据库事务内计算金额、写入两条事件并创建唯一结算记录。</small>
            </>
          ) : null}
          {application.status === "pending_settlement" ? (
            <>
              <h2>已生成待模拟结算</h2>
              <p>完工与金额已核定。模拟结算只允许在独立结算页处理，不在报名页跨级操作。</p>
              <Link className="primary-button wide-button" to={`/employer/settlements?application=${application.id}`}>查看待结算</Link>
            </>
          ) : null}
          {application.status === "settled_demo" ? (
            <>
              <h2>已结算（Demo模拟）</h2>
              <p>该报名已到达只读终态，不发生真实支付，也不会继续出现推进按钮。</p>
              <Link className="secondary-button wide-button" to={`/employer/settlements?application=${application.id}`}>查看模拟结算记录</Link>
            </>
          ) : null}
          {application.status === "rejected" || application.status === "cancelled" ? (
            <>
              <h2>当前记录已终止</h2>
              <p>{application.status === "rejected" ? `报名未通过：${application.events.find((event) => event.toStatus === "rejected")?.note ?? "招聘方未通过该报名。"}` : "报名已取消，当前记录只读。"}</p>
              <Link className="secondary-button wide-button" to="/employer/applications">返回报名处理</Link>
            </>
          ) : null}
        </article>
      </section>

      <section className="content-card timeline-section standalone">
        <div className="section-heading small">
          <div><span className="section-kicker">状态事件</span><h2>报名时间线</h2></div>
          <button className="text-button" type="button" disabled={loading} onClick={() => void reload()}>{loading ? "读取中…" : "刷新状态"}</button>
        </div>
        <ApplicationTimeline events={application.events} />
      </section>
      {showReject && application.status === "pending" ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !submitting && setShowReject(false)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="reject-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="section-kicker">招聘方拒绝报名</span>
            <h2 id="reject-title">填写未通过原因</h2>
            <p>原因会写入报名事件并展示给学生；不能为空，最多 500 字。</p>
            <label className="field-label" htmlFor="reject-reason">拒绝原因</label>
            <textarea id="reject-reason" maxLength={500} rows={5} value={rejectReason} placeholder="例如：该班次已调整为需要夜间作业经验" onChange={(event) => { setRejectReason(event.target.value); setActionError(null); }} />
            <div className="textarea-meta">{rejectReason.trim().length}/500 字</div>
            {actionError ? <p className="inline-error" role="alert">{actionError} 当前状态未被伪造，可继续修改原因后重试。</p> : null}
            <div className="modal-actions">
              <button className="secondary-button" type="button" disabled={submitting} onClick={() => setShowReject(false)}>返回修改</button>
              <button className="danger-button" type="button" disabled={submitting || !isValidRejectionReason(rejectReason)} onClick={() => void handleReject()}>{submitting ? "正在提交…" : "确认拒绝报名"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
