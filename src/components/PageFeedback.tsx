interface PageFeedbackProps {
  title: string;
  detail: string;
  tone?: "loading" | "error" | "empty" | "success";
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}

export function PageFeedback({
  title,
  detail,
  tone = "loading",
  actionLabel,
  onAction,
  actionDisabled = false,
}: PageFeedbackProps) {
  return (
    <div className={`page-feedback ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="feedback-mark" aria-hidden="true">{tone === "error" ? "!" : tone === "success" ? "✓" : "·"}</span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      {actionLabel && onAction ? (
        <button className="secondary-button" type="button" disabled={actionDisabled} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
