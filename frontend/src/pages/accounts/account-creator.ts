import { state } from '../../modules/state';
import { escapeAttribute } from '../../utils';
import { renderHelpIcon, renderAdviceInline } from '../../modules/ui';
import { debtTypeOptions } from '../../modules/config';
import type { PlannerResponse } from '../../types';

export const renderAccountCreatorPanel = (planner: PlannerResponse, existingGroups: string[]) => {
  const showingDraftStatementHelp = state.accountDraft.interestMethodChoice === 'help';
  const showCreateGroupEditor = state.inlineGroupEditor.mode === 'create';

  return `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Add account</p>
        <h3>Create a new account</h3>
      </div>
      <button class="button button--ghost" type="button" data-action="cancel-add-account">Close</button>
    </div>

    <div class="account-fields">
      <label class="field">
        <span>Name</span>
        <input type="text" value="${escapeAttribute(state.accountDraft.name)}" data-draft-account-field="name" />
      </label>
      <label class="field">
        <span>Group</span>
        <div class="group-field-row">
          <select data-draft-account-field="groupSelection">
            <option value="">No group</option>
            ${existingGroups
              .map((groupName) => `<option value="${escapeAttribute(groupName)}" ${state.draftGroupSelection === groupName ? 'selected' : ''}>${groupName}</option>`)
              .join('')}
            <option value="__new__">Add new group…</option>
          </select>
          <button class="icon-button" type="button" data-action="clear-draft-group">Clear</button>
        </div>
      </label>
      ${
        showCreateGroupEditor
          ? `
            <div class="field field--wide">
              <div class="inline-help-card inline-help-card--accent">
                <div class="inline-help-card__header">
                  <strong>Add new group</strong>
                </div>
                <div class="group-editor-row">
                  <input type="text" value="${escapeAttribute(state.inlineGroupEditor.value)}" data-inline-group-input="create" placeholder="Student Loans" />
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
        <select data-draft-account-field="debtType">
          ${debtTypeOptions
            .map((option) => `<option value="${option.value}" ${state.accountDraft.debtType === option.value ? 'selected' : ''}>${option.label}</option>`)
            .join('')}
        </select>
      </label>
      <label class="field">
        <span>Starting balance</span>
        <div class="input-affix"><span>$</span><input type="number" min="0" step="0.01" value="${escapeAttribute(state.accountDraft.startingBalance)}" data-draft-account-field="startingBalance" placeholder="0.00" /></div>
      </label>
      <label class="field">
        <span>Current balance</span>
        <div class="input-affix"><span>$</span><input type="number" min="0" step="0.01" value="${escapeAttribute(state.accountDraft.balance)}" data-draft-account-field="balance" placeholder="0.00" /></div>
      </label>
      <label class="field">
        <span>Minimum payment</span>
        <div class="input-affix"><span>$</span><input type="number" min="0" step="0.01" value="${escapeAttribute(state.accountDraft.minimumPayment)}" data-draft-account-field="minimumPayment" placeholder="0.00" /></div>
      </label>
      <label class="field">
        <span>APR</span>
        <div class="input-affix input-affix--suffix"><input type="number" min="0" step="0.01" value="${escapeAttribute(state.accountDraft.apr)}" data-draft-account-field="apr" placeholder="0.00" /><span>%</span></div>
      </label>
      <label class="field">
        <span>Due day</span>
        <input type="number" min="1" max="31" step="1" value="${escapeAttribute(state.accountDraft.dueDay)}" data-draft-account-field="dueDay" />
      </label>
      <label class="field">
        <span class="field-label">
          <span>Accrual method</span>
          ${renderHelpIcon(escapeAttribute('Choose Daily if interest grows every day, Monthly if it posts once per month, or Help me choose if you want to upload statements and let the app compare which model fits better.'))}
        </span>
        <select data-draft-account-field="interestMethodChoice">
          <option value="daily" ${state.accountDraft.interestMethodChoice === 'daily' ? 'selected' : ''}>Daily accrual</option>
          <option value="monthly" ${state.accountDraft.interestMethodChoice === 'monthly' ? 'selected' : ''}>Monthly accrual</option>
          <option value="help" ${state.accountDraft.interestMethodChoice === 'help' ? 'selected' : ''}>Help me choose</option>
        </select>
      </label>
      <label class="field">
        <span>Promo APR</span>
        <div class="input-affix input-affix--suffix"><input type="number" min="0" step="0.01" value="${escapeAttribute(state.accountDraft.promoApr)}" data-draft-account-field="promoApr" placeholder="0.00" /><span>%</span></div>
      </label>
      <label class="field">
        <span>Promo end</span>
        <input type="date" value="${escapeAttribute(state.accountDraft.promoEndDate)}" data-draft-account-field="promoEndDate" />
      </label>
      <label class="field field--wide">
        <span>Notes</span>
        <input type="text" value="${escapeAttribute(state.accountDraft.notes)}" data-draft-account-field="notes" />
      </label>
      <label class="checkbox-field checkbox-field--inline">
        <input type="checkbox" ${state.accountDraft.deferredInterest ? 'checked' : ''} data-draft-account-field="deferredInterest" />
        <span>Deferred interest</span>
      </label>
    </div>
    ${
      showingDraftStatementHelp
        ? `
          <section class="content-panel content-panel--nested">
            <div class="panel-header panel-header--tight">
              <div>
                <p class="eyebrow">Help Me Choose</p>
                <h3>Upload statements for this account</h3>
              </div>
            </div>
            ${renderAdviceInline(planner, undefined, 'draft')}
            <label class="field">
              <span>Upload up to 3 statements</span>
              <input id="statement-upload-input" class="hidden-file-input" type="file" accept=".pdf,.txt,.text" multiple data-import-file="statement" />
              <button class="button button--ghost" type="button" data-action="pick-statement-files">Choose statement files</button>
              <small>Use statements from the same account so the app can compare real posted interest against daily and monthly accrual.</small>
            </label>
            ${state.parsing ? `<div class="status-card"><strong>Parsing statement...</strong><span>Looking for statement dates, balances, and posted interest.</span></div>` : ''}
            ${state.parseError ? `<div class="status-card status-card--warn"><strong>Parser issue</strong><span>${state.parseError}</span></div>` : ''}
            ${
              state.parsedStatement
                ? `<div class="tip-card"><strong>${state.parsedStatement.documentName}</strong><span>${state.parsedStatement.entries.length} parsed row${state.parsedStatement.entries.length === 1 ? '' : 's'} ready for review.</span></div>`
                : ''
            }
          </section>
        `
        : ''
    }
    <div class="field field--wide">
      <div class="topbar-actions">
        <button class="button" type="button" data-action="create-account">Save account</button>
      </div>
    </div>
  `;
};
