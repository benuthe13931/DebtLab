import './style.css';
import {
  renderOverview as renderOverviewPage,
  renderAccountPage as renderAccountPageView,
  renderAccounts as renderAccountsView,
  renderProjections as renderProjectionsView,
  renderPayments as renderPaymentsView,
  renderSchedule as renderScheduleView,
  renderReconciliation as renderReconciliationView,
  renderMethodology as renderMethodologyView,
  renderResources as renderResourcesView,
} from './pages';
import { state, createEmptyAccountDraft } from './modules/state';
import {
  API_BASE,
  momentumQuotes,
} from './modules/config';
import {
  slug,
} from './modules/utils';
import {
  getQuickPayDraft,
  getParsedAccountDraft,
  buildSnapshotCsvRow,
} from './modules/ui';
import { parseIsoDateLocal } from './modules/calculations';
import { renderSidebar, usesSidebar, isWorkspaceTab, renderGlobalNav, renderAuthShell } from './modules/shell-layout';
import { parseStatementFiles as parseStatementFilesForState, parseCreditReportFilesClient as parseCreditReportFilesClientForState } from './modules/import-parsers';
import {
  savePlanner,
  fetchPlanner as fetchPlannerData,
  fetchSession as fetchSessionData,
  submitAuth as submitAuthRequest,
  logout as logoutRequest,
  resetAllDevelopmentData as resetAllDevelopmentDataRequest,
} from './modules/planner-api';
import type {
  AppState,
  DebtType,
  DebtInput,
  ModelAdvice,
  PaymentRecord,
  PlannerSettings,
  ReconciliationItem,
  SimulationResult,
  SnapshotRecord,
} from './types';
import type {
  TabId,
  AccountAreaTab,
  AuthMode,
  PaymentDraft,
  AccountDraft,
  ParsedAccountDraft,
  PaymentEditDraft,
} from './modules/types';

type PlannerResponse = AppState & {
  simulation: SimulationResult;
  snapshots: SnapshotRecord[];
  reconciliation: ReconciliationItem[];
  payments: PaymentRecord[];
  modelAdvice: ModelAdvice[];
};

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('App root not found.');
}

let deletedDebtTimer: number | null = null;
const clearDeletedDebtBanner = () => {
  state.deletedDebt = null;
  if (deletedDebtTimer !== null) {
    window.clearTimeout(deletedDebtTimer);
    deletedDebtTimer = null;
  }
};
const queueDeletedDebtBannerClear = () => {
  if (deletedDebtTimer !== null) {
    window.clearTimeout(deletedDebtTimer);
  }
  deletedDebtTimer = window.setTimeout(() => {
    state.deletedDebt = null;
    deletedDebtTimer = null;
    render();
  }, 10_000);
};

const fetchPlanner = async () =>
  fetchPlannerData({
    state,
    render,
    clearDeletedDebtBanner,
  });

const fetchSession = async () =>
  fetchSessionData({
    state,
    render,
    fetchPlannerForSession: fetchPlanner,
  });

const save = async (url: string, options?: RequestInit) =>
  savePlanner({
    state,
    render,
    url,
    options,
  });

const quickPay = async (debtId: string, amountCents: number, paymentDate: string, note: string) => {
  if (amountCents <= 0) {
    state.error = 'Enter a payment amount greater than zero.';
    render();
    return;
  }

  await save(`${API_BASE}/payments/batch`, {
    method: 'POST',
    body: JSON.stringify({
      payments: [
        {
          id: slug(),
          debtId,
          paymentDate,
          amountCents,
          note,
        },
      ],
    }),
  });

  state.quickPayDrafts[debtId] = {
    paymentDate,
    customAmount: '',
  };
  render();
};

const parseStatementFiles = async (files: FileList | File[]) =>
  parseStatementFilesForState({
    state,
    render,
    files,
  });

const parseCreditReportFilesClient = async (files: FileList | File[]) =>
  parseCreditReportFilesClientForState({
    state,
    render,
    files,
  });

const importParsedEntries = async () => {
  if (!state.parsedStatement) {
    return;
  }

  const rows = state.parsedStatement.entries
    .map((entry) => {
      const debtId = state.parsedMappings[entry.entryId];
      if (!debtId || !entry.snapshotDate || entry.balanceCents === null) {
        return null;
      }

      return buildSnapshotCsvRow(debtId, entry);
    })
    .filter((row): row is string => Boolean(row));

  if (rows.length === 0) {
    state.parseError = 'Map at least one parsed row to a debt, and make sure the parser found a date and balance.';
    render();
    return;
  }

  state.importDraft = [
    'debtId,snapshotDate,balance,principalBalance,accruedInterest,interestCharged,minimumDue,sourceNote',
    ...rows,
  ].join('\n');

  await importSnapshots();
};

