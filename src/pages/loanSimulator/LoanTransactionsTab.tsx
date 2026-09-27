// @ts-nocheck
import type { LoanSimulatorRuntime } from "../../types/loanSimulatorRuntime";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { PaycheckPage } from "../PaycheckPage";
import { DebtOverview } from "../DebtOverviewPage";
import { BudgetPage } from "../BudgetPage";
import { DateField, DatePickerInput, MonthYearField } from "../../components/ui/date-fields";
import { FormSection, SummaryGroupLabel, SummaryValue } from "../../components/ui/summary";
import { LoanSidebar } from "../../components/loans/LoanSidebar";
import { CreditCardActivityEditor } from "../../components/loans/CreditCardActivityEditor";
import { LabelWithNotes, formatPrincipalShare, getEventTypeCode, getEventTypeTitle, getTableRowStyle } from "../../components/loans/schedulePresentation";
import { CurrencyField, CurrencyInput } from "../../components/ui/CurrencyField";
import { Field } from "../../components/ui/Field";
import { LoginPage } from "../LoginPage";
import { estimateSavedLoanBalance, estimateSavedAccountMinimum } from "../../calculations/debt/savedAccount";
import { simulatePortfolio } from "../../calculations/debt/simulatePortfolio";
import { accrueInterest } from "../../calculations/loans/accrueInterest";
import { addMonths, clampToMonth, formatMonth, parseDate, toDateInputValue } from "../../calculations/loans/dateUtils";
import { buildSchedule, getNextScheduledPaymentDate } from "../../calculations/loans/schedule";
import { buildCreditCardSchedule } from "../../calculations/cards/buildCreditCardSchedule";
import {
  cloudStorageEnabled,
  cloudStorageStatus,
  createCloudProfile,
  deleteCloudProfileData,
  getCloudSessionProfile,
  loadCloudLoans,
  loginCloudProfile,
  logoutCloudProfile,
  sendCloudPasswordResetEmail,
  saveCloudLoans,
  saveCloudProfile,
} from "../../lib/cloudStorage";
import type {
  DayCountBasis,
  DueDayChange,
  FutureRecurringChange,
  LoanSnapshot,
  SavedLoanRecord,
  SerializedDueDayChange,
  SerializedFutureRecurringChange,
  SerializedPausePeriod,
  SerializedPaymentEvent,
  PaymentEvent,
  PauseMode,
  PausePeriod,
  ScheduleRow,
} from "../../types/loans";
import { parseCurrency } from "../../utils/currency";
import { compareDateOnly, monthValue, parseMonthInput, startOfDay } from "../../utils/date";
import { formatCurrency, formatDurationToPayoff, formatMonthYear, formatPauseRange, formatPercent, formatTimeShaved, getDifferenceLabel } from "../../utils/formatting";
import { THEME_DEFINITIONS, type ThemeId } from "../../constants/theme";
import { createBlankLoanSnapshot } from "../../constants/loanDefaults";
import type { UserProfile } from "../../types/profile";
export function LoanTransactionsTab({ runtime }: { runtime: LoanSimulatorRuntime }) {
  const { userProfiles, setUserProfiles, currentUserId, setCurrentUserId, authMode, setAuthMode, authName, setAuthName, authDisplayName, setAuthDisplayName, authPassword, setAuthPassword, authError, setAuthError, activePage, setActivePage, activeLoanTab, setActiveLoanTab, loanSidebarCollapsed, setLoanSidebarCollapsed, profileMenuOpen, setProfileMenuOpen, deleteAccountConfirmOpen, setDeleteAccountConfirmOpen, profileMenuRef, profileDraftName, setProfileDraftName, profileDraftEmail, setProfileDraftEmail, profileStatus, setProfileStatus, passwordResetCodeInput, setPasswordResetCodeInput, passwordResetNewPassword, setPasswordResetNewPassword, passwordResetConfirmPassword, setPasswordResetConfirmPassword, savedLoans, setSavedLoans, currentLoanId, setCurrentLoanId, saveStatus, setSaveStatus, loanName, setLoanName, accountType, setAccountType, promoType, setPromoType, promoEndDate, setPromoEndDate, cardMinimumMode, setCardMinimumMode, cardMinimumPercent, setCardMinimumPercent, cardMinimumFloor, setCardMinimumFloor, postPromoMinimumMode, setPostPromoMinimumMode, postPromoMinimumPercent, setPostPromoMinimumPercent, postPromoMinimumFloor, setPostPromoMinimumFloor, postPromoFixedMinimum, setPostPromoFixedMinimum, cardStatementDate, setCardStatementDate, creditCardTransactions, setCreditCardTransactions, startingPrincipal, setStartingPrincipal, startingPrincipalDate, setStartingPrincipalDate, firstPaymentDate, setFirstPaymentDate, minimumPayment, setMinimumPayment, additionalMonthlyPayment, setAdditionalMonthlyPayment, aprPercent, setAprPercent, dueDay, setDueDay, targetDate, setTargetDate, moveWeekend, setMoveWeekend, roundDailyInterest, setRoundDailyInterest, dayCountBasis, setDayCountBasis, activeView, setActiveView, showAmortization, setShowAmortization, showHelperAmortization, setShowHelperAmortization, oneOffPayments, setOneOffPayments, newOneOffDate, setNewOneOffDate, newOneOffAmount, setNewOneOffAmount, newOneOffLabel, setNewOneOffLabel, helperPausePeriods, setHelperPausePeriods, helperPauseFromMonth, setHelperPauseFromMonth, helperPauseToMonth, setHelperPauseToMonth, helperPauseMode, setHelperPauseMode, helperBulkMode, setHelperBulkMode, helperAdjustmentFromMonth, setHelperAdjustmentFromMonth, helperAdjustmentToMonth, setHelperAdjustmentToMonth, helperAdjustmentAmount, setHelperAdjustmentAmount, helperRecurringChanges, setHelperRecurringChanges, helperDueDayChanges, setHelperDueDayChanges, helperAdjustmentDueDay, setHelperAdjustmentDueDay, deletedHelperRowIds, setDeletedHelperRowIds, helperActionError, setHelperActionError, helperPaymentAmountOverrides, setHelperPaymentAmountOverrides, paymentDateOverrides, setPaymentDateOverrides, paymentLabelOverrides, setPaymentLabelOverrides, editingPaymentId, setEditingPaymentId, editingPaymentDate, setEditingPaymentDate, editingPaymentAmount, setEditingPaymentAmount, editingPaymentLabel, setEditingPaymentLabel, whatIfPayments, setWhatIfPayments, whatIfRecurringChanges, setWhatIfRecurringChanges, whatIfPausePeriods, setWhatIfPausePeriods, whatIfEntryMode, setWhatIfEntryMode, newWhatIfDate, setNewWhatIfDate, newWhatIfAmount, setNewWhatIfAmount, newWhatIfLabel, setNewWhatIfLabel, whatIfAdjustmentDate, setWhatIfAdjustmentDate, whatIfAdjustmentEndDate, setWhatIfAdjustmentEndDate, whatIfAdjustmentAmount, setWhatIfAdjustmentAmount, whatIfAdjustmentDueDay, setWhatIfAdjustmentDueDay, whatIfDueDayChanges, setWhatIfDueDayChanges, whatIfPauseFromMonth, setWhatIfPauseFromMonth, whatIfPauseToMonth, setWhatIfPauseToMonth, whatIfPauseMode, setWhatIfPauseMode, whatIfActionError, setWhatIfActionError, showHistoricalDetails, setShowHistoricalDetails, showFutureDetails, setShowFutureDetails, showLifetimeDetails, setShowLifetimeDetails, showComparisonDetails, setShowComparisonDetails, cardScheduleStart, cardScheduleFirstPayment, cardScheduleTarget, deferredStartingPrincipal, deferredStartingPrincipalDate, deferredFirstPaymentDate, deferredMinimumPayment, deferredAdditionalMonthlyPayment, deferredAprPercent, deferredDueDay, deferredTargetDate, cardMinimumPayment, cardProjectionNudge, effectiveMinimumPayment, totalMonthlyPayment, buildProjection, todayDate, todayValue, getSavedLoansStorageKey, currentUser, currentTheme, displayName, firstName, profileInitial, serializePaymentEvent, deserializePaymentEvent, serializeRecurringChange, deserializeRecurringChange, serializePausePeriod, deserializePausePeriod, serializeDueDayChange, deserializeDueDayChange, applyLoanSnapshot, buildLoanSnapshot, loadLoansForUser, persistSavedLoans, persistUserProfiles, updateCurrentUserProfile, loginUser, handleAuthSubmit, logoutUser, deleteCurrentUserProfile, saveProfileDetails, applyThemeToProfile, sendPasswordResetEmail, applyPasswordReset, saveCurrentLoan, startNewLoan, loadSavedLoan, deleteLoan, helperVisiblePayments, helperPaymentsThroughTarget, helperPausePeriodsThroughTarget, helperScheduledAdjustments, helperDueDayAdjustments, assumedResult, minimumOnlyToDateProjection, amortizationTargetDate, fullLoanTargetDate, assumedCurrentPlanProjection, amortizationProjection, minimumOnlyFullProjection, assumedFullProjection, historyResult, helperAmortizationTargetDate, helperProjection, helperCurrentPlanProjection, whatIfTargetDate, nextPaymentDate, whatIfAllPayments, whatIfRecurringAdjustments, whatIfDueDayAdjustments, whatIfProjection, loanInputsReady, historyErrors, assumedInterestSaved, minimumOnlyLifetimeInterest, assumedInterestSavedAsOfToday, assumedInterestSavedFromTodayForward, helperInterestSavedAsOfToday, helperInterestSavedOverall, helperInterestSavedFromTodayForward, assumedInterestStillOwedWithAdditional, helperTotalExpectedInterestPaidIncludingAdditional, whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly, whatIfTotalExpectedInterestPaidIncludingAnticipated, whatIfHasProjectedExtras, assumedScenarioLifetimeInterest, assumedScenarioLifetimeSaved, assumedScenarioRemainingInterest, assumedScenarioRemainingSaved, helperScenarioLifetimeInterest, helperScenarioLifetimeSaved, helperScenarioRemainingInterest, helperScenarioRemainingSaved, minimumOnlyRemainingInterest, whatIfBaseRemainingInterest, whatIfBaseLifetimeInterest, whatIfProjectedExtrasSavedRemaining, whatIfScenarioRemainingInterest, whatIfScenarioLifetimeInterest, whatIfScenarioSaved, startingPrincipalAmount, assumedPayoffPercent, historyPayoffPercent, activePayoffPercent, activeProjectedPayoffDate, canShowAssumedSchedule, baselinePayoffDate, activeAsOfDate, projectedScenarioPrincipalForDailyCost, activeInterestStartDate, activeInterestEndDate, activeDailyInterestCost, activePayoffDuration, baselinePayoffDeltaMonths, activeTimeSavedLabel, assumedReferenceRow, historyReferenceRow, whatIfReferenceRow, activeReferenceRow, activePrincipalShare, activeInterestShare, softDangerMessage, whatIfDeltaInterest, whatIfBaselinePayoffDate, whatIfDeltaMonths, whatIfTimeChangeLabel, assumedLifetimeSavedTone, helperLifetimeSavedTone, whatIfLifetimeSavedTone, assumedRemainingInterestNotes, assumedRemainingSavedNotes, assumedLifetimeSavedNotes, helperRemainingInterestNotes, helperRemainingSavedNotes, helperLifetimeSavedNotes, whatIfRemainingInterestNotes, whatIfAdditionalSavedNotes, whatIfLifetimeSavedNotes, footnote2Text, assumedHasNegativeAmortization, historyHasNegativeAmortization, whatIfHasNegativeAmortization, negativeAmortizationWarning, startingPrincipalDateValue, minimumTargetDate, targetDateMinValue, helperMaxMonthValue, whatIfMinimumPaymentDate, whatIfMinDate, whatIfMinDateValue, addHelperPausePeriod, deleteHelperPausePeriod, addHelperBulkAdjustment, deleteHelperRecurringChange, deleteHelperDueDayChange, addOneOffPayment, startEditingReplayRow, saveEditedPayment, cancelEditingPayment, deleteHelperRow, addWhatIfPayment, deleteWhatIfPayment, deleteWhatIfRecurringChange, deleteWhatIfDueDayChange, deleteWhatIfPausePeriod, resetHelper, resetWhatIf, headerLoans, headerProjection, headerOriginalDebt, headerProgress } = runtime;
  return (
    <>
      <CreditCardActivityEditor theme={currentTheme} transactions={creditCardTransactions} onChange={setCreditCardTransactions} />
    </>
  );
}




