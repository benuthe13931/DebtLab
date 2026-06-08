import type { DebtInput, PlannerResponse, SimulationResult } from '../types';

export const daysInMonthLocal = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
export const clampDayLocal = (day: number, monthDays: number) => Math.max(1, Math.min(day, monthDays));
export const addMonthsLocal = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);
export const endOfMonthLocal = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
export const startOfDayLocal = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const parseIsoDateLocal = (value: string) => new Date(`${value}T00:00:00`);

export const aprForDateLocal = (debt: DebtInput, date: Date) => {
  if (debt.promoEndDate && debt.promoAprBps !== undefined && debt.promoAprBps !== null) {
    const promoEnd = new Date(debt.promoEndDate);
    if (date <= promoEnd) {
      return debt.promoAprBps;
    }
  }
  return debt.aprBps;
};

export const getDebtMinimumProjection = (debt: DebtInput) => {
  if (debt.aprBps <= 0 || debt.minimumPaymentCents <= 0 || debt.balanceCents <= 0) {
    return null;
  }

  let balance = debt.balanceCents;
  const start = new Date();

  for (let monthOffset = 0; monthOffset < 600; monthOffset += 1) {
    const monthDate = addMonthsLocal(start, monthOffset);
    const dueDay = clampDayLocal(debt.dueDay, daysInMonthLocal(monthDate));
    let monthBalance = balance;

    for (let day = 1; day <= daysInMonthLocal(monthDate); day += 1) {
      const currentDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const aprBps = aprForDateLocal(debt, currentDate);

      if (debt.interestMethod === 'daily' && monthBalance > 0 && aprBps > 0) {
        monthBalance += (monthBalance * aprBps) / 10000 / 365;
      }

      if (day === dueDay && monthBalance > 0) {
        monthBalance -= Math.min(debt.minimumPaymentCents, monthBalance);
      }
    }

    if (debt.interestMethod === 'monthly' && monthBalance > 0) {
      monthBalance += (monthBalance * aprForDateLocal(debt, endOfMonthLocal(monthDate))) / 10000 / 12;
    }

    balance = Math.max(0, Math.round(monthBalance));
    if (balance <= 0) {
      return {
        months: monthOffset + 1,
        payoffDate: monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      };
    }
  }

  return {
    months: 600,
    payoffDate: 'More than 50 years',
  };
};

export const estimateInterestForWindow = (debt: DebtInput, principalCents: number, startDate: Date, targetDate: Date) => {
  if (debt.aprBps <= 0 || targetDate <= startDate || principalCents <= 0) {
    return 0;
  }

  if (debt.interestMethod === 'monthly') {
    let interest = 0;
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const targetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);

    while (cursor <= targetMonth) {
      const monthEnd = endOfMonthLocal(cursor);
      if (monthEnd > startDate && monthEnd <= targetDate) {
        interest += (principalCents * aprForDateLocal(debt, monthEnd)) / 10000 / 12;
      }
      cursor = addMonthsLocal(cursor, 1);
    }

    return Math.max(0, Math.round(interest));
  }

  const dayDiff = Math.max(0, Math.floor((startOfDayLocal(targetDate).getTime() - startOfDayLocal(startDate).getTime()) / (1000 * 60 * 60 * 24)));
  return Math.max(0, Math.round((principalCents * debt.aprBps) / 10000 / 365 * dayDiff));
};

export const getProjectionAnchor = (planner: PlannerResponse, debt: DebtInput) => {
  const latestSnapshot = [...planner.snapshots]
    .filter((snapshot) => snapshot.debtId === debt.id)
    .sort((left, right) => right.snapshotDate.localeCompare(left.snapshotDate))[0];
  const latestPayment = [...planner.payments]
    .filter((payment) => payment.debtId === debt.id)
    .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))[0];

  const today = startOfDayLocal(new Date());
  const dueDateThisMonth = new Date(today.getFullYear(), today.getMonth(), clampDayLocal(debt.dueDay, daysInMonthLocal(today)));
  const lastDueDate = dueDateThisMonth > today ? new Date(today.getFullYear(), today.getMonth() - 1, debt.dueDay) : dueDateThisMonth;

  const paymentDate = latestPayment ? parseIsoDateLocal(latestPayment.paymentDate) : null;
  const baseDate = paymentDate && paymentDate > lastDueDate ? paymentDate : lastDueDate;
  const principalCents =
    latestSnapshot?.principalBalanceCents ??
    (debt.balancePresentation === 'principal_plus_accrued_interest'
      ? Math.max(0, debt.balanceCents - getEstimatedCurrentAccruedInterest(planner, debt))
      : debt.balanceCents);
  const accruedTodayCents =
    latestSnapshot?.accruedInterestCents ??
    estimateInterestForWindow(debt, principalCents, baseDate, today);

  return {
    baseDate,
    principalCents,
    accruedTodayCents,
  };
};