const createAccountsFromParsedSelection = async () => {
  if (!state.parsedStatement) {
    return;
  }

  const entries = state.parsedStatement.entries.filter((entry) => state.parsedSelections[entry.entryId]);
  if (entries.length === 0) {
    state.parseError = 'Select at least one parsed account before creating accounts.';
    render();
    return;
  }

  for (const entry of entries) {
    const draft = getParsedAccountDraft(entry);
    await save(`${API_BASE}/debts`, {
      method: 'POST',
      body: JSON.stringify({
        id: slug(),
        name: draft.name.trim() || entry.accountLabel || 'Imported Debt',
        groupName: draft.groupName.trim() || null,
        debtType: draft.debtType,
        startingBalanceCents: Math.max(0, Math.round(Number(draft.startingBalance || draft.balance || 0) * 100)),
        balanceCents: Math.max(0, Math.round(Number(draft.balance || 0) * 100)),
        minimumPaymentCents: Math.max(0, Math.round(Number(draft.minimumPayment || 0) * 100)),
        aprBps: Math.max(0, Math.round(Number(draft.apr || 0) * 100)),
        dueDay: Math.max(1, Math.min(31, Math.round(Number(draft.dueDay || 15)))),
        interestMethod: draft.interestMethod,
        balancePresentation: 'capitalized_balance',
        promoAprBps: draft.promoApr ? Math.max(0, Math.round(Number(draft.promoApr || 0) * 100)) : null,
        promoEndDate: draft.promoEndDate || null,
        deferredInterest: draft.deferredInterest,
        notes: draft.notes,
      }),
    });
  }

  state.parsedStatement = null;
  state.parsedSelections = {};
  state.parsedAccountDrafts = {};
  state.parsedCursor = 0;
  state.activeTab = 'accounts';
  render();
};

const updateSettings = async (patch: Partial<PlannerSettings>) => {
  await save(`${API_BASE}/settings`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
};

const updateDebt = async (id: string, patch: Partial<DebtInput>) => {
  await save(`${API_BASE}/debts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
};

const addDebt = async () => {
  await save(`${API_BASE}/debts`, {
    method: 'POST',
    body: JSON.stringify({
      id: slug(),
      name: state.accountDraft.name || 'New Debt',
      groupName: state.draftGroupSelection.trim() || null,
      debtType: state.accountDraft.debtType,
      startingBalanceCents: Math.max(0, Math.round(Number(state.accountDraft.startingBalance || state.accountDraft.balance || 0) * 100)),
      balanceCents: Math.max(0, Math.round(Number(state.accountDraft.balance || 0) * 100)),
      minimumPaymentCents: Math.max(0, Math.round(Number(state.accountDraft.minimumPayment || 0) * 100)),
      aprBps: Math.max(0, Math.round(Number(state.accountDraft.apr || 0) * 100)),
      dueDay: Math.max(1, Math.round(Number(state.accountDraft.dueDay || 15))),
      interestMethod:
        state.accountDraft.interestMethodChoice === 'help'
          ? 'daily'
          : state.accountDraft.interestMethodChoice,
      balancePresentation: 'capitalized_balance',
      promoAprBps: state.accountDraft.promoApr
        ? Math.max(0, Math.round(Number(state.accountDraft.promoApr || 0) * 100))
        : null,
      promoEndDate: state.accountDraft.promoEndDate || null,
      deferredInterest: state.accountDraft.deferredInterest,
      notes: state.accountDraft.notes,
    }),
  });
  state.accountDraft = createEmptyAccountDraft();
  state.draftGroupMode = 'existing';
  state.draftGroupSelection = '';
  state.inlineGroupEditor = { mode: null, debtId: null, value: '' };
  state.parsedStatement = null;
  state.parsedMappings = {};
  state.activeTab = 'accounts';
  state.showAccountCreator = false;
  state.selectedAccountId = state.planner?.debts[state.planner.debts.length - 1]?.id ?? state.selectedAccountId;
};

const deleteDebt = async (id: string) => {
  const current = state.planner?.debts.find((debt) => debt.id === id) ?? null;
  await save(`${API_BASE}/debts/${id}`, {
    method: 'DELETE',
  });
  state.deletedDebt =
    current && state.currentUser
      ? {
          debt: current,
          userId: state.currentUser.id,
        }
      : null;
  queueDeletedDebtBannerClear();
  state.deleteConfirmDebtId = null;
  if (state.selectedAccountId === id) {
    state.selectedAccountId = state.planner?.debts[0]?.id ?? null;
  }
  render();
};

const undoDeleteDebt = async () => {
  if (!state.deletedDebt || !state.currentUser || state.deletedDebt.userId !== state.currentUser.id) {
    return;
  }

  await save(`${API_BASE}/debts`, {
    method: 'POST',
    body: JSON.stringify(state.deletedDebt.debt),
  });
  clearDeletedDebtBanner();
  render();
};

const savePaymentBatch = async () => {
  const payments = state.paymentDrafts
    .filter((draft) => draft.debtId && draft.amount)
    .map((draft) => ({
      id: draft.id,
      debtId: draft.debtId,
      paymentDate: draft.paymentDate,
      amountCents: Math.max(0, Math.round(Number(draft.amount || 0) * 100)),
      note: draft.note,
    }))
    .filter((draft) => draft.amountCents > 0);

  await save(`${API_BASE}/payments/batch`, {
    method: 'POST',
    body: JSON.stringify({ payments }),
  });

  state.paymentDrafts = [
    { id: slug(), debtId: '', paymentDate: new Date().toISOString().slice(0, 10), amount: '', note: '' },
  ];
  render();
};

const deletePayment = async (id: string) => {
  await save(`${API_BASE}/payments/${id}`, {
    method: 'DELETE',
  });
};

const startEditingPayment = (payment: PaymentRecord) => {
  state.editingPaymentId = payment.id;
  state.editingPaymentDraft = {
    paymentDate: payment.paymentDate,
    amount: (payment.amountCents / 100).toFixed(2),
    note: payment.note,
  };
  render();
};

const saveEditedPayment = async (id: string) => {
  await save(`${API_BASE}/payments/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      paymentDate: state.editingPaymentDraft.paymentDate,
      amountCents: Math.max(0, Math.round(Number(state.editingPaymentDraft.amount || 0) * 100)),
      note: state.editingPaymentDraft.note,
    }),
  });
  state.editingPaymentId = null;
};

