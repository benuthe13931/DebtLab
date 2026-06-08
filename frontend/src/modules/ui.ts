import { state } from './state';
import { formatCurrency, centsToInput, bpsToInput } from './utils';
import {
  daysInMonthLocal,
  clampDayLocal,
  startOfDayLocal,
  parseIsoDateLocal,
  getLatestSnapshotForDebt,
} from './calculations';
import type {
  AppState,
  DebtInput,
  ModelAdvice,
  ParsedStatementDocument,
  PaymentRecord,
  ReconciliationItem,
  SimulationResult,
  SnapshotRecord,
} from '../types';
import type { ParsedAccountDraft } from './types';

type PlannerResponse = AppState & {
  simulation: SimulationResult;
  snapshots: SnapshotRecord[];
  reconciliation: ReconciliationItem[];
  payments: PaymentRecord[];
  modelAdvice: ModelAdvice[];
};

type QuickPayDraft = {
  paymentDate: string;
  customAmount: string;
};

export const renderHelpIcon = (copy: string) => `
  <span class="tooltip">
    <button type="button" class="help-button" aria-label="Show help">?</button>
    <span class="tooltip-bubble" role="tooltip">${copy}</span>
  </span>
`;

export const pickQuote = (items: string[], seed: string) => {
  const value = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return items[value % items.length];
};

export const getDebtProgress = (debt: DebtInput) => {
  const baseline = Math.max(debt.startingBalanceCents, debt.balanceCents, 1);
  const paidOffCents = Math.max(0, baseline - debt.balanceCents);
  const percentPaid = Math.max(0, Math.min(100, (paidOffCents / baseline) * 100));
  return {
    baseline,
    paidOffCents,
    percentPaid,
    isPaidOff: debt.balanceCents <= 0,
  };
};

export const getOverallProgress = (planner: PlannerResponse) => {
  const startingTotal = planner.debts.reduce((sum, debt) => sum + Math.max(debt.startingBalanceCents, debt.balanceCents), 0);
  const currentTotal = planner.debts.reduce((sum, debt) => sum + debt.balanceCents, 0);
  const paidOffCents = Math.max(0, startingTotal - currentTotal);
  const percentPaid = startingTotal > 0 ? (paidOffCents / startingTotal) * 100 : 0;
  return {
    startingTotal,
    currentTotal,
    paidOffCents,
    percentPaid,
  };
};

export const getQuickPayDraft = (debt: DebtInput): QuickPayDraft =>
  state.quickPayDrafts[debt.id] ?? {
    paymentDate: new Date().toISOString().slice(0, 10),
    customAmount: '',
  };

