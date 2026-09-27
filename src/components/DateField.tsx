import { useEffect, useRef, useState } from "react";

const parseDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};
const dateValue = (date: Date) => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
const normalizeDraft = (value: string) => value.replace(/[^0-9-]/g, "").slice(0, 10);

export function DateField({ id, label, maxDate, minDate, onChange, value }: { id: string; label: string; maxDate?: string; minDate?: string; onChange: (value: string) => void; value: string }) {
  const selected = parseDate(value);
  const minimum = parseDate(minDate ?? "");
  const maximum = parseDate(maxDate ?? "");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [view, setView] = useState(selected ?? minimum ?? new Date());
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setDraft(value); setView(parseDate(value) ?? parseDate(minDate ?? "") ?? new Date()); }, [value, minDate]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const disabled = (date: Date) => Boolean((minimum && date < minimum) || (maximum && date > maximum));
  const commit = () => {
    if (!draft) { onChange(""); return; }
    const parsed = parseDate(draft);
    if (!parsed) { setDraft(value); return; }
    let next = parsed;
    if (minimum && next < minimum) next = minimum;
    if (maximum && next > maximum) next = maximum;
    const nextValue = dateValue(next);
    setDraft(nextValue); onChange(nextValue); setView(next);
  };
  const firstDay = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= count ? new Date(view.getFullYear(), view.getMonth(), day) : null;
  });
  const years = Array.from({ length: 21 }, (_, index) => view.getFullYear() - 10 + index);

  return <label htmlFor={id} style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-heading, #334155)" }}>{label}</span><div ref={ref} style={{ position: "relative", minWidth: 0 }}>
    <div style={{ position: "relative", border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: 10, background: "var(--app-input-bg, #fff)" }}><input id={id} type="text" inputMode="numeric" placeholder="yyyy-mm-dd" value={draft} onChange={(event) => setDraft(normalizeDraft(event.target.value))} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") commit(); }} style={{ width: "100%", minWidth: 0, border: 0, outline: 0, borderRadius: 10, padding: "10px 38px 10px 12px", fontSize: 15, background: "transparent", color: "var(--app-text, #0f172a)" }} /><button type="button" aria-label="Open calendar" onClick={() => setOpen((current) => !current)} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", width: 28, height: 28, display: "grid", placeItems: "center", border: 0, background: "transparent", color: "var(--app-text-muted, #64748b)", cursor: "pointer" }}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 4.75V7.25M17 4.75V7.25M5.75 8.5H18.25M8 6H16C17.7 6 19 7.3 19 9V16C19 17.7 17.7 19 16 19H8C6.3 19 5 17.7 5 16V9C5 7.3 6.3 6 8 6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></button></div>
    {open ? <div style={{ position: "absolute", zIndex: 40, bottom: "calc(100% + 8px)", left: 0, width: "min(320px, calc(100vw - 32px))", boxSizing: "border-box", display: "grid", gap: 10, padding: 14, border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: 14, background: "var(--app-surface, #fff)", boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", gap: 7 }}><button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} style={{ border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 8, background: "var(--app-surface, #fff)", color: "var(--app-text, #0f172a)", cursor: "pointer" }}>‹</button><select aria-label="Month" value={view.getMonth()} onChange={(event) => setView(new Date(view.getFullYear(), Number(event.target.value), 1))} style={{ ...inputStyle }}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{new Date(2026, index, 1).toLocaleString("en-US", { month: "short" })}</option>)}</select><select aria-label="Year" value={view.getFullYear()} onChange={(event) => setView(new Date(Number(event.target.value), view.getMonth(), 1))} style={{ ...inputStyle }}>{years.map((year) => <option key={year}>{year}</option>)}</select><button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} style={{ border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 8, background: "var(--app-surface, #fff)", color: "var(--app-text, #0f172a)", cursor: "pointer" }}>›</button></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <div key={day} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--app-text-muted, #64748b)" }}>{day}</div>)}{cells.map((date, index) => date ? <button key={dateValue(date)} type="button" disabled={disabled(date)} onClick={() => { const next = dateValue(date); setDraft(next); onChange(next); setOpen(false); }} style={{ border: selected && dateValue(selected) === dateValue(date) ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border, #e2e8f0)", borderRadius: 7, padding: "7px 0", background: selected && dateValue(selected) === dateValue(date) ? "var(--app-accent-soft, #dbeafe)" : "var(--app-surface, #fff)", color: disabled(date) ? "#94a3b8" : "var(--app-text, #0f172a)", cursor: disabled(date) ? "not-allowed" : "pointer" }}>{date.getDate()}</button> : <span key={`blank-${index}`} />)}</div>
    </div> : null}
  </div></label>;
}

const inputStyle = { width: "100%", border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 8, padding: "6px", background: "var(--app-surface, #fff)", color: "var(--app-text, #0f172a)" } as const;
