




import { DateField, MonthYearField } from "../../components/ui/date-fields";




import { CurrencyField } from "../../components/ui/CurrencyField";
import { Field } from "../../components/ui/Field";




import { formatMonth } from "../../calculations/loans/dateUtils";
































import { formatCurrency, formatPauseRange } from "../../utils/formatting";



export function LoanHistoryTab({ runtime }: {runtime: LoanSimulatorRuntime;}) {
  const { newOneOffDate, setNewOneOffDate, newOneOffAmount, setNewOneOffAmount, newOneOffLabel, setNewOneOffLabel, helperPausePeriods, helperPauseFromMonth, setHelperPauseFromMonth, helperPauseToMonth, setHelperPauseToMonth, helperPauseMode, setHelperPauseMode, helperBulkMode, setHelperBulkMode, helperAdjustmentFromMonth, setHelperAdjustmentFromMonth, helperAdjustmentToMonth, setHelperAdjustmentToMonth, helperAdjustmentAmount, setHelperAdjustmentAmount, helperRecurringChanges, helperDueDayChanges, helperAdjustmentDueDay, setHelperAdjustmentDueDay, helperActionError, todayValue, currentTheme, helperMaxMonthValue, deleteHelperPausePeriod, addHelperBulkAdjustment, deleteHelperRecurringChange, deleteHelperDueDayChange, addOneOffPayment, resetHelper } = runtime;
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
            gap: 12
          }}>
          
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Add one-time payment</div>
                          <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4, marginTop: 4 }}>
                            Insert a payment by date and amount. The payoff schedule will place it in the
                            correct order and recalculate from there.
                          </div>
                        </div>
                        <DateField
            id="new-one-off-date"
            label="Payment date"
            maxDate={todayValue}
            value={newOneOffDate}
            onChange={setNewOneOffDate} />
          
                        <CurrencyField
            id="new-one-off-amount"
            label="Payment amount"
            value={newOneOffAmount}
            onChange={setNewOneOffAmount} />
          
                        <Field
            id="new-one-off-label"
            label="Memo"
            value={newOneOffLabel}
            onChange={setNewOneOffLabel} />
          
                        <button
            type="button"
            onClick={addOneOffPayment}
            style={{
              border: `1px solid ${currentTheme.accent}`,
              background: currentTheme.accent,
              color: "#ffffff",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer"
            }}>
            
                          Add one-time payment
                        </button>
                      </div>
      
                      <div
          style={{
            background: currentTheme.surfaceMuted,
            border: `1px solid ${currentTheme.cardBorder}`,
            borderRadius: 12,
            padding: 14,
            display: "grid",
            gap: 12
          }}>
          
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Bulk adjust schedule</div>
                          <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4, marginTop: 4 }}>
                            Apply a month-range change instead of editing several scheduled rows one at a time.
                          </div>
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                type="radio"
                name="helper-bulk-mode"
                checked={helperBulkMode === "pause"}
                onChange={() => setHelperBulkMode("pause")} />
              
                            Pause / stop payments
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                type="radio"
                name="helper-bulk-mode"
                checked={helperBulkMode === "monthly-extra"}
                onChange={() => setHelperBulkMode("monthly-extra")} />
              
                            Update monthly extra payment
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                type="radio"
                name="helper-bulk-mode"
                checked={helperBulkMode === "minimum"}
                onChange={() => setHelperBulkMode("minimum")} />
              
                            Update minimum payment
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                type="radio"
                name="helper-bulk-mode"
                checked={helperBulkMode === "due-day"}
                onChange={() => setHelperBulkMode("due-day")} />
              
                            Change payment due date
                          </label>
                        </div>
                        <MonthYearField
            id="helper-pause-from"
            label="From"
            maxMonth={helperMaxMonthValue}
            value={helperBulkMode === "pause" ? helperPauseFromMonth : helperAdjustmentFromMonth}
            onChange={helperBulkMode === "pause" ? setHelperPauseFromMonth : setHelperAdjustmentFromMonth} />
          
                        <MonthYearField
            id="helper-pause-to"
            label="To"
            maxMonth={helperMaxMonthValue}
            value={helperBulkMode === "pause" ? helperPauseToMonth : helperAdjustmentToMonth}
            onChange={helperBulkMode === "pause" ? setHelperPauseToMonth : setHelperAdjustmentToMonth} />
          
                        {helperBulkMode === "pause" ?
          <div style={{ display: "grid", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Pause behavior</span>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                              <input
                type="radio"
                name="helper-pause-mode"
                checked={helperPauseMode === "accrues"}
                onChange={() => setHelperPauseMode("accrues")} />
              
                              Interest continues to accrue
                            </label>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                              <input
                type="radio"
                name="helper-pause-mode"
                checked={helperPauseMode === "paused"}
                onChange={() => setHelperPauseMode("paused")} />
              
                              Interest is paused
                            </label>
                          </div> :
          helperBulkMode === "due-day" ?
          <Field
            id="helper-adjustment-due-day"
            label="New due day"
            value={helperAdjustmentDueDay}
            onChange={setHelperAdjustmentDueDay} /> :


          <CurrencyField
            id="helper-adjustment-amount"
            label={helperBulkMode === "minimum" ? "New minimum payment" : "New monthly extra payment"}
            value={helperAdjustmentAmount}
            onChange={setHelperAdjustmentAmount} />

          }
                        <button
            type="button"
            onClick={addHelperBulkAdjustment}
            style={{
              border: `1px solid ${currentTheme.accent}`,
              background: currentTheme.accent,
              color: "#ffffff",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer"
            }}>
            
                          {helperBulkMode === "pause" ? "Apply pause" : helperBulkMode === "due-day" ? "Apply due-date change" : "Apply adjustment"}
                        </button>
                        {helperActionError ?
          <div
            style={{
              border: "1px solid var(--app-danger-border, #fecaca)",
              background: "var(--app-danger-bg, #fff1f2)",
              color: "var(--app-danger-text, #991b1b)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13
            }}>
            
                            {helperActionError}
                          </div> :
          null}
                        {helperPausePeriods.length > 0 ?
          <div style={{ display: "grid", gap: 8 }}>
                            {helperPausePeriods.map((pausePeriod) =>
            <div
              key={pausePeriod.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                borderTop: `1px solid ${currentTheme.cardBorder}`,
                paddingTop: 8
              }}>
              
                                <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                                  Pause payments from {formatPauseRange(pausePeriod)} with{" "}
                                  {pausePeriod.mode === "paused" ? "interest paused" : "interest accruing"}
                                </div>
                                <button
                type="button"
                onClick={() => deleteHelperPausePeriod?.(pausePeriod.id)}
                style={{
                  border: "1px solid #ef4444",
                  background: currentTheme.surface,
                  color: "#b91c1c",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 12,
                  cursor: "pointer"
                }}>
                
                                  Delete
                                </button>
                              </div>
            )}
                          </div> :
          null}
                        {helperRecurringChanges.length > 0 ?
          <div style={{ display: "grid", gap: 8 }}>
                            {helperRecurringChanges.map((change) =>
            <div
              key={change.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                borderTop: `1px solid ${currentTheme.cardBorder}`,
                paddingTop: 8
              }}>
              
                                <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                                  {change.kind === "minimum" ? "Minimum payment" : "Monthly extra payment"} becomes{" "}
                                  {formatCurrency(change.amount)} from {formatPauseRange({
                  startMonth: change.effectiveDate,
                  endMonth: change.endDate ?? change.effectiveDate,
                  id: change.id,
                  mode: "accrues"
                })}
                                </div>
                                <button
                type="button"
                onClick={() => deleteHelperRecurringChange?.(change.id)}
                style={{
                  border: "1px solid #ef4444",
                  background: currentTheme.surface,
                  color: "#b91c1c",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 12,
                  cursor: "pointer"
                }}>
                
                                  Delete
                                </button>
                              </div>
            )}
                          </div> :
          null}
                        {helperDueDayChanges.length > 0 ?
          <div style={{ display: "grid", gap: 8 }}>
                            {helperDueDayChanges.map((change) =>
            <div
              key={change.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                borderTop: `1px solid ${currentTheme.cardBorder}`,
                paddingTop: 8
              }}>
              
                                <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                                  Due day becomes {change.day} from {formatMonth(change.startMonth)}{change.endMonth ? ` through ${formatMonth(change.endMonth)}` : ""}
                                </div>
                                <button type="button" onClick={() => deleteHelperDueDayChange?.(change.id)} style={{ border: "1px solid #ef4444", background: currentTheme.surface, color: "#b91c1c", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>Delete</button>
                              </div>
            )}
                          </div> :
          null}
                      </div>
      
                      <button
          type="button"
          onClick={resetHelper}
          style={{
            border: `1px solid ${currentTheme.cardBorder}`,
            background: currentTheme.surface,
            color: currentTheme.text,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer"
          }}>
          
                        Reset all changes
                      </button>
                    </>
    </>);

}
 
import type { LoanSimulatorRuntime } from "../../types/loanSimulatorRuntime";

