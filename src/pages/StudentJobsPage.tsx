import { Link } from "react-router-dom";
import { PageFeedback } from "../components/PageFeedback";
import { AvailabilityBadge } from "../components/StatusBadge";
import { formatPay, formatShift } from "../domain/formatters";
import { formatCurrency, haversineDistanceKm } from "../domain/calculations";
import { useAsyncData } from "../hooks/useAsyncData";
import { getJobs } from "../services/demoService";

export function StudentJobsPage({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error, reload } = useAsyncData(getJobs, refreshKey);

  if (loading && !data) {
    return <PageFeedback title="正在读取校园岗位" detail="正在从当前匿名会话加载 J-01 主演示班次。" />;
  }
  if (error && !data) {
    return <PageFeedback tone="error" title="岗位读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;
  }

  const mainJob = data?.jobs.find((job) => job.scenarioKind === "main");
  if (!data || !mainJob) {
    return <PageFeedback tone="empty" title="暂时没有主演示岗位" detail="请重置当前 Demo 或稍后重试。" actionLabel="重新读取" onAction={() => void reload()} />;
  }

  const distance = haversineDistanceKm(data.campus, mainJob);

  return (
    <section className="page-stack">
      <header className="page-heading">
        <div className="eyebrow">学生端 · 岗位发现</div>
        <h1>周六有空，先找到一份信息透明的零工</h1>
        <p className="lede">当前 G4 聚焦一条真实云端主流程；其他四条班次保留在数据库中，将在 G5 开放完整筛选与比较。</p>
      </header>

      {error ? <PageFeedback tone="error" title="刷新失败" detail={`${error}。当前仍展示上次成功读取的真实状态。`} actionLabel="重试" onAction={() => void reload()} /> : null}

      <section className="scenario-strip" aria-label="当前演示学生场景">
        <div>
          <span>当前学生</span>
          <strong>{data.profile.displayName}</strong>
        </div>
        <div>
          <span>可工作时间</span>
          <strong>{formatShift(data.profile.availableStart, data.profile.availableEnd)}</strong>
        </div>
        <div>
          <span>目标范围</span>
          <strong>校园附近 5 公里 · 时薪优先</strong>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <span className="section-kicker">J-01 · 主演示岗位</span>
          <h2>与你的空闲时间完全匹配</h2>
        </div>
        <span className="result-count">当前展示 1 条</span>
      </div>

      <article className="job-card featured-card">
        <div className="card-topline">
          <AvailabilityBadge status={mainJob.availabilityStatus} />
          <span className="demo-chip">合成直招演示岗位</span>
        </div>
        <div className="job-card-main">
          <div>
            <h2>{mainJob.title}</h2>
            <p>{mainJob.employerName}</p>
          </div>
          <strong className="pay-highlight">{formatPay(mainJob)}</strong>
        </div>
        <dl className="job-facts">
          <div><dt>班次</dt><dd>{formatShift(mainJob.shiftStart, mainJob.shiftEnd)}</dd></div>
          <div><dt>直线距离</dt><dd>{distance.toFixed(1)} 公里</dd></div>
          <div><dt>预计收入</dt><dd>{formatCurrency(mainJob.estimatedAmountCents)}</dd></div>
          <div><dt>剩余名额</dt><dd>{mainJob.remainingSlots}/{mainJob.capacity} 人</dd></div>
        </dl>
        <div className="job-card-footer">
          <p>{mainJob.settlementTiming}</p>
          <Link className="primary-button" to={`/student/jobs/${mainJob.id}`}>
            {mainJob.hasApplied ? "查看已报名岗位" : "查看详情与透明度"}
          </Link>
        </div>
      </article>
    </section>
  );
}
