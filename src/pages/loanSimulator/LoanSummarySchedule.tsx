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
export function LoanSummarySchedule({ runtime }: { runtime: Record<string, any> }) {
  const { userProfiles, setUserProfiles, currentUserId, setCurrentUserId, authMode, setAuthMode, authName, setAuthName, authDisplayName, setAuthDisplayName, authPassword, setAuthPassword, authError, setAuthError, activePage, setActivePage, activeLoanTab, setActiveLoanTab, loanSidebarCollapsed, setLoanSidebarCollapsed, profileMenuOpen, setProfileMenuOpen, deleteAccountConfirmOpen, setDeleteAccountConfirmOpen, profileMenuRef, profileDraftName, setProfileDraftName, profileDraftEmail, setProfileDraftEmail, profileStatus, setProfileStatus, passwordResetCodeInput, setPasswordResetCodeInput, passwordResetNewPassword, setPasswordResetNewPassword, passwordResetConfirmPassword, setPasswordResetConfirmPassword, savedLoans, setSavedLoans, currentLoanId, setCurrentLoanId, saveStatus, setSaveStatus, loanName, setLoanName, accountType, setAccountType, promoType, setPromoType, promoEndDate, setPromoEndDate, cardMinimumMode, setCardMinimumMode, cardMinimumPercent, setCardMinimumPercent, cardMinimumFloor, setCardMinimumFloor, postPromoMinimumMode, setPostPromoMinimumMode, postPromoMinimumPercent, setPostPromoMinimumPercent, postPromoMinimumFloor, setPostPromoMinimumFloor, postPromoFixedMinimum, setPostPromoFixedMinimum, cardStatementDate, setCardStatementDate, creditCardTransactions, setCreditCardTransactions, startingPrincipal, setStartingPrincipal, startingPrincipalDate, setStartingPrincipalDate, firstPaymentDate, setFirstPaymentDate, minimumPayment, setMinimumPayment, additionalMonthlyPayment, setAdditionalMonthlyPayment, aprPercent, setAprPercent, dueDay, setDueDay, targetDate, setTargetDate, moveWeekend, setMoveWeekend, roundDailyInterest, setRoundDailyInterest, dayCountBasis, setDayCountBasis, activeView, setActiveView, showAmortization, setShowAmortization, showHelperAmortization, setShowHelperAmortization, oneOffPayments, setOneOffPayments, newOneOffDate, setNewOneOffDate, newOneOffAmount, setNewOneOffAmount, newOneOffLabel, setNewOneOffLabel, helperPausePeriods, setHelperPausePeriods, helperPauseFromMonth, setHelperPauseFromMonth, helperPauseToMonth, setHelperPauseToMonth, helperPauseMode, setHelperPauseMode, helperBulkMode, setHelperBulkMode, helperAdjustmentFromMonth, setHelperAdjustmentFromMonth, helperAdjustmentToMonth, setHelperAdjustmentToMonth, helperAdjustmentAmount, setHelperAdjustmentAmount, helperRecurringChanges, setHelperRecurringChanges, helperDueDayChanges, setHelperDueDayChanges, helperAdjustmentDueDay, setHelperAdjustmentDueDay, deletedHelperRowIds, setDeletedHelperRowIds, helperActionError, setHelperActionError, helperPaymentAmountOverrides, setHelperPaymentAmountOverrides, paymentDateOverrides, setPaymentDateOverrides, paymentLabelOverrides, setPaymentLabelOverrides, editingPaymentId, setEditingPaymentId, editingPaymentDate, setEditingPaymentDate, editingPaymentAmount, setEditingPaymentAmount, editingPaymentLabel, setEditingPaymentLabel, whatIfPayments, setWhatIfPayments, whatIfRecurringChanges, setWhatIfRecurringChanges, whatIfPausePeriods, setWhatIfPausePeriods, whatIfEntryMode, setWhatIfEntryMode, newWhatIfDate, setNewWhatIfDate, newWhatIfAmount, setNewWhatIfAmount, newWhatIfLabel, setNewWhatIfLabel, whatIfAdjustmentDate, setWhatIfAdjustmentDate, whatIfAdjustmentEndDate, setWhatIfAdjustmentEndDate, whatIfAdjustmentAmount, setWhatIfAdjustmentAmount, whatIfAdjustmentDueDay, setWhatIfAdjustmentDueDay, whatIfDueDayChanges, setWhatIfDueDayChanges, whatIfPauseFromMonth, setWhatIfPauseFromMonth, whatIfPauseToMonth, setWhatIfPauseToMonth, whatIfPauseMode, setWhatIfPauseMode, whatIfActionError, setWhatIfActionError, showHistoricalDetails, setShowHistoricalDetails, showFutureDetails, setShowFutureDetails, showLifetimeDetails, setShowLifetimeDetails, showComparisonDetails, setShowComparisonDetails, cardScheduleStart, cardScheduleFirstPayment, cardScheduleTarget, deferredStartingPrincipal, deferredStartingPrincipalDate, deferredFirstPaymentDate, deferredMinimumPayment, deferredAdditionalMonthlyPayment, deferredAprPercent, deferredDueDay, deferredTargetDate, cardMinimumPayment, cardProjectionNudge, effectiveMinimumPayment, totalMonthlyPayment, buildProjection, todayDate, todayValue, getSavedLoansStorageKey, currentUser, currentTheme, displayName, firstName, profileInitial, serializePaymentEvent, deserializePaymentEvent, serializeRecurringChange, deserializeRecurringChange, serializePausePeriod, deserializePausePeriod, serializeDueDayChange, deserializeDueDayChange, applyLoanSnapshot, buildLoanSnapshot, loadLoansForUser, persistSavedLoans, persistUserProfiles, updateCurrentUserProfile, loginUser, handleAuthSubmit, logoutUser, deleteCurrentUserProfile, saveProfileDetails, applyThemeToProfile, sendPasswordResetEmail, applyPasswordReset, saveCurrentLoan, startNewLoan, loadSavedLoan, deleteLoan, helperVisiblePayments, helperPaymentsThroughTarget, helperPausePeriodsThroughTarget, helperScheduledAdjustments, helperDueDayAdjustments, assumedResult, minimumOnlyToDateProjection, amortizationTargetDate, fullLoanTargetDate, assumedCurrentPlanProjection, amortizationProjection, minimumOnlyFullProjection, assumedFullProjection, historyResult, helperAmortizationTargetDate, helperProjection, helperCurrentPlanProjection, whatIfTargetDate, nextPaymentDate, whatIfAllPayments, whatIfRecurringAdjustments, whatIfDueDayAdjustments, whatIfProjection, loanInputsReady, historyErrors, assumedInterestSaved, minimumOnlyLifetimeInterest, assumedInterestSavedAsOfToday, assumedInterestSavedFromTodayForward, helperInterestSavedAsOfToday, helperInterestSavedOverall, helperInterestSavedFromTodayForward, assumedInterestStillOwedWithAdditional, helperTotalExpectedInterestPaidIncludingAdditional, whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly, whatIfTotalExpectedInterestPaidIncludingAnticipated, whatIfHasProjectedExtras, assumedScenarioLifetimeInterest, assumedScenarioLifetimeSaved, assumedScenarioRemainingInterest, assumedScenarioRemainingSaved, helperScenarioLifetimeInterest, helperScenarioLifetimeSaved, helperScenarioRemainingInterest, helperScenarioRemainingSaved, minimumOnlyRemainingInterest, whatIfBaseRemainingInterest, whatIfBaseLifetimeInterest, whatIfProjectedExtrasSavedRemaining, whatIfScenarioRemainingInterest, whatIfScenarioLifetimeInterest, whatIfScenarioSaved, startingPrincipalAmount, assumedPayoffPercent, historyPayoffPercent, activePayoffPercent, activeProjectedPayoffDate, canShowAssumedSchedule, baselinePayoffDate, activeAsOfDate, projectedScenarioPrincipalForDailyCost, activeInterestStartDate, activeInterestEndDate, activeDailyInterestCost, activePayoffDuration, baselinePayoffDeltaMonths, activeTimeSavedLabel, assumedReferenceRow, historyReferenceRow, whatIfReferenceRow, activeReferenceRow, activePrincipalShare, activeInterestShare, softDangerMessage, whatIfDeltaInterest, whatIfBaselinePayoffDate, whatIfDeltaMonths, whatIfTimeChangeLabel, assumedLifetimeSavedTone, helperLifetimeSavedTone, whatIfLifetimeSavedTone, assumedRemainingInterestNotes, assumedRemainingSavedNotes, assumedLifetimeSavedNotes, helperRemainingInterestNotes, helperRemainingSavedNotes, helperLifetimeSavedNotes, whatIfRemainingInterestNotes, whatIfAdditionalSavedNotes, whatIfLifetimeSavedNotes, footnote2Text, assumedHasNegativeAmortization, historyHasNegativeAmortization, whatIfHasNegativeAmortization, negativeAmortizationWarning, startingPrincipalDateValue, minimumTargetDate, targetDateMinValue, helperMaxMonthValue, whatIfMinimumPaymentDate, whatIfMinDate, whatIfMinDateValue, addHelperPausePeriod, deleteHelperPausePeriod, addHelperBulkAdjustment, deleteHelperRecurringChange, deleteHelperDueDayChange, addOneOffPayment, startEditingReplayRow, saveEditedPayment, cancelEditingPayment, deleteHelperRow, addWhatIfPayment, deleteWhatIfPayment, deleteWhatIfRecurringChange, deleteWhatIfDueDayChange, deleteWhatIfPausePeriod, resetHelper, resetWhatIf, headerLoans, headerProjection, headerOriginalDebt, headerProgress } = runtime;
  return (
    <>
                  {activeLoanTab === "details" ? null : activeView === "assumed" ? (
                    <>
                      {assumedResult.errors.length > 0 ? (
                        <div style={{ display: "grid", gap: 10 }}>
                          {assumedResult.errors.map((error) => (
                            <div
                              key={error}
                              style={{
                                border: "1px solid var(--app-danger-border, #fecaca)",
                                background: "var(--app-danger-bg, #fff1f2)",
                                color: "var(--app-danger-text, #991b1b)",
                                borderRadius: 12,
                                padding: 12,
                              }}
                            >
                              {error}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div
                        style={{
                          background: currentTheme.surface,
                          border: `1px solid ${currentTheme.cardBorder}`,
                          borderRadius: 18,
                          padding: 20,
                          width: "100%",
                          minWidth: 0,
                          boxShadow: currentTheme.cardShadow,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                          <div>
                            <h2 style={{ margin: 0, fontSize: 22 }}>Assumed payment schedule</h2>
                            <p style={{ margin: "8px 0 0", color: currentTheme.textMuted, fontSize: 14 }}>
                              This table is based only on the recurring minimum payment assumptions above.
                            </p>
                          </div>
                          <div style={{ display: "grid", gap: 8, justifyItems: "start", maxWidth: 320 }}>
                            <button
                              type="button"
                              onClick={() => setShowAmortization((value) => !value)}
                              style={{
                                border: `1px solid ${currentTheme.cardBorder}`,
                                background: currentTheme.surface,
                                color: currentTheme.text,
                                borderRadius: 999,
                                padding: "10px 16px",
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {showAmortization ? "Hide future amortization" : "Show future amortization"}
                            </button>
                          </div>
                        </div>
      
                        {!canShowAssumedSchedule ? (
                          <div
                            style={{
                              border: `1px dashed ${currentTheme.cardBorder}`,
                              borderRadius: 12,
                              padding: 16,
                              color: currentTheme.textMuted,
                            }}
                          >
                            Enter both the starting principal date and first scheduled payment date to show
                            the assumed schedule.
                          </div>
                        ) : assumedResult.errors.length > 0 ? (
                          <div
                            style={{
                              border: `1px dashed ${currentTheme.cardBorder}`,
                              borderRadius: 12,
                              padding: 16,
                              color: currentTheme.textMuted,
                            }}
                          >
                            Enter the loan inputs to build the assumed schedule.
                          </div>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                              <colgroup>
                                <col style={{ width: "13%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "11%" }} />
                                <col style={{ width: "13%" }} />
                                <col style={{ width: "13%" }} />
                                <col style={{ width: "14%" }} />
                              </colgroup>
                              <thead>
                                <tr style={{ background: currentTheme.surfaceMuted }}>
                                  {["Date", "Payment", "Interest paid", "Principal paid", "% to principal", "Outstanding principal", "Outstanding interest", "Total outstanding balance"].map((heading) => (
                                    <th
                                      key={heading}
                                      style={{
                                        padding: "10px 8px",
                                        borderBottom: `1px solid ${currentTheme.cardBorder}`,
                                        fontSize: 14,
                                        textAlign: "left",
                                        color: currentTheme.textMuted,
                                      }}
                                    >
                                      {heading}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(showAmortization ? amortizationProjection.rows : assumedResult.rows).map((row) => (
                                  <tr key={`${row.eventType}-${row.label}-${row.paymentDate.toISOString()}`} style={getTableRowStyle(row)}>
                                    <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14, whiteSpace: "nowrap" }}>{toDateInputValue(row.paymentDate)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.paymentAmount)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>
                                      <div>{formatCurrency(row.interestPaid)}</div>
                                      {row.eventType === "paused" && row.accruedInterest > 0 ? (
                                        <div style={{ fontSize: 12, color: "#b45309" }}>
                                          Accrued {formatCurrency(row.accruedInterest)}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.principalPaid)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>
                                      <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                      {row.negativeAmortization ? (
                                        <div style={{ fontSize: 12, color: "#b45309" }}>Negative amortization</div>
                                      ) : null}
                                    </td>
                                    <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.endingPrincipal)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.endingInterest)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.endingPrincipal + row.endingInterest)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : activeView === "history" ? (
                    <>
                      {historyErrors.length > 0 ? (
                        <div style={{ display: "grid", gap: 10 }}>
                          {historyErrors.map((error) => (
                            <div
                              key={error}
                              style={{
                                border: "1px solid var(--app-danger-border, #fecaca)",
                                background: "var(--app-danger-bg, #fff1f2)",
                                color: "var(--app-danger-text, #991b1b)",
                                borderRadius: 12,
                                padding: 12,
                              }}
                            >
                              {error}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {helperActionError ? (
                        <div
                          style={{
                            border: "1px solid var(--app-danger-border, #fecaca)",
                            background: "var(--app-danger-bg, #fff1f2)",
                            color: "var(--app-danger-text, #991b1b)",
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          {helperActionError}
                        </div>
                      ) : null}
      
                      <div
                        style={{
                          background: currentTheme.surface,
                          border: `1px solid ${currentTheme.cardBorder}`,
                          borderRadius: 18,
                          padding: 20,
                          width: "100%",
                          minWidth: 0,
                          boxShadow: currentTheme.cardShadow,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
                          <h2 style={{ margin: 0, fontSize: 22 }}>Payment timeline</h2>
                          <div style={{ display: "grid", gap: 8, justifyItems: "start", maxWidth: 320 }}>
                            <button
                              type="button"
                              onClick={() => {
                                cancelEditingPayment();
                                setShowHelperAmortization((value) => !value);
                              }}
                              style={{
                                border: `1px solid ${currentTheme.cardBorder}`,
                                background: currentTheme.surface,
                                color: currentTheme.text,
                                borderRadius: 999,
                                padding: "10px 16px",
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {showHelperAmortization ? "Hide future amortization" : "Show future amortization"}
                            </button>
                          </div>
                        </div>
                        <p style={{ margin: "0 0 16px", color: currentTheme.textMuted, fontSize: 14 }}>
                          Edit payment dates and amounts directly here, add extra payments, or delete rows.
                          The payoff schedule recalculates through the `As of target date` row.
                        </p>
                        {(showHelperAmortization ? helperProjection.rows : historyResult.rows).length === 0 ? (
                          <div
                            style={{
                              border: `1px dashed ${currentTheme.cardBorder}`,
                              borderRadius: 12,
                              padding: 16,
                              color: currentTheme.textMuted,
                            }}
                          >
                            Add loan inputs and payment history to see the replay.
                          </div>
                        ) : (
                          <div style={{ width: "100%", minWidth: 0 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                              <colgroup>
                                <col style={{ width: "4%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "8%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "7%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "10%" }} />
                              </colgroup>
                              <thead>
                                <tr style={{ background: currentTheme.surfaceMuted }}>
                                  {["Type", "Memo", "Date", "Payment", "Interest paid", "Principal paid", "% to principal", "Outstanding principal", "Outstanding interest", "Total outstanding balance", "Actions"].map((heading) => (
                                    <th
                                      key={heading}
                                      style={{
                                        padding: "9px 5px",
                                        borderBottom: `1px solid ${currentTheme.cardBorder}`,
                                        fontSize: 12,
                                        textAlign: "left",
                                        color: currentTheme.textMuted,
                                      }}
                                    >
                                      {heading}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(showHelperAmortization ? helperProjection.rows : historyResult.rows).map((row) => (
                                  <tr key={row.rowId} style={getTableRowStyle(row)}>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }} title={getEventTypeTitle(row.eventType)}>{getEventTypeCode(row.eventType)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                      {editingPaymentId === row.rowId ? (
                                        <input
                                          type="text"
                                          value={editingPaymentLabel}
                                          onChange={(event) => setEditingPaymentLabel(event.target.value)}
                                          style={{
                                            border: "1px solid #cbd5e1",
                                            borderRadius: 8,
                                            padding: "6px 8px",
                                            fontSize: 12,
                                            width: "100%",
                                            minWidth: 0,
                                          }}
                                        />
                                      ) : (
                                        row.label
                                      )}
                                    </td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }}>
                                      {editingPaymentId === row.rowId ? (
                                        <div style={{ width: "100%", minWidth: 0 }}>
                                          <DatePickerInput
                                            compact
                                            maxDate={todayValue}
                                            value={editingPaymentDate}
                                            onChange={setEditingPaymentDate}
                                          />
                                        </div>
                                      ) : (
                                        toDateInputValue(row.paymentDate)
                                      )}
                                    </td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                      {editingPaymentId === row.rowId ? (
                                        <CurrencyInput compact value={editingPaymentAmount} onChange={setEditingPaymentAmount} />
                                      ) : (
                                        formatCurrency(row.paymentAmount)
                                      )}
                                    </td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                      <div>{formatCurrency(row.interestPaid)}</div>
                                      {row.eventType === "paused" && row.accruedInterest > 0 ? (
                                        <div style={{ fontSize: 12, color: "#b45309" }}>
                                          Accrued {formatCurrency(row.accruedInterest)}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.principalPaid)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                      <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                      {row.negativeAmortization ? (
                                        <div style={{ fontSize: 12, color: "#b45309" }}>Negative amortization</div>
                                      ) : null}
                                    </td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingInterest)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal + row.endingInterest)}</td>
                                    <td style={{ padding: "8px 5px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 12 }}>
                                      {row.eventType === "snapshot" || row.eventType === "paused" || showHelperAmortization ? (
                                        <span style={{ color: currentTheme.textMuted, fontSize: 12 }}>Auto</span>
                                      ) : editingPaymentId === row.rowId ? (
                                        <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                                          <button
                                            type="button"
                                            aria-label="Edit payment"
                                            title="Edit payment"
                                            onClick={saveEditedPayment}
                                            style={{
                                              border: `1px solid ${currentTheme.accent}`,
                                              background: currentTheme.accent,
                                              color: "#ffffff",
                                              borderRadius: 8,
                                              padding: 6,
                                              fontSize: 12,
                                              cursor: "pointer",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            onClick={cancelEditingPayment}
                                            style={{
                                              border: `1px solid ${currentTheme.cardBorder}`,
                                              background: currentTheme.surface,
                                              color: currentTheme.text,
                                              borderRadius: 8,
                                              padding: "6px 10px",
                                              fontSize: 12,
                                              cursor: "pointer",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ display: "grid", gap: 5 }}>
                                          <button
                                            type="button"
                                            onClick={() => startEditingReplayRow(row)}
                                            style={{
                                              border: `1px solid ${currentTheme.cardBorder}`,
                                              background: currentTheme.surface,
                                              color: currentTheme.text,
                                              borderRadius: 8,
                                              padding: "6px 10px",
                                              fontSize: 12,
                                              cursor: "pointer",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm10-12 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                          </button>
                                          <button
                                            type="button"
                                            aria-label="Delete payment"
                                            title="Delete payment"
                                            onClick={() => deleteHelperRow(row.rowId)}
                                            style={{
                                              border: "1px solid #ef4444",
                                              background: "var(--app-danger-bg, #fff1f2)",
                                              color: "var(--app-danger-text, #b91c1c)",
                                              borderRadius: 8,
                                              padding: 6,
                                              fontSize: 12,
                                              cursor: "pointer",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {loanInputsReady && (historyErrors.length > 0 || whatIfProjection.errors.length > 0) ? (
                        <div style={{ display: "grid", gap: 10 }}>
                          {[...historyErrors, ...whatIfProjection.errors].map((error, index) => (
                            <div
                              key={`${error}-${index}`}
                              style={{
                                border: "1px solid var(--app-danger-border, #fecaca)",
                                background: "var(--app-danger-bg, #fff1f2)",
                                color: "var(--app-danger-text, #991b1b)",
                                borderRadius: 12,
                                padding: 12,
                              }}
                            >
                              {error}
                            </div>
                          ))}
                        </div>
                      ) : null}
      
                      <div
                        style={{
                          background: currentTheme.surface,
                          border: `1px solid ${currentTheme.cardBorder}`,
                          borderRadius: 18,
                          padding: 20,
                          width: "100%",
                          minWidth: 0,
                          boxShadow: currentTheme.cardShadow,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
                          <div>
                            <h2 style={{ margin: 0, fontSize: 22 }}>What If Projection</h2>
                            <p style={{ margin: "8px 0 0", color: currentTheme.textMuted, fontSize: 14 }}>
                              This starts from the payment-history balance as of {targetDate || "today"} and
                              then applies your future payment adjustments to project a new payoff path.
                            </p>
                          </div>
                          <div />
                        </div>
                        {whatIfPayments.length > 0 || whatIfRecurringChanges.length > 0 || whatIfPausePeriods.length > 0 || whatIfDueDayChanges.length > 0 ? (
                          <div
                            style={{
                              background: currentTheme.surfaceMuted,
                              border: `1px solid ${currentTheme.cardBorder}`,
                              borderRadius: 12,
                              padding: 14,
                              marginBottom: 16,
                              display: "grid",
                              gap: 10,
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Projected payment changes</div>
                            {whatIfPausePeriods.map((pausePeriod) => (
                              <div
                                key={pausePeriod.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                                  Pause payments from {formatPauseRange(pausePeriod)} with{" "}
                                  {pausePeriod.mode === "paused" ? "interest paused" : "interest accruing"}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => deleteWhatIfPausePeriod(pausePeriod.id)}
                                  style={{
                                    border: "1px solid #ef4444",
                                    background: currentTheme.surface,
                                    color: "#b91c1c",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                            {whatIfRecurringChanges.map((change) => (
                              <div
                                key={change.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                                  {change.kind === "minimum" ? "Minimum payment" : "Monthly extra"} becomes{" "}
                                  {formatCurrency(change.amount)} starting in {formatMonth(change.effectiveDate)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => deleteWhatIfRecurringChange(change.id)}
                                  style={{
                                    border: "1px solid #ef4444",
                                    background: currentTheme.surface,
                                    color: "#b91c1c",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                            {whatIfDueDayChanges.map((change) => (
                              <div
                                key={change.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                                  Due day becomes {change.day} starting in {formatMonth(change.startMonth)}{change.endMonth ? ` through ${formatMonth(change.endMonth)}` : ""}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => deleteWhatIfDueDayChange(change.id)}
                                  style={{
                                    border: "1px solid #ef4444",
                                    background: currentTheme.surface,
                                    color: "#b91c1c",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                            {whatIfPayments.map((payment) => (
                              <div
                                key={payment.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                                  {payment.label} on {toDateInputValue(payment.date)} for {formatCurrency(payment.amount)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => deleteWhatIfPayment(payment.id ?? "")}
                                  style={{
                                    border: "1px solid #ef4444",
                                    background: currentTheme.surface,
                                    color: "#b91c1c",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {whatIfProjection.rows.length === 0 ? (
                          <div
                            style={{
                              border: `1px dashed ${currentTheme.cardBorder}`,
                              borderRadius: 12,
                              padding: 16,
                              color: currentTheme.textMuted,
                            }}
                          >
                            Add loan inputs first, then add payments in Payoff Schedule if needed. This tab will project
                            forward from the current balance date.
                          </div>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                              <colgroup>
                                <col style={{ width: "5%" }} />
                                <col style={{ width: "16%" }} />
                                <col style={{ width: "11%" }} />
                                <col style={{ width: "11%" }} />
                                <col style={{ width: "11%" }} />
                                <col style={{ width: "11%" }} />
                                <col style={{ width: "8%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "13%" }} />
                              </colgroup>
                              <thead>
                                <tr style={{ background: currentTheme.surfaceMuted }}>
                                  {["Type", "Memo", "Date", "Payment", "Interest paid", "Principal paid", "% to principal", "Outstanding principal", "Outstanding interest", "Total outstanding balance"].map((heading) => (
                                    <th
                                      key={heading}
                                      style={{
                                        padding: "10px 8px",
                                        borderBottom: `1px solid ${currentTheme.cardBorder}`,
                                        fontSize: 14,
                                        textAlign: "left",
                                        color: currentTheme.textMuted,
                                      }}
                                    >
                                      {heading}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {whatIfProjection.rows.map((row) => (
                                  <tr key={row.rowId} style={getTableRowStyle(row)}>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }} title={getEventTypeTitle(row.eventType)}>{getEventTypeCode(row.eventType)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{row.label}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }}>{toDateInputValue(row.paymentDate)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.paymentAmount)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                      <div>{formatCurrency(row.interestPaid)}</div>
                                      {row.eventType === "paused" && row.accruedInterest > 0 ? (
                                        <div style={{ fontSize: 12, color: "#b45309" }}>
                                          Accrued {formatCurrency(row.accruedInterest)}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.principalPaid)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                      <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                      {row.negativeAmortization ? (
                                        <div style={{ fontSize: 12, color: "#b45309" }}>Negative amortization</div>
                                      ) : null}
                                    </td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingInterest)}</td>
                                    <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal + row.endingInterest)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
    </>
  );
}
