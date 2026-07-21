import { formatBeijingDateTime } from "../domain/formatters";
import { visibleStatusLabel } from "../domain/stateMachine";
import type { ApplicationEvent } from "../types/demo";

const actorLabels = {
  student: "学生",
  employer: "招聘方",
  system: "系统",
};

export function ApplicationTimeline({ events }: { events: ApplicationEvent[] }) {
  return (
    <ol className="timeline" aria-label="报名状态时间线">
      {events.map((event) => (
        <li key={event.id}>
          <span className="timeline-dot" aria-hidden="true" />
          <div className="timeline-content">
            <div className="timeline-title-row">
              <strong>{visibleStatusLabel(event.toStatus)}</strong>
              <time dateTime={event.createdAt}>{formatBeijingDateTime(event.createdAt)}</time>
            </div>
            <p>{event.note || `${actorLabels[event.actor]}更新了报名状态`}</p>
            <small>{actorLabels[event.actor]}操作 · 北京时间</small>
          </div>
        </li>
      ))}
    </ol>
  );
}
