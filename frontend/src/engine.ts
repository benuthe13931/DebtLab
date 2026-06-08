import type {
  DebtInput,
  DebtMonthResult,
  MonthResult,
  PlannerSettings,
  SimulationResult,
  Strategy,
} from './types';

const MICROS_PER_CENT = 10_000n;
const MAX_MONTHS = 480;

interface RuntimeDebt extends DebtInput {
  balanceMicros: bigint;
}

interface MonthPlan {
  paymentsMicros: Map<string, bigint>;
  focusDebtId?: string;
  warnings: string[];
}

const toMicrosFromCents = (value: number) => BigInt(Math.round(value)) * MICROS_PER_CENT;

const microsToCents = (value: bigint) => Number((value + MICROS_PER_CENT / 2n) / MICROS_PER_CENT);

const divRound = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator / 2n) / denominator;

const clampDay = (day: number, daysInMonth: number) =>
  Math.max(1, Math.min(daysInMonth, Math.round(day)));

const daysInMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const formatMonth = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

const formatDeadline = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const isPromoActiveOn = (debt: DebtInput, date: Date) =>
  debt.promoEndDate ? new Date(debt.promoEndDate) >= date : false;

const aprForDate = (debt: DebtInput, date: Date) => {
  if (isPromoActiveOn(debt, date)) {
    return debt.promoAprBps ?? debt.aprBps;
  }

  return debt.aprBps;
};

const paymentWindowsRemaining = (monthDate: Date, promoEndDate: string) => {
  const promoDate = new Date(promoEndDate);
  const monthIndex =
    (promoDate.getFullYear() - monthDate.getFullYear()) * 12 +
    (promoDate.getMonth() - monthDate.getMonth());

  return Math.max(1, monthIndex + 1);
};

const computeGuardPayment = (debt: RuntimeDebt, monthDate: Date) => {
  if (!debt.promoEndDate) {
    return 0n;
  }

  const promoEnds = new Date(debt.promoEndDate);
  if (promoEnds < startOfMonth(monthDate)) {
    return 0n;
  }

  const windows = paymentWindowsRemaining(monthDate, debt.promoEndDate);
  return divRound(debt.balanceMicros, BigInt(windows));
};

const getStrategySort = (strategy: Strategy, debts: RuntimeDebt[], monthDate: Date) => {
  const scoreById = new Map<string, number>();

  for (const debt of debts) {
    const currentApr = aprForDate(debt, monthDate);
    const balanceCents = microsToCents(debt.balanceMicros);
    const promoWindows = debt.promoEndDate ? paymentWindowsRemaining(monthDate, debt.promoEndDate) : 999;
    const urgencyBoost =
      debt.promoEndDate && (debt.deferredInterest || promoWindows <= 2) ? 10_000 - promoWindows : 0;

    if (strategy === 'snowball') {
      scoreById.set(debt.id, -balanceCents + currentApr / 10_000);
      continue;
    }

    if (strategy === 'avalanche') {
      scoreById.set(debt.id, currentApr * 1_000_000 - balanceCents);
      continue;
    }

    scoreById.set(debt.id, currentApr * 1_000_000 + urgencyBoost * 100_000 - balanceCents);
  }

  return [...debts].sort((left, right) => (scoreById.get(right.id) ?? 0) - (scoreById.get(left.id) ?? 0));
};

