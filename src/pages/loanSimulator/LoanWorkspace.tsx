// @ts-nocheck
import { LoanDetailsTab } from "./LoanDetailsTab";
import { LoanTransactionsTab } from "./LoanTransactionsTab";
import { LoanHistoryTab } from "./LoanHistoryTab";
import { LoanWhatIfTab } from "./LoanWhatIfTab";
import { LoanSummarySection } from "./LoanSummarySection";
export function LoanWorkspace({ runtime }: { runtime: Record<string, any> }) {
  const { activeLoanTab, accountType, currentTheme, setActiveLoanTab, setActiveView } = runtime;
  return (
            <main style={{ display: "grid", gap: 0, minWidth: 0 }}>
                <nav aria-label="Loan workspace" style={{ display: "flex", alignItems: "end", borderBottom: `1px solid ${currentTheme.cardBorder}` }}>
                  {([
                    ["details", accountType === "credit-card" ? "Card Details" : "Loan Details"],
                    ...(accountType === "credit-card" ? [["transactions", "Transactions"]] : []),
                    ["history", "Payoff Schedule"],
                    ["whatif", "What If"],
                  ] as const).map(([tab, label]) => (
                    <button key={tab} type="button" onClick={() => { setActiveLoanTab(tab as "details" | "transactions" | "history" | "whatif"); if (tab === "history" || tab === "whatif") setActiveView(tab); else setActiveView("assumed"); }} style={{ flex: "1 1 0", marginBottom: -1, border: `1px solid ${currentTheme.cardBorder}`, borderBottomColor: activeLoanTab === tab ? currentTheme.surface : currentTheme.cardBorder, borderRadius: "14px 14px 0 0", padding: "13px 16px", background: activeLoanTab === tab ? currentTheme.surface : currentTheme.surfaceMuted, color: currentTheme.text, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                  ))}
                </nav>
                <div style={{ display: "grid", gap: 24, gridTemplateColumns: activeLoanTab === "details" || activeLoanTab === "transactions" ? "minmax(0, 1fr)" : "360px minmax(0, 1fr)", alignItems: "start", minWidth: 0, paddingTop: 20 }}>
              <section
                style={{
                  background: currentTheme.surface,
                  border: `1px solid ${currentTheme.cardBorder}`,
                  borderRadius: 18,
                  padding: 20,
                  textAlign: "left",
                  display: "grid",
                  gridTemplateColumns: activeLoanTab === "details" ? "repeat(auto-fit, minmax(280px, 1fr))" : undefined,
                  gap: 16,
                  boxShadow: currentTheme.cardShadow,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 22, gridColumn: activeLoanTab === "details" || activeLoanTab === "transactions" ? "1 / -1" : undefined }}>
                  {activeLoanTab === "details"
                    ? accountType === "credit-card" ? "Credit Card Details" : "Loan Details"
                    : activeLoanTab === "transactions"
                      ? "Transactions"
                    : activeLoanTab === "history"
                       ? "Payoff Schedule"
                      : "What If"}
                </h2>
                
          {activeLoanTab === "details" ? <LoanDetailsTab runtime={runtime} /> : activeLoanTab === "transactions" ? <LoanTransactionsTab runtime={runtime} /> : activeLoanTab === "history" ? <LoanHistoryTab runtime={runtime} /> : <LoanWhatIfTab runtime={runtime} />}
          </section>
          <LoanSummarySection runtime={runtime} />
            </div>
        </main>
  );
}
