import { state } from '../../modules/state';
import { formatCurrency, formatPercentValue, formatOrdinal, escapeAttribute, needsMoreInfo } from '../../utils';
import { getEstimatedCurrentAccruedInterest } from '../../modules/calculations';
import { renderHelpIcon, renderAdviceInline, getDebtProgress, pickQuote } from '../../modules/ui';
import { debtTypeOptions, momentumQuotes, paidOffQuotes } from '../../modules/config';
import type { PlannerResponse } from '../../types';
import { getDebtTypeSummaries, getExistingGroups, getGroupSummaries } from './shared';
import { renderAccountCreatorPanel } from './account-creator';

export const renderAccountsWorkspace = (planner: PlannerResponse) => {
  const filteredDebts = planner.debts.filter(
    (debt) =>
      state.accountTypeFilter === 'all' ||
      debt.debtType === state.accountTypeFilter ||
      state.accountTypeFilter === `group:${debt.groupName ?? ''}`,
  );
  const selectedDebt = filteredDebts.find((debt) => debt.id === state.selectedAccountId) ?? filteredDebts[0] ?? null;
  const groupSummaries = getGroupSummaries(planner);
  const debtTypeSummaries = getDebtTypeSummaries(planner);
  const existingGroups = getExistingGroups(planner);
  const accountScopedStatement = selectedDebt && state.statementTargetDebtId === selectedDebt.id ? state.parsedStatement : null;
  const currentAccruedInterest = selectedDebt ? getEstimatedCurrentAccruedInterest(planner, selectedDebt) : 0;
  const selectedDebtProgress = selectedDebt ? getDebtProgress(selectedDebt) : null;
  const paidOffQuote = selectedDebt ? pickQuote(paidOffQuotes, selectedDebt.id) : '';
  const selectedDebtPayments = selectedDebt ? planner.payments.filter((payment) => payment.debtId === selectedDebt.id) : [];
  const visibleDeletedDebt = state.deletedDebt && state.currentUser && state.deletedDebt.userId === state.currentUser.id ? state.deletedDebt : null;

  return `
  <section class="content-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Accounts</p>
        <h3>Groups and account editor</h3>
      </div>
      <p class="panel-copy">Groups are visual rollups only. The payoff math still runs debt by debt behind the scenes.</p>
    </div>

    <div class="panel-section-label">Debt categories</div>
    <div class="group-tile-grid">
      ${debtTypeSummaries
        .map(
          (summary) => `
            <article class="metric-card">
              <span>${debtTypeOptions.find((option) => option.value === summary.debtType)?.label ?? summary.debtType}</span>
              <strong>${formatCurrency(summary.totalBalanceCents)}</strong>
              <small>${summary.count} account${summary.count === 1 ? '' : 's'} · ${formatCurrency(summary.totalMinimumPaymentCents)} minimum payments this month</small>
            </article>
          `,
        )
        .join('')}
    </div>

    <div class="panel-section-label">Custom groups</div>
    <div class="group-tile-grid">
      ${
        groupSummaries.length === 0
          ? `<div class="status-card"><strong>No groups yet</strong><span>Use the Group field to create rollup tiles like Student Loans.</span></div>`
          : groupSummaries
              .map(
                (group) => `
                  <article class="metric-card">
                    <span>${group.groupName}</span>
                    <strong>${formatCurrency(group.totalBalanceCents)}</strong>
                    <small>${group.count} account${group.count === 1 ? '' : 's'} · ${formatCurrency(group.totalMinimumPaymentCents)} minimum payments this month</small>
                  </article>
                `,
              )
              .join('')
      }
    </div>
  </section>

  <section class="account-layout">
    <article class="content-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Account list</p>
          <h3>Account list</h3>
        </div>
      </div>
      <div class="account-list-toolbar">
        <label class="field field--compact">
          <span>Filter</span>
          <select data-account-filter="debtType">
            <option value="all" ${state.accountTypeFilter === 'all' ? 'selected' : ''}>All debt types</option>
            ${debtTypeOptions
              .map((option) => `<option value="${option.value}" ${state.accountTypeFilter === option.value ? 'selected' : ''}>${option.label}</option>`)
              .join('')}
            ${
              existingGroups.length > 0
                ? existingGroups
                    .map((groupName) => `<option value="group:${groupName}" ${state.accountTypeFilter === `group:${groupName}` ? 'selected' : ''}>Group: ${groupName}</option>`)
                    .join('')
                : ''
            }
          </select>
        </label>
        <button class="icon-button" type="button" data-action="show-add-account">+</button>
      </div>
      <div class="account-list">
        ${filteredDebts
          .map(
            (debt) => `
              <button class="account-list-item ${selectedDebt?.id === debt.id ? 'account-list-item--active' : ''}" data-action="select-account" data-debt-id="${debt.id}">
                <span>${needsMoreInfo(debt) ? '<strong class="attention-mark">!</strong>' : ''}${debt.name}</span>
                <small>${debt.groupName ?? 'Ungrouped'} · ${formatCurrency(debt.balanceCents)}</small>
                <div class="progress-meter">
                  <div class="progress-meter__bar" style="width: ${getDebtProgress(debt).percentPaid.toFixed(0)}%"></div>
                </div>
                <small>${getDebtProgress(debt).isPaidOff ? 'Paid off' : `${formatPercentValue(getDebtProgress(debt).percentPaid)} paid off`}</small>
              </button>
            `,
          )
          .join('')}
      </div>
    </article>

    <article class="content-panel">
      ${
        visibleDeletedDebt
          ? `<div class="status-card status-card--warn status-card--floating-action"><div><strong>Account deleted</strong><span>${visibleDeletedDebt.debt.name} was removed.</span></div><button class="button button--ghost" type="button" data-action="undo-delete">Undo delete</button></div>`
          : ''
      }
      ${
        state.showAccountCreator
          ? renderAccountCreatorPanel(planner, existingGroups)
          : !selectedDebt
          ? `<div class="status-card"><strong>No accounts yet</strong><span>Use Add Account to create your first debt.</span></div>`
          : `
            <div class="panel-header">
              <div>
                <p class="eyebrow">Account detail</p>
                <h3>${selectedDebt.name}</h3>
              </div>
              ${
                state.deleteConfirmDebtId === selectedDebt.id
                  ? `
                    <div class="topbar-actions">
                      <button class="button button--ghost" type="button" data-action="cancel-delete">Cancel</button>
                      <button class="button" type="button" data-action="confirm-delete" data-debt-id="${selectedDebt.id}">Delete account</button>
                    </div>
                  `
                  : `<button class="icon-button" data-action="prompt-delete" data-debt-id="${selectedDebt.id}">Delete</button>`
              }
            </div>
            ${
              selectedDebtProgress?.isPaidOff
                ? `<div class="status-card status-card--good paid-banner"><strong>Paid off</strong><span>${paidOffQuote}</span></div>`
                : ''
            }
            <div class="status-card status-card--good paid-banner">
              <strong>Keep going</strong>
              <span>${pickQuote(momentumQuotes, selectedDebt.id)}</span>
            </div>

            <div class="account-fields">
              ${
                needsMoreInfo(selectedDebt)
                  ? `
                    <div class="field field--wide">
                      <div class="status-card status-card--warn">
                        <strong>More information needed</strong>
                        <span>This account is excluded from payoff projections until you add its APR.</span>
                      </div>
                    </div>
                  `
                  : ''
              }
              <div class="field field--wide">
                <div class="projection-grid">
                  <article class="metric-card">
                    <span>Current balance</span>
                    <strong>${formatCurrency(selectedDebt.balanceCents)}</strong>
                    <small>Current account balance</small>
                  </article>
                  <article class="metric-card">
                    <span>Starting balance</span>
                    <strong>${formatCurrency(selectedDebt.startingBalanceCents)}</strong>
                    <small>${formatPercentValue(selectedDebtProgress?.percentPaid ?? 0)} paid off so far</small>
                  </article>
                  <article class="metric-card">
                    <span>Current unpaid principal</span>
                    <strong>${formatCurrency(planner.snapshots.find((snapshot) => snapshot.debtId === selectedDebt.id)?.principalBalanceCents ?? selectedDebt.balanceCents)}</strong>
                    <small>Latest imported principal when available</small>
                  </article>
                  <article class="metric-card">
                    <span>Current unpaid interest</span>
                    <strong>${formatCurrency(currentAccruedInterest)}</strong>
                    <small>Estimated from the latest snapshot, payment date, or due date</small>
                  </article>
                </div>
              </div>
              <label class="field">
                <span>Name</span>
                <input type="text" value="${escapeAttribute(selectedDebt.name)}" data-debt-id="${selectedDebt.id}" data-field="name" />
              </label>
              <label class="field">
                <span>Group</span>
                <div class="group-field-row">
                  <select data-debt-id="${selectedDebt.id}" data-field="groupName">
                    <option value="">No group</option>
                    ${existingGroups
                      .map((groupName) => `<option value="${escapeAttribute(groupName)}" ${selectedDebt.groupName === groupName ? 'selected' : ''}>${groupName}</option>`)
                      .join('')}
                    <option value="__new__">Add new group…</option>
                  </select>
                  <button class="icon-button" type="button" data-action="clear-group" data-debt-id="${selectedDebt.id}" aria-label="Clear group">Clear</button>
                </div>
              </label>
              ${
                state.inlineGroupEditor.mode === 'detail' && state.inlineGroupEditor.debtId === selectedDebt.id
                  ? `
                    <div class="field field--wide">
                      <div class="inline-help-card inline-help-card--accent">
                        <div class="inline-help-card__header">
                          <strong>Add new group</strong>
                        </div>
                        <div class="group-editor-row">
                          <input type="text" value="${escapeAttribute(state.inlineGroupEditor.value)}" data-inline-group-input="detail" placeholder="Student Loans" />
                          <button class="button button--ghost" type="button" data-action="cancel-inline-group">Cancel</button>
                          <button class="button" type="button" data-action="save-inline-group">Save group</button>
                        </div>
                      </div>
                    </div>
                  `
                  : ''
              }
              <label class="field">
                <span>Debt type</span>
                <select data-debt-id="${selectedDebt.id}" data-field="debtType">
                  ${debtTypeOptions
                    .map((option) => `<option value="${option.value}" ${selectedDebt.debtType === option.value ? 'selected' : ''}>${option.label}</option>`)
                    .join('')}
                </select>
              </label>
              <label class="field">
                <span>Starting balance</span>
                <div class="input-affix"><span>$</span><input type="number" min="0" step="0.01" value="${(selectedDebt.startingBalanceCents / 100).toFixed(2)}" data-debt-id="${selectedDebt.id}" data-field="startingBalanceCents" /></div>
              </label>
              <label class="field">
                <span>Current balance</span>
                <div class="input-affix"><span>$</span><input type="number" min="0" step="0.01" value="${(selectedDebt.balanceCents / 100).toFixed(2)}" data-debt-id="${selectedDebt.id}" data-field="balanceCents" /></div>
              </label>
              <label class="field">
                <span>Minimum payment</span>
                <div class="input-affix"><span>$</span><input type="number" min="0" step="0.01" value="${(selectedDebt.minimumPaymentCents / 100).toFixed(2)}" data-debt-id="${selectedDebt.id}" data-field="minimumPaymentCents" /></div>
              </label>
              <label class="field">
                <span>APR</span>
                <div class="input-affix input-affix--suffix"><input type="number" min="0" step="0.01" value="${(selectedDebt.aprBps / 100).toFixed(2)}" data-debt-id="${selectedDebt.id}" data-field="aprBps" /><span>%</span></div>
              </label>
              <label class="field">
                <span>Due date each month</span>
                <input type="number" min="1" max="31" step="1" value="${selectedDebt.dueDay}" data-debt-id="${selectedDebt.id}" data-field="dueDay" />
                <small>${formatOrdinal(selectedDebt.dueDay)} of each month</small>
              </label>
              <label class="field">
                <span class="field-label">
                  <span>Accrual method</span>
                  ${renderHelpIcon(escapeAttribute('Choose Daily, Monthly, or use the recommendation tool if you have at least 3 statements for this account.'))}
                </span>
                <div class="inline-select-row">
                  <select data-debt-id="${selectedDebt.id}" data-field="interestMethod">
                    <option value="daily" ${selectedDebt.interestMethod === 'daily' ? 'selected' : ''}>Daily accrual</option>
                    <option value="monthly" ${selectedDebt.interestMethod === 'monthly' ? 'selected' : ''}>Monthly accrual</option>
                  </select>
                </div>
              </label>
              <label class="field">
                <span>Promo APR</span>
                <div class="input-affix input-affix--suffix"><input type="number" min="0" step="0.01" value="${((selectedDebt.promoAprBps ?? 0) / 100).toFixed(2)}" data-debt-id="${selectedDebt.id}" data-field="promoAprBps" /><span>%</span></div>
              </label>
              <label class="field">
                <span>Promo end</span>
                <input type="date" value="${selectedDebt.promoEndDate ?? ''}" data-debt-id="${selectedDebt.id}" data-field="promoEndDate" />
              </label>
              <label class="field field--wide">
                <span>Notes</span>
                <input type="text" value="${escapeAttribute(selectedDebt.notes ?? '')}" data-debt-id="${selectedDebt.id}" data-field="notes" />
              </label>
              <label class="checkbox-field checkbox-field--inline">
                <input type="checkbox" ${selectedDebt.deferredInterest ? 'checked' : ''} data-debt-id="${selectedDebt.id}" data-field="deferredInterest" />
                <span>Deferred interest</span>
              </label>
              <div class="field field--wide">
                <input id="statement-upload-input" class="hidden-file-input" type="file" accept=".pdf,.txt,.text" multiple data-import-file="statement" />
                ${renderAdviceInline(planner, selectedDebt.id)}
              </div>
              ${
                accountScopedStatement || state.parsing || state.parseError
                  ? `
                    <div class="field field--wide">
                      ${state.parsing ? `<div class="status-card"><strong>Parsing statement...</strong><span>Reading statement rows for this account.</span></div>` : ''}
                      ${state.parseError ? `<div class="status-card status-card--warn"><strong>Parser issue</strong><span>${state.parseError}</span></div>` : ''}
                      ${
                        accountScopedStatement
                          ? `
                            <div class="detail-table">
                              <div class="detail-row detail-row--header detail-row--parser">
                                <span>File</span>
                                <span>Detected row</span>
                                <span>Date</span>
                                <span>Balance</span>
                                <span>Interest</span>
                                <span>Action</span>
                              </div>
                              ${accountScopedStatement.entries
                                .map(
                                  (entry) => `
                                    <div class="detail-row detail-row--parser">
                                      <span>${entry.sourceDocumentName}</span>
                                      <span><strong>${entry.accountLabel}</strong><small>${entry.sourceExcerpt.slice(0, 120)}</small></span>
                                      <span>${entry.snapshotDate ?? 'Unknown'}</span>
                                      <span>${entry.balanceCents === null ? 'Unknown' : formatCurrency(entry.balanceCents)}</span>
                                      <span>${entry.interestChargedCents === null ? 'Unknown' : formatCurrency(entry.interestChargedCents)}</span>
                                      <span><button class="button button--ghost" type="button" data-action="import-entry-to-selected" data-entry-id="${entry.entryId}" data-debt-id="${selectedDebt.id}">Import statement snapshot</button></span>
                                    </div>
                                  `,
                                )
                                .join('')}
                            </div>
                          `
                          : ''
                      }
                    </div>
                  `
                  : ''
              }
              <div class="field field--wide">
                <div class="panel-header panel-header--tight">
                  <div>
                    <p class="eyebrow">Payments made</p>
                    <h3>Account payment history</h3>
                  </div>
                </div>
                ${
                  selectedDebtPayments.length === 0
                    ? `<div class="status-card"><strong>No payments yet</strong><span>Quick pay and batch payment entries for this account will show up here.</span></div>`
                    : `
                      <div class="detail-table">
                        <div class="detail-row detail-row--header detail-row--payments">
                          <span>Date</span>
                          <span>Debt</span>
                          <span>Amount</span>
                          <span>Note</span>
                          <span>Action</span>
                        </div>
                        ${selectedDebtPayments
                          .map(
                            (payment) =>
                              state.editingPaymentId === payment.id
                                ? `
                                  <div class="detail-row detail-row--payments">
                                    <span><input type="date" value="${state.editingPaymentDraft.paymentDate}" data-edit-payment-field="paymentDate" /></span>
                                    <span>${selectedDebt.name}</span>
                                    <span><input type="number" min="0" step="0.01" value="${state.editingPaymentDraft.amount}" data-edit-payment-field="amount" /></span>
                                    <span><input type="text" value="${escapeAttribute(state.editingPaymentDraft.note)}" data-edit-payment-field="note" /></span>
                                    <span class="ledger-actions"><button class="icon-button" data-action="save-edit-payment" data-payment-id="${payment.id}">Save</button><button class="icon-button" data-action="cancel-edit-payment">Cancel</button></span>
                                  </div>
                                `
                                : `
                                  <div class="detail-row detail-row--payments">
                                    <span>${payment.paymentDate}</span>
                                    <span>${selectedDebt.name}</span>
                                    <span>${formatCurrency(payment.amountCents)}</span>
                                    <span>${payment.note || 'No note'}</span>
                                    <span class="ledger-actions"><button class="icon-button" data-action="edit-payment" data-payment-id="${payment.id}">Edit</button><button class="icon-button" data-delete-payment="${payment.id}">Delete</button></span>
                                  </div>
                                `,
                          )
                          .join('')}
                      </div>
                    `
                }
              </div>
            </div>
            <datalist id="group-options">
              ${existingGroups.map((groupName) => `<option value="${groupName}"></option>`).join('')}
            </datalist>
          `
      }
    </article>
  </section>
`;
};
