






import { LoanSidebar } from "../components/loans/LoanSidebar";













































import { LoanSimulatorChrome } from "./loanSimulator/LoanSimulatorChrome";
import { LoanWorkspace } from "./loanSimulator/LoanWorkspace";
import { LoanAccountDeleteModal } from "./loanSimulator/LoanAccountDeleteModal";

export function LoanSimulatorView({ runtime }: {runtime: LoanSimulatorRuntime;}) {
  const { setActivePage, loanSidebarCollapsed, setLoanSidebarCollapsed, savedLoans, currentLoanId, saveStatus, loanName, currentTheme, startNewLoan, loadSavedLoan, deleteLoan } = runtime;
  return (
    <div
      style={{
        minHeight: "100vh",
        background: currentTheme.appBackground,
        padding: "24px 16px 48px",
        color: currentTheme.text,
        ["--app-accent" as string]: currentTheme.accent,
        ["--app-accent-soft" as string]: currentTheme.accentSoft,
        ["--app-border" as string]: currentTheme.cardBorder,
        ["--app-border-strong" as string]: currentTheme.cardBorder,
        ["--app-heading" as string]: currentTheme.text,
        ["--app-input-bg" as string]: currentTheme.surface,
        ["--app-danger-bg" as string]: currentTheme.isDark ? "rgba(127, 29, 29, 0.35)" : "#fff1f2",
        ["--app-danger-border" as string]: currentTheme.isDark ? "#7f1d1d" : "#fecaca",
        ["--app-danger-text" as string]: currentTheme.isDark ? "#fecaca" : "#991b1b",
        ["--app-negative-bg" as string]: currentTheme.isDark ? "rgba(157, 23, 77, 0.25)" : "#fff1f2",
        ["--app-negative-border" as string]: currentTheme.isDark ? "#9d174d" : "#fda4af",
        ["--app-negative-text" as string]: currentTheme.isDark ? "#f9a8d4" : "#be123c",
        ["--app-positive-bg" as string]: currentTheme.isDark ? "rgba(21, 128, 61, 0.22)" : "#ecfdf5",
        ["--app-positive-border" as string]: currentTheme.isDark ? "#166534" : "#86efac",
        ["--app-positive-text" as string]: currentTheme.isDark ? "#86efac" : "#15803d",
        ["--app-benchmark-bg" as string]: currentTheme.isDark ? "rgba(180, 83, 9, 0.22)" : "#fefce8",
        ["--app-benchmark-border" as string]: currentTheme.isDark ? "#92400e" : "#fde68a",
        ["--app-benchmark-text" as string]: currentTheme.isDark ? "#fcd34d" : "#a16207",
        ["--app-row-negative" as string]: currentTheme.isDark ? "rgba(146, 64, 14, 0.18)" : "#fffbeb",
        ["--app-row-paused" as string]: currentTheme.isDark ? "rgba(194, 65, 12, 0.16)" : "#fff7ed",
        ["--app-surface" as string]: currentTheme.surface,
        ["--app-surface-muted" as string]: currentTheme.surfaceMuted,
        ["--app-table-header" as string]: currentTheme.surfaceMuted,
        ["--app-table-border" as string]: currentTheme.cardBorder,
        ["--app-text" as string]: currentTheme.text,
        ["--app-text-muted" as string]: currentTheme.textMuted
      }}>
      
          <div
        style={{
          maxWidth: 1760,
          margin: "0 auto",
          display: "grid",
          gap: 20,
          gridTemplateColumns: loanSidebarCollapsed ? "44px minmax(0, 1fr)" : "260px minmax(0, 1fr)",
          alignItems: "start"
        }}>
        
            <LoanSidebar
          collapsed={loanSidebarCollapsed}
          currentLoanId={currentLoanId}
          loanName={loanName}
          loans={savedLoans}
          onAdd={(type) => { void startNewLoan?.(type); setActivePage("simulator"); }}
          onCollapse={() => setLoanSidebarCollapsed((collapsed: boolean) => !collapsed)}
          onDelete={(loanId) => { void deleteLoan?.(loanId); }}
          onOverview={() => setActivePage("overview")}
          onSelect={(loanId) => { void loadSavedLoan?.(loanId); setActivePage("simulator"); }}
          saveStatus={saveStatus} />
        
            <div style={{ display: "grid", gap: 24, minWidth: 0 }}>
        <LoanSimulatorChrome runtime={runtime} />
        {runtime.activePage === "simulator" ? <LoanWorkspace runtime={runtime} /> : null}
        <LoanAccountDeleteModal runtime={runtime} />
        </div>
      </div>
    </div>);

}
 
import type { LoanSimulatorRuntime } from "../types/loanSimulatorRuntime";

