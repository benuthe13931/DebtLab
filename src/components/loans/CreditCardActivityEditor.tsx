import { useState } from "react";
import { DateField } from "../DateField";
import { CurrencyField } from "../ui/CurrencyField";
import { Field } from "../ui/Field";
import type { PaymentEvent } from "../../types/loans";
import type { ThemeDefinition } from "../../constants/theme";
import { parseDate, toDateInputValue } from "../../calculations/loans/dateUtils";
import { formatCurrency } from "../../utils/formatting";
import { parseCurrency } from "../../utils/currency";
export function CreditCardActivityEditor({ theme, transactions, onChange }: { theme: ThemeDefinition; transactions: PaymentEvent[]; onChange: (next: PaymentEvent[]) => void }) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("Purchase");
  const [kind, setKind] = useState<"charge" | "payment">("charge");
  const add = () => { const value = parseCurrency(amount); if (!date || value <= 0) return; onChange([...transactions, { id: crypto.randomUUID(), date: parseDate(date) ?? new Date(), amount: value, label: label.trim() || (kind === "charge" ? "Purchase" : "Standalone payment"), source: kind === "charge" ? "history" : "extra" }]); setAmount(""); setDate(""); };
  return <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12, padding: 14, borderRadius: 14, background: theme.surfaceMuted, border: `1px solid ${theme.cardBorder}` }}><div><strong>Transactions and standalone payments</strong><div style={{ marginTop: 4, fontSize: 12, color: theme.textMuted }}>Record purchases, fees, credits, and payments outside the recurring minimum. These entries change the balance independently of the monthly minimum rule.</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}><label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Entry type</span><select value={kind} onChange={(event) => setKind(event.target.value as "charge" | "payment")} style={{ boxSizing: "border-box", width: "100%", border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: "10px 12px", background: theme.surface, color: theme.text }}><option value="charge">Purchase or fee</option><option value="payment">Standalone payment</option></select></label><DateField id="card-activity-date" label="Date" value={date} onChange={setDate} /><CurrencyField id="card-activity-amount" label="Amount" value={amount} onChange={setAmount} /><Field id="card-activity-label" label="Memo" value={label} onChange={setLabel} /></div><button type="button" onClick={add} style={{ justifySelf: "start", border: `1px solid ${theme.accent}`, background: theme.accent, color: "#fff", borderRadius: 9, padding: "9px 12px", fontWeight: 700, cursor: "pointer" }}>Add entry</button>{transactions.length ? <div style={{ display: "grid", gap: 6 }}>{transactions.slice().sort((a, b) => a.date.getTime() - b.date.getTime()).map((entry) => <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 9, background: theme.surface, border: `1px solid ${theme.cardBorder}` }}><span>{toDateInputValue(entry.date)} · {entry.label}</span><span><strong>{formatCurrency(entry.amount)}</strong><button type="button" onClick={() => onChange(transactions.filter((item) => item.id !== entry.id))} style={{ marginLeft: 8, border: 0, background: "transparent", color: "#b91c1c", cursor: "pointer" }}>×</button></span></div>)}</div> : null}</div>;
}

