import { state } from '../modules/state';
import { formatCurrency, escapeAttribute } from '../modules/utils';
import { getDebtMinimumProjection, getProjectedDebtSnapshot } from '../modules/calculations';
import type { PlannerResponse } from '../types';

export const renderProjections = (planner: PlannerResponse) => {
  const selectedDebt = planner.debts.find((debt) => debt.id === state.selectedAccountId) ?? planner.debts[0] ?? null;
  const draftDate =
    selectedDebt && state.projectionDateDraft.selectedDebtId === selectedDebt.id
      ? state.projectionDateDraft.value
      : state.accountProjectionDate;
  const projectedSnapshot = selectedDebt ? getProjectedDebtSnapshot(planner, selectedDebt, state.accountProjectionDate) : null;
  const projectedBalanceOnDate = projectedSnapshot?.projectedBalanceCents ?? null;
  const estimatedPendingInterest = projectedSnapshot?.accruedInterestCents ?? null;

  return `
    <section class="content-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Projections</p>
          <h3>Date-based projection lab</h3>
        </div>
        <p class="panel-copy">Pick an account and a date to estimate where the balance should be if the current settings are correct.</p>
      </div>

      ${
        !selectedDebt
          ? `<div class="status-card"><strong>No account selected</strong><span>Add an account first, then come back here to test dates and projected balances.</span></div>`
          : `
            <div class="account-fields">
              <label class="field">
                <span>Account</span>
                <select data-projection-account="selectedDebtId">
                  ${planner.debts
                    .map((debt) => `<option value="${debt.id}" ${debt.id === selectedDebt.id ? 'selected' : ''}>${escapeAttribute(debt.name)}</option>`)
                    .join('')}
                </select>
              </label>
              <label class="field">
                <span>Projection date</span>
                <input class="control-input control-input--date" type="date" value="${draftDate}" data-account-projection="date" />
                <button class="button button--ghost" type="button" data-action="apply-projection-date">Update projection</button>
              </label>
            </div>

            <div class="projection-grid">
              <article class="metric-card">
                <span>Projected balance</span>
                <strong>${projectedBalanceOnDate === null ? 'Needs APR' : formatCurrency(projectedBalanceOnDate)}</strong>
                <small>Estimated using the current account settings</small>
              </article>
              <article class="metric-card">
                <span>Current balance</span>
                <strong>${formatCurrency(selectedDebt.balanceCents)}</strong>
                <small>From the account inputs you have right now</small>
              </article>
              <article class="metric-card">
                <span>Estimated interest owed</span>
                <strong>${estimatedPendingInterest === null ? 'Needs APR' : formatCurrency(estimatedPendingInterest)}</strong>
                <small>Estimated accrued interest from the current billing cycle through the chosen date</small>
              </article>
              <article class="metric-card">
                <span>At minimum payments</span>
                <strong>${(() => {
                  const projection = getDebtMinimumProjection(selectedDebt);
                  return projection ? projection.payoffDate : 'Needs APR';
                })()}</strong>
                <small>${(() => {
                  const projection = getDebtMinimumProjection(selectedDebt);
                  return projection ? `${projection.months} months to payoff` : 'Add APR and minimum payment';
                })()}</small>
              </article>
            </div>

            <div class="status-card">
              <strong>How to use this</strong>
              <span>Compare the projected balance here to your real statement balance on the same date. If they drift, the APR, accrual method, payment timing, or lender-specific rules still need adjustment.</span>
            </div>
          `
      }
    </section>
  `;
};
