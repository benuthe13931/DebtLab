import { formatCurrency, needsMoreInfo, escapeAttribute } from '../utils';
import { renderHelpIcon } from '../modules/ui';
import type { PlannerResponse, MonthResult, DebtMonthResult } from '../types';

type Cell = {
  paymentCents: number;
  extraCents: number;
};

export const renderSchedule = (planner: PlannerResponse) => {
  const months = planner.simulation.months;
  const currentMonth = months[0];
  const incompleteDebts = planner.debts.filter((debt) => needsMoreInfo(debt));
  const debtRows = planner.debts.map((debt) => ({
    debt,
    cells: months.map((month: MonthResult) => {
      const item = month.items.find((candidate: DebtMonthResult) => candidate.debtId === debt.id);
      if (!item) {
        return {
          paymentCents: 0,
          extraCents: 0,
        };
      }

      const minimumCents = Math.min(debt.minimumPaymentCents, item.startingBalanceCents);
      return {
        paymentCents: item.paymentCents,
        extraCents: Math.max(0, item.paymentCents - minimumCents),
      };
    }),
  }));

  return `
    <section class="content-panel">
      <div class="panel-header panel-header--schedule">
        <div>
          <p class="eyebrow">Schedule</p>
          <h3>Monthly payoff matrix</h3>
        </div>
        <div class="field field--compact field--inline">
          <span class="field-label">
            <span>Strategy</span>
            ${renderHelpIcon(escapeAttribute('Snowball targets the smallest balance first. Avalanche targets the highest APR first. Hybrid follows APR priority while still protecting promo and deferred-interest deadlines.'))}
          </span>
          <select class="inline-metric-input inline-metric-input--compact" data-setting="strategy">
            <option value="snowball" ${planner.settings.strategy === 'snowball' ? 'selected' : ''}>Snowball</option>
            <option value="avalanche" ${planner.settings.strategy === 'avalanche' ? 'selected' : ''}>Avalanche</option>
            <option value="hybrid" ${planner.settings.strategy === 'hybrid' ? 'selected' : ''}>Hybrid</option>
          </select>
        </div>
      </div>
      <p class="panel-copy">Months run across the top, debts run down the side, and each cell shows the scheduled payment for that month.</p>
      ${
        incompleteDebts.length > 0
          ? `<div class="status-card status-card--warn"><strong>Needs attention</strong><span>${incompleteDebts.map((debt) => escapeAttribute(debt.name)).join(', ')} are excluded until they have APR.</span></div>`
          : ''
      }
      ${
        months.length === 0
          ? `<div class="status-card"><strong>No schedule yet</strong><span>Add APR to the remaining accounts and make sure the budget covers minimums.</span></div>`
          : `
            <div class="matrix-table-wrap">
              <table class="matrix-table">
                <thead>
                  <tr>
                    <th>Debt</th>
                    ${months.map((month: MonthResult) => `<th>${escapeAttribute(month.label)}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${debtRows
                    .map(
                      (row) => `
                        <tr>
                          <th scope="row">${escapeAttribute(row.debt.name)}</th>
                          ${row.cells
                            .map(
                              (cell: Cell) => `
                                <td>
                                  ${cell.paymentCents > 0 ? formatCurrency(cell.paymentCents) : '--'}
                                  ${
                                    cell.paymentCents > 0
                                      ? `<small>${cell.extraCents > 0 ? `+${formatCurrency(cell.extraCents)} extra` : 'minimum only'}</small>`
                                      : ''
                                  }
                                </td>
                              `,
                            )
                            .join('')}
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
      }
    </section>

    <section class="content-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Current detail</p>
          <h3>${currentMonth?.label ?? 'No schedule yet'}</h3>
        </div>
      </div>
      <div class="detail-table">
        <div class="detail-row detail-row--header">
          <span>Debt</span>
          <span>Start</span>
          <span>Interest</span>
          <span>Payment</span>
          <span>End</span>
          <span>APR</span>
        </div>
        ${(currentMonth?.items ?? [])
          .map(
            (item) => `
              <div class="detail-row">
                <span><strong>${escapeAttribute(item.name)}</strong>${item.note ? `<small>${escapeAttribute(item.note)}</small>` : ''}</span>
                <span>${formatCurrency(item.startingBalanceCents)}</span>
                <span>${formatCurrency(item.interestCents)}</span>
                <span>${formatCurrency(item.paymentCents)}</span>
                <span>${formatCurrency(item.endingBalanceCents)}</span>
                <span>${escapeAttribute(item.aprLabel)}</span>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
};
