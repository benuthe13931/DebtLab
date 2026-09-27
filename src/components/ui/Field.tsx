import { useEffect, useState } from "react";

export type FieldProps = {
  commitMode?: "blur" | "change";
  id: string;
  label: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "month" | "password";
  value: string;
};

export function Field({ commitMode = "change", id, label, onChange, type = "text", value }: FieldProps) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commit = () => {
    if (draftValue !== value) {
      onChange(draftValue);
    }
  };

  return (
    <label htmlFor={id} style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-heading, #334155)" }}>{label}</span>
      <input
        id={id}
        type={type}
        value={commitMode === "blur" ? draftValue : value}
        onBlur={commitMode === "blur" ? commit : undefined}
        onChange={(event) => {
          if (commitMode === "blur") {
            setDraftValue(event.target.value);
            return;
          }
          onChange(event.target.value);
        }}
        onKeyDown={
          commitMode === "blur"
            ? (event) => {
                if (event.key === "Enter") {
                  commit();
                }
              }
            : undefined
        }
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px solid var(--app-border-strong, #cbd5e1)",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 15,
          background: "var(--app-input-bg, #fff)",
          color: "var(--app-text, #0f172a)",
        }}
      />
    </label>
  );
}
