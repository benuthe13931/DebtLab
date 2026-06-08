import { state } from '../../modules/state';
import { escapeAttribute } from '../../utils';
import { themeOptions } from '../../modules/config';

export const renderAccountPage = () => {
  if (!state.currentUser) {
    return '';
  }

  return `
    <section class="content-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">My account</p>
          <h3>${state.accountAreaTab === 'info' ? 'User information' : 'Settings'}</h3>
        </div>
      </div>
      ${
        state.accountAreaTab === 'info'
          ? `
            <div class="account-settings-grid">
              <article class="metric-card">
                <span>Display name</span>
                <strong>${escapeAttribute(state.currentUser.displayName)}</strong>
                <small>Shown in your signed-in workspace</small>
              </article>
              <article class="metric-card">
                <span>Email</span>
                <strong>${escapeAttribute(state.currentUser.email)}</strong>
                <small>Used to sign in to this local profile</small>
              </article>
              <article class="metric-card">
                <span>Member since</span>
                <strong>${new Date(state.currentUser.createdAt).toLocaleDateString()}</strong>
                <small>Your DebtLab profile creation date</small>
              </article>
            </div>
          `
          : `
            <div class="account-settings-grid">
              <article class="content-panel content-panel--nested">
                <div class="panel-header panel-header--tight">
                  <div>
                    <p class="eyebrow">Theme</p>
                    <h3>Choose your workspace look</h3>
                  </div>
                </div>
                <label class="field field--wide">
                  <span>Theme</span>
                  <select data-ui-theme="theme">
                    ${themeOptions
                      .map((option) => `<option value="${option.value}" ${state.theme === option.value ? 'selected' : ''}>${option.label}</option>`)
                      .join('')}
                  </select>
                </label>
              </article>
              <article class="content-panel content-panel--nested">
                <div class="panel-header panel-header--tight">
                  <div>
                    <p class="eyebrow">Reset</p>
                    <h3>Load sample data into this profile</h3>
                  </div>
                </div>
                <p class="panel-copy">Use this only when you want to repopulate the signed-in account with the demo debts, payments, and snapshots.</p>
                <div class="topbar-actions topbar-actions--start">
                  <button class="button button--ghost" type="button" data-action="reset-sample-data">Reset data</button>
                </div>
              </article>
              <article class="content-panel content-panel--nested">
                <div class="panel-header panel-header--tight">
                  <div>
                    <p class="eyebrow">Development</p>
                    <h3>Master reset</h3>
                  </div>
                </div>
                <p class="panel-copy">For local development only. This clears every user, session, debt, payment, and snapshot from the database.</p>
                <div class="topbar-actions topbar-actions--start">
                  <button class="button button--ghost" type="button" data-action="reset-all-dev">Nuke database</button>
                </div>
              </article>
            </div>
          `
      }
    </section>
  `;
};