const importSnapshots = async () => {
  await save(`${API_BASE}/import-snapshots`, {
    method: 'POST',
    body: JSON.stringify({
      csvText: state.importDraft,
    }),
  });
};

const importParsedEntryToDebt = async (entryId: string, debtId: string) => {
  const entry = state.parsedStatement?.entries.find((candidate) => candidate.entryId === entryId);
  if (!entry || !entry.snapshotDate || entry.balanceCents === null) {
    state.parseError = 'That parsed row is missing a statement date or balance, so it cannot be imported yet.';
    render();
    return;
  }

  state.importDraft = [
    'debtId,snapshotDate,balance,principalBalance,accruedInterest,interestCharged,minimumDue,sourceNote',
    buildSnapshotCsvRow(debtId, entry),
  ].join('\n');

  await importSnapshots();
  state.parsedStatement = null;
  state.statementTargetDebtId = null;
  state.parseError = null;
  render();
};

const resetPlanner = async () => {
  await save(`${API_BASE}/reset`, {
    method: 'POST',
  });
  clearDeletedDebtBanner();
  state.deleteConfirmDebtId = null;
  state.showAccountCreator = false;
  state.parsedStatement = null;
  state.parsedSelections = {};
  state.parsedMappings = {};
  state.parsedAccountDrafts = {};
  state.parseError = null;
};

const resetAllDevelopmentData = async () =>
  resetAllDevelopmentDataRequest({
    state,
    render,
    clearDeletedDebtBanner,
  });

const submitAuth = async () =>
  submitAuthRequest({
    state,
    render,
    clearDeletedDebtBanner,
    fetchPlannerForSession: fetchPlanner,
  });

const logout = async () =>
  logoutRequest({
    state,
    render,
    clearDeletedDebtBanner,
  });
const renderContent = (planner: PlannerResponse) => {
  if (state.activeTab === 'account') {
    return renderAccountPageView();
  }

  if (state.activeTab === 'accounts') {
    return renderAccountsView(planner);
  }

  if (state.activeTab === 'projections') {
    return renderProjectionsView(planner);
  }

  if (state.activeTab === 'payments') {
    return renderPaymentsView(planner);
  }

  if (state.activeTab === 'schedule') {
    return renderScheduleView(planner);
  }

  if (state.activeTab === 'reconciliation') {
    return renderReconciliationView(planner);
  }

  if (state.activeTab === 'methodology') {
    return renderMethodologyView();
  }

  if (state.activeTab === 'resources') {
    return renderResourcesView();
  }

  return renderOverviewPage(planner);
};