export const formatShortDate = (value: string) => {
  const date = parseIsoDateLocal(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const renderQuickPayCalendar = (debtId: string) => {
  if (state.quickPayCalendar.debtId !== debtId) {
    return '';
  }

  const { viewYear, viewMonth } = state.quickPayCalendar;
  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const cells: string[] = [];

  for (let index = 0; index < leadingBlanks; index += 1) {
    cells.push('<span class="mini-calendar__blank"></span>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = new Date(viewYear, viewMonth, day).toISOString().slice(0, 10);
    const isSelected = getQuickPayDraft({ id: debtId } as DebtInput).paymentDate === iso;
    cells.push(
      `<button class="mini-calendar__day ${isSelected ? 'mini-calendar__day--selected' : ''}" type="button" data-action="select-quick-pay-date" data-debt-id="${debtId}" data-date="${iso}">${day}</button>`,
    );
  }

  return `
    <div class="mini-calendar">
      <div class="mini-calendar__header">
        <button class="icon-button" type="button" data-action="quick-pay-calendar-prev" data-debt-id="${debtId}" aria-label="Previous month">‹</button>
        <strong>${firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button class="icon-button" type="button" data-action="quick-pay-calendar-next" data-debt-id="${debtId}" aria-label="Next month">›</button>
      </div>
      <div class="mini-calendar__weekdays">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
      </div>
      <div class="mini-calendar__grid">
        ${cells.join('')}
      </div>
    </div>
  `;
};

export const getUpcomingPaymentsForMonth = (planner: PlannerResponse) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthStart = new Date(year, month, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  return planner.debts
    .map((debt) => {
      const latestSnapshot = getLatestSnapshotForDebt(planner, debt.id);
      const paidThisMonthCents = planner.payments
        .filter((payment) => payment.debtId === debt.id && payment.paymentDate >= monthStart && payment.paymentDate <= monthEnd)
        .reduce((sum, payment) => sum + payment.amountCents, 0);
      const dueAmountCents =
        latestSnapshot?.minimumDueCents && latestSnapshot.minimumDueCents > 0
          ? latestSnapshot.minimumDueCents
          : debt.minimumPaymentCents;
      const dueDate = new Date(year, month, clampDayLocal(debt.dueDay, daysInMonthLocal(today)));
      const remainingMinimumCents = Math.max(0, debt.minimumPaymentCents - paidThisMonthCents);
      const recommendedAmountCents =
        planner.simulation.months[0]?.items.find((item) => item.debtId === debt.id)?.paymentCents ?? debt.minimumPaymentCents;
      const remainingRecommendedCents = Math.max(0, recommendedAmountCents - paidThisMonthCents);
      return {
        debt,
        dueDate,
        dueAmountCents: Math.max(0, dueAmountCents - paidThisMonthCents),
        remainingMinimumCents,
        recommendedAmountCents: remainingRecommendedCents,
        paidThisMonthCents,
        isOverdue: dueDate < startOfDayLocal(today),
      };
    })
    .filter((item) => item.remainingMinimumCents > 0 || item.recommendedAmountCents > 0 || item.dueAmountCents > 0)
    .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime());
};

export const renderDrift = (value: number | null) => {
  if (value === null) {
    return 'N/A';
  }

  const formatted = formatCurrency(Math.abs(value));
  return value === 0 ? '$0.00' : `${value > 0 ? '+' : '-'}${formatted}`;
};

export const createParsedAccountDraft = (entry: ParsedStatementDocument['entries'][number]): ParsedAccountDraft => ({
  name: entry.accountLabel,
  groupName: '',
  debtType: entry.debtType ?? 'other',
  startingBalance: centsToInput(entry.balanceCents),
  balance: centsToInput(entry.balanceCents),
  minimumPayment: centsToInput(entry.minimumDueCents),
  apr: bpsToInput(entry.aprBps),
  aprMissing: entry.aprBps === null,
  dueDay: '15',
  interestMethod: 'daily',
  promoApr: '',
  promoEndDate: '',
  deferredInterest: false,
  notes: `Imported from ${entry.sourceDocumentName}`,
});

export const getParsedAccountDraft = (entry: ParsedStatementDocument['entries'][number]) =>
  state.parsedAccountDrafts[entry.entryId] ?? createParsedAccountDraft(entry);

export const buildSnapshotCsvRow = (debtId: string, entry: ParsedStatementDocument['entries'][number]) =>
  [
    debtId,
    entry.snapshotDate,
    (entry.balanceCents! / 100).toFixed(2),
    entry.principalBalanceCents === null ? '' : (entry.principalBalanceCents / 100).toFixed(2),
    entry.accruedInterestCents === null ? '' : (entry.accruedInterestCents / 100).toFixed(2),
    entry.interestChargedCents === null ? '' : (entry.interestChargedCents / 100).toFixed(2),
    entry.minimumDueCents === null ? '' : (entry.minimumDueCents / 100).toFixed(2),
    `"${`${entry.sourceDocumentName}: ${entry.accountLabel}`.replaceAll('"', '""')}"`,
  ].join(',');

export const renderAdviceInline = (planner: PlannerResponse, debtId?: string, mode: 'detail' | 'draft' = 'detail') => {
  const advice = planner.modelAdvice.find((item) => item.debtId === debtId);
  if (mode === 'draft') {
    return `
      <div class="inline-help-card">
        <strong>Help me choose</strong>
        <span>Upload statements below. After 3 statements with posted interest, the app can compare daily and monthly fit and recommend the closer one.</span>
      </div>
    `;
  }

  if (!advice) {
    return '';
  }

  return `
    <div class="inline-help-card ${advice.recommendationReady ? 'inline-help-card--accent' : ''}">
      <div class="inline-help-card__header">
        <strong>Accrual recommendation</strong>
        ${
          advice.recommendationReady && advice.recommendedInterestMethod
            ? `<button class="button button--ghost" type="button" data-action="apply-advice" data-debt-id="${advice.debtId}">Apply ${advice.recommendedInterestMethod}</button>`
            : `<button class="button button--ghost" type="button" data-action="pick-statement-files">Choose statements</button>`
        }
      </div>
      <span>${advice.message}</span>
    </div>
  `;
};
