import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageFeedback } from "../components/PageFeedback";
import { AvailabilityBadge } from "../components/StatusBadge";
import { formatCurrency, haversineDistanceKm } from "../domain/calculations";
import { formatBeijingDateTime, formatPay, formatShift } from "../domain/formatters";
import { jobCode } from "../domain/jobDiscovery";
import { useAsyncData } from "../hooks/useAsyncData";
import { getJobs, submitApplication } from "../services/demoService";

export function StudentJobDetailPage({ refreshKey }: { refreshKey: number }) {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsyncData(getJobs, refreshKey);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (loading && !data) return <PageFeedback title="正在读取岗位详情" detail="正在核对班次、主体和结算证据。" />;
  if (error && !data) return <PageFeedback tone="error" title="岗位详情读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;

  const job = data?.jobs.find((item) => item.id === jobId);
  if (!data || !job) {
    return <PageFeedback tone="empty" title="岗位不存在或已在重置后更新" detail="重置会生成新的会话岗位 ID，请返回岗位列表重新进入。" actionLabel="返回岗位列表" onAction={() => navigate("/student/jobs")} />;
  }

  const distance = haversineDistanceKm(data.campus, job);
  const canApply = job.availabilityStatus === "open" && !job.hasApplied;
  const jobInstanceId = job.id;
  const unavailableReason = job.availabilityStatus === "full"
    ? "该班次名额已满，不能报名"
    : job.availabilityStatus === "expired"
      ? "该班次报名已截止，不能报名"
      : job.availabilityStatus === "cancelled"
        ? "该班次已取消，不能报名"
        : null;

  async function handleApply() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitApplication(jobInstanceId);
      navigate("/student/applications", { replace: true });
    } catch (mutationError) {
      setSubmitError(mutationError instanceof Error ? mutationError.message : "报名提交失败，请重试");
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack detail-page">
      <Link className="back-link" to="/student/jobs">← 返回岗位列表</Link>
      <header className="detail-hero">
        <div>
          <div className="card-topline">
            <AvailabilityBadge status={job.availabilityStatus} />
            <span className="demo-chip">{jobCode(job)} · 合成直招演示岗位</span>
          </div>
          <h1>{job.title}</h1>
          <p>{job.employerName} · {job.workAddress}</p>
        </div>
        <div className="detail-pay-box">
          <span>{job.payType === "daily" ? "固定日薪" : "有效时薪"}</span>
          <strong>{formatPay(job)}</strong>
          <small>预计共 {formatCurrency(job.estimatedAmountCents)}</small>
        </div>
      </header>

      {error ? <PageFeedback tone="error" title="刷新失败" detail={`${error}。页面保留上次成功读取的数据。`} actionLabel="重试" onAction={() => void reload()} /> : null}

      <section className="detail-grid">
        <article className="content-card">
          <span className="section-kicker">岗位信息</span>
          <h2>先确认工作与时间是否匹配</h2>
          <dl className="evidence-list">
            <div><dt>班次</dt><dd>{formatShift(job.shiftStart, job.shiftEnd)}</dd></div>
            <div><dt>报名截止</dt><dd>{formatBeijingDateTime(job.applicationDeadline)}</dd></div>
            <div><dt>直线距离</dt><dd>{distance.toFixed(1)} 公里（基于演示坐标）</dd></div>
            <div><dt>剩余名额</dt><dd>{job.remainingSlots}/{job.capacity} 人</dd></div>
            <div><dt>工作内容</dt><dd>{job.workContent}</dd></div>
            <div><dt>岗位要求</dt><dd>{job.requirements}</dd></div>
          </dl>
        </article>

        <article className="content-card transparency-card">
          <span className="section-kicker">直招信息透明度</span>
          <h2>展示证据，不用一个分数替代判断</h2>
          <div className="transparency-summary">
            <strong>主体关系已披露</strong>
            <p>“直招”仅表示本 Demo 的主体关系字段已展示，不代表真实企业认证或绝对安全。</p>
          </div>
          <dl className="evidence-list">
            <div><dt>招聘主体</dt><dd>{job.employerName}</dd></div>
            <div><dt>用工主体</dt><dd>{job.legalEntityName}</dd></div>
            <div><dt>工资支付主体</dt><dd>{job.paymentEntityName}</dd></div>
            <div><dt>联系部门</dt><dd>{job.contactDepartment}</dd></div>
            <div><dt>实际用工地点</dt><dd>{job.workAddress}</dd></div>
            <div><dt>直招披露</dt><dd>{job.directHireDisclosure}</dd></div>
            <div><dt>收费项</dt><dd>押金：{job.depositRequired ? "有" : "无"} · 培训费：{job.trainingFeeRequired ? "有" : "无"} · 介绍费：{job.agencyFeeRequired ? "有" : "无"}</dd></div>
            <div><dt>收费说明</dt><dd>{job.feeDisclosure}</dd></div>
            <div><dt>发布时间</dt><dd>{formatBeijingDateTime(job.publishedAt)}</dd></div>
            <div><dt>信息缺失项</dt><dd>{job.missingFields.length ? job.missingFields.join("、") : "无"}</dd></div>
            <div><dt>风险线索</dt><dd>{job.riskFlags.length ? job.riskFlags.join("、") : "演示字段中未发现明显收费项"}</dd></div>
          </dl>
        </article>

        <article className="content-card settlement-card">
          <span className="section-kicker">计价与结算</span>
          <h2>报名前就看清金额条件</h2>
          <dl className="evidence-list">
            <div><dt>计价类型</dt><dd>{job.payType === "daily" ? "日薪" : "时薪"}</dd></div>
            {job.payType === "hourly" ? <div><dt>基础时薪</dt><dd>{formatCurrency(job.baseRateCents ?? 0)}/小时</dd></div> : null}
            {job.payType === "hourly" && job.nightBonusCents > 0 ? <div><dt>夜班补贴</dt><dd>{formatCurrency(job.nightBonusCents)}/小时（作用于全部核定分钟）</dd></div> : null}
            <div><dt>{job.payType === "daily" ? "固定日薪" : "有效时薪"}</dt><dd>{formatPay(job)}{job.payType === "daily" ? "，不折算时薪" : ""}</dd></div>
            <div><dt>预计收入</dt><dd>{formatCurrency(job.estimatedAmountCents)}</dd></div>
            <div><dt>结算时间</dt><dd>{job.settlementTiming}</dd></div>
            <div><dt>结算前提</dt><dd>{job.settlementConditions}</dd></div>
          </dl>
          <p className="demo-notice">本产品不发生真实支付；后续“已结算”状态始终标注为 Demo 模拟。</p>
        </article>
      </section>

      <aside className="sticky-action-card" aria-label="岗位报名操作">
        <div>
          <strong>{job.hasApplied ? "你已报名该岗位" : unavailableReason ?? "信息已确认，准备报名？"}</strong>
          <p>{job.hasApplied ? "前往我的报名查看当前云端状态。" : unavailableReason ?? `${data.profile.displayName} · ${formatShift(data.profile.availableStart, data.profile.availableEnd)}`}</p>
        </div>
        {job.hasApplied ? (
          <Link className="primary-button" to="/student/applications">查看我的报名</Link>
        ) : (
          <button className="primary-button" type="button" disabled={!canApply} onClick={() => setShowConfirmation(true)}>
            {canApply ? "立即报名" : unavailableReason ?? "当前不可报名"}
          </button>
        )}
      </aside>

      {showConfirmation ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !submitting && setShowConfirmation(false)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="apply-title" onKeyDown={(event) => { if (event.key === "Escape" && !submitting) setShowConfirmation(false); }} onMouseDown={(event) => event.stopPropagation()}>
            <span className="section-kicker">提交前确认</span>
            <h2 id="apply-title">确认报名 {job.title}</h2>
            <p>报名将占用 1 个名额，并创建“待招聘方确认”的真实云端记录。</p>
            <dl className="confirmation-list">
              <div><dt>演示学生</dt><dd>{data.profile.displayName}</dd></div>
              <div><dt>可工作时间</dt><dd>{formatShift(data.profile.availableStart, data.profile.availableEnd)}</dd></div>
              <div><dt>预计收入</dt><dd>{formatCurrency(job.estimatedAmountCents)}</dd></div>
            </dl>
            {submitError ? <p className="inline-error" role="alert">{submitError}。当前页面未伪造成功，可再次提交；RPC 会阻止重复报名。</p> : null}
            <div className="modal-actions">
              <button className="secondary-button" type="button" disabled={submitting} onClick={() => setShowConfirmation(false)}>暂不报名</button>
              <button className="primary-button" type="button" disabled={submitting} onClick={() => void handleApply()}>{submitting ? "正在提交…" : "确认报名"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