export const render = () => {
  document.documentElement.dataset.theme = state.sessionToken && state.currentUser ? state.theme : 'ocean';

  if (!state.sessionToken || !state.currentUser) {
    root.innerHTML = renderAuthShell();
    return;
  }

  if (state.loading && !state.planner) {
    root.innerHTML = `<main class="loading-shell"><div class="loading-card"><strong>Loading planner...</strong><span>Talking to the local API.</span></div></main>`;
    return;
  }

  if (!state.planner) {
    root.innerHTML = `<main class="loading-shell"><div class="loading-card loading-card--error"><strong>Unable to load planner</strong><span>${state.error ?? 'Unknown error'}</span></div></main>`;
    return;
  }

  const workspace = usesSidebar(state.activeTab);
  root.innerHTML = `
    <main class="page-shell">
      ${renderGlobalNav(state.planner)}
      ${
        workspace
          ? `
            <section class="workspace-shell">
              ${renderSidebar()}
              <section class="main-shell">
                ${state.error ? `<div class="banner banner--error">${state.error}</div>` : ''}
                ${renderContent(state.planner)}
              </section>
            </section>
          `
          : `
            <section class="main-shell main-shell--solo">
              ${state.error ? `<div class="banner banner--error">${state.error}</div>` : ''}
              ${renderContent(state.planner)}
            </section>
          `
      }
    </main>
  `;
};

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }

  let shouldRenderForClosedMenu = false;

  if (state.profileMenuOpen && !target.closest('.profile-menu')) {
    state.profileMenuOpen = false;
    shouldRenderForClosedMenu = true;
  }

  if (state.quickPayCalendar.debtId && !target.closest('.quick-pay-date')) {
    state.quickPayCalendar.debtId = null;
    shouldRenderForClosedMenu = true;
  }

  const tabButton = target.closest<HTMLElement>('[data-tab]');
  const tab = tabButton?.dataset.tab as TabId | undefined;
  if (tab) {
    state.activeTab = tab;
    state.profileMenuOpen = false;
    if (!isWorkspaceTab(tab)) {
      state.showAccountCreator = false;
    }
    render();
    return;
  }

  const accountTabButton = target.closest<HTMLElement>('[data-account-tab]');
  const accountTab = accountTabButton?.dataset.accountTab as AccountAreaTab | undefined;
  if (accountTab) {
    state.activeTab = 'account';
    state.accountAreaTab = accountTab;
    state.profileMenuOpen = false;
    render();
    return;
  }

  const topNavButton = target.closest<HTMLElement>('[data-topnav]');
  const topNav = topNavButton?.dataset.topnav as TabId | undefined;
  if (topNav) {
    state.activeTab = topNav === 'overview' ? 'overview' : topNav;
    state.profileMenuOpen = false;
    render();
    return;
  }

  const actionButton = target.closest<HTMLElement>('[data-action]');
  const action = actionButton?.dataset.action;
  if (action === 'show-add-account') {
    state.activeTab = 'accounts';
    state.showAccountCreator = true;
    render();
    return;
  }

  if (action === 'quick-pay-minimum' || action === 'quick-pay-recommended' || action === 'quick-pay-custom') {
    const debtId = actionButton?.dataset.debtId;
    const planner = state.planner;
    if (!debtId || !planner) {
      return;
    }

    const debt = planner.debts.find((candidate) => candidate.id === debtId);
    if (!debt) {
      return;
    }

    const draft = getQuickPayDraft(debt);
    const date = new Date();
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
    const paidThisMonthCents = planner.payments
      .filter((payment) => payment.debtId === debtId && payment.paymentDate >= monthStart && payment.paymentDate <= monthEnd)
      .reduce((sum, payment) => sum + payment.amountCents, 0);
    const scheduledPaymentCents =
      planner.simulation.months[0]?.items.find((item) => item.debtId === debtId)?.paymentCents ?? debt.minimumPaymentCents;
    const amountCents =
      action === 'quick-pay-minimum'
        ? Math.max(0, debt.minimumPaymentCents - paidThisMonthCents)
        : action === 'quick-pay-recommended'
          ? Math.max(0, scheduledPaymentCents - paidThisMonthCents)
          : Math.max(0, Math.round(Number(draft.customAmount || 0) * 100));

    const note =
      action === 'quick-pay-minimum'
        ? 'Quick pay: minimum payment'
        : action === 'quick-pay-recommended'
          ? 'Quick pay: recommended payment'
          : 'Quick pay: custom payment';

    void quickPay(debtId, amountCents, draft.paymentDate, note);
    return;
  }

  if (action === 'toggle-quick-pay-calendar') {
    const debtId = actionButton?.dataset.debtId;
    if (!debtId) {
      return;
    }
    if (state.quickPayCalendar.debtId === debtId) {
      state.quickPayCalendar.debtId = null;
    } else {
      const selected = parseIsoDateLocal(getQuickPayDraft({ id: debtId } as DebtInput).paymentDate);
      state.quickPayCalendar = {
        debtId,
        viewYear: selected.getFullYear(),
        viewMonth: selected.getMonth(),
      };
    }
    render();
    return;
  }

  if (action === 'quick-pay-calendar-prev' || action === 'quick-pay-calendar-next') {
    const delta = action === 'quick-pay-calendar-prev' ? -1 : 1;
    const next = new Date(state.quickPayCalendar.viewYear, state.quickPayCalendar.viewMonth + delta, 1);
    state.quickPayCalendar.viewYear = next.getFullYear();
    state.quickPayCalendar.viewMonth = next.getMonth();
    render();
    return;
  }

  if (action === 'select-quick-pay-date') {
    const debtId = actionButton?.dataset.debtId;
    const value = actionButton?.dataset.date;
    if (debtId && value) {
      state.quickPayDrafts[debtId] = {
        paymentDate: value,
        customAmount: state.quickPayDrafts[debtId]?.customAmount ?? '',
      };
      state.quickPayCalendar.debtId = null;
      render();
    }
    return;
  }

  if (action === 'set-auth-mode') {
    state.authMode = (actionButton?.dataset.authMode as AuthMode) || 'login';
    state.error = null;
    render();
    return;
  }

  if (action === 'submit-auth') {
    void submitAuth();
    return;
  }

  if (action === 'logout') {
    void logout();
    return;
  }

  if (action === 'toggle-profile-menu') {
    state.profileMenuOpen = !state.profileMenuOpen;
    render();
    return;
  }

  if (action === 'open-account') {
    state.activeTab = 'account';
    state.accountAreaTab = 'info';
    state.profileMenuOpen = false;
    render();
    return;
  }

  if (action === 'cancel-add-account') {
    state.showAccountCreator = false;
    render();
    return;
  }

  if (action === 'clear-group') {
    const debtId = actionButton?.dataset.debtId;
    if (debtId) {
      state.inlineGroupEditor = { mode: null, debtId: null, value: '' };
      void updateDebt(debtId, { groupName: null });
    }
    return;
  }

  if (action === 'clear-draft-group') {
    state.draftGroupSelection = '';
    state.inlineGroupEditor = { mode: null, debtId: null, value: '' };
    render();
    return;
  }

  if (action === 'cancel-inline-group') {
    state.inlineGroupEditor = { mode: null, debtId: null, value: '' };
    render();
    return;
  }

  if (action === 'save-inline-group') {
    const nextGroup = state.inlineGroupEditor.value.trim();
    if (!nextGroup) {
      state.parseError = 'Give the new group a name before saving it.';
      render();
      return;
    }

    if (state.inlineGroupEditor.mode === 'create') {
      state.draftGroupSelection = nextGroup;
      state.inlineGroupEditor = { mode: null, debtId: null, value: '' };
      render();
      return;
    }

    if (state.inlineGroupEditor.mode === 'detail' && state.inlineGroupEditor.debtId) {
      void updateDebt(state.inlineGroupEditor.debtId, { groupName: nextGroup });
      state.inlineGroupEditor = { mode: null, debtId: null, value: '' };
    }
    return;
  }

  if (action === 'reset-sample-data') {
    if (window.confirm('Reset the planner back to the sample data set? This will replace your current local debts, payments, and snapshots.')) {
      state.profileMenuOpen = false;
      void resetPlanner();
    }
    return;
  }

  if (action === 'reset-all-dev') {
    if (window.confirm('Delete every user, session, debt, payment, snapshot, and planner setting from the local development database?')) {
      void resetAllDevelopmentData();
    }
    return;
  }

  if (action === 'undo-delete') {
    void undoDeleteDebt();
    return;
  }

  if (action === 'toggle-focus-explanation') {
    state.showFocusExplanation = !state.showFocusExplanation;
    render();
    return;
  }

  if (action === 'shuffle-overview-quote') {
    state.overviewQuoteIndex = Math.floor(Math.random() * momentumQuotes.length);
    render();
    return;
  }

  if (action === 'edit-budget') {
    state.editingBudget = true;
    render();
    return;
  }

  if (action === 'done-budget') {
    state.editingBudget = false;
    render();
    return;
  }

  if (action === 'filter-group') {
    const groupName = actionButton?.dataset.groupName ?? '';
    state.accountTypeFilter = `group:${groupName}`;
    state.activeTab = 'accounts';
    render();
    return;
  }

  if (action === 'apply-projection-date') {
    state.accountProjectionDate = state.projectionDateDraft.value;
    render();
    return;
  }

  if (action === 'prompt-delete') {
    state.deleteConfirmDebtId = actionButton?.dataset.debtId ?? null;
    render();
    return;
  }

  if (action === 'cancel-delete') {
    state.deleteConfirmDebtId = null;
    render();
    return;
  }

  if (action === 'confirm-delete') {
    const debtId = actionButton?.dataset.debtId;
    if (debtId) {
      void deleteDebt(debtId);
    }
    return;
  }

  if (action === 'import') {
    void importSnapshots();
    return;
  }

  if (action === 'add-payment-row') {
    state.paymentDrafts.push({
      id: slug(),
      debtId: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: '',
      note: '',
    });
    render();
    return;
  }

  if (action === 'remove-payment-row') {
    const draftId = actionButton?.dataset.draftId;
    if (!draftId) {
      return;
    }
    state.paymentDrafts = state.paymentDrafts.filter((draft) => draft.id !== draftId);
    if (state.paymentDrafts.length === 0) {
      state.paymentDrafts = [
        { id: slug(), debtId: '', paymentDate: new Date().toISOString().slice(0, 10), amount: '', note: '' },
      ];
    }
    render();
    return;
  }

  if (action === 'save-payments') {
    void savePaymentBatch();
    return;
  }

  if (action === 'edit-payment') {
    const paymentId = actionButton?.dataset.paymentId;
    const payment = state.planner?.payments.find((candidate) => candidate.id === paymentId);
    if (payment) {
      startEditingPayment(payment);
    }
    return;
  }

  if (action === 'save-edit-payment') {
    const paymentId = actionButton?.dataset.paymentId;
    if (paymentId) {
      void saveEditedPayment(paymentId);
    }
    return;
  }

  if (action === 'cancel-edit-payment') {
    state.editingPaymentId = null;
    render();
    return;
  }

  if (action === 'pick-statement-files') {
    if (state.activeTab === 'accounts') {
      state.statementTargetDebtId = state.selectedAccountId;
      state.parseError = null;
    }
    const input = document.querySelector<HTMLInputElement>('#statement-upload-input');
    if (input) {
      input.value = '';
      input.click();
    }
    return;
  }

  if (action === 'pick-credit-report-files') {
    const input = document.querySelector<HTMLInputElement>('#credit-report-upload-input');
    if (input) {
      input.value = '';
      input.click();
    }
    return;
  }

  if (action === 'pick-reconcile-statement-files') {
    const input = document.querySelector<HTMLInputElement>('#reconcile-statement-upload-input');
    if (input) {
      input.value = '';
      input.click();
    }
    return;
  }

  if (action === 'create-account') {
    void addDebt();
    return;
  }

  if (action === 'create-parsed-accounts') {
    void createAccountsFromParsedSelection();
    return;
  }

  if (action === 'import-parsed') {
    void importParsedEntries();
    return;
  }

  if (action === 'import-entry-to-selected') {
    const entryId = actionButton?.dataset.entryId;
    const debtId = actionButton?.dataset.debtId;
    if (entryId && debtId) {
      void importParsedEntryToDebt(entryId, debtId);
    }
    return;
  }

  if (action === 'next-parsed-card') {
    if (state.parsedStatement) {
      state.parsedCursor = Math.min(state.parsedCursor + 1, state.parsedStatement.entries.length - 1);
      render();
    }
    return;
  }

  if (action === 'prev-parsed-card') {
    state.parsedCursor = Math.max(state.parsedCursor - 1, 0);
    render();
    return;
  }

  if (action === 'reset-account-draft') {
    state.accountDraft = createEmptyAccountDraft();
    state.draftGroupMode = 'existing';
    state.draftGroupSelection = '';
    state.inlineGroupEditor = { mode: null, debtId: null, value: '' };
    state.parsedStatement = null;
    state.parseError = null;
    render();
    return;
  }

  if (action === 'apply-advice' && state.planner) {
    const debtId = actionButton?.dataset.debtId;
    if (!debtId) {
      return;
    }

    const advice = state.planner.modelAdvice.find((item) => item.debtId === debtId);
    if (!advice?.recommendationReady || !advice.recommendedInterestMethod) {
      return;
    }

    const patch: Partial<DebtInput> = {
      interestMethod: advice.recommendedInterestMethod,
    };

    if (advice.recommendedBalancePresentation) {
      patch.balancePresentation = advice.recommendedBalancePresentation;
    }

    void updateDebt(debtId, patch);
    return;
  }

  const deletePaymentButton = target.closest<HTMLElement>('[data-delete-payment]');
  const deletePaymentId = deletePaymentButton?.dataset.deletePayment;
  if (deletePaymentId) {
    void deletePayment(deletePaymentId);
    return;
  }

  if (action === 'select-account') {
    const debtId = actionButton?.dataset.debtId;
    if (debtId) {
      state.selectedAccountId = debtId;
      state.activeTab = 'accounts';
      state.deleteConfirmDebtId = null;
      state.showAccountCreator = false;
      state.accountQuoteIndex = Math.floor(Math.random() * momentumQuotes.length);
      render();
    }
    return;
  }

  if (action === 'prefill-parsed-entry' && state.parsedStatement) {
    const entryId = actionButton?.dataset.entryId;
    const entry = state.parsedStatement.entries.find((candidate) => candidate.entryId === entryId);
    if (!entry) {
      return;
    }

    state.accountDraft = {
      ...state.accountDraft,
      name: entry.accountLabel || state.accountDraft.name,
      debtType: entry.debtType ?? state.accountDraft.debtType,
      startingBalance:
        entry.balanceCents === null ? state.accountDraft.startingBalance : (entry.balanceCents / 100).toFixed(2),
      balance:
        entry.balanceCents === null ? state.accountDraft.balance : (entry.balanceCents / 100).toFixed(2),
      minimumPayment:
        entry.minimumDueCents === null
          ? state.accountDraft.minimumPayment
          : (entry.minimumDueCents / 100).toFixed(2),
      apr: entry.aprBps === null ? state.accountDraft.apr : (entry.aprBps / 100).toFixed(2),
      notes: state.parsedStatement.documentName,
    };
    render();
  }

  if (shouldRenderForClosedMenu) {
    render();
  }
});

