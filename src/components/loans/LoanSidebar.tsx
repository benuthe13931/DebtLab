type SidebarLoan = {
  id: string;
  name: string;
};

type LoanSidebarProps = {
  collapsed: boolean;
  currentLoanId: string | null;
  loanName: string;
  loans: SidebarLoan[];
  onAdd: () => void;
  onCollapse: () => void;
  onDelete: (loanId: string) => void;
  onOverview: () => void;
  onSelect: (loanId: string) => void;
  saveStatus: string;
};

export function LoanSidebar({
  collapsed,
  currentLoanId,
  loanName,
  loans,
  onAdd,
  onCollapse,
  onDelete,
  onOverview,
  onSelect,
  saveStatus,
}: LoanSidebarProps) {
  return (
    <aside style={{ position: "sticky", top: 24, minHeight: "calc(100vh - 48px)", padding: collapsed ? 6 : 16, display: "grid", gridTemplateRows: collapsed ? "auto" : "auto auto 1fr auto", alignContent: "start", gap: 14, border: "1px solid var(--app-border, #e2e8f0)", borderRadius: collapsed ? 10 : 18, background: "var(--app-surface, #fff)", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", gap: 8 }}>
        {!collapsed ? <strong style={{ fontSize: 16 }}>Your loans</strong> : null}
        <button type="button" aria-label={collapsed ? "Expand loan sidebar" : "Collapse loan sidebar"} onClick={onCollapse} style={{ width: collapsed ? 30 : 36, height: collapsed ? 30 : 36, display: "grid", placeItems: "center", border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 8, background: "var(--app-surface-muted, #f8fafc)", color: "var(--app-text, #0f172a)", cursor: "pointer" }}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor"/><path d="M6 3v10" stroke="currentColor"/><path d={collapsed ? "m9 6 2 2-2 2" : "m11 6-2 2 2 2"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
      </div>
      {!collapsed ? <button type="button" onClick={onAdd} title="Add loan" style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 9, width: "100%", border: "1px solid var(--app-accent, #2563eb)", borderRadius: 11, padding: "10px 12px", background: "var(--app-accent, #2563eb)", color: "#fff", fontWeight: 750, cursor: "pointer" }}>
        <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>+</span>Add loan
      </button> : null}
      {!collapsed ? <div style={{ display: "grid", gap: 7, alignContent: "start" }}>
        <button type="button" onClick={onOverview} style={{ width: "100%", textAlign: "left", border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 10, padding: "10px 12px", background: "var(--app-surface-muted, #f8fafc)", color: "var(--app-text, #0f172a)", fontWeight: 750, cursor: "pointer" }}>Overall summary</button>
        {!currentLoanId && loanName ? <div style={{ padding: collapsed ? "10px 0" : "10px 12px", textAlign: collapsed ? "center" : "left", borderRadius: 10, background: "var(--app-accent-soft, #dbeafe)", color: "var(--app-text, #0f172a)", fontSize: 13, fontWeight: 700 }} title="Unsaved loan">{collapsed ? "*" : `${loanName || "New loan"} (draft)`}</div> : null}
        {loans.map((loan) => {
          const selected = loan.id === currentLoanId;
          return <div key={loan.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 5, alignItems: "center", border: selected ? "1px solid var(--app-accent, #2563eb)" : "1px solid transparent", borderRadius: 10, background: selected ? "var(--app-accent-soft, #dbeafe)" : "transparent" }}><button type="button" title={loan.name} onClick={() => onSelect(loan.id)} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", border: 0, padding: "10px 8px 10px 12px", background: "transparent", color: "var(--app-text, #0f172a)", fontWeight: selected ? 750 : 600, cursor: "pointer" }}>{loan.name}</button><button type="button" aria-label={`Delete ${loan.name}`} title="Delete loan" onClick={() => onDelete(loan.id)} style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: 0, borderRadius: 7, background: "transparent", color: "var(--app-danger-text, #b91c1c)", cursor: "pointer" }}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div>;
        })}
        {loans.length === 0 && !collapsed ? <div style={{ padding: "12px 4px", color: "var(--app-text-muted, #64748b)", fontSize: 12, lineHeight: 1.5 }}>Add your first loan to begin building a payoff plan.</div> : null}
      </div> : null}
      {!collapsed && saveStatus ? <div style={{ fontSize: 12, color: "var(--app-text-muted, #64748b)", lineHeight: 1.4 }}>{saveStatus}</div> : null}
    </aside>
  );
}