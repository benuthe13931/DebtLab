import { accrueInterest, isMonthWithinPause } from "./accrueInterest.ts";
import { addMonths, clampToMonth, parseDate, toDateInputValue } from "./dateUtils.ts";
import { parseCurrency } from "../../utils/currency.ts";
import type {
  DayCountBasis,
  PaymentEvent,
  PausePeriod,
  ScheduleResult,
  ScheduleRow,
  ScheduledMode,
} from "../../types/loans.ts";

type ScheduledDueDayChange = { day: number; endMonth?: Date; startMonth: Date };

function monthValue(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

function getPausePeriodForDate(date: Date, pausePeriods: PausePeriod[]): PausePeriod | null {
  return pausePeriods.find((pausePeriod) => isMonthWithinPause(date, pausePeriod)) ?? null;
}

function getEffectiveDueDayForMonth(date: Date, baseDueDay: number, dueDayChanges: ScheduledDueDayChange[]): number {
  const value = monthValue(date);
  const match = dueDayChanges.find((change) => {
    const start = monthValue(change.startMonth);
    const end = change.endMonth ? monthValue(change.endMonth) : Number.POSITIVE_INFINITY;
    return value >= start && value <= end;
  });
  return match?.day ?? baseDueDay;
}

function diffDays(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((endUtc - startUtc) / msPerDay));
}

function moveToNextWeekday(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  if (day === 6) next.setDate(next.getDate() + 2);
  if (day === 0) next.setDate(next.getDate() + 1);
  return next;
}

export function getNextScheduledPaymentDate(params: {
  afterDate: Date;
  dueDayChanges?: ScheduledDueDayChange[];
  dueDay: number;
  firstPaymentDate: Date;
  moveWeekend: boolean;
}): Date {
  const { afterDate, dueDay, dueDayChanges = [], firstPaymentDate, moveWeekend } = params;
  let scheduledPaymentDate = new Date(firstPaymentDate);

  while (scheduledPaymentDate <= afterDate) {
    const nextMonthBase = addMonths(scheduledPaymentDate, 1);
    const effectiveDueDay = getEffectiveDueDayForMonth(nextMonthBase, dueDay, dueDayChanges);
    let nextPayment = clampToMonth(nextMonthBase.getFullYear(), nextMonthBase.getMonth(), effectiveDueDay);
    if (moveWeekend) nextPayment = moveToNextWeekday(nextPayment);
    scheduledPaymentDate = nextPayment;
  }

  return scheduledPaymentDate;
}

export type BuildScheduleInput = {
  actualPayments: PaymentEvent[];
  appendAsOfRow?: boolean;
  aprPercent: number;
  dayCountBasis: DayCountBasis;
  deletedRowIds?: Set<string>;
  dueDay: number;
  firstPaymentDate: Date;
  minimumPayment: number;
  moveWeekend: boolean;
  paymentAmountOverrides?: Record<string, string>;
  paymentDateOverrides?: Record<string, string>;
  paymentLabelOverrides?: Record<string, string>;
  pausePeriods?: PausePeriod[];
  roundDailyInterest: boolean;
  scheduledDueDayChanges?: ScheduledDueDayChange[];
  scheduledPaymentAdjustments?: Array<{ amount: number; endDate?: Date; startDate: Date }>;
  scheduledCutoffDate?: Date;
  scheduledMode: ScheduledMode;
  startingInterest?: number;
  startingPrincipal: number;
  startingPrincipalDate: Date;
  targetDate: Date;
};