document.addEventListener('input', (event) => {
  const target = event.target as HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement | null;
  if (!target) {
    return;
  }

  if (target instanceof HTMLInputElement && target.dataset.accountProjection === 'date') {
    state.projectionDateDraft = {
      selectedDebtId: state.selectedAccountId,
      value: target.value,
    };
    return;
  }

  if (target instanceof HTMLInputElement && target.dataset.quickPayDate) {
    const debtId = target.dataset.quickPayDate;
    if (debtId) {
      state.quickPayDrafts[debtId] = {
        paymentDate: target.value,
        customAmount: state.quickPayDrafts[debtId]?.customAmount ?? '',
      };
    }
    return;
  }

  if (target instanceof HTMLInputElement && target.dataset.quickPayCustom) {
    const debtId = target.dataset.quickPayCustom;
    if (debtId) {
      state.quickPayDrafts[debtId] = {
        paymentDate: state.quickPayDrafts[debtId]?.paymentDate ?? new Date().toISOString().slice(0, 10),
        customAmount: target.value,
      };
    }
    return;
  }

  if (target.dataset.editPaymentField) {
    const field = target.dataset.editPaymentField as keyof PaymentEditDraft;
    state.editingPaymentDraft[field] = target.value;
    return;
  }

  if (target instanceof HTMLTextAreaElement && target.dataset.import === 'csv') {
    state.importDraft = target.value;
    return;
  }

  const draftId = target.dataset.draftId;
  const draftField = target.dataset.draftField as keyof PaymentDraft | undefined;
  if (draftId && draftField) {
    const draft = state.paymentDrafts.find((candidate) => candidate.id === draftId);
    if (!draft) {
      return;
    }

    draft[draftField] = target.value;
    return;
  }

  const parsedEntryId = target.dataset.parsedEntry;
  const parsedField = target.dataset.parsedField;
  if (parsedEntryId && parsedField === 'debtId') {
    state.parsedMappings[parsedEntryId] = target.value;
    return;
  }

  const parsedToggle = target.dataset.parsedToggle;
  if (parsedEntryId && parsedToggle === 'include' && target instanceof HTMLInputElement) {
    state.parsedSelections[parsedEntryId] = target.checked;
    render();
    return;
  }

  if (parsedEntryId && parsedToggle === 'missing-apr' && target instanceof HTMLInputElement) {
    const parsedDraft = state.parsedAccountDrafts[parsedEntryId];
    if (!parsedDraft) {
      return;
    }
    parsedDraft.aprMissing = target.checked;
    if (target.checked) {
      parsedDraft.apr = '';
    }
    render();
    return;
  }

  const parsedDraftField = target.dataset.parsedDraftField as keyof ParsedAccountDraft | undefined;
  if (parsedEntryId && parsedDraftField) {
    const parsedDraft = state.parsedAccountDrafts[parsedEntryId];
    if (!parsedDraft) {
      return;
    }
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      parsedDraft[parsedDraftField] = target.checked as never;
    } else {
      parsedDraft[parsedDraftField] = target.value as never;
    }
    if (parsedDraftField === 'apr' && target instanceof HTMLInputElement) {
      parsedDraft.aprMissing = false;
    }
    return;
  }

  const accountDraftField = target.dataset.draftAccountField;
  if (accountDraftField) {
    if (accountDraftField === 'groupMode') {
      state.draftGroupMode = target.value === 'new' ? 'new' : 'existing';
    } else if (accountDraftField === 'groupSelection') {
      if (target.value === '__new__') {
        state.inlineGroupEditor = { mode: 'create', debtId: null, value: '' };
      } else {
        state.draftGroupSelection = target.value;
        state.inlineGroupEditor = { mode: null, debtId: null, value: '' };
      }
      render();
      return;
    } else if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      state.accountDraft[accountDraftField as keyof AccountDraft] = target.checked as never;
      render();
      return;
    } else {
      state.accountDraft[accountDraftField as keyof AccountDraft] = target.value as never;
    }
    if (accountDraftField === 'interestMethodChoice') {
      render();
    }
    return;
  }
});

