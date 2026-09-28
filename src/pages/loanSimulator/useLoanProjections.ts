import type { LoanSimulatorRuntime } from "../../types/loanSimulatorRuntime";
import { useMemo } from "react";
import { accrueInterest } from "../../calculations/loans/accrueInterest";
import { addMonths, clampToMonth, parseDate, toDateInputValue } from "../../calculations/loans/dateUtils";
import { getNextScheduledPaymentDate } from "../../calculations/loans/schedule";
import { compareDateOnly } from "../../utils/date";
import { parseCurrency } from "../../utils/currency";
import { formatDurationToPayoff, formatTimeShaved } from "../../utils/formatting";

export function useLoanProjections(context: LoanSimulatorRuntime) {
  const { startingPrincipalDate, minimumPayment, additionalMonthlyPayment, dueDay, targetDate, moveWeekend, roundDailyInterest, dayCountBasis, activeView, oneOffPayments, helperPausePeriods, helperRecurringChanges, helperDueDayChanges, deletedHelperRowIds, helperPaymentAmountOverrides, paymentDateOverrides, paymentLabelOverrides, whatIfPayments, whatIfRecurringChanges, whatIfPausePeriods, whatIfDueDayChanges, deferredStartingPrincipal, deferredStartingPrincipalDate, deferredFirstPaymentDate, deferredAdditionalMonthlyPayment, deferredAprPercent, deferredDueDay, deferredTargetDate, effectiveMinimumPayment, totalMonthlyPayment, buildProjection, todayDate, todayValue } = context;
  const helperVisiblePayments = useMemo(() => {
    return [...oneOffPayments].
    map((payment) => {
      const override = payment.id ? paymentDateOverrides[payment.id] : undefined;
      const overriddenDate = override ? parseDate(override) : null;
      return {
        ...payment,
        date: overriddenDate ?? payment.date
      };
    }).
    sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [oneOffPayments, paymentDateOverrides]);

  const helperPaymentsThroughTarget = useMemo(() => {
    const target = parseDate(targetDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    return helperVisiblePayments.
    filter((payment) => payment.date.getTime() <= target).
    sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [helperVisiblePayments, targetDate]);

  const helperPausePeriodsThroughTarget = useMemo(() => {
    const target = parseDate(targetDate);
    if (!target) {
      return helperPausePeriods;
    }
    const targetMonthValue = target.getFullYear() * 12 + target.getMonth();
    return helperPausePeriods.
    filter((pausePeriod) => {
      const startMonthValue =
      pausePeriod.startMonth.getFullYear() * 12 + pausePeriod.startMonth.getMonth();
      return startMonthValue <= targetMonthValue;
    }).
    map((pausePeriod) => {
      const endMonthValue =
      pausePeriod.endMonth.getFullYear() * 12 + pausePeriod.endMonth.getMonth();
      if (endMonthValue <= targetMonthValue) {
        return pausePeriod;
      }
      return {
        ...pausePeriod,
        endMonth: new Date(target.getFullYear(), target.getMonth(), 1)
      };
    });
  }, [helperPausePeriods, targetDate]);

  const helperScheduledAdjustments = useMemo(() => {
    const baseMinimum = parseCurrency(minimumPayment);
    const baseExtra = parseCurrency(additionalMonthlyPayment);
    return helperRecurringChanges.
    map((change) => {
      const targetTotal =
      change.kind === "minimum" ? change.amount + baseExtra : baseMinimum + change.amount;
      const baseTotal = baseMinimum + baseExtra;
      const startDate = clampToMonth(
        change.effectiveDate.getFullYear(),
        change.effectiveDate.getMonth(),
        Number(dueDay) || 1
      );
      const endDate = change.endDate ?
      clampToMonth(change.endDate.getFullYear(), change.endDate.getMonth(), Number(dueDay) || 1) :
      undefined;
      return {
        amount: targetTotal - baseTotal,
        endDate,
        startDate
      };
    }).
    sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [additionalMonthlyPayment, dueDay, helperRecurringChanges, minimumPayment]);

  const helperDueDayAdjustments = useMemo(
    () =>
    [...helperDueDayChanges].
    sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()).
    map((change) => ({
      day: change.day,
      endMonth: change.endMonth,
      startMonth: change.startMonth
    })),
    [helperDueDayChanges]
  );

  const assumedResult = useMemo(
    () =>
    buildProjection({
      actualPayments: [],
      startingPrincipal: parseCurrency(deferredStartingPrincipal),
      startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      targetDate: parseDate(deferredTargetDate) ?? new Date(),
      roundDailyInterest,
      scheduledMode: "always"
    }),
    [
    deferredStartingPrincipal,
    deferredStartingPrincipalDate,
    deferredAprPercent,
    dayCountBasis,
    totalMonthlyPayment,
    deferredFirstPaymentDate,
    deferredDueDay,
    moveWeekend,
    deferredTargetDate,
    roundDailyInterest]

  );

  const minimumOnlyToDateProjection = useMemo(
    () =>
    buildProjection({
      actualPayments: [],
      appendAsOfRow: true,
      startingPrincipal: parseCurrency(deferredStartingPrincipal),
      startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(effectiveMinimumPayment),
      firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      targetDate: parseDate(deferredTargetDate) ?? new Date(),
      roundDailyInterest,
      scheduledMode: "always"
    }),
    [
    deferredAprPercent,
    dayCountBasis,
    deferredDueDay,
    deferredFirstPaymentDate,
    effectiveMinimumPayment,
    moveWeekend,
    roundDailyInterest,
    deferredStartingPrincipal,
    deferredStartingPrincipalDate,
    deferredTargetDate]

  );

  const amortizationTargetDate = useMemo(() => {
    const start = parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredTargetDate]);

  const fullLoanTargetDate = useMemo(() => {
    const start = parseDate(deferredStartingPrincipalDate) ?? parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredStartingPrincipalDate, deferredTargetDate]);

  const assumedCurrentPlanProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0
      };
    }

    return buildProjection({
      actualPayments: [],
      startingPrincipal: assumedResult.currentPrincipal,
      startingInterest: assumedResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        firstPaymentDate: firstPayment,
        moveWeekend
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      targetDate: amortizationTargetDate,
      roundDailyInterest,
      scheduledMode: "always"
    });
  }, [
  amortizationTargetDate,
  deferredAprPercent,
  assumedResult.currentInterest,
  assumedResult.currentPrincipal,
  dayCountBasis,
  deferredDueDay,
  deferredFirstPaymentDate,
  moveWeekend,
  roundDailyInterest,
  deferredTargetDate,
  totalMonthlyPayment]
  );

  const amortizationProjection = assumedCurrentPlanProjection;

  const minimumOnlyFullProjection = useMemo(
    () =>
    buildProjection({
      actualPayments: [],
      startingPrincipal: parseCurrency(deferredStartingPrincipal),
      startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(effectiveMinimumPayment),
      firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      targetDate: fullLoanTargetDate,
      roundDailyInterest,
      scheduledMode: "always"
    }),
    [
    deferredAprPercent,
    dayCountBasis,
    deferredDueDay,
    deferredFirstPaymentDate,
    fullLoanTargetDate,
    effectiveMinimumPayment,
    moveWeekend,
    roundDailyInterest,
    deferredStartingPrincipal,
    deferredStartingPrincipalDate]

  );

  const assumedFullProjection = useMemo(
    () =>
    buildProjection({
      actualPayments: [],
      startingPrincipal: parseCurrency(deferredStartingPrincipal),
      startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      targetDate: fullLoanTargetDate,
      roundDailyInterest,
      scheduledMode: "always"
    }),
    [
    deferredAprPercent,
    dayCountBasis,
    deferredDueDay,
    deferredFirstPaymentDate,
    fullLoanTargetDate,
    moveWeekend,
    roundDailyInterest,
    deferredStartingPrincipal,
    deferredStartingPrincipalDate,
    totalMonthlyPayment]

  );

  const historyResult = useMemo(
    () =>
    buildProjection({
      actualPayments: helperPaymentsThroughTarget,
      appendAsOfRow: true,
      startingPrincipal: parseCurrency(deferredStartingPrincipal),
      startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      deletedRowIds: new Set(deletedHelperRowIds),
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      pausePeriods: helperPausePeriodsThroughTarget,
      paymentAmountOverrides: helperPaymentAmountOverrides,
      paymentDateOverrides,
      paymentLabelOverrides,
      scheduledDueDayChanges: helperDueDayAdjustments,
      scheduledPaymentAdjustments: helperScheduledAdjustments,
      targetDate: parseDate(deferredTargetDate) ?? new Date(),
      roundDailyInterest,
      scheduledMode: "always"
    }),
    [
    deferredAprPercent,
    dayCountBasis,
    deletedHelperRowIds,
    deferredDueDay,
    deferredFirstPaymentDate,
    helperPaymentAmountOverrides,
    helperPaymentsThroughTarget,
    helperDueDayAdjustments,
    moveWeekend,
    paymentDateOverrides,
    paymentLabelOverrides,
    helperPausePeriodsThroughTarget,
    helperScheduledAdjustments,
    roundDailyInterest,
    deferredStartingPrincipal,
    deferredStartingPrincipalDate,
    deferredTargetDate,
    totalMonthlyPayment]

  );

  const helperAmortizationTargetDate = useMemo(() => {
    const start = parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredTargetDate]);

  const helperProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0
      };
    }

    return buildProjection({
      actualPayments: helperVisiblePayments.filter((payment) => payment.date > target),
      appendAsOfRow: false,
      startingPrincipal: historyResult.currentPrincipal,
      startingInterest: historyResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        dueDayChanges: helperDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      paymentLabelOverrides,
      scheduledDueDayChanges: helperDueDayAdjustments,
      scheduledPaymentAdjustments: helperScheduledAdjustments,
      targetDate: helperAmortizationTargetDate,
      roundDailyInterest,
      scheduledMode: "always"
    });
  }, [
  deferredAprPercent,
  deferredDueDay,
  deferredFirstPaymentDate,
  helperAmortizationTargetDate,
  helperVisiblePayments,
  historyResult.currentInterest,
  historyResult.currentPrincipal,
  minimumPayment,
  moveWeekend,
  paymentLabelOverrides,
  helperDueDayAdjustments,
  helperScheduledAdjustments,
  helperVisiblePayments,
  roundDailyInterest,
  deferredTargetDate,
  totalMonthlyPayment,
  dayCountBasis]
  );

  const helperCurrentPlanProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0
      };
    }

    return buildProjection({
      actualPayments: helperVisiblePayments.filter((payment) => payment.date > target),
      appendAsOfRow: false,
      startingPrincipal: historyResult.currentPrincipal,
      startingInterest: historyResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        dueDayChanges: helperDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      paymentLabelOverrides,
      scheduledDueDayChanges: helperDueDayAdjustments,
      scheduledPaymentAdjustments: helperScheduledAdjustments,
      targetDate: helperAmortizationTargetDate,
      roundDailyInterest,
      scheduledMode: "always"
    });
  }, [
  deferredAprPercent,
  dayCountBasis,
  deferredDueDay,
  deferredFirstPaymentDate,
  helperAmortizationTargetDate,
  helperVisiblePayments,
  historyResult.currentInterest,
  historyResult.currentPrincipal,
  moveWeekend,
  paymentLabelOverrides,
  helperDueDayAdjustments,
  helperScheduledAdjustments,
  roundDailyInterest,
  deferredTargetDate,
  totalMonthlyPayment]
  );

  const whatIfTargetDate = useMemo(() => {
    const start = parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredTargetDate]);

  const nextPaymentDate = useMemo(() => {
    const firstPayment = parseDate(deferredFirstPaymentDate);
    const anchorDate = parseDate(deferredTargetDate);
    const numericDueDay = Number(deferredDueDay) || 0;
    if (!firstPayment || !anchorDate || numericDueDay < 1 || numericDueDay > 31) {
      return "-";
    }
    return toDateInputValue(
      getNextScheduledPaymentDate({
        afterDate: anchorDate,
        dueDay: numericDueDay,
        dueDayChanges:
        activeView === "whatif" ?
        whatIfDueDayChanges.map((change) => ({ day: change.day, endMonth: change.endMonth, startMonth: change.startMonth })) :
        helperDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend
      })
    );
  }, [activeView, deferredDueDay, deferredFirstPaymentDate, helperDueDayAdjustments, moveWeekend, deferredTargetDate, whatIfDueDayChanges]);

  const whatIfAllPayments = useMemo(
    () => [...whatIfPayments].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [whatIfPayments]
  );

  const whatIfRecurringAdjustments = useMemo(() => {
    const baseMinimum = parseCurrency(effectiveMinimumPayment);
    const baseExtra = parseCurrency(deferredAdditionalMonthlyPayment);
    let currentMinimum = baseMinimum;
    let currentExtra = baseExtra;
    let previousTotal = baseMinimum + baseExtra;

    return [...whatIfRecurringChanges].
    sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime()).
    map((change) => {
      if (change.kind === "minimum") {
        currentMinimum = change.amount;
      } else {
        currentExtra = change.amount;
      }
      const nextTotal = currentMinimum + currentExtra;
      const delta = nextTotal - previousTotal;
      previousTotal = nextTotal;
      return {
        amount: delta,
        startDate: change.effectiveDate
      };
    });
  }, [deferredAdditionalMonthlyPayment, effectiveMinimumPayment, whatIfRecurringChanges]);

  const whatIfDueDayAdjustments = useMemo(
    () =>
    [...whatIfDueDayChanges].
    sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()).
    map((change) => ({
      day: change.day,
      endMonth: change.endMonth,
      startMonth: change.startMonth
    })),
    [whatIfDueDayChanges]
  );

  const whatIfProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0
      };
    }

    return buildProjection({
      actualPayments: whatIfAllPayments.
      filter((payment) => payment.date > target).
      sort((a, b) => a.date.getTime() - b.date.getTime()),
      appendAsOfRow: false,
      startingPrincipal: historyResult.currentPrincipal,
      startingInterest: historyResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        dueDayChanges: whatIfDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      pausePeriods: whatIfPausePeriods,
      scheduledDueDayChanges: whatIfDueDayAdjustments,
      scheduledPaymentAdjustments: whatIfRecurringAdjustments,
      targetDate: whatIfTargetDate,
      roundDailyInterest,
      scheduledMode: "always"
    });
  }, [
  deferredAprPercent,
  dayCountBasis,
  deferredDueDay,
  deferredFirstPaymentDate,
  historyResult.currentInterest,
  historyResult.currentPrincipal,
  minimumPayment,
  moveWeekend,
  whatIfPausePeriods,
  whatIfDueDayAdjustments,
  roundDailyInterest,
  deferredTargetDate,
  totalMonthlyPayment,
  whatIfAllPayments,
  whatIfRecurringAdjustments,
  whatIfTargetDate]
  );

  const loanInputsReady = parseCurrency(deferredStartingPrincipal) > 0 && parseCurrency(effectiveMinimumPayment) > 0 && Boolean(parseDate(deferredStartingPrincipalDate)) && Boolean(parseDate(deferredFirstPaymentDate));
  const historyErrors = loanInputsReady ? [...historyResult.errors] : [];

  const assumedInterestSaved =
  minimumOnlyFullProjection.totalInterestPaid - assumedFullProjection.totalInterestPaid;
  const minimumOnlyLifetimeInterest = minimumOnlyFullProjection.totalInterestPaid;

  const assumedInterestSavedAsOfToday =
  minimumOnlyToDateProjection.totalInterestPaid - assumedResult.totalInterestPaid;

  const assumedInterestSavedFromTodayForward =
  assumedInterestSaved - assumedInterestSavedAsOfToday;

  const helperInterestSavedAsOfToday =
  minimumOnlyToDateProjection.totalInterestPaid - historyResult.totalInterestPaid;

  const helperInterestSavedOverall =
  minimumOnlyFullProjection.totalInterestPaid - (
  historyResult.totalInterestPaid + helperCurrentPlanProjection.totalInterestPaid);

  const helperInterestSavedFromTodayForward =
  helperInterestSavedOverall - helperInterestSavedAsOfToday;

  const assumedInterestStillOwedWithAdditional = Math.max(
    0,
    assumedFullProjection.totalInterestPaid - assumedResult.totalInterestPaid
  );

  const helperTotalExpectedInterestPaidIncludingAdditional =
  historyResult.totalInterestPaid + helperCurrentPlanProjection.totalInterestPaid;

  const whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly =
  historyResult.totalInterestPaid + helperCurrentPlanProjection.totalInterestPaid;

  const whatIfTotalExpectedInterestPaidIncludingAnticipated =
  historyResult.totalInterestPaid + whatIfProjection.totalInterestPaid;

  const whatIfHasProjectedExtras =
  whatIfPayments.length > 0 || whatIfRecurringChanges.length > 0 || whatIfPausePeriods.length > 0 || whatIfDueDayChanges.length > 0;

  const assumedScenarioLifetimeInterest = assumedResult.totalInterestPaid + assumedCurrentPlanProjection.totalInterestPaid;
  const assumedScenarioLifetimeSaved = minimumOnlyLifetimeInterest - assumedScenarioLifetimeInterest;
  const assumedScenarioRemainingInterest = assumedInterestStillOwedWithAdditional;
  const assumedScenarioRemainingSaved = assumedInterestSavedFromTodayForward;

  const helperScenarioLifetimeInterest = helperTotalExpectedInterestPaidIncludingAdditional;
  const helperScenarioLifetimeSaved = minimumOnlyLifetimeInterest - helperScenarioLifetimeInterest;
  const helperScenarioRemainingInterest = helperCurrentPlanProjection.totalInterestPaid;
  const helperScenarioRemainingSaved = helperInterestSavedFromTodayForward;

  const minimumOnlyRemainingInterest = Math.max(
    0,
    minimumOnlyFullProjection.totalInterestPaid - minimumOnlyToDateProjection.totalInterestPaid
  );
  const whatIfBaseRemainingInterest = helperCurrentPlanProjection.totalInterestPaid;
  const whatIfBaseLifetimeInterest = whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly;
  const whatIfProjectedExtrasSavedRemaining = minimumOnlyRemainingInterest - whatIfProjection.totalInterestPaid;
  const whatIfScenarioRemainingInterest = whatIfHasProjectedExtras ?
  whatIfProjection.totalInterestPaid :
  whatIfBaseRemainingInterest;
  const whatIfScenarioLifetimeInterest = whatIfHasProjectedExtras ?
  whatIfTotalExpectedInterestPaidIncludingAnticipated :
  whatIfBaseLifetimeInterest;
  const whatIfScenarioSaved = minimumOnlyLifetimeInterest - whatIfScenarioLifetimeInterest;
  const startingPrincipalAmount = parseCurrency(deferredStartingPrincipal);
  const assumedPayoffPercent =
  startingPrincipalAmount > 0 ? Math.min(100, assumedResult.totalPrincipalPaid / startingPrincipalAmount * 100) : 0;
  const historyPayoffPercent =
  startingPrincipalAmount > 0 ? Math.min(100, historyResult.totalPrincipalPaid / startingPrincipalAmount * 100) : 0;
  const activePayoffPercent =
  activeView === "assumed" ? assumedPayoffPercent : historyPayoffPercent;
  const activeProjectedPayoffDate =
  activeView === "assumed" ?
  assumedCurrentPlanProjection.payoffDate :
  activeView === "history" ?
  helperCurrentPlanProjection.payoffDate :
  whatIfProjection.payoffDate;
  const canShowAssumedSchedule =
  Boolean(parseDate(deferredStartingPrincipalDate)) && Boolean(parseDate(deferredFirstPaymentDate));
  const baselinePayoffDate = minimumOnlyFullProjection.payoffDate;
  const activeAsOfDate = parseDate(deferredTargetDate);
  const projectedScenarioPrincipalForDailyCost =
  activeView === "whatif" ?
  whatIfProjection.rows.find((row) => row.principalPaid > 0)?.endingPrincipal ?? historyResult.currentPrincipal :
  activeView === "assumed" ?
  assumedResult.currentPrincipal :
  historyResult.currentPrincipal;
  const activeInterestStartDate = activeAsOfDate ?? new Date();
  const activeInterestEndDate = new Date(activeInterestStartDate);
  activeInterestEndDate.setDate(activeInterestEndDate.getDate() + 1);
  const activeDailyInterestCost = accrueInterest({
    aprPercent: Number(deferredAprPercent) || 0,
    dayCountBasis,
    endDate: activeInterestEndDate,
    principal: projectedScenarioPrincipalForDailyCost,
    roundDailyInterest,
    startDate: activeInterestStartDate
  });
  const activePayoffDuration = formatDurationToPayoff(activeProjectedPayoffDate, activeAsOfDate);
  const baselinePayoffDeltaMonths =
  activeProjectedPayoffDate && baselinePayoffDate ?
  (baselinePayoffDate.getFullYear() - activeProjectedPayoffDate.getFullYear()) * 12 + (
  baselinePayoffDate.getMonth() - activeProjectedPayoffDate.getMonth()) :
  0;
  const activeTimeSavedLabel =
  baselinePayoffDate && activeProjectedPayoffDate ?
  formatTimeShaved(baselinePayoffDeltaMonths) :
  "-";
  const assumedReferenceRow = [...assumedResult.rows].reverse().find((row) => row.paymentAmount > 0) ?? null;
  const historyReferenceRow = [...historyResult.rows].reverse().find((row) => row.paymentAmount > 0) ?? null;
  const whatIfReferenceRow = whatIfProjection.rows.find((row) => row.paymentAmount > 0) ?? null;
  const activeReferenceRow =
  activeView === "assumed" ? assumedReferenceRow : activeView === "history" ? historyReferenceRow : whatIfReferenceRow;
  const activePrincipalShare = activeReferenceRow?.principalShareOfPayment ?? null;
  const activeInterestShare = activeReferenceRow?.paymentAmount ?
  activeReferenceRow.interestPaid / activeReferenceRow.paymentAmount :
  null;
  const softDangerMessage =
  activeReferenceRow?.negativeAmortization ?
  null :
  activeInterestShare !== null && activeInterestShare >= 0.7 ?
  "Most of your payment is going to interest." :
  activePrincipalShare !== null && activePrincipalShare < 0.3 ?
  "Only a small share of this payment is reaching principal." :
  null;
  const whatIfDeltaInterest = whatIfBaseLifetimeInterest - whatIfScenarioLifetimeInterest;
  const whatIfBaselinePayoffDate = helperCurrentPlanProjection.payoffDate;
  const whatIfDeltaMonths =
  whatIfProjection.payoffDate && whatIfBaselinePayoffDate ?
  (whatIfBaselinePayoffDate.getFullYear() - whatIfProjection.payoffDate.getFullYear()) * 12 + (
  whatIfBaselinePayoffDate.getMonth() - whatIfProjection.payoffDate.getMonth()) :
  0;
  const whatIfTimeChangeLabel =
  whatIfProjection.payoffDate && whatIfBaselinePayoffDate ?
  formatTimeShaved(whatIfDeltaMonths) :
  "-";
  const assumedLifetimeSavedTone =
  assumedScenarioLifetimeSaved > 0 ? "positive" : assumedScenarioLifetimeSaved < 0 ? "negative" : "default";
  const helperLifetimeSavedTone =
  helperScenarioLifetimeSaved > 0 ? "positive" : helperScenarioLifetimeSaved < 0 ? "negative" : "default";
  const whatIfLifetimeSavedTone =
  whatIfScenarioSaved > 0 ? "positive" : whatIfScenarioSaved < 0 ? "negative" : "default";
  const assumedRemainingInterestNotes = [2];
  const assumedRemainingSavedNotes = [1, 2];
  const assumedLifetimeSavedNotes = [1, 2];
  const helperRemainingInterestNotes = [2];
  const helperRemainingSavedNotes = [1, 2];
  const helperLifetimeSavedNotes = [1, 2];
  const whatIfRemainingInterestNotes: number[] = [];
  const whatIfAdditionalSavedNotes = [1];
  const whatIfLifetimeSavedNotes = [1, 2];
  const footnote2Text = "2. Assumes you keep paying your minimum payment plus monthly extra payment.";
  const assumedHasNegativeAmortization =
  assumedResult.hasNegativeAmortization || assumedCurrentPlanProjection.hasNegativeAmortization;
  const historyHasNegativeAmortization =
  historyResult.hasNegativeAmortization || helperProjection.hasNegativeAmortization;
  const whatIfHasNegativeAmortization = whatIfProjection.hasNegativeAmortization;
  const negativeAmortizationWarning =
  activeView === "assumed" ?
  assumedHasNegativeAmortization :
  activeView === "history" ?
  historyHasNegativeAmortization :
  whatIfHasNegativeAmortization;
  const startingPrincipalDateValue = parseDate(startingPrincipalDate);
  const minimumTargetDate = startingPrincipalDateValue && compareDateOnly(startingPrincipalDateValue, todayDate) > 0 ?
  startingPrincipalDateValue :
  todayDate;
  const targetDateMinValue = toDateInputValue(minimumTargetDate);
  const helperMaxMonthValue = todayValue.slice(0, 7);
  const whatIfMinimumPaymentDate = parseDate(targetDate);
  const whatIfMinDate = whatIfMinimumPaymentDate && compareDateOnly(whatIfMinimumPaymentDate, todayDate) > 0 ?
  whatIfMinimumPaymentDate :
  todayDate;
  const whatIfMinDateValue = toDateInputValue(whatIfMinDate);

  return { helperVisiblePayments, helperPaymentsThroughTarget, helperPausePeriodsThroughTarget, helperScheduledAdjustments, helperDueDayAdjustments, assumedResult, minimumOnlyToDateProjection, amortizationTargetDate, fullLoanTargetDate, assumedCurrentPlanProjection, amortizationProjection, minimumOnlyFullProjection, assumedFullProjection, historyResult, helperAmortizationTargetDate, helperProjection, helperCurrentPlanProjection, whatIfTargetDate, nextPaymentDate, whatIfAllPayments, whatIfRecurringAdjustments, whatIfDueDayAdjustments, whatIfProjection, loanInputsReady, historyErrors, assumedInterestSaved, minimumOnlyLifetimeInterest, assumedInterestSavedAsOfToday, assumedInterestSavedFromTodayForward, helperInterestSavedAsOfToday, helperInterestSavedOverall, helperInterestSavedFromTodayForward, assumedInterestStillOwedWithAdditional, helperTotalExpectedInterestPaidIncludingAdditional, whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly, whatIfTotalExpectedInterestPaidIncludingAnticipated, whatIfHasProjectedExtras, assumedScenarioLifetimeInterest, assumedScenarioLifetimeSaved, assumedScenarioRemainingInterest, assumedScenarioRemainingSaved, helperScenarioLifetimeInterest, helperScenarioLifetimeSaved, helperScenarioRemainingInterest, helperScenarioRemainingSaved, minimumOnlyRemainingInterest, whatIfBaseRemainingInterest, whatIfBaseLifetimeInterest, whatIfProjectedExtrasSavedRemaining, whatIfScenarioRemainingInterest, whatIfScenarioLifetimeInterest, whatIfScenarioSaved, startingPrincipalAmount, assumedPayoffPercent, historyPayoffPercent, activePayoffPercent, activeProjectedPayoffDate, canShowAssumedSchedule, baselinePayoffDate, activeAsOfDate, projectedScenarioPrincipalForDailyCost, activeInterestStartDate, activeInterestEndDate, activeDailyInterestCost, activePayoffDuration, baselinePayoffDeltaMonths, activeTimeSavedLabel, assumedReferenceRow, historyReferenceRow, whatIfReferenceRow, activeReferenceRow, activePrincipalShare, activeInterestShare, softDangerMessage, whatIfDeltaInterest, whatIfBaselinePayoffDate, whatIfDeltaMonths, whatIfTimeChangeLabel, assumedLifetimeSavedTone, helperLifetimeSavedTone, whatIfLifetimeSavedTone, assumedRemainingInterestNotes, assumedRemainingSavedNotes, assumedLifetimeSavedNotes, helperRemainingInterestNotes, helperRemainingSavedNotes, helperLifetimeSavedNotes, whatIfRemainingInterestNotes, whatIfAdditionalSavedNotes, whatIfLifetimeSavedNotes, footnote2Text, assumedHasNegativeAmortization, historyHasNegativeAmortization, whatIfHasNegativeAmortization, negativeAmortizationWarning, startingPrincipalDateValue, minimumTargetDate, targetDateMinValue, helperMaxMonthValue, whatIfMinimumPaymentDate, whatIfMinDate, whatIfMinDateValue };
}