export const getProjectedDebtSnapshot = (planner: PlannerResponse, debt: DebtInput, isoDate: string) => {
  if (!isoDate) {
    return null;
  }

  const targetDate = parseIsoDateLocal(isoDate);
  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }

  if (debt.aprBps <= 0) {
    return null;
  }

  const today = startOfDayLocal(new Date());
  const anchor = getProjectionAnchor(planner, debt);

  if (targetDate < anchor.baseDate) {
    return {
      projectedBalanceCents: anchor.principalCents,
      accruedInterestCents: 0,
    };
  }

  if (targetDate <= today) {
    const accruedInterest = estimateInterestForWindow(debt, anchor.principalCents, anchor.baseDate, targetDate);
    return {
      projectedBalanceCents: Math.max(0, anchor.principalCents + accruedInterest),
      accruedInterestCents: accruedInterest,
    };
  }

  let balance = Math.max(debt.balanceCents, anchor.principalCents + anchor.accruedTodayCents);
  let accruedInterest = anchor.accruedTodayCents;
  let cursor = new Date(today);

  while (cursor <= targetDate) {
    const aprBps = aprForDateLocal(debt, cursor);
    const monthDays = daysInMonthLocal(cursor);
    const dueDay = clampDayLocal(debt.dueDay, monthDays);

    if (debt.interestMethod === 'daily' && balance > 0 && aprBps > 0) {
      const dailyInterest = (balance * aprBps) / 10000 / 365;
      balance += dailyInterest;
      accruedInterest += dailyInterest;
    }

    if (cursor.getDate() === dueDay && balance > 0) {
      balance -= Math.min(debt.minimumPaymentCents, balance);
    }

    if (cursor.getDate() === monthDays && debt.interestMethod === 'monthly' && balance > 0) {
      const monthlyInterest = (balance * aprBps) / 10000 / 12;
      balance += monthlyInterest;
      accruedInterest += monthlyInterest;
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }

  return {
    projectedBalanceCents: Math.max(0, Math.round(balance)),
    accruedInterestCents: Math.max(0, Math.round(accruedInterest)),
  };
};

export const getEstimatedCurrentAccruedInterest = (planner: PlannerResponse, debt: DebtInput) => {
  const latestSnapshot = [...planner.snapshots]
    .filter((snapshot) => snapshot.debtId === debt.id)
    .sort((left, right) => right.snapshotDate.localeCompare(left.snapshotDate))[0];
  if (latestSnapshot?.accruedInterestCents !== null && latestSnapshot?.accruedInterestCents !== undefined) {
    return latestSnapshot.accruedInterestCents;
  }

  if (debt.interestMethod !== 'daily' || debt.aprBps <= 0) {
    return 0;
  }

  const latestPayment = [...planner.payments]
    .filter((payment) => payment.debtId === debt.id)
    .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))[0];

  const today = new Date();
  const lastDueDate = new Date(today.getFullYear(), today.getMonth(), clampDayLocal(debt.dueDay, daysInMonthLocal(today)));
  if (lastDueDate > today) {
    lastDueDate.setMonth(lastDueDate.getMonth() - 1);
  }

  const baseDate = latestPayment ? new Date(`${latestPayment.paymentDate}T00:00:00`) : lastDueDate;
  const dayDiff = Math.max(0, Math.floor((today.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)));
  const principal =
    latestSnapshot?.principalBalanceCents ??
    debt.balanceCents;

  return Math.max(0, Math.round((principal * debt.aprBps) / 10000 / 365 * dayDiff));
};

export const getFocusExplanation = (planner: PlannerResponse) => {
  const focusDebt = getCurrentFocusOrder(planner)[0];
  if (!focusDebt) {
    return 'The planner needs complete debt inputs before it can explain the current focus order.';
  }

  if (planner.settings.strategy === 'snowball') {
    return `${focusDebt.name} is first because snowball pushes extra money to the smallest balance after minimums are covered.`;
  }

  if (planner.settings.strategy === 'avalanche') {
    return `${focusDebt.name} is first because avalanche pushes extra money to the highest APR after minimums are covered.`;
  }

  if (focusDebt.deferredInterest) {
    return `${focusDebt.name} is first because the hybrid strategy is protecting a deferred-interest deadline while still following your broader payoff priorities whenever it can.`;
  }

  if (focusDebt.promoEndDate && focusDebt.promoAprBps !== undefined && focusDebt.promoAprBps !== null) {
    return `${focusDebt.name} is first because the hybrid strategy is reserving enough money to clear the promo safely without abandoning APR priority too early.`;
  }

  return `${focusDebt.name} is first because hybrid usually follows APR priority, but it will step in to protect promo and deferred-interest deadlines when the calendar says it has to.`;
};

export const getCurrentFocusOrder = (planner: PlannerResponse) => {
  const currentMonth = planner.simulation.months[0];
  if (!currentMonth) {
    return [];
  }

  return [...currentMonth.items]
    .map((item) => {
      const debt = planner.debts.find((candidate: DebtInput) => candidate.id === item.debtId);
      const minimumCents = debt ? Math.min(debt.minimumPaymentCents, item.startingBalanceCents) : 0;
      const extraCents = Math.max(0, item.paymentCents - minimumCents);
      return {
        debt: debt ?? planner.debts.find((candidate: DebtInput) => candidate.id === item.debtId),
        item,
        extraCents,
      };
    })
    .filter((entry): entry is { debt: DebtInput; item: SimulationResult['months'][number]['items'][number]; extraCents: number } => Boolean(entry.debt))
    .sort((left, right) => right.extraCents - left.extraCents || right.item.paymentCents - left.item.paymentCents || right.item.interestCents - left.item.interestCents)
    .map((entry) => entry.debt);
};

export const getLatestSnapshotForDebt = (planner: PlannerResponse, debtId: string) =>
  [...planner.snapshots]
    .filter((snapshot) => snapshot.debtId === debtId)
    .sort((left, right) => right.snapshotDate.localeCompare(left.snapshotDate))[0] ?? null;