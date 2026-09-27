// @ts-nocheck
import type { LoanSimulatorRuntime } from "../types/loanSimulatorRuntime";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { PaycheckPage } from "./PaycheckPage";
import { DebtOverview } from "./DebtOverviewPage";
import { BudgetPage } from "./BudgetPage";
import { DateField, DatePickerInput, MonthYearField } from "../components/ui/date-fields";
import { FormSection, SummaryGroupLabel, SummaryValue } from "../components/ui/summary";
import { LoanSidebar } from "../components/loans/LoanSidebar";
import { CreditCardActivityEditor } from "../components/loans/CreditCardActivityEditor";
import { LabelWithNotes, formatPrincipalShare, getEventTypeCode, getEventTypeTitle, getTableRowStyle } from "../components/loans/schedulePresentation";
import { CurrencyField, CurrencyInput } from "../components/ui/CurrencyField";
import { Field } from "../components/ui/Field";
import { LoginPage } from "./LoginPage";
import { estimateSavedLoanBalance, estimateSavedAccountMinimum } from "../calculations/debt/savedAccount";
import { simulatePortfolio } from "../calculations/debt/simulatePortfolio";
import { accrueInterest } from "../calculations/loans/accrueInterest";
import { addMonths, clampToMonth, formatMonth, parseDate, toDateInputValue } from "../calculations/loans/dateUtils";
import { buildSchedule, getNextScheduledPaymentDate } from "../calculations/loans/schedule";
import { buildCreditCardSchedule } from "../calculations/cards/buildCreditCardSchedule";
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
} from "../lib/cloudStorage";
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
} from "../types/loans";
import { parseCurrency } from "../utils/currency";
import { compareDateOnly, monthValue, parseMonthInput, startOfDay } from "../utils/date";
import { formatCurrency, formatDurationToPayoff, formatMonthYear, formatPauseRange, formatPercent, formatTimeShaved, getDifferenceLabel } from "../utils/formatting";
import { THEME_DEFINITIONS, type ThemeId } from "../constants/theme";
import { createBlankLoanSnapshot } from "../constants/loanDefaults";
import type { UserProfile } from "../types/profile";
import { LoanSimulatorChrome } from "./loanSimulator/LoanSimulatorChrome";
import { LoanWorkspace } from "./loanSimulator/LoanWorkspace";
import { LoanAccountDeleteModal } from "./loanSimulator/LoanAccountDeleteModal";

