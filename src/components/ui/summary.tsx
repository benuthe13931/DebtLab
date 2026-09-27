import type { ReactNode } from "react";
export function SummaryValue({
  emphasized = false,
  label,
  subtext,
  tone = "default",
  value,
}: {
  emphasized?: boolean;
  label: ReactNode;
  subtext?: ReactNode;
  tone?: "benchmark" | "default" | "negative" | "positive";
  value: string;
}) {
  const emphasizedStyle =
    tone === "positive"
      ? {
          display: "grid",
          gap: 4,
          padding: 12,
          borderRadius: 14,
          background: "var(--app-positive-bg, #ecfdf5)",
          border: "1px solid var(--app-positive-border, #86efac)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
        }
      : tone === "negative"
        ? {
            display: "grid",
            gap: 4,
            padding: 12,
            borderRadius: 14,
            background: "var(--app-negative-bg, #fff1f2)",
            border: "1px solid var(--app-negative-border, #fda4af)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
          }
        : tone === "benchmark"
          ? {
              display: "grid",
              gap: 4,
              padding: 12,
              borderRadius: 14,
              background: "var(--app-benchmark-bg, #fefce8)",
              border: "1px solid var(--app-benchmark-border, #fde68a)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
            }
          : {
              display: "grid",
              gap: 4,
              padding: 12,
              borderRadius: 14,
              background: "var(--app-surface-muted, #f8fafc)",
              border: "1px solid var(--app-border, #dbe2ea)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
            };

  return (
    <div
      style={emphasized ? emphasizedStyle : { display: "grid", gap: 4 }}
    >
      <div
        style={{
          fontSize: emphasized ? 12 : 13,
          color:
            tone === "positive"
              ? "var(--app-positive-text, #15803d)"
              : tone === "negative"
                ? "var(--app-negative-text, #be123c)"
                : tone === "benchmark"
                  ? "var(--app-benchmark-text, #a16207)"
                  : emphasized
                    ? "var(--app-accent, #1d4ed8)"
                  : "var(--app-text-muted, #64748b)",
          fontWeight: emphasized ? 700 : 500,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, color: "var(--app-text, #0f172a)", letterSpacing: "-0.01em" }}>{value}</div>
      {subtext ? <div style={{ fontSize: 12, color: "var(--app-text-muted, #64748b)", lineHeight: 1.4 }}>{subtext}</div> : null}
    </div>
  );
}

export function SummaryGroupLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "var(--app-text-muted, #475569)",
        marginTop: 8,
      }}
    >
      {label}
    </div>
  );
}

export function FormSection({
  children,
  helper,
  title,
}: {
  children: ReactNode;
  helper?: ReactNode;
  title: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        alignContent: "start",
        alignItems: "start",
        gap: 12,
        padding: 14,
        borderRadius: 14,
        background: "var(--app-surface-muted, #f8fafc)",
        border: "1px solid var(--app-border, #e2e8f0)",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--app-heading, #334155)" }}>{title}</div>
        {helper ? <div style={{ fontSize: 12, color: "var(--app-text-muted, #64748b)", lineHeight: 1.4 }}>{helper}</div> : null}
      </div>
      {children}
    </div>
  );
}

