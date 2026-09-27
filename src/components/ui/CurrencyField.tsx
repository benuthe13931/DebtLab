import { useEffect, useState } from "react";
import { parseCurrency } from "../../utils/currency";

export function CurrencyInput({ compact = false, id, onChange, value }: { compact?: boolean; id?: string; onChange: (value: string) => void; value: string }) {
  const formatValue = (nextValue: string) => nextValue.trim() === "" ? "" : parseCurrency(nextValue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [draftValue, setDraftValue] = useState(() => formatValue(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraftValue(formatValue(value));
  }, [focused, value]);

  const commit = () => {
    const formatted = formatValue(draftValue);
    setFocused(false);
    setDraftValue(formatted);
    onChange(formatted);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", minWidth: 0, border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: compact ? 8 : 10, background: "var(--app-input-bg, #fff)" }}>
      <span aria-hidden="true" style={{ paddingLeft: compact ? 7 : 11, color: "var(--app-text-muted, #64748b)", fontSize: compact ? 12 : 15 }}>$</span>
      <input id={id} type="text" inputMode="decimal" value={draftValue} onFocus={() => setFocused(true)} onChange={(event) => setDraftValue(event.target.value.replace(/[^0-9.,]/g, ""))} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") commit(); }} style={{ width: "100%", minWidth: 0, border: 0, outline: 0, padding: compact ? "6px 6px" : "10px 10px", borderRadius: compact ? 8 : 10, fontSize: compact ? 12 : 15, background: "transparent", color: "var(--app-text, #0f172a)" }} />
    </div>
  );
}

export function CurrencyField({ id, label, onChange, value }: { id: string; label: string; onChange: (value: string) => void; value: string }) {
  return <label htmlFor={id} style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-heading, #334155)" }}>{label}</span><CurrencyInput id={id} value={value} onChange={onChange} /></label>;
}