export function buildSchedule(params: BuildScheduleInput): ScheduleResult {
  const {
    actualPayments,
    appendAsOfRow = false,
    aprPercent,
    dayCountBasis,
    deletedRowIds,
    dueDay,
    firstPaymentDate,
    minimumPayment,
    moveWeekend,
    paymentAmountOverrides,
    paymentDateOverrides,
    paymentLabelOverrides,
    pausePeriods = [],
    roundDailyInterest,
    scheduledDueDayChanges = [],
    scheduledPaymentAdjustments = [],
    scheduledCutoffDate,
    scheduledMode,
    startingInterest = 0,
    startingPrincipal,
    startingPrincipalDate,
    targetDate,
  } = params;

  const emptyResult = (errors: string[]): ScheduleResult => ({
    currentInterest: 0,
    currentPrincipal: 0,
    errors,
    paidOff: false,
    payoffDate: null,
    rows: [],
    hasNegativeAmortization: false,
    totalBalance: 0,
    totalInterestPaid: 0,
    totalPaid: 0,
    totalPrincipalPaid: 0,
  });

  if (startingPrincipal <= 0 || aprPercent < 0 || minimumPayment < 0) {
    return emptyResult(["Enter valid numeric values."]);
  }
  if (targetDate < startingPrincipalDate) {
    return emptyResult(["Target date cannot be earlier than the starting principal date."]);
  }
  if (firstPaymentDate <= startingPrincipalDate) {
    return emptyResult(["First payment date must be after the starting principal date."]);
  }
  if (dueDay < 1 || dueDay > 31) {
    return emptyResult(["Due day must be between 1 and 31."]);
  }

  const rows: ScheduleRow[] = [];
  const errors: string[] = [];
  let principal = startingPrincipal;
  let unpaidInterest = startingInterest;
  let previousEventDate = new Date(startingPrincipalDate);
  let scheduledPaymentDate = new Date(firstPaymentDate);
  let cycle = 1;
  let paymentIndex = 0;
  let totalPaid = 0;
  let totalInterestPaid = 0;
  let totalPrincipalPaid = 0;
  let paidOff = false;
  let payoffDate: Date | null = null;

  const maxEvents = 3000;
  const cutoffTime = scheduledCutoffDate?.getTime() ?? Number.NEGATIVE_INFINITY;
  const amountOverrides = paymentAmountOverrides ?? {};
  const dateOverrides = paymentDateOverrides ?? {};
  const labelOverrides = paymentLabelOverrides ?? {};
  const deletedIds = deletedRowIds ?? new Set<string>();

  const canUseScheduledPayment = (date: Date) => {
    if (scheduledMode === "never") return false;
    if (scheduledMode === "always") return true;
    return date.getTime() > cutoffTime;
  };

  const shouldSkipDeletedScheduledRow = (rowId: string, date: Date) =>
    deletedIds.has(rowId) && !getPausePeriodForDate(date, pausePeriods);
  const getFollowingScheduledPaymentDate = (currentDate: Date) => {
    const nextMonthBase = addMonths(currentDate, 1);
    const effectiveDueDay = getEffectiveDueDayForMonth(nextMonthBase, dueDay, scheduledDueDayChanges);
    let nextPayment = clampToMonth(nextMonthBase.getFullYear(), nextMonthBase.getMonth(), effectiveDueDay);
    if (moveWeekend) nextPayment = moveToNextWeekday(nextPayment);
    return nextPayment;
  };

  const getAdjustedActualPayment = (payment: PaymentEvent) => {
    const rowId = payment.id ?? `${payment.source}-${toDateInputValue(payment.date)}-${payment.amount}`;
    const overriddenDate = dateOverrides[rowId] ? parseDate(dateOverrides[rowId]) : null;
    const overriddenAmount = amountOverrides[rowId] ? parseCurrency(amountOverrides[rowId]) : Number.NaN;
    return {
      ...payment,
      amount: Number.isFinite(overriddenAmount) && overriddenAmount > 0 ? overriddenAmount : payment.amount,
      date: overriddenDate ?? payment.date,
      rowId,
    };
  };

  for (let eventCount = 0; eventCount < maxEvents; eventCount += 1) {
    while (paymentIndex < actualPayments.length) {
      const candidate = getAdjustedActualPayment(actualPayments[paymentIndex]);
      if (!deletedIds.has(candidate.rowId)) break;
      paymentIndex += 1;
    }

    const nextActual = paymentIndex < actualPayments.length ? getAdjustedActualPayment(actualPayments[paymentIndex]) : null;
    const nextActualTime = nextActual?.date.getTime() ?? Number.POSITIVE_INFINITY;

    let scheduledRowId = `scheduled-${cycle}`;
    let adjustedScheduledDate = dateOverrides[scheduledRowId]
      ? parseDate(dateOverrides[scheduledRowId]) ?? scheduledPaymentDate
      : scheduledPaymentDate;
    let adjustedScheduledAmount = amountOverrides[scheduledRowId]
      ? parseCurrency(amountOverrides[scheduledRowId])
      : minimumPayment;

    const scheduledAdjustment = scheduledPaymentAdjustments.reduce((sum, adjustment) => {
      const isAfterStart = adjustedScheduledDate >= adjustment.startDate;
      const isBeforeEnd = adjustment.endDate ? adjustedScheduledDate <= adjustment.endDate : true;
      return isAfterStart && isBeforeEnd ? sum + adjustment.amount : sum;
    }, 0);

    adjustedScheduledAmount += scheduledAdjustment;
    if (!(adjustedScheduledAmount > 0)) adjustedScheduledAmount = minimumPayment;

    while (
      (!canUseScheduledPayment(adjustedScheduledDate) || shouldSkipDeletedScheduledRow(scheduledRowId, adjustedScheduledDate)) &&
      scheduledPaymentDate <= targetDate
    ) {
      scheduledPaymentDate = getFollowingScheduledPaymentDate(scheduledPaymentDate);
      cycle += 1;
      scheduledRowId = `scheduled-${cycle}`;
      adjustedScheduledDate = dateOverrides[scheduledRowId]
        ? parseDate(dateOverrides[scheduledRowId]) ?? scheduledPaymentDate
        : scheduledPaymentDate;
      adjustedScheduledAmount = amountOverrides[scheduledRowId]
        ? parseCurrency(amountOverrides[scheduledRowId])
        : minimumPayment;
      const nextScheduledAdjustment = scheduledPaymentAdjustments.reduce((sum, adjustment) => {
        const isAfterStart = adjustedScheduledDate >= adjustment.startDate;
        const isBeforeEnd = adjustment.endDate ? adjustedScheduledDate <= adjustment.endDate : true;
        return isAfterStart && isBeforeEnd ? sum + adjustment.amount : sum;
      }, 0);
      adjustedScheduledAmount += nextScheduledAdjustment;
      if (!(adjustedScheduledAmount > 0)) adjustedScheduledAmount = minimumPayment;
    }

    const nextScheduledTime = canUseScheduledPayment(adjustedScheduledDate)
      ? adjustedScheduledDate.getTime()
      : Number.POSITIVE_INFINITY;
    if (nextActualTime === Number.POSITIVE_INFINITY && nextScheduledTime === Number.POSITIVE_INFINITY) break;

    const useActual = nextActualTime < nextScheduledTime;
    const eventDate = useActual ? new Date(nextActual!.date) : new Date(adjustedScheduledDate);
    if (eventDate > targetDate) break;
    if (principal <= 0.000001 && unpaidInterest <= 0.000001) {
      paidOff = true;
      payoffDate = new Date(previousEventDate);
      break;
    }

    const days = diffDays(previousEventDate, eventDate);
    const startingPrincipalForRow = principal;
    const startingInterestForRow = unpaidInterest;
    const accruedInterest = accrueInterest({
      aprPercent,
      dayCountBasis,
      endDate: eventDate,
      pausePeriods,
      principal: startingPrincipalForRow,
      roundDailyInterest,
      startDate: previousEventDate,
    });
    const totalInterestBeforePayment = startingInterestForRow + accruedInterest;
    const scheduledPausePeriod = useActual ? null : getPausePeriodForDate(eventDate, pausePeriods);
    const paymentAmount = scheduledPausePeriod ? 0 : useActual ? nextActual!.amount : adjustedScheduledAmount;
    const interestPaid = scheduledPausePeriod ? 0 : Math.min(paymentAmount, totalInterestBeforePayment);
    const principalPaid = scheduledPausePeriod
      ? 0
      : Math.min(startingPrincipalForRow, Math.max(0, paymentAmount - interestPaid));
    const negativeAmortization = scheduledPausePeriod
      ? scheduledPausePeriod.mode === "accrues" && accruedInterest > 0
      : paymentAmount > 0 && principalPaid <= 0.000001 && totalInterestBeforePayment > 0;

    unpaidInterest = Math.max(0, totalInterestBeforePayment - interestPaid);
    principal = Math.max(0, startingPrincipalForRow - principalPaid);

    rows.push({
      accruedInterest,
      cycle: useActual ? null : cycle,
      daysAccrued: days,
      endingInterest: unpaidInterest,
      endingPrincipal: principal,
      eventType: scheduledPausePeriod ? "paused" : useActual ? nextActual!.source : "scheduled",
      interestPaid,
      label: scheduledPausePeriod
        ? scheduledPausePeriod.mode === "paused" ? "Payment paused (interest paused)" : "Payment paused"
        : useActual ? labelOverrides[nextActual!.rowId] || nextActual!.label : labelOverrides[scheduledRowId] || "Scheduled payment",
      negativeAmortization,
      paymentAmount,
      paymentDate: new Date(eventDate),
      principalShareOfPayment: paymentAmount > 0 ? principalPaid / paymentAmount : 0,
      principalPaid,
      rowId: useActual ? nextActual!.rowId : scheduledRowId,
      startingInterest: startingInterestForRow,
      startingPrincipal: startingPrincipalForRow,
      totalInterestBeforePayment,
    });

    totalPaid += paymentAmount;
    totalInterestPaid += interestPaid;
    totalPrincipalPaid += principalPaid;
    previousEventDate = new Date(eventDate);
    if (useActual) {
      paymentIndex += 1;
    } else {
      scheduledPaymentDate = getFollowingScheduledPaymentDate(scheduledPaymentDate);
      cycle += 1;
    }

    if (principal <= 0.000001 && unpaidInterest <= 0.000001) {
      paidOff = true;
      payoffDate = new Date(eventDate);
      break;
    }
  }

  if (!paidOff && rows.length >= maxEvents) {
    errors.push("Reached event limit while simulating. Double-check payment amounts and dates.");
  }

  const finalAccruedInterest = accrueInterest({
    aprPercent,
    dayCountBasis,
    endDate: targetDate,
    pausePeriods,
    principal,
    roundDailyInterest,
    startDate: previousEventDate,
  });
  const currentInterest = unpaidInterest + finalAccruedInterest;
  const totalBalance = principal + currentInterest;

  if (appendAsOfRow && targetDate >= previousEventDate) {
    rows.push({
      accruedInterest: finalAccruedInterest,
      cycle: null,
      daysAccrued: diffDays(previousEventDate, targetDate),
      endingInterest: currentInterest,
      endingPrincipal: principal,
      eventType: "snapshot",
      interestPaid: 0,
      label: "As of target date",
      negativeAmortization: false,
      paymentAmount: 0,
      paymentDate: new Date(targetDate),
      principalShareOfPayment: null,
      principalPaid: 0,
      rowId: `snapshot-${toDateInputValue(targetDate)}`,
      startingInterest: unpaidInterest,
      startingPrincipal: principal,
      totalInterestBeforePayment: currentInterest,
    });
  }

  return {
    currentInterest,
    currentPrincipal: principal,
    errors,
    paidOff,
    payoffDate,
    rows,
    hasNegativeAmortization: rows.some((row) => row.negativeAmortization),
    totalBalance,
    totalInterestPaid,
    totalPaid,
    totalPrincipalPaid,
  };
}