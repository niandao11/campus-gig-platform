import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageFeedback } from "../components/PageFeedback";
import { AvailabilityBadge } from "../components/StatusBadge";
import { formatCurrency, haversineDistanceKm } from "../domain/calculations";
import { formatPay, formatShift } from "../domain/formatters";
import { jobCode } from "../domain/jobDiscovery";
import { useAsyncData } from "../hooks/useAsyncData";
import { getJobs } from "../services/demoService";
import type { Job } from "../types/demo";

function pricingDetails(job: Job): string {
  if (job.payType === "daily") return `${formatCurrency(job.dailyRateCents ?? 0)}/日，日薪不折算时薪`;
  if (job.nightBonusCents > 0) {
    return `基础 ${formatCurrency(job.baseRateCents ?? 0)}/时 + 夜班补贴 ${formatCurrency(job.nightBonusCents)}/时`;
  }
  return `基础时薪 ${formatCurrency(job.baseRateCents ?? 0)}/时`;
}

export function StudentComparePage({ refreshKey }: { refreshKey: number }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, reload } = useAsyncData(getJobs, refreshKey);
  const requestedIds = (searchParams.get("jobs") ?? "").split(",").filter(Boolean).slice(0, 3);

  if (loading && !data) return <PageFeedback title="正在读取岗位比较" detail="正在从云端核对已选岗位的最新名额和状态。" />;
  if (error && !data) return <PageFeedback tone="error" title="岗位比较读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;
  if (!data) return null;

  const jobs = requestedIds.map((id) => data.jobs.find((job) => job.id === id)).filter((job): job is Job => Boolean(job));
  if (jobs.length < 2) {
    return <PageFeedback tone="empty" title="请先选择 2–3 条岗位" detail="重置后岗位 ID 会更新；请返回列表重新选择要比较的班次。" actionLabel="返回选择岗位" onAction={() => navigate("/student/jobs")} />;
  }

  function removeJob(jobId: string) {
    const nextIds = jobs.filter((job) => job.id !== jobId).map((job) => job.id);
    setSearchParams(nextIds.length ? { jobs: nextIds.join(",") } : {});
  }

  return (
    <section className="page-stack">
      <Link className="back-link" to="/student/jobs">← 返回岗位列表</Link>
      <header className="page-heading compact-heading">
        <div className="eyebrow">学生端 · 岗位比较</div>
        <h1>把影响选择的条件放在一起</h1>
        <p className="lede">当前比较 {jobs.length} 条岗位；不可报名样例也保留，便于看清名额与截止状态，而不是被系统隐藏。</p>
      </header>
      {error ? <PageFeedback tone="error" title="刷新失败" detail={`${error}。当前仍展示上次成功读取的数据。`} actionLabel="重试" onAction={() => void reload()} /> : null}

      <div className={`compare-grid compare-count-${jobs.length}`}>
        {jobs.map((job) => (
          <article className={`compare-card ${job.scenarioKind === "main" ? "featured-card" : ""}`} key={job.id}>
            <div className="card-topline">
              <AvailabilityBadge status={job.availabilityStatus} />
              <span className="demo-chip">{jobCode(job)}</span>
            </div>
            <h2>{job.title}</h2>
            <strong className="pay-highlight">{formatPay(job)}</strong>
            <dl className="compare-facts">
              <div><dt>可报名状态</dt><dd>{job.availabilityStatus === "open" ? "当前可报名" : job.availabilityStatus === "full" ? "名额已满" : "报名已截止"}</dd></div>
              <div><dt>班次</dt><dd>{formatShift(job.shiftStart, job.shiftEnd)}</dd></div>
              <div><dt>直线距离</dt><dd>{haversineDistanceKm(data.campus, job).toFixed(1)} 公里</dd></div>
              <div><dt>计价构成</dt><dd>{pricingDetails(job)}</dd></div>
              <div><dt>{job.payType === "daily" ? "日薪" : "有效时薪"}</dt><dd>{job.payType === "daily" ? `${formatCurrency(job.dailyRateCents ?? 0)}/日` : `${formatCurrency(job.effectiveRateCents ?? 0)}/小时`}</dd></div>
              <div><dt>预计总收入</dt><dd>{formatCurrency(job.estimatedAmountCents)}</dd></div>
              <div><dt>结算时间</dt><dd>{job.settlementTiming}</dd></div>
              <div><dt>结算前提</dt><dd>{job.settlementConditions}</dd></div>
              <div><dt>剩余名额</dt><dd>{job.remainingSlots}/{job.capacity} 人</dd></div>
            </dl>
            <div className="compare-actions">
              <button className="text-button" type="button" onClick={() => removeJob(job.id)}>移出比较</button>
              <Link className="primary-button" to={`/student/jobs/${job.id}`}>查看详情</Link>
            </div>
          </article>
        ))}
      </div>
      <p className="demo-notice">所有金额与主体信息均为演示数据；比较结果用于辅助判断，不构成岗位安全或信用评分。</p>
    </section>
  );
}

