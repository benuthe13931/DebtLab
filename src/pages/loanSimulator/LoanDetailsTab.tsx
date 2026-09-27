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
export function LoanDetailsTab({ runtime }: { runtime: LoanSimulatorRuntime }) {
  const { userProfiles, setUserProfiles, currentUserId, setCurrentUserId, authMode, setAuthMode, authName, setAuthName, authDisplayName, setAuthDisplayName, authPassword, setAuthPassword, authError, setAuthError, activePage, setActivePage, activeLoanTab, setActiveLoanTab, loanSidebarCollapsed, setLoanSidebarCollapsed, profileMenuOpen, setProfileMenuOpen, deleteAccountConfirmOpen, setDeleteAccountConfirmOpen, profileMenuRef, profileDraftName, setProfileDraftName, profileDraftEmail, setProfileDraftEmail, profileStatus, setProfileStatus, passwordResetCodeInput, setPasswordResetCodeInput, passwordResetNewPassword, setPasswordResetNewPassword, passwordResetConfirmPassword, setPasswordResetConfirmPassword, savedLoans, setSavedLoans, currentLoanId, setCurrentLoanId, saveStatus, setSaveStatus, loanName, setLoanName, accountType, setAccountType, promoType, setPromoType, promoEndDate, setPromoEndDate, cardMinimumMode, setCardMinimumMode, cardMinimumPercent, setCardMinimumPercent, cardMinimumFloor, setCardMinimumFloor, postPromoMinimumMode, setPostPromoMinimumMode, postPromoMinimumPercent, setPostPromoMinimumPercent, postPromoMinimumFloor, setPostPromoMinimumFloor, postPromoFixedMinimum, setPostPromoFixedMinimum, cardStatementDate, setCardStatementDate, creditCardTransactions, setCreditCardTransactions, startingPrincipal, setStartingPrincipal, startingPrincipalDate, setStartingPrincipalDate, firstPaymentDate, setFirstPaymentDate, minimumPayment, setMinimumPayment, additionalMonthlyPayment, setAdditionalMonthlyPayment, aprPercent, setAprPercent, dueDay, setDueDay, targetDate, setTargetDate, moveWeekend, setMoveWeekend, roundDailyInterest, setRoundDailyInterest, dayCountBasis, setDayCountBasis, activeView, setActiveView, showAmortization, setShowAmortization, showHelperAmortization, setShowHelperAmortization, oneOffPayments, setOneOffPayments, newOneOffDate, setNewOneOffDate, newOneOffAmount, setNewOneOffAmount, newOneOffLabel, setNewOneOffLabel, helperPausePeriods, setHelperPausePeriods, helperPauseFromMonth, setHelperPauseFromMonth, helperPauseToMonth, setHelperPauseToMonth, helperPauseMode, setHelperPauseMode, helperBulkMode, setHelperBulkMode, helperAdjustmentFromMonth, setHelperAdjustmentFromMonth, helperAdjustmentToMonth, setHelperAdjustmentToMonth, helperAdjustmentAmount, setHelperAdjustmentAmount, helperRecurringChanges, setHelperRecurringChanges, helperDueDayChanges, setHelperDueDayChanges, helperAdjustmentDueDay, setHelperAdjustmentDueDay, deletedHelperRowIds, setDeletedHelperRowIds, helperActionError, setHelperActionError, helperPaymentAmountOverrides, setHelperPaymentAmountOverrides, paymentDateOverrides, setPaymentDateOverrides, paymentLabelOverrides, setPaymentLabelOverrides, editingPaymentId, setEditingPaymentId, editingPaymentDate, setEditingPaymentDate, editingPaymentAmount, setEditingPaymentAmount, editingPaymentLabel, setEditingPaymentLabel, whatIfPayments, setWhatIfPayments, whatIfRecurringChanges, setWhatIfRecurringChanges, whatIfPausePeriods, setWhatIfPausePeriods, whatIfEntryMode, setWhatIfEntryMode, newWhatIfDate, setNewWhatIfDate, newWhatIfAmount, setNewWhatIfAmount, newWhatIfLabel, setNewWhatIfLabel, whatIfAdjustmentDate, setWhatIfAdjustmentDate, whatIfAdjustmentEndDate, setWhatIfAdjustmentEndDate, whatIfAdjustmentAmount, setWhatIfAdjustmentAmount, whatIfAdjustmentDueDay, setWhatIfAdjustmentDueDay, whatIfDueDayChanges, setWhatIfDueDayChanges, whatIfPauseFromMonth, setWhatIfPauseFromMonth, whatIfPauseToMonth, setWhatIfPauseToMonth, whatIfPauseMode, setWhatIfPauseMode, whatIfActionError, setWhatIfActionError, showHistoricalDetails, setShowHistoricalDetails, showFutureDetails, setShowFutureDetails, showLifetimeDetails, setShowLifetimeDetails, showComparisonDetails, setShowComparisonDetails, cardScheduleStart, cardScheduleFirstPayment, cardScheduleTarget, deferredStartingPrincipal, deferredStartingPrincipalDate, deferredFirstPaymentDate, deferredMinimumPayment, deferredAdditionalMonthlyPayment, deferredAprPercent, deferredDueDay, deferredTargetDate, cardMinimumPayment, cardProjectionNudge, effectiveMinimumPayment, totalMonthlyPayment, buildProjection, todayDate, todayValue, getSavedLoansStorageKey, currentUser, currentTheme, displayName, firstName, profileInitial, serializePaymentEvent, deserializePaymentEvent, serializeRecurringChange, deserializeRecurringChange, serializePausePeriod, deserializePausePeriod, serializeDueDayChange, deserializeDueDayChange, applyLoanSnapshot, buildLoanSnapshot, loadLoansForUser, persistSavedLoans, persistUserProfiles, updateCurrentUserProfile, loginUser, handleAuthSubmit, logoutUser, deleteCurrentUserProfile, saveProfileDetails, applyThemeToProfile, sendPasswordResetEmail, applyPasswordReset, saveCurrentLoan, startNewLoan, loadSavedLoan, deleteLoan, helperVisiblePayments, helperPaymentsThroughTarget, helperPausePeriodsThroughTarget, helperScheduledAdjustments, helperDueDayAdjustments, assumedResult, minimumOnlyToDateProjection, amortizationTargetDate, fullLoanTargetDate, assumedCurrentPlanProjection, amortizationProjection, minimumOnlyFullProjection, assumedFullProjection, historyResult, helperAmortizationTargetDate, helperProjection, helperCurrentPlanProjection, whatIfTargetDate, nextPaymentDate, whatIfAllPayments, whatIfRecurringAdjustments, whatIfDueDayAdjustments, whatIfProjection, loanInputsReady, historyErrors, assumedInterestSaved, minimumOnlyLifetimeInterest, assumedInterestSavedAsOfToday, assumedInterestSavedFromTodayForward, helperInterestSavedAsOfToday, helperInterestSavedOverall, helperInterestSavedFromTodayForward, assumedInterestStillOwedWithAdditional, helperTotalExpectedInterestPaidIncludingAdditional, whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly, whatIfTotalExpectedInterestPaidIncludingAnticipated, whatIfHasProjectedExtras, assumedScenarioLifetimeInterest, assumedScenarioLifetimeSaved, assumedScenarioRemainingInterest, assumedScenarioRemainingSaved, helperScenarioLifetimeInterest, helperScenarioLifetimeSaved, helperScenarioRemainingInterest, helperScenarioRemainingSaved, minimumOnlyRemainingInterest, whatIfBaseRemainingInterest, whatIfBaseLifetimeInterest, whatIfProjectedExtrasSavedRemaining, whatIfScenarioRemainingInterest, whatIfScenarioLifetimeInterest, whatIfScenarioSaved, startingPrincipalAmount, assumedPayoffPercent, historyPayoffPercent, activePayoffPercent, activeProjectedPayoffDate, canShowAssumedSchedule, baselinePayoffDate, activeAsOfDate, projectedScenarioPrincipalForDailyCost, activeInterestStartDate, activeInterestEndDate, activeDailyInterestCost, activePayoffDuration, baselinePayoffDeltaMonths, activeTimeSavedLabel, assumedReferenceRow, historyReferenceRow, whatIfReferenceRow, activeReferenceRow, activePrincipalShare, activeInterestShare, softDangerMessage, whatIfDeltaInterest, whatIfBaselinePayoffDate, whatIfDeltaMonths, whatIfTimeChangeLabel, assumedLifetimeSavedTone, helperLifetimeSavedTone, whatIfLifetimeSavedTone, assumedRemainingInterestNotes, assumedRemainingSavedNotes, assumedLifetimeSavedNotes, helperRemainingInterestNotes, helperRemainingSavedNotes, helperLifetimeSavedNotes, whatIfRemainingInterestNotes, whatIfAdditionalSavedNotes, whatIfLifetimeSavedNotes, footnote2Text, assumedHasNegativeAmortization, historyHasNegativeAmortization, whatIfHasNegativeAmortization, negativeAmortizationWarning, startingPrincipalDateValue, minimumTargetDate, targetDateMinValue, helperMaxMonthValue, whatIfMinimumPaymentDate, whatIfMinDate, whatIfMinDateValue, addHelperPausePeriod, deleteHelperPausePeriod, addHelperBulkAdjustment, deleteHelperRecurringChange, deleteHelperDueDayChange, addOneOffPayment, startEditingReplayRow, saveEditedPayment, cancelEditingPayment, deleteHelperRow, addWhatIfPayment, deleteWhatIfPayment, deleteWhatIfRecurringChange, deleteWhatIfDueDayChange, deleteWhatIfPausePeriod, resetHelper, resetWhatIf, headerLoans, headerProjection, headerOriginalDebt, headerProgress } = runtime;
  return (
    <>
      <>
                      <FormSection title="Loan basics">
                        <Field label={accountType === "credit-card" ? "Credit card name" : "Loan name"} id="loan-name" value={loanName} onChange={setLoanName} />
                        <CurrencyField label={accountType === "credit-card" ? "Current balance" : "Starting principal"} id="starting-principal" value={startingPrincipal} onChange={setStartingPrincipal} />
                        <Field label={accountType === "credit-card" ? "Standard APR (%)" : "APR (%)"} id="apr" value={aprPercent} onChange={setAprPercent} />
                        {accountType === "credit-card" ? <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12, padding: 14, borderRadius: 14, background: currentTheme.surfaceMuted, border: `1px solid ${currentTheme.cardBorder}` }}><strong>Credit card promotion</strong><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}><label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Promotion type</span><select value={promoType} onChange={(event) => setPromoType(event.target.value as "none" | "zero" | "deferred")} style={{ boxSizing: "border-box", width: "100%", border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, padding: "10px 12px", background: currentTheme.surface, color: currentTheme.text }}><option value="none">No promotion</option><option value="zero">0% APR until a date</option><option value="deferred">Deferred interest until a date</option></select></label>{promoType !== "none" ? <DateField label="Promotion end date" id="promo-end-date" value={promoEndDate} onChange={setPromoEndDate} /> : null}</div>{promoType === "zero" ? <span style={{ fontSize: 12, color: currentTheme.textMuted }}>No interest accrues during the promotional period; the standard APR applies after the end date.</span> : promoType === "deferred" ? <span style={{ fontSize: 12, color: currentTheme.textMuted }}>Deferred interest may be charged retroactively if the promotional balance is not paid by the end date.</span> : null}</div> : null}
                      </FormSection>
                      {accountType === "loan" ? <FormSection title="Timeline">
                        <DateField label="Starting principal date" id="starting-date" value={startingPrincipalDate} onChange={setStartingPrincipalDate} />
                        <DateField label="First scheduled payment date" id="first-payment-date" value={firstPaymentDate} minDate={startingPrincipalDate} onChange={setFirstPaymentDate} />
                        <DateField label="Calculate current balance through" id="target-date" value={targetDate} minDate={targetDateMinValue} onChange={setTargetDate} />
                      </FormSection> : <FormSection title="Card account cycle" helper="The statement date starts the billing cycle; the due day is the deadline for that cycle's payment.">
                        <DateField label="Statement date" id="card-statement-date" value={cardStatementDate} onChange={setCardStatementDate} />
                        <label style={{ display: "grid", gap: 6, width: 96 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Due day</span><input id="card-due-day" inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value.replace(/[^0-9]/g, "").slice(0, 2))} style={{ width: 96, boxSizing: "border-box", border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, padding: "10px 12px", background: currentTheme.surface, color: currentTheme.text }} /></label>
                      </FormSection>}
                      <FormSection title="Recurring payment rules">
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, minWidth: 0 }}>
                        {accountType === "credit-card" ? <><label style={{ display: "grid", gap: 6, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Minimum payment rule</span><select value={cardMinimumMode} onChange={(event) => setCardMinimumMode(event.target.value as "percent" | "fixed")} style={{ boxSizing: "border-box", width: "100%", minWidth: 0, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, padding: "10px 12px", background: currentTheme.surface, color: currentTheme.text }}><option value="percent">Percentage of balance</option><option value="fixed">Fixed minimum</option></select></label>{cardMinimumMode === "percent" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, minWidth: 0, width: "100%" }}><div style={{ minWidth: 0, width: "100%" }}><Field label="Percent of balance" id="card-minimum-percent" value={cardMinimumPercent} onChange={setCardMinimumPercent} /></div><div style={{ minWidth: 0, width: "100%" }}><CurrencyField label="Minimum floor" id="card-minimum-floor" value={cardMinimumFloor} onChange={setCardMinimumFloor} /></div></div> : <CurrencyField label="Fixed minimum payment" id="minimum-payment" value={minimumPayment} onChange={setMinimumPayment} />}</> : <CurrencyField label="Minimum payment" id="minimum-payment" value={minimumPayment} onChange={setMinimumPayment} />}
                        <CurrencyField label="Monthly extra payment" id="additional-monthly-payment" value={additionalMonthlyPayment} onChange={setAdditionalMonthlyPayment} />
                        {accountType === "loan" ? <Field label="Recurring due day" id="due-day" value={dueDay} onChange={setDueDay} /> : <div style={{ fontSize: 12, color: currentTheme.textMuted }}>The projected minimum is recalculated from the balance each month.</div>}
                        </div>
                        {accountType === "credit-card" && promoType !== "none" ? <div style={{ display: "grid", gap: 10, padding: 12, borderRadius: 10, background: currentTheme.surfaceMuted, border: `1px solid ${currentTheme.cardBorder}` }}><strong style={{ fontSize: 13 }}>Payment rule after promotion ends</strong><span style={{ fontSize: 12, color: currentTheme.textMuted }}>Set the recurring minimum that begins after the 0% or deferred-interest period. This is separate from the promotional minimum above.</span><label style={{ display: "grid", gap: 6, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Post-promotion minimum</span><select value={postPromoMinimumMode} onChange={(event) => setPostPromoMinimumMode(event.target.value as "percent" | "fixed")} style={{ boxSizing: "border-box", width: "100%", minWidth: 0, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, padding: "10px 12px", background: currentTheme.surface, color: currentTheme.text }}><option value="percent">Percentage of balance</option><option value="fixed">Fixed amount</option></select></label>{postPromoMinimumMode === "percent" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, minWidth: 0 }}><Field label="Percent after promotion" id="post-promo-percent" value={postPromoMinimumPercent} onChange={setPostPromoMinimumPercent} /><CurrencyField label="Minimum floor after promotion" id="post-promo-floor" value={postPromoMinimumFloor} onChange={setPostPromoMinimumFloor} /></div> : <CurrencyField label="Fixed minimum after promotion" id="post-promo-fixed" value={postPromoFixedMinimum} onChange={setPostPromoFixedMinimum} />}</div> : null}
                      </FormSection>
                      {accountType === "loan" ? <FormSection title="Accrual / calendar behavior" helper="These rules control how scheduled dates and daily interest are calculated.">
                        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                          <input type="checkbox" checked={moveWeekend} onChange={(event) => setMoveWeekend(event.target.checked)} />
                          Move scheduled due dates that fall on weekends to next weekday
                        </label>
                        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                          <input type="checkbox" checked={roundDailyInterest} onChange={(event) => setRoundDailyInterest(event.target.checked)} />
                          Round daily interest before summing
                        </label>
                        <div style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Daily interest basis</span>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                              <input type="radio" name="day-count-basis" checked={dayCountBasis === "365"} onChange={() => setDayCountBasis("365")} />
                              Always divide APR by 365
                            </label>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                              <input type="radio" name="day-count-basis" checked={dayCountBasis === "actual-year"} onChange={() => setDayCountBasis("actual-year")} />
                              Use 366 during leap years
                            </label>
                          </div>
                          <span style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4 }}>
                            Your July 3, 2024 first-payment example strongly suggests your lender may be using 366 for 2024.
                          </span>
                        </div>
                      </FormSection> : null}
                      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={saveCurrentLoan} style={{ border: `1px solid ${currentTheme.accent}`, background: currentTheme.accent, color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{currentLoanId ? "Save changes" : accountType === "credit-card" ? "Create credit card" : "Create loan"}</button></div>
                    </>
    </>
  );
}