document.addEventListener('change', (event) => {
  const fileTarget = event.target as HTMLInputElement | null;
  if (fileTarget?.dataset.importFile === 'statement') {
    if (fileTarget.files && fileTarget.files.length > 0) {
      void parseStatementFiles(fileTarget.files);
    }
    fileTarget.value = '';
    return;
  }

  if (fileTarget?.dataset.importFile === 'credit-report-local') {
    if (fileTarget.files && fileTarget.files.length > 0) {
      void parseCreditReportFilesClient(fileTarget.files);
    }
    fileTarget.value = '';
    return;
  }
});

document.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null;
  if (!target || !state.planner) {
    return;
  }

  if (target.dataset.uiTheme === 'theme') {
    void updateSettings({ theme: target.value as PlannerSettings['theme'] });
    return;
  }

  if (target.dataset.projectionAccount === 'selectedDebtId') {
    state.selectedAccountId = target.value || null;
    state.projectionDateDraft = {
      selectedDebtId: target.value || null,
      value: state.accountProjectionDate,
    };
    render();
    return;
  }

  if (target.dataset.accountProjection === 'date') {
    state.accountProjectionDate = target.value;
    state.projectionDateDraft = {
      selectedDebtId: state.selectedAccountId,
      value: target.value,
    };
    render();
    return;
  }

  if (target.dataset.accountFilter === 'debtType') {
    state.accountTypeFilter = target.value === 'all' ? 'all' : (target.value as DebtType);
    render();
    return;
  }

  const setting = target.dataset.setting as keyof PlannerSettings | undefined;
  if (setting) {
    const patch: Partial<PlannerSettings> = {};
    if (setting === 'monthlyBudgetCents') {
      patch.monthlyBudgetCents = Math.max(0, Math.round(Number(target.value || 0) * 100));
    } else if (setting === 'strategy') {
      patch.strategy = target.value as PlannerSettings['strategy'];
    } else {
      patch.startDate = target.value;
    }

    void updateSettings(patch);
    return;
  }

  const debtId = target.dataset.debtId;
  const field = target.dataset.field as keyof DebtInput | undefined;
  if (!debtId || !field) {
    return;
  }

  const patch: Partial<DebtInput> = {};

  if (target instanceof HTMLInputElement && target.type === 'checkbox') {
    patch[field] = target.checked as never;
  } else if (field === 'groupName' && target instanceof HTMLSelectElement && target.value === '__new__') {
    state.inlineGroupEditor = { mode: 'detail', debtId, value: '' };
    render();
    return;
  } else if (field === 'startingBalanceCents' || field === 'balanceCents' || field === 'minimumPaymentCents') {
    patch[field] = Math.max(0, Math.round(Number(target.value || 0) * 100)) as never;
  } else if (field === 'aprBps' || field === 'promoAprBps') {
    patch[field] = Math.max(0, Math.round(Number(target.value || 0) * 100)) as never;
  } else if (field === 'dueDay') {
    patch[field] = Math.max(1, Math.round(Number(target.value || 1))) as never;
  } else if (field === 'promoEndDate') {
    return;
  } else if (field === 'interestMethod') {
    patch.interestMethod = target.value as DebtInput['interestMethod'];
  } else if (field === 'balancePresentation') {
    patch.balancePresentation = target.value as DebtInput['balancePresentation'];
  } else {
    patch[field] = target.value as never;
  }

  void updateDebt(debtId, patch);
});

document.addEventListener('blur', (event) => {
  const target = event.target as HTMLInputElement | null;
  if (!target || !state.planner) {
    return;
  }

  const debtId = target.dataset.debtId;
  const field = target.dataset.field as keyof DebtInput | undefined;
  if (!debtId || !field || target.type !== 'date') {
    return;
  }

  const patch: Partial<DebtInput> = {};
  if (field === 'promoEndDate') {
    patch.promoEndDate = target.value || undefined;
  } else {
    return;
  }

  void updateDebt(debtId, patch);
}, true);

document.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement | null;
  if (!target) {
    return;
  }

  const authField = target.dataset.authField as keyof typeof state.authDraft | undefined;
  if (authField) {
    state.authDraft[authField] = target.value;
    return;
  }

  if (target.dataset.inlineGroupInput) {
    state.inlineGroupEditor.value = target.value;
  }
});

void fetchSession();

