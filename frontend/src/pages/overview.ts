import { state } from '../modules/state';
import { formatCurrency, formatPercent, titleCase, needsMoreInfo, escapeAttribute } from '../utils';
import { getCurrentFocusOrder, getFocusExplanation } from '../modules/calculations';
import { renderHelpIcon, renderQuickPayCalendar, getUpcomingPaymentsForMonth, getQuickPayDraft, formatShortDate } from '../modules/ui';
import type { SimulationResult, PlannerResponse } from '../types';

const getProjectionCards = (simulation: SimulationResult) => {
  if (simulation.months.length === 0) {
    return [
      {
        label: 'Balance left after 1 year',
        balanceCents: null,
        interestCents: null,
      },
    ];
  }

  const checkpoints = [12, 24, 36, 60, 120, 180];
  const cards: Array<{
    label: string;
    balanceCents: number | null;
    interestCents: number | null;
    paidOffBeforeCheckpoint?: boolean;
    celebration?: boolean;
  }> = [];

  for (const months of checkpoints) {
    const taken = simulation.months.slice(0, Math.min(months, simulation.months.length));
    const finalMonth = taken[taken.length - 1];
    const paidOffBeforeCheckpoint = simulation.completed && simulation.months.length < months;

    cards.push({
      label: `Balance left after ${months / 12} year${months === 12 ? '' : 's'}`,
      balanceCents: paidOffBeforeCheckpoint ? 0 : finalMonth?.totalBalanceCents ?? null,
      interestCents: taken.reduce((sum, month) => sum + month.totalInterestCents, 0),
      paidOffBeforeCheckpoint,
      celebration: paidOffBeforeCheckpoint,
    });

    if (paidOffBeforeCheckpoint || finalMonth?.totalBalanceCents === 0) {
      break;
    }
  }

  return cards;
};

