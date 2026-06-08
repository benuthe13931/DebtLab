import { state } from '../modules/state';
import { formatCurrency, escapeAttribute } from '../utils';
import type { AppState, SnapshotRecord, PaymentRecord, ModelAdvice } from '../types';

type PlannerResponse = AppState & {
  snapshots: SnapshotRecord[];
  payments: PaymentRecord[];
  modelAdvice: ModelAdvice[];
};

export const renderReconciliation = (planner: PlannerResponse) => {
  const snapshotTables = planner.snapshots.reduce<Record<string, SnapshotRecord[]>>((acc, snapshot) => {
    const key = snapshot.debtId ?? 'unmatched';
    acc[key] = acc[key] ? [...acc[key], snapshot] : [snapshot];
    return acc;
  }, {});

  const selectedDebt = planner.debts.find((debt) => debt.id === state.selectedAccountId) ?? planner.debts[0] ?? null;
  const selectedSnapshots = selectedDebt ? snapshotTables[selectedDebt.id] ?? [] : [];
  const hasSnapshots = planner.snapshots.length > 0;

  return `
    <section class="content-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Reconciliation</p>
          <h3>Imported snapshots and statement attachments</h3>
        </div>
        <p class="panel-copy">Review statement snapshot imports by account and export a reconciliation report for your own records.</p>
      </div>

      <div class="account-fields">
        <label class="field">
          <span>Account</span>
          <select data-reconciliation-account="selectedDebtId">
            ${planner.debts
              .map((debt) => `<option value="${debt.id}" ${selectedDebt?.id === debt.id ? 'selected' : ''}>${escapeAttribute(debt.name)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="field field--wide">
          <span>Export reconciliation rows</span>
          <button class="button button--ghost" type="button" data-action="export-reconciliation-csv">Download CSV</button>
        </label>
      </div>

      ${
        !hasSnapshots
          ? `<div class="status-card"><strong>No statement snapshots found</strong><span>Use the account detail page to import statements and reconcile with your ledger.</span></div>`
          : `
            <div class="detail-table">
              <div class="detail-row detail-row--header">
                <span>Date</span>
                <span>Debt</span>
                <span>Balance</span>
                <span>Interest</span>
                <span>Action</span>
              </div>
              ${selectedSnapshots
                .map(
                  (snapshot) => {
                    const debt = planner.debts.find((d) => d.id === snapshot.debtId);
                    return `
                    <div class="detail-row">
                      <span>${snapshot.snapshotDate ?? 'Unknown'}</span>
                      <span>${escapeAttribute(debt?.name ?? 'Unmatched')}</span>
                      <span>${formatCurrency(snapshot.balanceCents ?? 0)}</span>
                      <span>${formatCurrency(snapshot.accruedInterestCents ?? 0)}</span>
                      <span><button class="button button--ghost" type="button" data-action="view-snapshot" data-snapshot-id="${snapshot.id}">View</button></span>
                    </div>
                  `;
                  },
                )
                .join('')}
            </div>
          `
      }
    </section>

    <section class="content-panel content-panel--nested">
      <div class="panel-header panel-header--tight">
        <div>
          <p class="eyebrow">Reconciliation export</p>
          <h3>Row-format reconciliation export</h3>
        </div>
      </div>
      <p class="panel-copy">Generate a CSV row export that includes the latest status for each account plus the imported statement interest snapshot rows.</p>
      <button class="button" type="button" data-action="download-snapshot-report">Create reconciliation CSV</button>
    </section>
  `;
};
