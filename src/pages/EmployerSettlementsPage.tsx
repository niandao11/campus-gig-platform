import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageFeedback } from "../components/PageFeedback";
import { ApplicationBadge } from "../components/StatusBadge";
import { formatCurrency } from "../domain/calculations";
import { formatBeijingDateTime, formatShift } from "../domain/formatters";
import { useAsyncData } from "../hooks/useAsyncData";
import { confirmDemoSettlement, getEmployerDashboard } from "../services/demoService";

export function EmployerSettlementsPage({ refreshKey }: { refreshKey: number }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get("application");
  const { data, loading, error, reload } = useAsyncData(getEmployerDashboard, refreshKey);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (loading && !data) return <PageFeedback title="正在读取模拟结算" detail="正在核对唯一待结算记录与数据库计算金额。" />;
  if (error && !data) return <PageFeedback tone="error" title="模拟结算读取失败" detail={error} actionLabel="重新读取" onAction={() => void reload()} />;
  if (!data) return null;

  const settlementApplications = data.applications.filter((application) => application.status === "pending_settlement" || application.status === "settled_demo");
  const applications = selectedId
    ? settlementApplications.filter((application) => application.id === selectedId)
    : settlementApplications;

  async function handleSettle(applicationId: string) {
    setSubmittingId(applicationId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await confirmDemoSettlement(applicationId);
      const successMessage = result.repeated ? "该记录此前已完成模拟结算，没有生成重复事件。" : "Demo模拟结算已确认，学生端可以读取最终金额与完整时间线。";
      await reload();
      setActionSuccess(successMessage);
    } catch (mutationError) {
      setActionError(mutationError instanceof Error ? mutationError.message : "Demo模拟结算失败，请重试");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-heading compact-heading">
        <div className="eyebrow">招聘方端 · 模拟结算</div>
        <h1>金额由数据库核定，结算只有一个入口</h1>
        <p className="lede">这里仅改变演示状态并记录时间线，不接入支付工具、不转移资金，也不代表真实工资凭证。</p>
      </header>
      {error ? <PageFeedback tone="error" title="刷新失败" detail={`${error}。当前仍展示上次成功读取的状态。`} actionLabel="重试" onAction={() => void reload()} /> : null}
      {actionError ? <PageFeedback tone="error" title="模拟结算未完成" detail={`${actionError} 数据库真实状态保持不变。`} actionLabel="重新读取" onAction={() => void reload()} /> : null}
      {actionSuccess ? <PageFeedback tone="success" title="操作完成" detail={actionSuccess} /> : null}

      {applications.length === 0 ? (
        <PageFeedback tone="empty" title={selectedId ? "该记录尚未进入结算阶段或已被重置" : "当前没有待模拟结算记录"} detail="请先在报名处理页确认报名，再核定实际工时与完工。" actionLabel="查看报名处理" onAction={() => navigate("/employer/applications")} />
      ) : (
        <div className="settlement-list">
          {applications.map((application) => (
            <article className="settlement-record" key={application.id}>
              <div className="settlement-record-header">
                <div><span className="section-kicker">演示学生 · {application.employerName}</span><h2>{application.jobTitle}</h2><p>{formatShift(application.shiftStart, application.shiftEnd)}</p></div>
                <ApplicationBadge status={application.status} />
              </div>
              <div className="settlement-amount">
                <span>最终模拟金额</span>
                <strong>{formatCurrency(application.finalAmountCents ?? application.settlement?.amountCents ?? 0)}</strong>
                <small>由 complete_application 根据核定分钟与计价快照计算</small>
              </div>
              <dl className="evidence-list">
                <div><dt>计价快照</dt><dd>{application.payType === "daily" ? `${formatCurrency(application.dailyRateCents ?? 0)}/日（日薪不乘工时）` : `${formatCurrency(application.baseRateCents ?? 0)}/时${application.nightBonusCents ? ` + 夜班补贴 ${formatCurrency(application.nightBonusCents)}/时` : ""}`}</dd></div>
                <div><dt>计划 / 实际工时</dt><dd>{application.scheduledMinutes} / {application.actualMinutes ?? "—"} 分钟</dd></div>
                <div><dt>结算约定</dt><dd>{application.settlementTiming}；{application.settlementConditions}</dd></div>
                <div><dt>结算记录</dt><dd>{application.settlement?.status === "settled_demo" ? "已结算（Demo模拟）" : "待模拟结算"}</dd></div>
                {application.settlement?.settledAt ? <div><dt>模拟结算时间</dt><dd>{formatBeijingDateTime(application.settlement.settledAt)}</dd></div> : null}
              </dl>
              <div className="settlement-actions">
                <Link className="secondary-button" to={`/employer/applications/${application.id}`}>查看报名与事件</Link>
                {application.status === "pending_settlement" ? (
                  <button className="primary-button" type="button" disabled={submittingId !== null} onClick={() => void handleSettle(application.id)}>{submittingId === application.id ? "正在确认…" : "确认 Demo 模拟结算"}</button>
                ) : <strong className="terminal-note">终态只读 · 不发生真实支付</strong>}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="demo-notice">演示环境：所有结算均为状态模拟，不调用真实支付工具。</p>
    </section>
  );
}