export function LoanSimulatorView({ runtime }: { runtime: LoanSimulatorRuntime }) {
  const { userProfiles, setUserProfiles, currentUserId, setCurrentUserId, authMode, setAuthMode, authName, setAuthName, authDisplayName, setAuthDisplayName, authPassword, setAuthPassword, authError, setAuthError, activePage, setActivePage, activeLoanTab, setActiveLoanTab, loanSidebarCollapsed, setLoanSidebarCollapsed, profileMenuOpen, setProfileMenuOpen, deleteAccountConfirmOpen, setDeleteAccountConfirmOpen, profileMenuRef, profileDraftName, setProfileDraftName, profileDraftEmail, setProfileDraftEmail, profileStatus, setProfileStatus, passwordResetCodeInput, setPasswordResetCodeInput, passwordResetNewPassword, setPasswordResetNewPassword, passwordResetConfirmPassword, setPasswordResetConfirmPassword, savedLoans, setSavedLoans, currentLoanId, setCurrentLoanId, saveStatus, setSaveStatus, loanName, setLoanName, accountType, setAccountType, promoType, setPromoType, promoEndDate, setPromoEndDate, cardMinimumMode, setCardMinimumMode, cardMinimumPercent, setCardMinimumPercent, cardMinimumFloor, setCardMinimumFloor, postPromoMinimumMode, setPostPromoMinimumMode, postPromoMinimumPercent, setPostPromoMinimumPercent, postPromoMinimumFloor, setPostPromoMinimumFloor, postPromoFixedMinimum, setPostPromoFixedMinimum, cardStatementDate, setCardStatementDate, creditCardTransactions, setCreditCardTransactions, startingPrincipal, setStartingPrincipal, startingPrincipalDate, setStartingPrincipalDate, firstPaymentDate, setFirstPaymentDate, minimumPayment, setMinimumPayment, additionalMonthlyPayment, setAdditionalMonthlyPayment, aprPercent, setAprPercent, dueDay, setDueDay, targetDate, setTargetDate, moveWeekend, setMoveWeekend, roundDailyInterest, setRoundDailyInterest, dayCountBasis, setDayCountBasis, activeView, setActiveView, showAmortization, setShowAmortization, showHelperAmortization, setShowHelperAmortization, oneOffPayments, setOneOffPayments, newOneOffDate, setNewOneOffDate, newOneOffAmount, setNewOneOffAmount, newOneOffLabel, setNewOneOffLabel, helperPausePeriods, setHelperPausePeriods, helperPauseFromMonth, setHelperPauseFromMonth, helperPauseToMonth, setHelperPauseToMonth, helperPauseMode, setHelperPauseMode, helperBulkMode, setHelperBulkMode, helperAdjustmentFromMonth, setHelperAdjustmentFromMonth, helperAdjustmentToMonth, setHelperAdjustmentToMonth, helperAdjustmentAmount, setHelperAdjustmentAmount, helperRecurringChanges, setHelperRecurringChanges, helperDueDayChanges, setHelperDueDayChanges, helperAdjustmentDueDay, setHelperAdjustmentDueDay, deletedHelperRowIds, setDeletedHelperRowIds, helperActionError, setHelperActionError, helperPaymentAmountOverrides, setHelperPaymentAmountOverrides, paymentDateOverrides, setPaymentDateOverrides, paymentLabelOverrides, setPaymentLabelOverrides, editingPaymentId, setEditingPaymentId, editingPaymentDate, setEditingPaymentDate, editingPaymentAmount, setEditingPaymentAmount, editingPaymentLabel, setEditingPaymentLabel, whatIfPayments, setWhatIfPayments, whatIfRecurringChanges, setWhatIfRecurringChanges, whatIfPausePeriods, setWhatIfPausePeriods, whatIfEntryMode, setWhatIfEntryMode, newWhatIfDate, setNewWhatIfDate, newWhatIfAmount, setNewWhatIfAmount, newWhatIfLabel, setNewWhatIfLabel, whatIfAdjustmentDate, setWhatIfAdjustmentDate, whatIfAdjustmentEndDate, setWhatIfAdjustmentEndDate, whatIfAdjustmentAmount, setWhatIfAdjustmentAmount, whatIfAdjustmentDueDay, setWhatIfAdjustmentDueDay, whatIfDueDayChanges, setWhatIfDueDayChanges, whatIfPauseFromMonth, setWhatIfPauseFromMonth, whatIfPauseToMonth, setWhatIfPauseToMonth, whatIfPauseMode, setWhatIfPauseMode, whatIfActionError, setWhatIfActionError, showHistoricalDetails, setShowHistoricalDetails, showFutureDetails, setShowFutureDetails, showLifetimeDetails, setShowLifetimeDetails, showComparisonDetails, setShowComparisonDetails, cardScheduleStart, cardScheduleFirstPayment, cardScheduleTarget, deferredStartingPrincipal, deferredStartingPrincipalDate, deferredFirstPaymentDate, deferredMinimumPayment, deferredAdditionalMonthlyPayment, deferredAprPercent, deferredDueDay, deferredTargetDate, cardMinimumPayment, cardProjectionNudge, effectiveMinimumPayment, totalMonthlyPayment, buildProjection, todayDate, todayValue, getSavedLoansStorageKey, currentUser, currentTheme, displayName, firstName, profileInitial, serializePaymentEvent, deserializePaymentEvent, serializeRecurringChange, deserializeRecurringChange, serializePausePeriod, deserializePausePeriod, serializeDueDayChange, deserializeDueDayChange, applyLoanSnapshot, buildLoanSnapshot, loadLoansForUser, persistSavedLoans, persistUserProfiles, updateCurrentUserProfile, loginUser, handleAuthSubmit, logoutUser, deleteCurrentUserProfile, saveProfileDetails, applyThemeToProfile, sendPasswordResetEmail, applyPasswordReset, saveCurrentLoan, startNewLoan, loadSavedLoan, deleteLoan, helperVisiblePayments, helperPaymentsThroughTarget, helperPausePeriodsThroughTarget, helperScheduledAdjustments, helperDueDayAdjustments, assumedResult, minimumOnlyToDateProjection, amortizationTargetDate, fullLoanTargetDate, assumedCurrentPlanProjection, amortizationProjection, minimumOnlyFullProjection, assumedFullProjection, historyResult, helperAmortizationTargetDate, helperProjection, helperCurrentPlanProjection, whatIfTargetDate, nextPaymentDate, whatIfAllPayments, whatIfRecurringAdjustments, whatIfDueDayAdjustments, whatIfProjection, loanInputsReady, historyErrors, assumedInterestSaved, minimumOnlyLifetimeInterest, assumedInterestSavedAsOfToday, assumedInterestSavedFromTodayForward, helperInterestSavedAsOfToday, helperInterestSavedOverall, helperInterestSavedFromTodayForward, assumedInterestStillOwedWithAdditional, helperTotalExpectedInterestPaidIncludingAdditional, whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly, whatIfTotalExpectedInterestPaidIncludingAnticipated, whatIfHasProjectedExtras, assumedScenarioLifetimeInterest, assumedScenarioLifetimeSaved, assumedScenarioRemainingInterest, assumedScenarioRemainingSaved, helperScenarioLifetimeInterest, helperScenarioLifetimeSaved, helperScenarioRemainingInterest, helperScenarioRemainingSaved, minimumOnlyRemainingInterest, whatIfBaseRemainingInterest, whatIfBaseLifetimeInterest, whatIfProjectedExtrasSavedRemaining, whatIfScenarioRemainingInterest, whatIfScenarioLifetimeInterest, whatIfScenarioSaved, startingPrincipalAmount, assumedPayoffPercent, historyPayoffPercent, activePayoffPercent, activeProjectedPayoffDate, canShowAssumedSchedule, baselinePayoffDate, activeAsOfDate, projectedScenarioPrincipalForDailyCost, activeInterestStartDate, activeInterestEndDate, activeDailyInterestCost, activePayoffDuration, baselinePayoffDeltaMonths, activeTimeSavedLabel, assumedReferenceRow, historyReferenceRow, whatIfReferenceRow, activeReferenceRow, activePrincipalShare, activeInterestShare, softDangerMessage, whatIfDeltaInterest, whatIfBaselinePayoffDate, whatIfDeltaMonths, whatIfTimeChangeLabel, assumedLifetimeSavedTone, helperLifetimeSavedTone, whatIfLifetimeSavedTone, assumedRemainingInterestNotes, assumedRemainingSavedNotes, assumedLifetimeSavedNotes, helperRemainingInterestNotes, helperRemainingSavedNotes, helperLifetimeSavedNotes, whatIfRemainingInterestNotes, whatIfAdditionalSavedNotes, whatIfLifetimeSavedNotes, footnote2Text, assumedHasNegativeAmortization, historyHasNegativeAmortization, whatIfHasNegativeAmortization, negativeAmortizationWarning, startingPrincipalDateValue, minimumTargetDate, targetDateMinValue, helperMaxMonthValue, whatIfMinimumPaymentDate, whatIfMinDate, whatIfMinDateValue, addHelperPausePeriod, deleteHelperPausePeriod, addHelperBulkAdjustment, deleteHelperRecurringChange, deleteHelperDueDayChange, addOneOffPayment, startEditingReplayRow, saveEditedPayment, cancelEditingPayment, deleteHelperRow, addWhatIfPayment, deleteWhatIfPayment, deleteWhatIfRecurringChange, deleteWhatIfDueDayChange, deleteWhatIfPausePeriod, resetHelper, resetWhatIf, headerLoans, headerProjection, headerOriginalDebt, headerProgress } = runtime;
  return (
        <div
          style={{
            minHeight: "100vh",
            background: currentTheme.appBackground,
            padding: "24px 16px 48px",
            color: currentTheme.text,
            ["--app-accent" as string]: currentTheme.accent,
            ["--app-accent-soft" as string]: currentTheme.accentSoft,
            ["--app-border" as string]: currentTheme.cardBorder,
            ["--app-border-strong" as string]: currentTheme.cardBorder,
            ["--app-heading" as string]: currentTheme.text,
            ["--app-input-bg" as string]: currentTheme.surface,
            ["--app-danger-bg" as string]: currentTheme.isDark ? "rgba(127, 29, 29, 0.35)" : "#fff1f2",
            ["--app-danger-border" as string]: currentTheme.isDark ? "#7f1d1d" : "#fecaca",
            ["--app-danger-text" as string]: currentTheme.isDark ? "#fecaca" : "#991b1b",
            ["--app-negative-bg" as string]: currentTheme.isDark ? "rgba(157, 23, 77, 0.25)" : "#fff1f2",
            ["--app-negative-border" as string]: currentTheme.isDark ? "#9d174d" : "#fda4af",
            ["--app-negative-text" as string]: currentTheme.isDark ? "#f9a8d4" : "#be123c",
            ["--app-positive-bg" as string]: currentTheme.isDark ? "rgba(21, 128, 61, 0.22)" : "#ecfdf5",
            ["--app-positive-border" as string]: currentTheme.isDark ? "#166534" : "#86efac",
            ["--app-positive-text" as string]: currentTheme.isDark ? "#86efac" : "#15803d",
            ["--app-benchmark-bg" as string]: currentTheme.isDark ? "rgba(180, 83, 9, 0.22)" : "#fefce8",
            ["--app-benchmark-border" as string]: currentTheme.isDark ? "#92400e" : "#fde68a",
            ["--app-benchmark-text" as string]: currentTheme.isDark ? "#fcd34d" : "#a16207",
            ["--app-row-negative" as string]: currentTheme.isDark ? "rgba(146, 64, 14, 0.18)" : "#fffbeb",
            ["--app-row-paused" as string]: currentTheme.isDark ? "rgba(194, 65, 12, 0.16)" : "#fff7ed",
            ["--app-surface" as string]: currentTheme.surface,
            ["--app-surface-muted" as string]: currentTheme.surfaceMuted,
            ["--app-table-header" as string]: currentTheme.surfaceMuted,
            ["--app-table-border" as string]: currentTheme.cardBorder,
            ["--app-text" as string]: currentTheme.text,
            ["--app-text-muted" as string]: currentTheme.textMuted,
          }}
        >
          <div
            style={{
              maxWidth: 1760,
              margin: "0 auto",
              display: "grid",
              gap: 20,
              gridTemplateColumns: loanSidebarCollapsed ? "44px minmax(0, 1fr)" : "260px minmax(0, 1fr)",
              alignItems: "start",
            }}
          >
            <LoanSidebar
              collapsed={loanSidebarCollapsed}
              currentLoanId={currentLoanId}
              loanName={loanName}
              loans={savedLoans}
              onAdd={(type) => { startNewLoan(type); setActivePage("simulator"); }}
              onCollapse={() => setLoanSidebarCollapsed((collapsed) => !collapsed)}
              onDelete={deleteLoan}
              onOverview={() => setActivePage("overview")}
              onSelect={(loanId) => { loadSavedLoan(loanId); setActivePage("simulator"); }}
              saveStatus={saveStatus}
            />
            <div style={{ display: "grid", gap: 24, minWidth: 0 }}>
        <LoanSimulatorChrome runtime={runtime} />
        {runtime.activePage === "simulator" ? <LoanWorkspace runtime={runtime} /> : null}
        <LoanAccountDeleteModal runtime={runtime} />
        </div>
      </div>
    </div>
  );
}




