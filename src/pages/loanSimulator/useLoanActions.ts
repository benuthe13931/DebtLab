// @ts-nocheck
import type { LoanSimulatorRuntime } from "../../types/loanSimulatorRuntime";
import { parseCurrency } from "../../utils/currency";
import { compareDateOnly, monthValue, parseMonthInput } from "../../utils/date";
import { clampToMonth, parseDate, toDateInputValue } from "../../calculations/loans/dateUtils";

function pausePeriodsOverlap(left: { startMonth: Date; endMonth: Date }, right: { startMonth: Date; endMonth: Date }) {
  return left.startMonth <= right.endMonth && right.startMonth <= left.endMonth;
}

export function useLoanActions(context: LoanSimulatorRuntime) {
  const { userProfiles, setUserProfiles, currentUserId, setCurrentUserId, authMode, setAuthMode, authName, setAuthName, authDisplayName, setAuthDisplayName, authPassword, setAuthPassword, authError, setAuthError, activePage, setActivePage, activeLoanTab, setActiveLoanTab, loanSidebarCollapsed, setLoanSidebarCollapsed, profileMenuOpen, setProfileMenuOpen, deleteAccountConfirmOpen, setDeleteAccountConfirmOpen, profileMenuRef, profileDraftName, setProfileDraftName, profileDraftEmail, setProfileDraftEmail, profileStatus, setProfileStatus, passwordResetCodeInput, setPasswordResetCodeInput, passwordResetNewPassword, setPasswordResetNewPassword, passwordResetConfirmPassword, setPasswordResetConfirmPassword, savedLoans, setSavedLoans, currentLoanId, setCurrentLoanId, saveStatus, setSaveStatus, loanName, setLoanName, accountType, setAccountType, promoType, setPromoType, promoEndDate, setPromoEndDate, cardMinimumMode, setCardMinimumMode, cardMinimumPercent, setCardMinimumPercent, cardMinimumFloor, setCardMinimumFloor, postPromoMinimumMode, setPostPromoMinimumMode, postPromoMinimumPercent, setPostPromoMinimumPercent, postPromoMinimumFloor, setPostPromoMinimumFloor, postPromoFixedMinimum, setPostPromoFixedMinimum, cardStatementDate, setCardStatementDate, creditCardTransactions, setCreditCardTransactions, startingPrincipal, setStartingPrincipal, startingPrincipalDate, setStartingPrincipalDate, firstPaymentDate, setFirstPaymentDate, minimumPayment, setMinimumPayment, additionalMonthlyPayment, setAdditionalMonthlyPayment, aprPercent, setAprPercent, dueDay, setDueDay, targetDate, setTargetDate, moveWeekend, setMoveWeekend, roundDailyInterest, setRoundDailyInterest, dayCountBasis, setDayCountBasis, activeView, setActiveView, showAmortization, setShowAmortization, showHelperAmortization, setShowHelperAmortization, oneOffPayments, setOneOffPayments, newOneOffDate, setNewOneOffDate, newOneOffAmount, setNewOneOffAmount, newOneOffLabel, setNewOneOffLabel, helperPausePeriods, setHelperPausePeriods, helperPauseFromMonth, setHelperPauseFromMonth, helperPauseToMonth, setHelperPauseToMonth, helperPauseMode, setHelperPauseMode, helperBulkMode, setHelperBulkMode, helperAdjustmentFromMonth, setHelperAdjustmentFromMonth, helperAdjustmentToMonth, setHelperAdjustmentToMonth, helperAdjustmentAmount, setHelperAdjustmentAmount, helperRecurringChanges, setHelperRecurringChanges, helperDueDayChanges, setHelperDueDayChanges, helperAdjustmentDueDay, setHelperAdjustmentDueDay, deletedHelperRowIds, setDeletedHelperRowIds, helperActionError, setHelperActionError, helperPaymentAmountOverrides, setHelperPaymentAmountOverrides, paymentDateOverrides, setPaymentDateOverrides, paymentLabelOverrides, setPaymentLabelOverrides, editingPaymentId, setEditingPaymentId, editingPaymentDate, setEditingPaymentDate, editingPaymentAmount, setEditingPaymentAmount, editingPaymentLabel, setEditingPaymentLabel, whatIfPayments, setWhatIfPayments, whatIfRecurringChanges, setWhatIfRecurringChanges, whatIfPausePeriods, setWhatIfPausePeriods, whatIfEntryMode, setWhatIfEntryMode, newWhatIfDate, setNewWhatIfDate, newWhatIfAmount, setNewWhatIfAmount, newWhatIfLabel, setNewWhatIfLabel, whatIfAdjustmentDate, setWhatIfAdjustmentDate, whatIfAdjustmentEndDate, setWhatIfAdjustmentEndDate, whatIfAdjustmentAmount, setWhatIfAdjustmentAmount, whatIfAdjustmentDueDay, setWhatIfAdjustmentDueDay, whatIfDueDayChanges, setWhatIfDueDayChanges, whatIfPauseFromMonth, setWhatIfPauseFromMonth, whatIfPauseToMonth, setWhatIfPauseToMonth, whatIfPauseMode, setWhatIfPauseMode, whatIfActionError, setWhatIfActionError, showHistoricalDetails, setShowHistoricalDetails, showFutureDetails, setShowFutureDetails, showLifetimeDetails, setShowLifetimeDetails, showComparisonDetails, setShowComparisonDetails, cardScheduleStart, cardScheduleFirstPayment, cardScheduleTarget, deferredStartingPrincipal, deferredStartingPrincipalDate, deferredFirstPaymentDate, deferredMinimumPayment, deferredAdditionalMonthlyPayment, deferredAprPercent, deferredDueDay, deferredTargetDate, cardMinimumPayment, cardProjectionNudge, effectiveMinimumPayment, totalMonthlyPayment, buildProjection, todayDate, todayValue, getSavedLoansStorageKey, currentUser, currentTheme, displayName, firstName, profileInitial, serializePaymentEvent, deserializePaymentEvent, serializeRecurringChange, deserializeRecurringChange, serializePausePeriod, deserializePausePeriod, serializeDueDayChange, deserializeDueDayChange, applyLoanSnapshot, buildLoanSnapshot, loadLoansForUser, persistSavedLoans, persistUserProfiles, updateCurrentUserProfile, loginUser, handleAuthSubmit, logoutUser, deleteCurrentUserProfile, saveProfileDetails, applyThemeToProfile, sendPasswordResetEmail, applyPasswordReset, saveCurrentLoan, startNewLoan, loadSavedLoan, deleteLoan, projectionContext, helperVisiblePayments, helperPaymentsThroughTarget, helperPausePeriodsThroughTarget, helperScheduledAdjustments, helperDueDayAdjustments, assumedResult, minimumOnlyToDateProjection, amortizationTargetDate, fullLoanTargetDate, assumedCurrentPlanProjection, amortizationProjection, minimumOnlyFullProjection, assumedFullProjection, historyResult, helperAmortizationTargetDate, helperProjection, helperCurrentPlanProjection, whatIfTargetDate, nextPaymentDate, whatIfAllPayments, whatIfRecurringAdjustments, whatIfDueDayAdjustments, whatIfProjection, loanInputsReady, historyErrors, assumedInterestSaved, minimumOnlyLifetimeInterest, assumedInterestSavedAsOfToday, assumedInterestSavedFromTodayForward, helperInterestSavedAsOfToday, helperInterestSavedOverall, helperInterestSavedFromTodayForward, assumedInterestStillOwedWithAdditional, helperTotalExpectedInterestPaidIncludingAdditional, whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly, whatIfTotalExpectedInterestPaidIncludingAnticipated, whatIfHasProjectedExtras, assumedScenarioLifetimeInterest, assumedScenarioLifetimeSaved, assumedScenarioRemainingInterest, assumedScenarioRemainingSaved, helperScenarioLifetimeInterest, helperScenarioLifetimeSaved, helperScenarioRemainingInterest, helperScenarioRemainingSaved, minimumOnlyRemainingInterest, whatIfBaseRemainingInterest, whatIfBaseLifetimeInterest, whatIfProjectedExtrasSavedRemaining, whatIfScenarioRemainingInterest, whatIfScenarioLifetimeInterest, whatIfScenarioSaved, startingPrincipalAmount, assumedPayoffPercent, historyPayoffPercent, activePayoffPercent, activeProjectedPayoffDate, canShowAssumedSchedule, baselinePayoffDate, activeAsOfDate, projectedScenarioPrincipalForDailyCost, activeInterestStartDate, activeInterestEndDate, activeDailyInterestCost, activePayoffDuration, baselinePayoffDeltaMonths, activeTimeSavedLabel, assumedReferenceRow, historyReferenceRow, whatIfReferenceRow, activeReferenceRow, activePrincipalShare, activeInterestShare, softDangerMessage, whatIfDeltaInterest, whatIfBaselinePayoffDate, whatIfDeltaMonths, whatIfTimeChangeLabel, assumedLifetimeSavedTone, helperLifetimeSavedTone, whatIfLifetimeSavedTone, assumedRemainingInterestNotes, assumedRemainingSavedNotes, assumedLifetimeSavedNotes, helperRemainingInterestNotes, helperRemainingSavedNotes, helperLifetimeSavedNotes, whatIfRemainingInterestNotes, whatIfAdditionalSavedNotes, whatIfLifetimeSavedNotes, footnote2Text, assumedHasNegativeAmortization, historyHasNegativeAmortization, whatIfHasNegativeAmortization, negativeAmortizationWarning, startingPrincipalDateValue, minimumTargetDate, targetDateMinValue, helperMaxMonthValue, whatIfMinimumPaymentDate, whatIfMinDate, whatIfMinDateValue } = context;
  const addHelperPausePeriod = () => {
    const startMonth = parseMonthInput(helperPauseFromMonth);
    const endMonth = parseMonthInput(helperPauseToMonth);
    if (!startMonth || !endMonth || endMonth < startMonth) {
      setHelperActionError("Choose a valid pause range.");
      return;
    }

    const nextPausePeriod: PausePeriod = {
      endMonth,
      id: `helper-pause-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mode: helperPauseMode,
      startMonth,
    };
    const hasOverlap = helperPausePeriods.some((pausePeriod) => pausePeriodsOverlap(pausePeriod, nextPausePeriod));
    if (hasOverlap) {
      setHelperActionError("A payment is already paused in that date range.");
      return;
    }

    setHelperPausePeriods((current) =>
      [
        ...current,
        nextPausePeriod,
      ].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()),
    );
    setHelperActionError("");
    setHelperPauseFromMonth("");
    setHelperPauseToMonth("");
    setHelperPauseMode("accrues");
  };

  const deleteHelperPausePeriod = (pauseId: string) => {
    setHelperPausePeriods((current) => current.filter((pausePeriod) => pausePeriod.id !== pauseId));
  };

  const addHelperBulkAdjustment = () => {
    if (helperBulkMode === "pause") {
      addHelperPausePeriod();
      return;
    }

    if (helperBulkMode === "due-day") {
      const startMonth = parseMonthInput(helperAdjustmentFromMonth);
      const endMonth = parseMonthInput(helperAdjustmentToMonth);
      const day = Number(helperAdjustmentDueDay);
      if (!startMonth || (helperAdjustmentToMonth && !endMonth) || (endMonth && endMonth < startMonth) || day < 1 || day > 31) {
        setHelperActionError("Choose a valid due day and month range.");
        return;
      }
      const nextChange: DueDayChange = {
        day,
        endMonth: endMonth ?? undefined,
        id: `helper-due-day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startMonth,
      };
      setHelperDueDayChanges((current) => [...current, nextChange].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()));
      setHelperActionError("");
      setHelperAdjustmentFromMonth("");
      setHelperAdjustmentToMonth("");
      setHelperAdjustmentDueDay("");
      return;
    }

    const startMonth = parseMonthInput(helperAdjustmentFromMonth);
    const endMonth = parseMonthInput(helperAdjustmentToMonth);
    const amount = parseCurrency(helperAdjustmentAmount);
    if (!startMonth || !endMonth || endMonth < startMonth || amount < 0) {
      return;
    }

    setHelperRecurringChanges((current) =>
      [
        ...current,
        {
          amount,
          effectiveDate: startMonth,
          endDate: endMonth,
          id: `helper-adjust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind: helperBulkMode,
        },
      ].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime()),
    );
    setHelperAdjustmentFromMonth("");
    setHelperAdjustmentToMonth("");
    setHelperAdjustmentAmount("");
  };

  const deleteHelperRecurringChange = (changeId: string) => {
    setHelperRecurringChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const deleteHelperDueDayChange = (changeId: string) => {
    setHelperDueDayChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const addOneOffPayment = () => {
    const date = parseDate(newOneOffDate);
    const amount = parseCurrency(newOneOffAmount);
    if (!date || amount <= 0) {
      setHelperActionError("Enter a valid payment date and amount.");
      return;
    }
    if (compareDateOnly(date, todayDate) > 0) {
      setHelperActionError("Payment dates cannot be in the future.");
      return;
    }

    const newPayment: PaymentEvent = {
      amount,
      date,
      id: `oneoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: newOneOffLabel.trim() || "Extra payment",
      source: "extra",
    };

    setOneOffPayments((current) =>
      [...current, newPayment].sort((a, b) => a.date.getTime() - b.date.getTime()),
    );
    setHelperActionError("");
    setNewOneOffDate("");
    setNewOneOffAmount("");
    setNewOneOffLabel("Extra payment");
  };

  const startEditingReplayRow = (row: ScheduleRow) => {
    setEditingPaymentId(row.rowId);
    setEditingPaymentDate(toDateInputValue(row.paymentDate));
    setEditingPaymentAmount(row.paymentAmount.toFixed(2));
    setEditingPaymentLabel(row.label);
  };

  const saveEditedPayment = () => {
    const parsed = parseDate(editingPaymentDate);
    const parsedAmount = parseCurrency(editingPaymentAmount);
    if (!parsed || !editingPaymentId || !(parsedAmount > 0)) {
      setHelperActionError("Enter a valid edited payment date and amount.");
      return;
    }
    if (compareDateOnly(parsed, todayDate) > 0) {
      setHelperActionError("Payment dates cannot be in the future.");
      return;
    }

    setPaymentDateOverrides((current) => ({
      ...current,
      [editingPaymentId]: toDateInputValue(parsed),
    }));
    setHelperPaymentAmountOverrides((current) => ({
      ...current,
      [editingPaymentId]: parsedAmount.toFixed(2),
    }));
    setPaymentLabelOverrides((current) => {
      const trimmed = editingPaymentLabel.trim();
      if (!trimmed) {
        const next = { ...current };
        delete next[editingPaymentId];
        return next;
      }
      return {
        ...current,
        [editingPaymentId]: trimmed,
      };
    });

    setHelperActionError("");
    setEditingPaymentId("");
    setEditingPaymentDate("");
    setEditingPaymentAmount("");
    setEditingPaymentLabel("");
  };

  const cancelEditingPayment = () => {
    setEditingPaymentId("");
    setEditingPaymentDate("");
    setEditingPaymentAmount("");
    setEditingPaymentLabel("");
  };

  const deleteHelperRow = (rowId: string) => {
    setDeletedHelperRowIds((current) => (current.includes(rowId) ? current : [...current, rowId]));
    if (editingPaymentId === rowId) {
      cancelEditingPayment();
    }
  };

  const addWhatIfPayment = () => {
    if (whatIfEntryMode === "pause") {
      const startMonth = parseMonthInput(whatIfPauseFromMonth);
      const endMonth = parseMonthInput(whatIfPauseToMonth);
      if (!startMonth || !endMonth || endMonth < startMonth) {
        setWhatIfActionError("Choose a valid pause range.");
        return;
      }
      const nextPausePeriod: PausePeriod = {
        endMonth,
        id: `whatif-pause-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: whatIfPauseMode,
        startMonth,
      };
      const hasOverlap = whatIfPausePeriods.some((pausePeriod) => pausePeriodsOverlap(pausePeriod, nextPausePeriod));
      if (hasOverlap) {
        setWhatIfActionError("A payment is already paused in that date range.");
        return;
      }
      setWhatIfPausePeriods((current) =>
        [
          ...current,
          nextPausePeriod,
        ].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()),
      );
      setWhatIfActionError("");
      setWhatIfPauseFromMonth("");
      setWhatIfPauseToMonth("");
      setWhatIfPauseMode("accrues");
      return;
    }

    if (whatIfEntryMode === "due-day") {
      const startMonth = parseMonthInput(whatIfAdjustmentDate);
      const endMonth = parseMonthInput(whatIfAdjustmentEndDate);
      const day = Number(whatIfAdjustmentDueDay);
      const currentTarget = parseDate(targetDate);
      if (!startMonth || (whatIfAdjustmentEndDate && !endMonth) || (endMonth && endMonth < startMonth) || day < 1 || day > 31) {
        setWhatIfActionError("Choose a valid due day and month range.");
        return;
      }
      const start = currentTarget ? monthValue(startMonth) : null;
      const currentMonth = currentTarget ? monthValue(new Date(currentTarget.getFullYear(), currentTarget.getMonth(), 1)) : null;
      if (start !== null && currentMonth !== null && start <= currentMonth) {
        setWhatIfActionError("Choose a due-date change that starts after the current baseline month.");
        return;
      }
      setWhatIfDueDayChanges((current) =>
        [
          ...current,
          {
            day,
            endMonth: endMonth ?? undefined,
            id: `whatif-due-day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            startMonth,
          },
        ].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()),
      );
      setWhatIfActionError("");
      setWhatIfAdjustmentDate("");
      setWhatIfAdjustmentEndDate("");
      setWhatIfAdjustmentDueDay("");
      return;
    }

    if (whatIfEntryMode !== "one-time") {
      const startMonth = parseMonthInput(whatIfAdjustmentDate);
      const amount = parseCurrency(whatIfAdjustmentAmount);
      const currentTarget = parseDate(targetDate);
      const start = startMonth
        ? clampToMonth(startMonth.getFullYear(), startMonth.getMonth(), Number(dueDay) || 1)
        : null;
      if (!start || amount <= 0 || (currentTarget && start <= currentTarget)) {
        setWhatIfActionError("Choose a valid future month and amount.");
        return;
      }
      setWhatIfRecurringChanges((current) =>
        [...current, {
          amount,
          effectiveDate: start,
          id: `change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind: (whatIfEntryMode === "minimum" ? "minimum" : "monthly-extra") as "minimum" | "monthly-extra",
        }].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime()),
      );
      setWhatIfActionError("");
      setWhatIfAdjustmentDate("");
      setWhatIfAdjustmentEndDate("");
      setWhatIfAdjustmentAmount("");
      return;
    }

    const date = parseDate(newWhatIfDate);
    const amount = parseCurrency(newWhatIfAmount);
    const currentTarget = parseDate(targetDate);
    if (!date || amount <= 0 || (currentTarget && date <= currentTarget)) {
      setWhatIfActionError("Choose a valid future payment date and amount.");
      return;
    }
    if (compareDateOnly(date, todayDate) < 0) {
      setWhatIfActionError("Future payment dates cannot be before today.");
      return;
    }

    const payment: PaymentEvent = {
      amount,
      date,
      id: `whatif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: newWhatIfLabel.trim() || "Anticipated one-time payment",
      source: "extra",
    };

    setWhatIfPayments((current) =>
      [...current, payment].sort((a, b) => a.date.getTime() - b.date.getTime()),
    );
    setWhatIfActionError("");
    setNewWhatIfDate("");
    setNewWhatIfAmount("");
    setNewWhatIfLabel("Anticipated one-time payment");
  };

  const deleteWhatIfPayment = (paymentId: string) => {
    setWhatIfPayments((current) => current.filter((payment) => payment.id !== paymentId));
  };

  const deleteWhatIfRecurringChange = (changeId: string) => {
    setWhatIfRecurringChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const deleteWhatIfDueDayChange = (changeId: string) => {
    setWhatIfDueDayChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const deleteWhatIfPausePeriod = (pauseId: string) => {
    setWhatIfPausePeriods((current) => current.filter((pausePeriod) => pausePeriod.id !== pauseId));
  };

  const resetHelper = () => {
    setOneOffPayments([]);
    setHelperPausePeriods([]);
    setHelperPauseFromMonth("");
    setHelperPauseToMonth("");
    setHelperPauseMode("accrues");
    setHelperBulkMode("pause");
    setHelperAdjustmentFromMonth("");
    setHelperAdjustmentToMonth("");
    setHelperAdjustmentAmount("");
    setHelperAdjustmentDueDay("");
    setHelperRecurringChanges([]);
    setHelperDueDayChanges([]);
    setDeletedHelperRowIds([]);
    setHelperActionError("");
    setHelperPaymentAmountOverrides({});
    setPaymentDateOverrides({});
    setPaymentLabelOverrides({});
    setEditingPaymentId("");
    setEditingPaymentDate("");
    setEditingPaymentAmount("");
    setNewOneOffDate("");
    setNewOneOffAmount("");
    setNewOneOffLabel("Extra payment");
  };

  const resetWhatIf = () => {
    setWhatIfPayments([]);
    setWhatIfRecurringChanges([]);
    setWhatIfPausePeriods([]);
    setWhatIfEntryMode("one-time");
    setNewWhatIfDate("");
    setNewWhatIfAmount("");
    setNewWhatIfLabel("Anticipated one-time payment");
    setWhatIfAdjustmentDate("");
    setWhatIfAdjustmentEndDate("");
    setWhatIfAdjustmentAmount("");
    setWhatIfAdjustmentDueDay("");
    setWhatIfDueDayChanges([]);
    setWhatIfPauseFromMonth("");
    setWhatIfPauseToMonth("");
    setWhatIfPauseMode("accrues");
    setWhatIfActionError("");
  };

  return { addHelperPausePeriod, deleteHelperPausePeriod, addHelperBulkAdjustment, deleteHelperRecurringChange, deleteHelperDueDayChange, addOneOffPayment, startEditingReplayRow, saveEditedPayment, cancelEditingPayment, deleteHelperRow, addWhatIfPayment, deleteWhatIfPayment, deleteWhatIfRecurringChange, deleteWhatIfDueDayChange, deleteWhatIfPausePeriod, resetHelper, resetWhatIf };
}