export const renderOverview = (planner: PlannerResponse) => {
  const simulation = planner.simulation;
  const calculableDebts = planner.debts.filter((debt) => !needsMoreInfo(debt));
  const incompleteDebts = planner.debts.filter((debt) => needsMoreInfo(debt));
  const highestApr = [...calculableDebts].sort((a, b) => b.aprBps - a.aprBps)[0];
  const atRiskCount = simulation.warnings.length;
  const projections = getProjectionCards(simulation);
  const noPlanYet = simulation.months.length === 0;
  const currentTotalDebt = planner.debts.reduce((sum, debt) => sum + debt.balanceCents, 0);
  const focusItems = getCurrentFocusOrder(planner).slice(0, 8).map((debt) => debt.name);
  const currentFocus = getCurrentFocusOrder(planner)[0];
  const upcomingPayments = getUpcomingPaymentsForMonth(planner);

  return `
    <section class="content-panel hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">Overview</p>
        <h2>Promo deadlines are guardrails here, not panic buttons.</h2>
        <p>
          The planner protects 0% and deferred-interest deadlines, but it does not automatically shove them ahead of expensive APR debt unless the timeline actually demands it.
        </p>
      </div>
      <div class="metric-grid">
        <article class="metric-card metric-card--primary">
          <span>Current total debt</span>
          <strong>${formatCurrency(currentTotalDebt)}</strong>
          <small>Across all tracked accounts right now</small>
        </article>
        <article class="metric-card metric-card--primary">
          <span>Projected interest</span>
          <strong>${noPlanYet ? 'Waiting on inputs' : formatCurrency(simulation.totalInterestCents)}</strong>
          <small>${noPlanYet ? 'Add APRs and enough budget to build a payoff schedule' : `Across ${simulation.monthsToPayoff} simulated months`}</small>
        </article>
        <article class="metric-card">
          <span>Months left</span>
          <strong>${noPlanYet ? 'Unknown' : simulation.monthsToPayoff}</strong>
          <small>${simulation.debtFreeDate ?? 'Need complete inputs and enough budget'}</small>
        </article>
        <article class="metric-card">
          <span>Current focus</span>
          <strong>${currentFocus?.name ?? 'No active target yet'}</strong>
          <small>${noPlanYet ? 'The planner needs enough budget and complete debt inputs first' : planner.settings.strategy === 'hybrid' ? 'Hybrid strategy with promo guardrails' : `${titleCase(planner.settings.strategy)} strategy`}</small>
        </article>
        <article class="metric-card">
          <span>Highest APR</span>
          <strong>${highestApr ? highestApr.name : 'N/A'}</strong>
          <small>${highestApr ? formatPercent(highestApr.aprBps) : 'No debts yet'}</small>
        </article>
        <article class="metric-card">
          <span>Warnings</span>
          <strong>${atRiskCount}</strong>
          <small>${atRiskCount === 0 ? 'No missed-deadline warnings' : 'Budget or deadline issues detected'}</small>
        </article>
      </div>
    </section>

    <section class="content-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Projection view</p>
          <h3>Balance left after each checkpoint</h3>
        </div>
      </div>
      <div class="projection-grid">
        ${projections
          .map(
            (projection) => `
              <article class="metric-card">
                <span>${projection.label}</span>
                <strong>$
                  ${projection.balanceCents === null
                    ? 'No projection yet'
                    : projection.celebration
                      ? `Debt-free 🎉`
                      : formatCurrency(projection.balanceCents)}
                </strong>
                <small>$
                  ${projection.interestCents === null
                    ? 'Budget or APR information is still incomplete'
                    : projection.celebration
                      ? `${formatCurrency(simulation.totalInterestCents)} total interest before payoff`
                      : `${formatCurrency(projection.interestCents)} interest paid by then`}
                </small>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>

    <section class="content-grid">
      <article class="content-panel upcoming-payments-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Upcoming payments</p>
            <h3>Due this month</h3>
          </div>
          <p class="panel-copy">
            Quick pay keeps the payment date explicit, because date can change interest on daily-accrual debts and revolving balances.
          </p>
        </div>

        <div class="detail-table upcoming-payments">
          <div class="detail-row detail-row--header detail-row--upcoming-payments-header">
            <div class="upcoming-payments__cell upcoming-payments__cell--debt">Debt</div>
            <div class="upcoming-payments__cell upcoming-payments__cell--due">Due</div>
            <div class="upcoming-payments__cell upcoming-payments__cell--amount">Amount due</div>
            <div class="upcoming-payments__cell upcoming-payments__cell--date">Payment date</div>
            <div class="upcoming-payments__cell upcoming-payments__cell--quickpay">Quick pay</div>
          </div>

          ${upcomingPayments
            .map((item) => {
              const draft = getQuickPayDraft(item.debt);
              const isCalendarOpen = state.quickPayCalendar.debtId === item.debt.id ? 'is-calendar-open' : '';

              return `
                <div class="detail-row detail-row--upcoming-payment ${isCalendarOpen}" data-debt-id="${item.debt.id}">
                  <div class="upcoming-payments__cell upcoming-payments__cell--debt">
                    <strong>${item.debt.name}</strong>
                    <small>${item.isOverdue ? 'Past due this month' : 'Upcoming this month'}</small>
                  </div>

                  <div class="upcoming-payments__cell upcoming-payments__cell--due">
                    ${item.dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>

                  <div class="upcoming-payments__cell upcoming-payments__cell--amount">
                    ${formatCurrency(item.dueAmountCents)}
                  </div>

                  <div class="upcoming-payments__cell upcoming-payments__cell--date">
                    <div class="quick-pay-date">
                      <button
                        class="control-input control-input--date quick-pay-date__button"
                        type="button"
                        data-action="toggle-quick-pay-calendar"
                        data-debt-id="${item.debt.id}"
                        aria-expanded="${state.quickPayCalendar.debtId === item.debt.id ? 'true' : 'false'}"
                      >
                        ${formatShortDate(draft.paymentDate)}
                      </button>
                      ${renderQuickPayCalendar(item.debt.id)}
                    </div>
                  </div>

                  <div class="upcoming-payments__cell upcoming-payments__cell--quickpay">
                    <div class="quick-pay-actions">
                      <div class="quick-pay-row">
                        <span class="quick-pay-value">${formatCurrency(item.remainingMinimumCents)}</span>
                        <button
                          class="button button--ghost button--compact"
                          type="button"
                          data-action="quick-pay-minimum"
                          data-debt-id="${item.debt.id}"
                        >
                          Pay minimum
                        </button>
                      </div>

                      <div class="quick-pay-row">
                        <span class="quick-pay-value">${formatCurrency(item.recommendedAmountCents)}</span>
                        <button
                          class="button button--ghost button--compact"
                          type="button"
                          data-action="quick-pay-recommended"
                          data-debt-id="${item.debt.id}"
                        >
                          Pay recommended
                        </button>
                      </div>

                      <div class="quick-pay-row">
                        <input
                          class="control-input control-input--compact"
                          type="number"
                          min="0"
                          step="0.01"
                          value="${draft.customAmount}"
                          placeholder="Custom amount"
                          data-quick-pay-custom="${item.debt.id}"
                        />
                        <button
                          class="button button--ghost button--compact"
                          type="button"
                          data-action="quick-pay-custom"
                          data-debt-id="${item.debt.id}"
                        >
                          Pay custom
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </article>

      <article class="content-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Plan health</p>
            <h3>Warnings and assumptions</h3>
          </div>
        </div>
        <div class="stack">
          ${
            simulation.warnings.length === 0
              ? `<div class="status-card status-card--good"><strong>Plan checks out</strong><span>Your current budget covers minimums and promo guardrails.</span></div>`
              : simulation.warnings
                  .map(
                    (warning) => `
                      <div class="status-card status-card--warn">
                        <strong>Needs attention</strong>
                        <span>${warning}</span>
                      </div>
                    `,
                  )
                  .join('')
          }
          <div class="status-card">
            <strong>Compounding model</strong>
            <span>Daily debts accrue every calendar day and pay on the chosen due day. Monthly debts accrue once at month-end.</span>
          </div>
          <div class="status-card">
            <strong>Choosing accrual method</strong>
            <span>Add Account now includes Daily, Monthly, and Help me choose, so the statement workflow only shows up when you actually need it.</span>
          </div>
          ${
            incompleteDebts.length > 0
              ? `
                <div class="status-card status-card--warn">
                  <strong>Needs attention</strong>
                  <span>${incompleteDebts.map((debt) => debt.name).join(', ')} still need APR before they can be included in projections.</span>
                </div>
              `
              : ''
          }
        </div>
      </article>

      <article class="content-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Budget</p>
            <h3>Monthly budget for the payoff plan</h3>
          </div>
        </div>
        <div class="projection-grid">
          <article class="metric-card">
            <span>Monthly budget</span>
            <strong>${formatCurrency(planner.settings.monthlyBudgetCents)}</strong>
            <small>Used for the payoff simulation</small>
            ${
              state.editingBudget
                ? `
                  <div class="metric-card__editor">
                    <input class="inline-metric-input" type="number" min="0" step="0.01" value="${(planner.settings.monthlyBudgetCents / 100).toFixed(2)}" data-setting="monthlyBudgetCents" />
                    <button class="button button--ghost" type="button" data-action="done-budget">Done</button>
                  </div>
                `
                : `<button class="button button--ghost" type="button" data-action="edit-budget">Edit budget</button>`
            }
          </article>
          <article class="metric-card">
            <span class="field-label">
              <span>Strategy</span>
              ${renderHelpIcon(
                escapeAttribute('Snowball targets the smallest balance first. Avalanche targets the highest APR first. Hybrid follows APR priority while still protecting promo and deferred-interest deadlines.'),
              )}
            </span>
            <strong>${titleCase(planner.settings.strategy)}</strong>
            <small>Controls where extra money goes after minimums are covered</small>
            <select class="inline-metric-input" data-setting="strategy">
              <option value="snowball" ${planner.settings.strategy === 'snowball' ? 'selected' : ''}>Snowball</option>
              <option value="avalanche" ${planner.settings.strategy === 'avalanche' ? 'selected' : ''}>Avalanche</option>
              <option value="hybrid" ${planner.settings.strategy === 'hybrid' ? 'selected' : ''}>Hybrid</option>
            </select>
          </article>
        </div>
      </article>

      <article class="content-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Focus order</p>
            <h3>What gets attacked next</h3>
          </div>
          <button class="button button--ghost" type="button" data-action="toggle-focus-explanation">${state.showFocusExplanation ? 'Hide why' : 'Why?'}</button>
        </div>
        ${
          state.showFocusExplanation
            ? `<div class="status-card"><strong>Why this debt is next</strong><span>${getFocusExplanation(planner)}</span></div>`
            : ''
        }
        <ol class="sequence-list">
          ${
            focusItems.length === 0
              ? '<li>No debt can be targeted yet because the planner is missing budget room or required account inputs.</li>'
              : focusItems
                  .map((item) => `<li>${item}</li>`)
                  .join('')
          }
        </ol>
      </article>
    </section>
  `;
};
