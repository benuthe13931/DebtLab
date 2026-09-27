import type { ScheduleRow } from "../../types/loans";
const footnoteSupStyle = {
  fontSize: 10,
  lineHeight: 1,
  verticalAlign: "super" as const,
  marginLeft: 1,
};

export function LabelWithNotes({ text, notes }: { text: string; notes?: number[] }) {
  return (
    <span>
      {text}
      {notes?.map((note) => (
        <sup key={`${text}-${note}`} style={footnoteSupStyle}>
          {note}
        </sup>
      ))}
    </span>
  );
}

export function formatPrincipalShare(share: number | null): string {
  if (share === null || !Number.isFinite(share)) {
    return "-";
  }
  return `${Math.max(0, share * 100).toFixed(0)}%`;
}

export function getEventTypeCode(eventType: ScheduleRow["eventType"]): string {
  switch (eventType) {
    case "scheduled":
      return "S";
    case "extra":
      return "E";
    case "history":
      return "H";
    case "paused":
      return "P";
    case "snapshot":
      return "A";
    default:
      return "-";
  }
}

export function getEventTypeTitle(eventType: ScheduleRow["eventType"]): string {
  switch (eventType) {
    case "scheduled":
      return "Scheduled";
    case "extra":
      return "Extra";
    case "history":
      return "Historical";
    case "paused":
      return "Paused";
    case "snapshot":
      return "As-of snapshot";
    default:
      return eventType;
  }
}

export function getTableRowStyle(row: ScheduleRow) {
  if (row.eventType === "paused") {
    return { background: "var(--app-row-paused, #fff7ed)" };
  }
  if (row.negativeAmortization) {
    return { background: "var(--app-row-negative, #fffbeb)" };
  }
  return undefined;
}

