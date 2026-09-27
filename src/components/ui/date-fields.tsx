import { useEffect, useRef, useState } from "react";
import { DateField as SharedDateField } from "../DateField";
import { clampToMonth, parseDate, toDateInputValue } from "../../calculations/loans/dateUtils";
import { compareDateOnly, monthValue, normalizeDateDraftInput, parseMonthInput, startOfDay } from "../../utils/date";
function formatMonthYear(date: Date | null): string {
  if (!date) return "-";
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export function DatePickerInput({
  compact = false,
  id,
  maxDate,
  minDate,
  onChange,
  value,
}: {
  compact?: boolean;
  id?: string;
  maxDate?: string;
  minDate?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const committedParsed = parseDate(value);
  const parsedMinDate = parseDate(minDate ?? "");
  const parsedMaxDate = parseDate(maxDate ?? "");
  const today = startOfDay(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"day" | "month" | "year">("day");
  const [draftValue, setDraftValue] = useState(value);
  const draftParsed = parseDate(draftValue);
  const parsed = draftParsed ?? committedParsed;
  const [viewDate, setViewDate] = useState(parsed ?? parsedMinDate ?? today);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    setViewDate(parseDate(value) ?? parseDate(minDate ?? "") ?? startOfDay(new Date()));
  }, [minDate, value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setPickerMode("day");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const viewStartYear = Math.floor(viewYear / 10) * 10;
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstDayOfMonth + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return null;
    }
    return new Date(viewYear, viewMonth, dayNumber);
  });

  const buttonFontSize = compact ? 13 : 15;
  const clampDateToBounds = (date: Date) => {
    let nextDate = date;
    if (parsedMinDate && compareDateOnly(nextDate, parsedMinDate) < 0) {
      nextDate = parsedMinDate;
    }
    if (parsedMaxDate && compareDateOnly(nextDate, parsedMaxDate) > 0) {
      nextDate = parsedMaxDate;
    }
    return nextDate;
  };
  const isDateDisabled = (date: Date) =>
    (parsedMinDate ? compareDateOnly(date, parsedMinDate) < 0 : false) ||
    (parsedMaxDate ? compareDateOnly(date, parsedMaxDate) > 0 : false);
  const commitDraftValue = (nextValue: string) => {
    const trimmedValue = nextValue.trim();
    if (!trimmedValue) {
      setDraftValue("");
      onChange("");
      return;
    }

    const parsedNext = parseDate(trimmedValue);
    if (!parsedNext) {
      setDraftValue(value);
      return;
    }

    const clampedDate = clampDateToBounds(parsedNext);
    const resolvedValue = toDateInputValue(clampedDate);
    setDraftValue(resolvedValue);
    onChange(resolvedValue);
    setViewDate(clampedDate);
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative", minWidth: 0 }}>
      <div
        style={{
          width: "100%",
          border: "1px solid var(--app-border-strong, #cbd5e1)",
          borderRadius: compact ? 8 : 10,
          background: "var(--app-input-bg, #fff)",
          position: "relative",
          minWidth: 0,
        }}
      >
        <input
          id={id}
          type="text"
          inputMode="numeric"
          maxLength={10}
          pattern="\d{4}-\d{2}-\d{2}"
          title="Use yyyy-mm-dd"
          placeholder="yyyy-mm-dd"
          value={draftValue}
          onChange={(event) => setDraftValue(normalizeDateDraftInput(event.target.value))}
          onBlur={() => commitDraftValue(draftValue)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraftValue(draftValue);
            }
          }}
          style={{
            border: "none",
            outline: "none",
            borderRadius: compact ? 8 : 10,
            padding: compact ? "6px 30px 6px 8px" : "10px 36px 10px 12px",
            fontSize: buttonFontSize,
            background: "transparent",
            color: "var(--app-text, #0f172a)",
            minWidth: 0,
            width: "100%",
          }}
        />
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-label="Open calendar"
          style={{
            border: "0",
            borderLeft: "0",
            borderWidth: 0,
            borderStyle: "none",
            background: "transparent",
            color: "var(--app-text-muted, #64748b)",
            padding: 0,
            width: compact ? 24 : 28,
            height: compact ? 24 : 28,
            lineHeight: 1,
            cursor: "pointer",
            flexShrink: 0,
            position: "absolute",
            right: compact ? 6 : 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            appearance: "none",
            boxShadow: "none",
            outline: "none",
          }}
        >
          <svg
            aria-hidden="true"
            width={compact ? 14 : 16}
            height={compact ? 14 : 16}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 4.75V7.25M17 4.75V7.25M5.75 8.5H18.25M7.75 12H8.25M11.75 12H12.25M15.75 12H16.25M7.75 15.5H8.25M11.75 15.5H12.25M15.75 15.5H16.25M8 6H16C17.6569 6 19 7.34315 19 9V16C19 17.6569 17.6569 19 16 19H8C6.34315 19 5 17.6569 5 16V9C5 7.34315 6.34315 6 8 6Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {isOpen ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 30,
            width: 320,
            border: "1px solid var(--app-border-strong, #cbd5e1)",
            borderRadius: 14,
            padding: 14,
            background: "var(--app-surface, #ffffff)",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={() =>
                setViewDate((current) => {
                  if (pickerMode === "year") return new Date(current.getFullYear() - 10, current.getMonth(), 1);
                  if (pickerMode === "month") return new Date(current.getFullYear() - 1, current.getMonth(), 1);
                  return new Date(current.getFullYear(), current.getMonth() - 1, 1);
                })
              }
              style={{
                border: "1px solid var(--app-border-strong, #cbd5e1)",
                background: "var(--app-surface, #ffffff)",
                color: "var(--app-text, #0f172a)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Prev
            </button>
            {pickerMode === "day" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setPickerMode("month")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--app-heading, #334155)",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {viewDate.toLocaleString("en-US", { month: "long" })}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode("year")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--app-heading, #334155)",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {viewYear}
                </button>
              </div>
            ) : pickerMode === "month" ? (
              <button
                type="button"
                onClick={() => setPickerMode("year")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--app-heading, #334155)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {viewYear}
              </button>
            ) : (
              <div style={{ color: "var(--app-heading, #334155)", fontSize: 13, fontWeight: 700 }}>
                {viewStartYear} - {viewStartYear + 9}
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                setViewDate((current) => {
                  if (pickerMode === "year") return new Date(current.getFullYear() + 10, current.getMonth(), 1);
                  if (pickerMode === "month") return new Date(current.getFullYear() + 1, current.getMonth(), 1);
                  return new Date(current.getFullYear(), current.getMonth() + 1, 1);
                })
              }
              style={{
                border: "1px solid var(--app-border-strong, #cbd5e1)",
                background: "var(--app-surface, #ffffff)",
                color: "var(--app-text, #0f172a)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Next
            </button>
          </div>
          {pickerMode === "year" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--app-text-muted, #64748b)" }}>Year</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
                {Array.from({ length: 10 }, (_, index) => viewStartYear + index).map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setViewDate((current) => clampToMonth(year, current.getMonth(), current.getDate()));
                      setPickerMode("month");
                    }}
                    style={{
                      border: viewYear === year ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border-strong, #cbd5e1)",
                      background: viewYear === year ? "var(--app-accent-soft, #dbeafe)" : "var(--app-surface, #ffffff)",
                      color: "var(--app-text, #0f172a)",
                      borderRadius: 8,
                      padding: "10px 6px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          ) : pickerMode === "month" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--app-text-muted, #64748b)" }}>{viewYear}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                {Array.from({ length: 12 }, (_, index) => {
                  const monthLabel = new Date(2026, index, 1).toLocaleString("en-US", { month: "short" });
                  return (
                    <button
                      key={monthLabel}
                      type="button"
                      onClick={() => {
                        setViewDate((current) => clampToMonth(current.getFullYear(), index, current.getDate()));
                        setPickerMode("day");
                      }}
                      style={{
                        border: viewMonth === index ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border-strong, #cbd5e1)",
                        background: viewMonth === index ? "var(--app-accent-soft, #dbeafe)" : "var(--app-surface, #ffffff)",
                        color: "var(--app-text, #0f172a)",
                        borderRadius: 8,
                        padding: "10px 6px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {monthLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((weekday) => (
                  <div
                    key={weekday}
                    style={{ fontSize: 11, fontWeight: 700, color: "var(--app-text-muted, #64748b)", textAlign: "center" }}
                  >
                    {weekday}
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
                {dayCells.map((date, index) =>
                  date ? (
                    <button
                      key={toDateInputValue(date)}
                      type="button"
                      disabled={isDateDisabled(date)}
                      onClick={() => {
                        if (isDateDisabled(date)) return;
                        const resolvedValue = toDateInputValue(date);
                        setDraftValue(resolvedValue);
                        onChange(resolvedValue);
                        setViewDate(date);
                        setIsOpen(false);
                        setPickerMode("day");
                      }}
                      style={{
                        border:
                          parsed &&
                          parsed.getFullYear() === date.getFullYear() &&
                          parsed.getMonth() === date.getMonth() &&
                          parsed.getDate() === date.getDate()
                            ? "1px solid var(--app-accent, #2563eb)"
                            : "1px solid var(--app-border, #e2e8f0)",
                        background:
                          parsed &&
                          parsed.getFullYear() === date.getFullYear() &&
                          parsed.getMonth() === date.getMonth() &&
                          parsed.getDate() === date.getDate()
                            ? "var(--app-accent-soft, #dbeafe)"
                            : isDateDisabled(date)
                              ? "var(--app-surface-muted, #f8fafc)"
                              : "var(--app-surface, #ffffff)",
                        color: isDateDisabled(date) ? "#94a3b8" : "var(--app-text, #0f172a)",
                        opacity: isDateDisabled(date) ? 0.65 : 1,
                        borderRadius: 8,
                        padding: "8px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isDateDisabled(date) ? "not-allowed" : "pointer",
                      }}
                    >
                      {date.getDate()}
                    </button>
                  ) : (
                    <div key={`empty-${index}`} />
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function DateField({
  id,
  label,
  maxDate,
  minDate,
  onChange,
  value,
}: {
  id: string;
  label: string;
  maxDate?: string;
  minDate?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return <SharedDateField id={id} label={label} maxDate={maxDate} minDate={minDate} value={value} onChange={onChange} />;
}

export function MonthYearField({
  id,
  label,
  maxMonth,
  minMonth,
  onChange,
  value,
}: {
  id: string;
  label: string;
  maxMonth?: string;
  minMonth?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const parsed = parseMonthInput(value);
  const parsedMinMonth = parseMonthInput(minMonth ?? "");
  const parsedMaxMonth = parseMonthInput(maxMonth ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"month" | "year">("month");
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewStartYear, setViewStartYear] = useState(
    parsed ? Math.floor(parsed.getFullYear() / 10) * 10 : Math.floor(new Date().getFullYear() / 10) * 10,
  );
  const yearValue = parsed?.getFullYear() ?? null;
  const selectedMonthValue = parsed?.getMonth() ?? null;
  const wrapperRef = useRef<HTMLLabelElement | null>(null);
  const isMonthDisabled = (year: number, monthIndex: number) => {
    const date = new Date(year, monthIndex, 1);
    return (parsedMinMonth ? monthValue(date) < monthValue(parsedMinMonth) : false) ||
      (parsedMaxMonth ? monthValue(date) > monthValue(parsedMaxMonth) : false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setPickerMode("month");
    }
  }, [isOpen]);

  useEffect(() => {
    const resolvedYear = parsed?.getFullYear() ?? new Date().getFullYear();
    setViewYear(resolvedYear);
    setViewStartYear(Math.floor(resolvedYear / 10) * 10);
  }, [parsed?.getFullYear()]);

  const selectYear = (year: number) => {
    const resolvedMonth = selectedMonthValue ?? new Date().getMonth();
    setViewYear(year);
    setViewStartYear(Math.floor(year / 10) * 10);
    onChange(`${year}-${`${resolvedMonth + 1}`.padStart(2, "0")}`);
    setPickerMode("month");
  };

  const selectMonth = (monthIndex: number) => {
    const resolvedYear = viewYear;
    if (isMonthDisabled(resolvedYear, monthIndex)) {
      return;
    }
    onChange(`${resolvedYear}-${`${monthIndex + 1}`.padStart(2, "0")}`);
    setIsOpen(false);
  };

  return (
    <label htmlFor={id} ref={wrapperRef} style={{ display: "grid", gap: 6, position: "relative" }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-heading, #334155)" }}>{label}</span>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        style={{
          border: "1px solid var(--app-border-strong, #cbd5e1)",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 15,
          background: "var(--app-input-bg, #fff)",
          color: "var(--app-text, #0f172a)",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <span>{parsed ? formatMonthYear(parsed) : "Select month and year"}</span>
        <span style={{ color: "var(--app-text-muted, #64748b)", fontSize: 14, lineHeight: 1 }}>📅</span>
      </button>
      {isOpen ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 20,
            width: 320,
            border: "1px solid var(--app-border-strong, #cbd5e1)",
            borderRadius: 14,
            padding: 14,
            background: "var(--app-surface, #ffffff)",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => {
                if (pickerMode === "year") {
                  setViewStartYear((year) => year - 10);
                  return;
                }
                setViewYear((year) => year - 1);
              }}
              style={{
                border: "1px solid var(--app-border-strong, #cbd5e1)",
                background: "var(--app-surface, #ffffff)",
                color: "var(--app-text, #0f172a)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                if (pickerMode === "month") {
                  setPickerMode("year");
                  setViewStartYear(viewYear - (viewYear % 10));
                }
              }}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--app-heading, #334155)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {pickerMode === "month" ? `${viewYear}` : `${viewStartYear} - ${viewStartYear + 9}`}
            </button>
            <button
              type="button"
              onClick={() => {
                if (pickerMode === "year") {
                  setViewStartYear((year) => year + 10);
                  return;
                }
                setViewYear((year) => year + 1);
              }}
              style={{
                border: "1px solid var(--app-border-strong, #cbd5e1)",
                background: "var(--app-surface, #ffffff)",
                color: "var(--app-text, #0f172a)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Next
            </button>
          </div>
          {pickerMode === "year" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--app-text-muted, #64748b)" }}>Year</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
                {Array.from({ length: 10 }, (_, index) => viewStartYear + index).map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => selectYear(year)}
                    style={{
                      border: yearValue === year ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border-strong, #cbd5e1)",
                      background: yearValue === year ? "var(--app-accent-soft, #dbeafe)" : "var(--app-surface, #ffffff)",
                      color: "var(--app-text, #0f172a)",
                      borderRadius: 8,
                      padding: "10px 6px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--app-text-muted, #64748b)" }}>{viewYear}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                {Array.from({ length: 12 }, (_, index) => {
                  const monthLabel = new Date(2026, index, 1).toLocaleString("en-US", { month: "short" });
                  return (
                    <button
                      key={monthLabel}
                      type="button"
                      disabled={isMonthDisabled(viewYear, index)}
                      onClick={() => selectMonth(index)}
                      style={{
                        border: selectedMonthValue === index ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border-strong, #cbd5e1)",
                        background: selectedMonthValue === index ? "var(--app-accent-soft, #dbeafe)" : isMonthDisabled(viewYear, index) ? "var(--app-surface-muted, #f8fafc)" : "var(--app-surface, #ffffff)",
                        color: isMonthDisabled(viewYear, index) ? "#94a3b8" : "var(--app-text, #0f172a)",
                        opacity: isMonthDisabled(viewYear, index) ? 0.65 : 1,
                        borderRadius: 8,
                        padding: "10px 6px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isMonthDisabled(viewYear, index) ? "not-allowed" : "pointer",
                      }}
                    >
                      {monthLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </label>
  );
}

