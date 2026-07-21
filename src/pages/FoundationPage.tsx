interface FoundationPageProps {
  eyebrow: string;
  title: string;
  description: string;
  sessionState: "loading" | "ready" | "unconfigured" | "error";
  sessionError: string | null;
  onRetry: () => void;
}

const statusContent = {
  loading: { title: "正在连接云端", detail: "正在建立匿名演示会话并初始化数据。", label: "连接中", tone: "warning" },
  ready: { title: "工程骨架与云端已连接", detail: "匿名会话和 Supabase 初始化 RPC 已成功。", label: "云端已连接", tone: "success" },
  unconfigured: { title: "应用等待云端配置", detail: "当前环境尚未配置 Supabase 客户端变量，无法读取真实演示状态。", label: "等待环境变量", tone: "warning" },
  error: { title: "云端连接失败", detail: "真实状态未被覆盖，请检查网络或云端配置后重试。", label: "连接失败", tone: "danger" },
} as const;

export function FoundationPage({ eyebrow, title, description, sessionState, sessionError, onRetry }: FoundationPageProps) {
  const status = statusContent[sessionState];
  return (
    <section className="foundation-page">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p className="lede">{description}</p>

      <div className="foundation-card">
        <div className={`foundation-icon ${sessionState === "error" ? "error" : ""}`} aria-hidden="true">
          {sessionState === "error" ? "!" : "✓"}
        </div>
        <div>
          <h2>{status.title}</h2>
          <p>{sessionState === "error" && sessionError ? sessionError : status.detail}</p>
        </div>
        <span className={`pill ${status.tone}`}>{status.label}</span>
        {sessionState === "error" ? <button className="retry-button" type="button" onClick={onRetry}>重新连接</button> : null}
      </div>

      <div className="info-grid">
        <article>
          <span>01</span>
          <h3>一个校园</h3>
          <p>当前启用 XX大学，数据模型保留多校园扩展能力。</p>
        </article>
        <article>
          <span>02</span>
          <h3>两个角色</h3>
          <p>学生与快递驿站在同一链接切换，并读写同一匿名会话的云端状态。</p>
        </article>
        <article>
          <span>03</span>
          <h3>完整闭环</h3>
          <p>报名、确认、完工、待模拟结算与已结算（Demo模拟）形成完整状态闭环。</p>
        </article>
      </div>
    </section>
  );
}
