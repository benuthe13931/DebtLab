// @ts-nocheck
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
export function LoanWhatIfTab({ runtime }: { runtime: Record<string, any> }) {
  const { userProfiles, setUserProfiles, currentUserId, setCurrentUserId, authMode, setAuthMode, authName, setAuthName, authDisplayName, setAuthDisplayName, authPassword, setAuthPassword, authError, setAuthError, activePage, setActivePage, activeLoanTab, setActiveLoanTab, loanSidebarCollapsed, setLoanSidebarCollapsed, profileMenuOpen, setProfileMenuOpen, deleteAccountConfirmOpen, setDeleteAccountConfirmOpen, profileMenuRef, profileDraftName, setProfileDraftName, profileDraftEmail, setProfileDraftEmail, profileStatus, setProfileStatus, passwordResetCodeInput, setPasswordResetCodeInput, passwordResetNewPassword, setPasswordResetNewPassword, passwordResetConfirmPassword, setPasswordResetConfirmPassword, savedLoans, setSavedLoans, currentLoanId, setCurrentLoanId, saveStatus, setSaveStatus, loanName, setLoanName, accountType, setAccountType, promoType, setPromoType, promoEndDate, setPromoEndDate, cardMinimumMode, setCardMinimumMode, cardMinimumPercent, setCardMinimumPercent, cardMinimumFloor, setCardMinimumFloor, postPromoMinimumMode, setPostPromoMinimumMode, postPromoMinimumPercent, setPostPromoMinimumPercent, postPromoMinimumFloor, setPostPromoMinimumFloor, postPromoFixedMinimum, setPostPromoFixedMinimum, cardStatementDate, setCardStatementDate, creditCardTransactions, setCreditCardTransactions, startingPrincipal, setStartingPrincipal, startingPrincipalDate, setStartingPrincipalDate, firstPaymentDate, setFirstPaymentDate, minimumPayment, setMinimumPayment, additionalMonthlyPayment, setAdditionalMonthlyPayment, aprPercent, setAprPercent, dueDay, setDueDay, targetDate, setTargetDate, moveWeekend, setMoveWeekend, roundDailyInterest, setRoundDailyInterest, dayCountBasis, setDayCountBasis, activeView, setActiveView, showAmortization, setShowAmortization, showHelperAmortization, setShowHelperAmortization, oneOffPayments, setOneOffPayments, newOneOffDate, setNewOneOffDate, newOneOffAmount, setNewOneOffAmount, newOneOffLabel, setNewOneOffLabel, helperPausePeriods, setHelperPausePeriods, helperPauseFromMonth, setHelperPauseFromMonth, helperPauseToMonth, setHelperPauseToMonth, helperPauseMode, setHelperPauseMode, helperBulkMode, setHelperBulkMode, helperAdjustmentFromMonth, setHelperAdjustmentFromMonth, helperAdjustmentToMonth, setHelperAdjustmentToMonth, helperAdjustmentAmount, setHelperAdjustmentAmount, helperRecurringChanges, setHelperRecurringChanges, helperDueDayChanges, setHelperDueDayChanges, helperAdjustmentDueDay, setHelperAdjustmentDueDay, deletedHelperRowIds, setDeletedHelperRowIds, helperActionError, setHelperActionError, helperPaymentAmountOverrides, setHelperPaymentAmountOverrides, paymentDateOverrides, setPaymentDateOverrides, paymentLabelOverrides, setPaymentLabelOverrides, editingPaymentId, setEditingPaymentId, editingPaymentDate, setEditingPaymentDate, editingPaymentAmount, setEditingPaymentAmount, editingPaymentLabel, setEditingPaymentLabel, whatIfPayments, setWhatIfPayments, whatIfRecurringChanges, setWhatIfRecurringChanges, whatIfPausePeriods, setWhatIfPausePeriods, whatIfEntryMode, setWhatIfEntryMode, newWhatIfDate, setNewWhatIfDate, newWhatIfAmount, setNewWhatIfAmount, newWhatIfLabel, setNewWhatIfLabel, whatIfAdjustmentDate, setWhatIfAdjustmentDate, whatIfAdjustmentEndDate, setWhatIfAdjustmentEndDate, whatIfAdjustmentAmount, setWhatIfAdjustmentAmount, whatIfAdjustmentDueDay, setWhatIfAdjustmentDueDay, whatIfDueDayChanges, setWhatIfDueDayChanges, whatIfPauseFromMonth, setWhatIfPauseFromMonth, whatIfPauseToMonth, setWhatIfPauseToMonth, whatIfPauseMode, setWhatIfPauseMode, whatIfActionError, setWhatIfActionError, showHistoricalDetails, setShowHistoricalDetails, showFutureDetails, setShowFutureDetails, showLifetimeDetails, setShowLifetimeDetails, showComparisonDetails, setShowComparisonDetails, cardScheduleStart, cardScheduleFirstPayment, cardScheduleTarget, deferredStartingPrincipal, deferredStartingPrincipalDate, deferredFirstPaymentDate, deferredMinimumPayment, deferredAdditionalMonthlyPayment, deferredAprPercent, deferredDueDay, deferredTargetDate, cardMinimumPayment, cardProjectionNudge, effectiveMinimumPayment, totalMonthlyPayment, buildProjection, todayDate, todayValue, getSavedLoansStorageKey, currentUser, currentTheme, displayName, firstName, profileInitial, serializePaymentEvent, deserializePaymentEvent, serializeRecurringChange, deserializeRecurringChange, serializePausePeriod, deserializePausePeriod, serializeDueDayChange, deserializeDueDayChange, applyLoanSnapshot, buildLoanSnapshot, loadLoansForUser, persistSavedLoans, persistUserProfiles, updateCurrentUserProfile, loginUser, handleAuthSubmit, logoutUser, deleteCurrentUserProfile, saveProfileDetails, applyThemeToProfile, sendPasswordResetEmail, applyPasswordReset, saveCurrentLoan, startNewLoan, loadSavedLoan, deleteLoan, helperVisiblePayments, helperPaymentsThroughTarget, helperPausePeriodsThroughTarget, helperScheduledAdjustments, helperDueDayAdjustments, assumedResult, minimumOnlyToDateProjection, amortizationTargetDate, fullLoanTargetDate, assumedCurrentPlanProjection, amortizationProjection, minimumOnlyFullProjection, assumedFullProjection, historyResult, helperAmortizationTargetDate, helperProjection, helperCurrentPlanProjection, whatIfTargetDate, nextPaymentDate, whatIfAllPayments, whatIfRecurringAdjustments, whatIfDueDayAdjustments, whatIfProjection, loanInputsReady, historyErrors, assumedInterestSaved, minimumOnlyLifetimeInterest, assumedInterestSavedAsOfToday, assumedInterestSavedFromTodayForward, helperInterestSavedAsOfToday, helperInterestSavedOverall, helperInterestSavedFromTodayForward, assumedInterestStillOwedWithAdditional, helperTotalExpectedInterestPaidIncludingAdditional, whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly, whatIfTotalExpectedInterestPaidIncludingAnticipated, whatIfHasProjectedExtras, assumedScenarioLifetimeInterest, assumedScenarioLifetimeSaved, assumedScenarioRemainingInterest, assumedScenarioRemainingSaved, helperScenarioLifetimeInterest, helperScenarioLifetimeSaved, helperScenarioRemainingInterest, helperScenarioRemainingSaved, minimumOnlyRemainingInterest, whatIfBaseRemainingInterest, whatIfBaseLifetimeInterest, whatIfProjectedExtrasSavedRemaining, whatIfScenarioRemainingInterest, whatIfScenarioLifetimeInterest, whatIfScenarioSaved, startingPrincipalAmount, assumedPayoffPercent, historyPayoffPercent, activePayoffPercent, activeProjectedPayoffDate, canShowAssumedSchedule, baselinePayoffDate, activeAsOfDate, projectedScenarioPrincipalForDailyCost, activeInterestStartDate, activeInterestEndDate, activeDailyInterestCost, activePayoffDuration, baselinePayoffDeltaMonths, activeTimeSavedLabel, assumedReferenceRow, historyReferenceRow, whatIfReferenceRow, activeReferenceRow, activePrincipalShare, activeInterestShare, softDangerMessage, whatIfDeltaInterest, whatIfBaselinePayoffDate, whatIfDeltaMonths, whatIfTimeChangeLabel, assumedLifetimeSavedTone, helperLifetimeSavedTone, whatIfLifetimeSavedTone, assumedRemainingInterestNotes, assumedRemainingSavedNotes, assumedLifetimeSavedNotes, helperRemainingInterestNotes, helperRemainingSavedNotes, helperLifetimeSavedNotes, whatIfRemainingInterestNotes, whatIfAdditionalSavedNotes, whatIfLifetimeSavedNotes, footnote2Text, assumedHasNegativeAmortization, historyHasNegativeAmortization, whatIfHasNegativeAmortization, negativeAmortizationWarning, startingPrincipalDateValue, minimumTargetDate, targetDateMinValue, helperMaxMonthValue, whatIfMinimumPaymentDate, whatIfMinDate, whatIfMinDateValue, addHelperPausePeriod, deleteHelperPausePeriod, addHelperBulkAdjustment, deleteHelperRecurringChange, deleteHelperDueDayChange, addOneOffPayment, startEditingReplayRow, saveEditedPayment, cancelEditingPayment, deleteHelperRow, addWhatIfPayment, deleteWhatIfPayment, deleteWhatIfRecurringChange, deleteWhatIfDueDayChange, deleteWhatIfPausePeriod, resetHelper, resetWhatIf, headerLoans, headerProjection, headerOriginalDebt, headerProgress } = runtime;
  return (
    <>
      <>
                      <div
                        style={{
                          background: currentTheme.surfaceMuted,
                          border: `1px solid ${currentTheme.cardBorder}`,
                          borderRadius: 12,
                          padding: 14,
                          display: "grid",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Adjust projected payments</div>
                          <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4, marginTop: 4 }}>
                            This starts from the payment-history balance as of the selected date, then applies
                            future payment changes to project a new payoff path.
                          </div>
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                              type="radio"
                              name="what-if-entry-mode"
                              checked={whatIfEntryMode === "one-time"}
                              onChange={() => setWhatIfEntryMode("one-time")}
                            />
                            Add one-time anticipated payment
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                              type="radio"
                              name="what-if-entry-mode"
                              checked={whatIfEntryMode === "monthly-extra"}
                              onChange={() => setWhatIfEntryMode("monthly-extra")}
                            />
                            Update monthly extra payment
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                              type="radio"
                              name="what-if-entry-mode"
                              checked={whatIfEntryMode === "minimum"}
                              onChange={() => setWhatIfEntryMode("minimum")}
                            />
                            Update minimum payment
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                              type="radio"
                              name="what-if-entry-mode"
                              checked={whatIfEntryMode === "pause"}
                              onChange={() => setWhatIfEntryMode("pause")}
                            />
                            Pause / forbearance
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                              type="radio"
                              name="what-if-entry-mode"
                              checked={whatIfEntryMode === "due-day"}
                              onChange={() => setWhatIfEntryMode("due-day")}
                            />
                            Change payment due date
                          </label>
                        </div>
                        {whatIfEntryMode === "one-time" ? (
                          <>
                            <DateField
                              id="new-what-if-date"
                              label="Future payment date"
                              minDate={whatIfMinDateValue}
                              value={newWhatIfDate}
                              onChange={setNewWhatIfDate}
                            />
                            <CurrencyField
                              id="new-what-if-amount"
                              label="Payment amount"
                              value={newWhatIfAmount}
                              onChange={setNewWhatIfAmount}
                            />
                            <Field
                              id="new-what-if-label"
                              label="Memo"
                              value={newWhatIfLabel}
                              onChange={setNewWhatIfLabel}
                            />
                          </>
                        ) : whatIfEntryMode === "pause" ? (
                          <>
                            <MonthYearField
                              id="what-if-pause-from"
                              label="From"
                              value={whatIfPauseFromMonth}
                              onChange={setWhatIfPauseFromMonth}
                            />
                            <MonthYearField
                              id="what-if-pause-to"
                              label="To"
                              value={whatIfPauseToMonth}
                              onChange={setWhatIfPauseToMonth}
                            />
                            <div style={{ display: "grid", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Pause behavior</span>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                                <input
                                  type="radio"
                                  name="what-if-pause-mode"
                                  checked={whatIfPauseMode === "accrues"}
                                  onChange={() => setWhatIfPauseMode("accrues")}
                                />
                                Interest continues to accrue
                              </label>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                                <input
                                  type="radio"
                                  name="what-if-pause-mode"
                                  checked={whatIfPauseMode === "paused"}
                                  onChange={() => setWhatIfPauseMode("paused")}
                                />
                                Interest is paused
                              </label>
                            </div>
                          </>
                        ) : whatIfEntryMode === "due-day" ? (
                          <>
                            <MonthYearField id="what-if-adjustment-date" label="Beginning month" value={whatIfAdjustmentDate} onChange={setWhatIfAdjustmentDate} />
                            <MonthYearField id="what-if-adjustment-end-date" label="Ending month (optional)" value={whatIfAdjustmentEndDate} onChange={setWhatIfAdjustmentEndDate} />
                            <Field id="what-if-adjustment-due-day" label="New due day" value={whatIfAdjustmentDueDay} onChange={setWhatIfAdjustmentDueDay} />
                          </>
                        ) : (
                          <>
                            <MonthYearField
                              id="what-if-adjustment-date"
                              label="Month"
                              value={whatIfAdjustmentDate}
                              onChange={setWhatIfAdjustmentDate}
                            />
                            <MonthYearField
                              id="what-if-adjustment-end-date"
                              label="Ending month (optional)"
                              value={whatIfAdjustmentEndDate}
                              onChange={setWhatIfAdjustmentEndDate}
                            />
                            <Field
                              id="what-if-adjustment-amount"
                              label={whatIfEntryMode === "minimum" ? "New minimum payment" : "New monthly extra payment"}
                              value={whatIfAdjustmentAmount}
                              onChange={setWhatIfAdjustmentAmount}
                            />
                          </>
                        )}
                        <button
                          type="button"
                          onClick={addWhatIfPayment}
                          style={{
                            border: `1px solid ${currentTheme.accent}`,
                            background: currentTheme.accent,
                            color: "#ffffff",
                            borderRadius: 10,
                            padding: "10px 14px",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {whatIfEntryMode === "one-time"
                            ? "Add anticipated payment"
                            : whatIfEntryMode === "pause"
                              ? "Apply pause"
                            : whatIfEntryMode === "due-day"
                              ? "Apply due-date change"
                            : whatIfEntryMode === "minimum"
                              ? "Update minimum payment"
                              : "Update monthly extra payment"}
                        </button>
                        {whatIfActionError ? (
                          <div
                            style={{
                              border: "1px solid var(--app-danger-border, #fecaca)",
                              background: "var(--app-danger-bg, #fff1f2)",
                              color: "var(--app-danger-text, #991b1b)",
                              borderRadius: 10,
                              padding: "10px 12px",
                              fontSize: 13,
                            }}
                          >
                            {whatIfActionError}
                          </div>
                        ) : null}
                      </div>
      
                      <button
                        type="button"
                        onClick={resetWhatIf}
                        style={{
                          border: `1px solid ${currentTheme.cardBorder}`,
                          background: currentTheme.surface,
                          color: currentTheme.text,
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Reset all changes
                      </button>
                    </>
    </>
  );
}
