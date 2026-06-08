import { state } from '../modules/state';
import { formatCurrency, formatPercentValue, escapeAttribute } from '../modules/utils';
import { pickQuote } from '../modules/ui';
import { paidOffQuotes } from '../modules/config';
import type { AppState, SnapshotRecord, PaymentRecord, ModelAdvice } from '../types';

type PlannerResponse = AppState & {
  snapshots: SnapshotRecord[];
  payments: PaymentRecord[];
  modelAdvice: ModelAdvice[];
};

export const renderInfo = (planner: PlannerResponse) => {
  const selectedDebt = planner.debts.find((debt) => debt.id === state.selectedAccountId) ?? planner.debts[0] ?? null;
  const hasAdvice = planner.modelAdvice.length > 0;
  const selectedDebtPayments = selectedDebt ? planner.payments.filter((payment) => payment.debtId === selectedDebt.id) : [];
  const isPaidOff = selectedDebt ? selectedDebt.balanceCents <= 0 : false;

  return `
    <section class="content-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">App info</p>
          <h3>Insights and advice</h3>
        </div>
      </div>
      <div class="account-fields">
        <label class="field">
          <span>Selected account</span>
          <select data-account-info="selectedDebtId">
            ${planner.debts
              .map((debt) => `<option value="${debt.id}" ${selectedDebt?.id === debt.id ? 'selected' : ''}>${escapeAttribute(debt.name)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="field field--compact">
          <span>Show</span>
          <select data-account-info="viewMode">
            <option value="advice" ${state.accountInfoViewMode === 'advice' ? 'selected' : ''}>Advice</option>
            <option value="payments" ${state.accountInfoViewMode === 'payments' ? 'selected' : ''}>Payment history</option>
          </select>
        </label>
      </div>

      ${selectedDebt && isPaidOff ? `<div class="status-card status-card--good"><strong>Paid off</strong><span>${pickQuote(paidOffQuotes, selectedDebt.id)}</span></div>` : ''}

      ${
        state.accountInfoViewMode === 'payments'
          ? `
              <div class="detail-table">
                <div class="detail-row detail-row--header detail-row--payments">
                  <span>Date</span>
                  <span>Amount</span>
                  <span>Note</span>
                </div>
                ${selectedDebtPayments
                  .map(
                    (payment) => `
                      <div class="detail-row detail-row--payments">
                        <span>${payment.paymentDate}</span>
                        <span>${formatCurrency(payment.amountCents)}</span>
                        <span>${escapeAttribute(payment.note || 'No note')}</span>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            `
          : `
              <div class="grid-two-up">
                <article class="metric-card">
                  <span>Current balance</span>
                  <strong>${selectedDebt ? formatCurrency(selectedDebt.balanceCents) : '$0.00'}</strong>
                  <small>${selectedDebt ? escapeAttribute(selectedDebt.groupName ?? 'No group') : 'No account selected'}</small>
                </article>
                <article class="metric-card">
                  <span>APR</span>
                  <strong>${selectedDebt ? formatPercentValue(selectedDebt.aprBps / 100) : '0%'}</strong>
                  <small>${selectedDebt ? (selectedDebt.aprBps > 0 ? 'Interest rate loaded' : 'APR missing or zero') : ''}</small>
                </article>
              </div>
              <div class="status-card">
                <strong>${hasAdvice ? 'Model advice available' : 'No advice ready'}</strong>
                <span>${hasAdvice ? 'This section shows suggestions for orphan, oversize, or deferred-interest accounts.' : 'Run a schedule or refresh your account data to populate advice.'}</span>
              </div>
              ${
                hasAdvice
                  ? planner.modelAdvice
                      .map(
                        (advice) => `
                          <div class="advice-card">
                            <strong>${escapeAttribute(advice.debtName)}</strong>
                            <span>${escapeAttribute(advice.message)}</span>
                          </div>
                        `,
                      )
                      .join('')
                  : ''
              }
            `
      }
    </section>
  `;
};
