import type { LoanSimulatorRuntime } from "../../types/loanSimulatorRuntime";

export function LoanAccountDeleteModal({ runtime }: { runtime: LoanSimulatorRuntime }) {
  const { deleteAccountConfirmOpen, setDeleteAccountConfirmOpen, deleteCurrentUserProfile, currentTheme } = runtime;
  if (!deleteAccountConfirmOpen) return null;
  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteAccountConfirmOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(15, 23, 42, 0.58)" }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" style={{ width: "min(460px, 100%)", display: "grid", gap: 18, padding: 24, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 18, background: currentTheme.surface, boxShadow: "0 28px 70px rgba(15, 23, 42, 0.3)" }}>
        <h2 id="delete-account-title" style={{ margin: 0, fontSize: 22 }}>Delete your account?</h2>
        <p style={{ margin: 0, color: currentTheme.textMuted, lineHeight: 1.6 }}>This permanently deletes your profile, saved loans, and paycheck plans. This action is irreversible.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={() => setDeleteAccountConfirmOpen(false)}>Cancel</button>
          <button type="button" onClick={() => void deleteCurrentUserProfile?.()}>Delete account</button>
        </div>
      </div>
    </div>
  );
}
