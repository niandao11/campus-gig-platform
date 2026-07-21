import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageFeedback } from "../components/PageFeedback";
import { AvailabilityBadge } from "../components/StatusBadge";
import { formatCurrency, haversineDistanceKm } from "../domain/calculations";
import { formatPay, formatShift } from "../domain/formatters";
import { defaultJobFilters, filterJobs, jobCode, matchesStudentAvailability, type JobFilters } from "../domain/jobDiscovery";
import { useAsyncData } from "../hooks/useAsyncData";
import { getJobs } from "../services/demoService";

export function StudentJobsPage({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error, reload } = useAsyncData(getJobs, refreshKey);
  const [filters, setFilters] = useState<JobFilters>(defaultJobFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareNotice, setCompareNotice] = useState<string | null>(null);
  const visibleJobs = useMemo(
    () => data ? filterJobs(data, filters).sort((left, right) => jobCode(left).localeCompare(jobCode(right))) : [],
    [data, filters],
  );

  if (loading && !data) {
    return <PageFeedback title="正在读取校园岗位" detail="正在从当前匿名会话加载五条快递驿站班次。" />;
  }
  if (error && !data) {
    return <PageFeedback tone="error" title="岗位读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;
  }
  if (!data?.jobs.length) {
    return <PageFeedback tone="empty" title="暂时没有演示岗位" detail="请重置当前 Demo 或稍后重试。" actionLabel="重新读取" onAction={() => void reload()} />;
  }

  function updateFilter<Key extends keyof JobFilters>(key: Key, value: JobFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleComparison(jobId: string) {
    setSelectedIds((current) => {
      if (current.includes(jobId)) {
        setCompareNotice(null);
        return current.filter((id) => id !== jobId);
      }
      if (current.length >= 3) {
        setCompareNotice("最多比较 3 条岗位，请先移除一条。");
        return current;
      }
      const next = [...current, jobId];
      setCompareNotice(next.length < 2 ? "再选择 1 条即可开始比较。" : null);
      return next;
    });
  }

  return (
    <section className="page-stack">
      <header className="page-heading">
        <div className="eyebrow">学生端 · 岗位发现</div>
        <h1>周末有空，先找到一份信息透明的零工</h1>
        <p className="lede">同一所校园、同一招聘方的五条真实班次样例；筛选、比较、报名与后续结算都读取当前会话的云端数据。</p>
      </header>

      {error ? <PageFeedback tone="error" title="刷新失败" detail={`${error}。当前仍展示上次成功读取的真实状态。`} actionLabel="重试" onAction={() => void reload()} /> : null}

      <section className="scenario-strip" aria-label="当前演示学生场景">
        <div><span>当前学生</span><strong>{data.profile.displayName}</strong></div>
        <div><span>可工作时间</span><strong>{formatShift(data.profile.availableStart, data.profile.availableEnd)}</strong></div>
        <div><span>目标范围</span><strong>校园附近 5 公里 · 时薪优先</strong></div>
      </section>

      <section className="filter-panel" aria-label="岗位筛选">
        <div className="section-heading small">
          <div><span className="section-kicker">决策条件</span><h2>筛选岗位</h2></div>
          <button className="text-button" type="button" onClick={() => setFilters(defaultJobFilters)}>清除筛选</button>
        </div>
        <div className="filter-grid">
          <label>
            <span>日期 / 时段</span>
            <select value={filters.date} onChange={(event) => updateFilter("date", event.target.value as JobFilters["date"])}>
              <option value="all">全部时段</option>
              <option value="matches">匹配我的空闲时间</option>
              <option value="saturday">周六</option>
              <option value="sunday">周日</option>
            </select>
          </label>
          <label>
            <span>计价方式</span>
            <select value={filters.pay} onChange={(event) => updateFilter("pay", event.target.value as JobFilters["pay"])}>
              <option value="all">全部计价</option>
              <option value="hourly">时薪</option>
              <option value="daily">日薪</option>
            </select>
          </label>
          <label>
            <span>结算时间</span>
            <select value={filters.settlement} onChange={(event) => updateFilter("settlement", event.target.value as JobFilters["settlement"])}>
              <option value="all">全部结算</option>
              <option value="same_day">当日</option>
              <option value="next_day">次日</option>
            </select>
          </label>
          <label className="checkbox-filter">
            <input type="checkbox" checked={filters.withinFiveKm} onChange={(event) => updateFilter("withinFiveKm", event.target.checked)} />
            <span>仅看 5 公里内</span>
          </label>
        </div>
      </section>

      <div className="section-heading">
        <div><span className="section-kicker">XX大学 · 校园快递驿站直招</span><h2>可比较的班次</h2></div>
        <span className="result-count">筛选结果 {visibleJobs.length} / {data.jobs.length} 条</span>
      </div>

      {visibleJobs.length === 0 ? (
        <PageFeedback tone="empty" title="没有同时满足这些条件的岗位" detail="多项筛选采用 AND 关系，可以清除筛选后重新选择。" actionLabel="清除筛选" onAction={() => setFilters(defaultJobFilters)} />
      ) : (
        <div className="job-list">
          {visibleJobs.map((job) => {
            const distance = haversineDistanceKm(data.campus, job);
            const selected = selectedIds.includes(job.id);
            const code = jobCode(job);
            return (
              <article className={`job-card ${job.scenarioKind === "main" ? "featured-card" : ""}`} key={job.id}>
                <div className="card-topline">
                  <AvailabilityBadge status={job.availabilityStatus} />
                  <span className="demo-chip">{code} · 合成直招演示岗位</span>
                  {matchesStudentAvailability(job, data.profile) ? <span className="match-chip">匹配空闲时间</span> : null}
                </div>
                <div className="job-card-main">
                  <div><h2>{job.title}</h2><p>{job.employerName}</p></div>
                  <strong className="pay-highlight">{formatPay(job)}</strong>
                </div>
                <dl className="job-facts">
                  <div><dt>班次</dt><dd>{formatShift(job.shiftStart, job.shiftEnd)}</dd></div>
                  <div><dt>直线距离</dt><dd>{distance.toFixed(1)} 公里</dd></div>
                  <div><dt>预计收入</dt><dd>{formatCurrency(job.estimatedAmountCents)}</dd></div>
                  <div><dt>剩余名额</dt><dd>{job.remainingSlots}/{job.capacity} 人</dd></div>
                </dl>
                <div className="job-card-footer">
                  <div><strong>{job.settlementTiming}</strong><p>{job.settlementConditions}</p></div>
                  <div className="card-actions">
                    <button className={`compare-toggle ${selected ? "selected" : ""}`} type="button" aria-pressed={selected} onClick={() => toggleComparison(job.id)}>
                      {selected ? "✓ 已选比较" : "+ 加入比较"}
                    </button>
                    <Link className="primary-button" to={`/student/jobs/${job.id}`}>{job.hasApplied ? "查看已报名岗位" : "查看详情"}</Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedIds.length ? (
        <aside className="compare-tray" aria-live="polite">
          <div><strong>已选 {selectedIds.length}/3 条岗位</strong><p>{compareNotice ?? (selectedIds.length >= 2 ? "已可进入比较，选择不会影响岗位报名状态。" : "再选择 1 条即可开始比较。")}</p></div>
          <Link className={selectedIds.length >= 2 ? "primary-button" : "secondary-button disabled-link"} aria-disabled={selectedIds.length < 2} onClick={(event) => { if (selectedIds.length < 2) event.preventDefault(); }} to={`/student/compare?jobs=${selectedIds.join(",")}`}>比较已选岗位</Link>
        </aside>
      ) : null}
    </section>
  );
}
