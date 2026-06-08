import { state } from '../modules/state';
import { formatCurrency, escapeAttribute } from '../modules/utils';
import type { AppState, SnapshotRecord, PaymentRecord, ModelAdvice } from '../types';

type PlannerResponse = AppState & {
  snapshots: SnapshotRecord[];
  payments: PaymentRecord[];
  modelAdvice: ModelAdvice[];
};

export const renderPayments = (planner: PlannerResponse) => `
  <section class="content-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Batch payment entry</p>
        <h3>Record multiple payments at once</h3>
      </div>
      <p class="panel-copy">This is the fast spot for "I paid all of these on this date" without repeating quick-pay over and over.</p>
    </div>

    <div class="payment-draft-grid">
      ${state.paymentDrafts
        .map(
          (draft) => `
            <div class="payment-row">
              <label class="field">
                <span>Debt</span>
                <select data-draft-id="${draft.id}" data-draft-field="debtId">
                  <option value="">Select debt</option>
                  ${planner.debts
                    .map((debt) => `<option value="${debt.id}" ${draft.debtId === debt.id ? 'selected' : ''}>${escapeAttribute(debt.name)} (${formatCurrency(debt.balanceCents)})</option>`)
                    .join('')}
                </select>
              </label>
              <label class="field">
                <span>Date</span>
                <input type="date" value="${draft.paymentDate}" data-draft-id="${draft.id}" data-draft-field="paymentDate" />
              </label>
              <label class="field">
                <span>Amount</span>
                <input type="number" min="0" step="0.01" value="${draft.amount}" data-draft-id="${draft.id}" data-draft-field="amount" />
              </label>
              <label class="field">
                <span>Note</span>
                <input type="text" value="${escapeAttribute(draft.note)}" data-draft-id="${draft.id}" data-draft-field="note" />
              </label>
              <div class="payment-row__actions">
                ${state.paymentDrafts[0]?.id === draft.id ? '' : `<button class="icon-button" type="button" data-action="remove-payment-row" data-draft-id="${draft.id}">Delete row</button>`}
              </div>
            </div>
          `,
        )
        .join('')}
    </div>

    <div class="topbar-actions topbar-actions--spaced">
      <button class="button button--ghost" data-action="add-payment-row">Add another row</button>
      <button class="button" data-action="save-payments">Save payment batch</button>
    </div>
  </section>

  <section class="content-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Recorded payments</p>
        <h3>Payment ledger</h3>
      </div>
      <p class="panel-copy">Stored payment history is the foundation for historical replay and typo correction.</p>
    </div>
    <div class="detail-table">
      <div class="detail-row detail-row--header detail-row--payments">
        <span>Date</span>
        <span>Debt</span>
        <span>Amount</span>
        <span>Note</span>
        <span>Action</span>
      </div>
      ${planner.payments
        .map(
          (payment) =>
            state.editingPaymentId === payment.id
              ? `
                <div class="detail-row detail-row--payments">
                  <span><input type="date" value="${state.editingPaymentDraft.paymentDate}" data-edit-payment-field="paymentDate" /></span>
                  <span>${escapeAttribute(planner.debts.find((debt) => debt.id === payment.debtId)?.name ?? payment.debtId)}</span>
                  <span><input type="number" min="0" step="0.01" value="${state.editingPaymentDraft.amount}" data-edit-payment-field="amount" /></span>
                  <span><input type="text" value="${escapeAttribute(state.editingPaymentDraft.note)}" data-edit-payment-field="note" /></span>
                  <span class="ledger-actions"><button class="icon-button" data-action="save-edit-payment" data-payment-id="${payment.id}">Save</button><button class="icon-button" data-action="cancel-edit-payment">Cancel</button></span>
                </div>
              `
              : `
                <div class="detail-row detail-row--payments">
                  <span>${payment.paymentDate}</span>
                  <span>${escapeAttribute(planner.debts.find((debt) => debt.id === payment.debtId)?.name ?? payment.debtId)}</span>
                  <span>${formatCurrency(payment.amountCents)}</span>
                  <span>${escapeAttribute(payment.note || 'No note')}</span>
                  <span class="ledger-actions"><button class="icon-button" data-action="edit-payment" data-payment-id="${payment.id}">Edit</button><button class="icon-button" data-delete-payment="${payment.id}">Delete</button></span>
                </div>
              `,
        )
        .join('')}
    </div>
  </section>
`;
