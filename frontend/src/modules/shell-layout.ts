import { state } from './state';
import { workspaceTabMeta, accountAreaMeta } from './config';
import { formatCurrency, formatPercentValue, getFirstName, escapeAttribute } from './utils';
import { getOverallProgress } from './ui';
import type { AppState, SnapshotRecord, PaymentRecord, ModelAdvice, ReconciliationItem, SimulationResult } from '../types';
import type { TabId } from './types';

type PlannerResponse = AppState & {
  simulation: SimulationResult;
  snapshots: SnapshotRecord[];
  reconciliation: ReconciliationItem[];
  payments: PaymentRecord[];
  modelAdvice: ModelAdvice[];
};

export const isWorkspaceTab = (tab: TabId) => !['methodology', 'resources', 'account'].includes(tab);
export const usesSidebar = (tab: TabId) => !['methodology', 'resources'].includes(tab);

export const renderSidebar = () => {
  const items =
    state.activeTab === 'account'
      ? accountAreaMeta.map(
          (tab) => `
            <button class="nav-tab ${state.accountAreaTab === tab.id ? 'nav-tab--active' : ''}" data-account-tab="${tab.id}">
              <span>${tab.label}</span>
              <small>${tab.kicker}</small>
            </button>
          `,
        )
      : workspaceTabMeta.map(
          (tab) => `
            <button class="nav-tab ${state.activeTab === tab.id ? 'nav-tab--active' : ''}" data-tab="${tab.id}">
              <span>${tab.label}</span>
              <small>${tab.kicker}</small>
            </button>
          `,
        );

  return `
    <aside class="sidebar">
      <nav class="sidebar-nav">
        ${items.join('')}
      </nav>
    </aside>
  `;
};

export const renderGlobalNav = (planner: PlannerResponse) => {
  const progress = getOverallProgress(planner);
  const topItems: Array<{ id: TabId; label: string; active: boolean }> = [
    { id: 'overview', label: 'Accounts', active: isWorkspaceTab(state.activeTab) },
    { id: 'methodology', label: 'Methodology', active: state.activeTab === 'methodology' },
    { id: 'resources', label: 'Resources', active: state.activeTab === 'resources' },
  ];

  return `
    <header class="global-nav">
      <div class="global-nav__brand">
        <span class="brand-mark">DL</span>
        <div>
          <p class="brand-title">DebtLab</p>
          <p class="brand-subtitle">Plan &bull; Model &bull; Pay off</p>
        </div>
      </div>
      <nav class="global-nav__links">
        ${topItems
          .map(
            (item) =>
              `<button class="header-pill ${item.active ? 'header-pill--active' : ''}" data-topnav="${item.id}">${item.label}</button>`,
          )
          .join('')}
      </nav>
      <div class="global-nav__metrics">
        <div class="summary-chip summary-chip--top">
          <span>Total debt</span>
          <strong>${formatCurrency(progress.currentTotal)}</strong>
        </div>
        <div class="summary-chip summary-chip--top">
          <span>Monthly budget</span>
          <strong>${formatCurrency(planner.settings.monthlyBudgetCents)}</strong>
        </div>
        <div class="summary-chip summary-chip--top">
          <span>Projected interest</span>
          <strong>${planner.simulation.months.length === 0 ? 'Waiting on inputs' : formatCurrency(planner.simulation.totalInterestCents)}</strong>
        </div>
        <div class="summary-chip summary-chip--top">
          <span>Projected debt-free</span>
          <strong>${planner.simulation.debtFreeDate ?? 'Needs more budget'}</strong>
        </div>
        <div class="summary-chip summary-chip--top">
          <span>Total paid off</span>
          <strong>${formatPercentValue(progress.percentPaid)}</strong>
        </div>
        <div class="global-nav__tools">
          <div class="profile-menu">
            <button class="profile-trigger" type="button" data-action="toggle-profile-menu">
              <span class="profile-trigger__label">Welcome, ${escapeAttribute(getFirstName(state.currentUser))}</span>
              <span class="profile-trigger__caret">${state.profileMenuOpen ? '&#9650;' : '&#9660;'}</span>
            </button>
            ${
              state.profileMenuOpen
                ? `
                  <div class="profile-dropdown">
                    <button class="profile-dropdown__item" type="button" data-action="open-account">My account</button>
                    <button class="profile-dropdown__item" type="button" data-action="logout">Log out</button>
                  </div>
                `
                : ''
            }
          </div>
        </div>
      </div>
    </header>
  `;
};

export const renderAuthShell = () => `
  <main class="loading-shell">
    <section class="auth-shell content-panel">
      <div>
        <p class="eyebrow">DebtLab</p>
        <h2>Sign in to your planner</h2>
        <p class="panel-copy">Your debts, payments, snapshots, and settings now live behind a real account instead of one shared local planner.</p>
      </div>
      <div class="auth-mode-row">
        <button class="button ${state.authMode === 'login' ? '' : 'button--ghost'}" type="button" data-action="set-auth-mode" data-auth-mode="login">Sign in</button>
        <button class="button ${state.authMode === 'register' ? '' : 'button--ghost'}" type="button" data-action="set-auth-mode" data-auth-mode="register">Create account</button>
      </div>
      <div class="account-fields">
        ${
          state.authMode === 'register'
            ? `<label class="field field--wide"><span>Display name</span><input type="text" value="${escapeAttribute(state.authDraft.displayName)}" data-auth-field="displayName" /></label>`
            : ''
        }
        <label class="field field--wide"><span>Email</span><input type="email" value="${escapeAttribute(state.authDraft.email)}" data-auth-field="email" /></label>
        <label class="field field--wide"><span>Password</span><input type="password" value="${escapeAttribute(state.authDraft.password)}" data-auth-field="password" /></label>
      </div>
      ${state.error ? `<div class="status-card status-card--warn"><strong>Auth issue</strong><span>${state.error}</span></div>` : ''}
      <div class="topbar-actions">
        <button class="button" type="button" data-action="submit-auth">${state.authMode === 'register' ? 'Create account' : 'Sign in'}</button>
      </div>
    </section>
  </main>
`;
