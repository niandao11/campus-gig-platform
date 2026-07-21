import { applicationLabel, availabilityLabel } from "../domain/formatters";
import type { ApplicationStatus, AvailabilityStatus } from "../types/demo";

export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  return <span className={`status-badge availability-${status}`}>{availabilityLabel(status)}</span>;
}

export function ApplicationBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`status-badge application-${status}`}>{applicationLabel(status)}</span>;
}
