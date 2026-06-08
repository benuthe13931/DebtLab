import { state as stateShape } from './state';
import { API_BASE, AUTH_BASE, SESSION_STORAGE_KEY, momentumQuotes } from './config';
import type { AuthSession, AppState, SnapshotRecord, PaymentRecord, ModelAdvice, ReconciliationItem, SimulationResult } from '../types';
import type { ThemeChoice } from './types';

type ShellState = typeof stateShape;

export type PlannerResponse = AppState & {
  simulation: SimulationResult;
  snapshots: SnapshotRecord[];
  reconciliation: ReconciliationItem[];
  payments: PaymentRecord[];
  modelAdvice: ModelAdvice[];
};

const resolveTheme = (theme: string | null | undefined): ThemeChoice =>
  theme === 'stone' || theme === 'meadow' || theme === 'sunrise' || theme === 'light' ? theme : 'ocean';

export const withAuthHeaders = (sessionToken: string | null, headers?: HeadersInit) => {
  const next = new Headers(headers);
  if (sessionToken) {
    next.set('x-session-token', sessionToken);
  }
  return next;
};

const applyPlannerResponse = (state: ShellState, planner: PlannerResponse) => {
  state.planner = planner;
  state.theme = resolveTheme(planner.settings.theme);
};

export const savePlanner = async ({
  state,
  render,
  url,
  options,
}: {
  state: ShellState;
  render: () => void;
  url: string;
  options?: RequestInit;
}) => {
  state.saving = true;
  state.error = null;

  try {
    const response = await fetch(url, {
      headers: withAuthHeaders(
        state.sessionToken,
        {
          'Content-Type': 'application/json',
        },
      ),
      ...options,
    });

    if (!response.ok) {
      throw new Error('Save failed.');
    }

    applyPlannerResponse(state, (await response.json()) as PlannerResponse);
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Unexpected error';
  } finally {
    state.saving = false;
    render();
  }
};

export const fetchPlanner = async ({
  state,
  render,
  clearDeletedDebtBanner,
}: {
  state: ShellState;
  render: () => void;
  clearDeletedDebtBanner: () => void;
}) => {
  if (!state.sessionToken) {
    state.loading = false;
    state.planner = null;
    state.selectedAccountId = null;
    render();
    return;
  }

  state.loading = true;
  state.error = null;
  render();

  try {
    const response = await fetch(API_BASE, {
      headers: withAuthHeaders(state.sessionToken),
    });
    if (!response.ok) {
      throw new Error('Could not load planner data.');
    }

    applyPlannerResponse(state, (await response.json()) as PlannerResponse);
    if (!state.selectedAccountId || !state.planner?.debts.some((debt) => debt.id === state.selectedAccountId)) {
      state.selectedAccountId = state.planner?.debts[0]?.id ?? null;
    }
    if (state.deletedDebt && state.currentUser && state.deletedDebt.userId !== state.currentUser.id) {
      clearDeletedDebtBanner();
    }
    if (state.overviewQuoteIndex === 0) {
      state.overviewQuoteIndex = Math.floor(Math.random() * momentumQuotes.length);
    }
    if (state.accountQuoteIndex === 0) {
      state.accountQuoteIndex = Math.floor(Math.random() * momentumQuotes.length);
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Unexpected error';
  } finally {
    state.loading = false;
    render();
  }
};

export const fetchSession = async ({
  state,
  render,
  fetchPlannerForSession,
}: {
  state: ShellState;
  render: () => void;
  fetchPlannerForSession: () => Promise<void>;
}) => {
  if (!state.sessionToken) {
    state.currentUser = null;
    state.loading = false;
    render();
    return;
  }

  state.loading = true;
  state.error = null;
  render();

  try {
    const response = await fetch(`${AUTH_BASE}/session`, {
      headers: withAuthHeaders(state.sessionToken),
    });

    if (!response.ok) {
      throw new Error('Session expired.');
    }

    const session = (await response.json()) as AuthSession;
    state.currentUser = session.user;
    state.sessionToken = session.token;
    window.localStorage.setItem(SESSION_STORAGE_KEY, session.token);
    await fetchPlannerForSession();
    return;
  } catch {
    state.sessionToken = null;
    state.currentUser = null;
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    state.theme = 'ocean';
    state.loading = false;
    state.planner = null;
    state.error = null;
    state.authMode = 'login';
    state.authDraft = {
      displayName: '',
      email: '',
      password: '',
    };
  }

  render();
};

export const submitAuth = async ({
  state,
  render,
  clearDeletedDebtBanner,
  fetchPlannerForSession,
}: {
  state: ShellState;
  render: () => void;
  clearDeletedDebtBanner: () => void;
  fetchPlannerForSession: () => Promise<void>;
}) => {
  state.loading = true;
  state.error = null;
  render();

  try {
    const endpoint = state.authMode === 'register' ? 'register' : 'login';
    const response = await fetch(`${AUTH_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: state.authDraft.email,
        password: state.authDraft.password,
        displayName: state.authDraft.displayName,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
      const message = Array.isArray(payload?.message) ? payload?.message[0] : payload?.message;
      throw new Error(message || 'Authentication failed.');
    }

    const session = (await response.json()) as AuthSession;
    state.sessionToken = session.token;
    state.currentUser = session.user;
    state.activeTab = 'overview';
    state.accountAreaTab = 'info';
    state.profileMenuOpen = false;
    state.selectedAccountId = null;
    clearDeletedDebtBanner();
    window.localStorage.setItem(SESSION_STORAGE_KEY, session.token);
    state.authDraft.password = '';
    await fetchPlannerForSession();
    return;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Authentication failed.';
    state.loading = false;
    render();
  }
};

export const logout = async ({
  state,
  render,
  clearDeletedDebtBanner,
}: {
  state: ShellState;
  render: () => void;
  clearDeletedDebtBanner: () => void;
}) => {
  try {
    if (state.sessionToken) {
      await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        headers: withAuthHeaders(state.sessionToken),
      });
    }
  } catch {
    // ignore logout transport issues for local MVP
  }

  state.sessionToken = null;
  state.currentUser = null;
  state.planner = null;
  state.error = null;
  state.activeTab = 'overview';
  state.accountAreaTab = 'info';
  state.profileMenuOpen = false;
  state.selectedAccountId = null;
  state.theme = 'ocean';
  state.authMode = 'login';
  state.authDraft = {
    displayName: '',
    email: '',
    password: '',
  };
  clearDeletedDebtBanner();
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  render();
};

export const resetAllDevelopmentData = async ({
  state,
  render,
  clearDeletedDebtBanner,
}: {
  state: ShellState;
  render: () => void;
  clearDeletedDebtBanner: () => void;
}) => {
  state.loading = true;
  state.error = null;
  render();

  try {
    const response = await fetch(`${API_BASE}/reset-all-dev`, {
      method: 'POST',
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
      const message = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
      throw new Error(message || 'Could not reset the development database.');
    }

    state.sessionToken = null;
    state.currentUser = null;
    state.planner = null;
    state.activeTab = 'overview';
    state.accountAreaTab = 'info';
    state.profileMenuOpen = false;
    state.theme = 'ocean';
    clearDeletedDebtBanner();
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Could not reset the development database.';
  } finally {
    state.loading = false;
    render();
  }
};