const buildMonthPlan = (debts: RuntimeDebt[], settings: PlannerSettings, monthDate: Date): MonthPlan => {
  const warnings: string[] = [];
  const paymentsMicros = new Map<string, bigint>();
  const activeDebts = debts.filter((debt) => debt.balanceMicros > 0n);
  const monthlyBudgetMicros = toMicrosFromCents(settings.monthlyBudgetCents);

  const minimumTotal = activeDebts.reduce(
    (sum, debt) => sum + toMicrosFromCents(Math.min(debt.minimumPaymentCents, microsToCents(debt.balanceMicros))),
    0n,
  );

  if (minimumTotal > monthlyBudgetMicros) {
    warnings.push(
      `Monthly budget does not cover minimum payments in ${formatMonth(monthDate)}. Increase the budget or reduce required minimums.`,
    );
    return { paymentsMicros, warnings };
  }

  let remainingBudget = monthlyBudgetMicros;

  for (const debt of activeDebts) {
    const basePayment = toMicrosFromCents(Math.min(debt.minimumPaymentCents, microsToCents(debt.balanceMicros)));
    paymentsMicros.set(debt.id, basePayment);
    remainingBudget -= basePayment;
  }

  const guardDebts = activeDebts
    .map((debt) => ({
      debt,
      guardPayment: computeGuardPayment(debt, monthDate),
    }))
    .filter(({ guardPayment }) => guardPayment > 0n)
    .sort((left, right) => {
      const leftDate = left.debt.promoEndDate ? new Date(left.debt.promoEndDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDate = right.debt.promoEndDate ? new Date(right.debt.promoEndDate).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    });

  for (const item of guardDebts) {
    const current = paymentsMicros.get(item.debt.id) ?? 0n;
    const needed = item.guardPayment > current ? item.guardPayment - current : 0n;
    const addition = remainingBudget >= needed ? needed : remainingBudget;

    if (addition > 0n) {
      paymentsMicros.set(item.debt.id, current + addition);
      remainingBudget -= addition;
    }

    if (addition < needed) {
      const debtType = item.debt.deferredInterest ? 'deferred-interest' : 'promo';
      warnings.push(
        `${item.debt.name} may miss its ${debtType} deadline of ${formatDeadline(
          item.debt.promoEndDate!,
        )} with the current budget.`,
      );
    }
  }

  const ranked = getStrategySort(settings.strategy, activeDebts, monthDate);
  let focusDebtId = ranked[0]?.id;

  while (remainingBudget > 0n) {
    const target = ranked.find((debt) => {
      const scheduled = paymentsMicros.get(debt.id) ?? 0n;
      return debt.balanceMicros - scheduled > 0n;
    });

    if (!target) {
      break;
    }

    if (!focusDebtId) {
      focusDebtId = target.id;
    }

    const current = paymentsMicros.get(target.id) ?? 0n;
    const capacity = target.balanceMicros - current;
    const extra = remainingBudget > capacity ? capacity : remainingBudget;
    paymentsMicros.set(target.id, current + extra);
    remainingBudget -= extra;
  }

  return { paymentsMicros, focusDebtId, warnings };
};

const simulateDebtMonth = (
  debt: RuntimeDebt,
  paymentMicros: bigint,
  monthDate: Date,
): { result: DebtMonthResult; endingBalanceMicros: bigint } => {
  const startingBalanceMicros = debt.balanceMicros;
  const monthDays = daysInMonth(monthDate);
  const dueDay = clampDay(debt.dueDay, monthDays);
  let balance = debt.balanceMicros;
  let interestAccruedMicros = 0n;
  let paymentAppliedMicros = 0n;

  for (let day = 1; day <= monthDays; day += 1) {
    const currentDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    const aprBps = aprForDate(debt, currentDate);

    if (debt.interestMethod === 'daily' && balance > 0n && aprBps > 0) {
      const dailyInterest = divRound(balance * BigInt(aprBps), 10_000n * 365n);
      balance += dailyInterest;
      interestAccruedMicros += dailyInterest;
    }

    if (day === dueDay && paymentMicros > 0n && balance > 0n) {
      const applied = paymentMicros > balance ? balance : paymentMicros;
      balance -= applied;
      paymentAppliedMicros += applied;
    }
  }

  if (debt.interestMethod === 'monthly' && balance > 0n) {
    const aprBps = aprForDate(debt, endOfMonth(monthDate));
    const monthlyInterest = divRound(balance * BigInt(aprBps), 10_000n * 12n);
    balance += monthlyInterest;
    interestAccruedMicros += monthlyInterest;
  }

  const noteParts: string[] = [];
  if (debt.promoEndDate && isPromoActiveOn(debt, endOfMonth(monthDate))) {
    noteParts.push(
      debt.deferredInterest
        ? `Deferred-interest window active until ${formatDeadline(debt.promoEndDate)}`
        : `Promo APR active until ${formatDeadline(debt.promoEndDate)}`,
    );
  }

  return {
    endingBalanceMicros: balance,
    result: {
      debtId: debt.id,
      name: debt.name,
      startingBalanceCents: microsToCents(startingBalanceMicros),
      paymentCents: microsToCents(paymentAppliedMicros),
      interestCents: microsToCents(interestAccruedMicros),
      endingBalanceCents: microsToCents(balance),
      aprLabel: `${(aprForDate(debt, monthDate) / 100).toFixed(2)}% ${debt.interestMethod}`,
      note: noteParts.join(' '),
    },
  };
};

export const simulatePayoff = (debts: DebtInput[], settings: PlannerSettings): SimulationResult => {
  const runtimeDebts: RuntimeDebt[] = debts.map((debt) => ({
    ...debt,
    balanceMicros: toMicrosFromCents(debt.balanceCents),
  }));

  const warnings: string[] = [];
  const months: MonthResult[] = [];
  const focusSequence: string[] = [];
  let totalInterestMicros = 0n;
  let totalPaidMicros = 0n;
  let completed = false;

  const startDate = startOfMonth(new Date(settings.startDate));

  for (let monthOffset = 0; monthOffset < MAX_MONTHS; monthOffset += 1) {
    const monthDate = addMonths(startDate, monthOffset);
    if (runtimeDebts.every((debt) => debt.balanceMicros <= 0n)) {
      completed = true;
      break;
    }

    const plan = buildMonthPlan(runtimeDebts, settings, monthDate);
    warnings.push(...plan.warnings);

    if (plan.paymentsMicros.size === 0) {
      break;
    }

    if (plan.focusDebtId) {
      const currentFocus = runtimeDebts.find((debt) => debt.id === plan.focusDebtId)?.name;
      if (currentFocus && focusSequence[focusSequence.length - 1] !== currentFocus) {
        focusSequence.push(currentFocus);
      }
    }

    const items: DebtMonthResult[] = [];
    let monthInterestMicros = 0n;
    let monthPaymentMicros = 0n;

    for (const debt of runtimeDebts) {
      if (debt.balanceMicros <= 0n) {
        continue;
      }

      const paymentMicros = plan.paymentsMicros.get(debt.id) ?? 0n;
      const { result, endingBalanceMicros } = simulateDebtMonth(debt, paymentMicros, monthDate);
      debt.balanceMicros = endingBalanceMicros;
      items.push(result);
      monthInterestMicros += toMicrosFromCents(result.interestCents);
      monthPaymentMicros += toMicrosFromCents(result.paymentCents);
    }

    const totalBalanceCents = runtimeDebts.reduce((sum, debt) => sum + microsToCents(debt.balanceMicros), 0);
    totalInterestMicros += monthInterestMicros;
    totalPaidMicros += monthPaymentMicros;

    months.push({
      monthKey: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
      label: formatMonth(monthDate),
      totalPaymentCents: microsToCents(monthPaymentMicros),
      totalInterestCents: microsToCents(monthInterestMicros),
      totalBalanceCents,
      focusDebtId: plan.focusDebtId,
      focusDebtName: runtimeDebts.find((debt) => debt.id === plan.focusDebtId)?.name,
      items: items.sort((left, right) => right.startingBalanceCents - left.startingBalanceCents),
    });
  }

  if (runtimeDebts.every((debt) => debt.balanceMicros <= 0n)) {
    completed = true;
  }

  const debtFreeMonth = completed && months.length > 0 ? months[months.length - 1].monthKey : undefined;
  const debtFreeDate = debtFreeMonth
    ? new Date(`${debtFreeMonth}-01T00:00:00`).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : undefined;

  return {
    months,
    warnings: [...new Set(warnings)],
    totalInterestCents: microsToCents(totalInterestMicros),
    totalPaidCents: microsToCents(totalPaidMicros),
    debtFreeDate,
    monthsToPayoff: months.length,
    focusSequence,
    completed,
  };
};
