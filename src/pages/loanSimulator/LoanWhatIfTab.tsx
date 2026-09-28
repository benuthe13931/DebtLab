




import { DateField, MonthYearField } from "../../components/ui/date-fields";




import { CurrencyField } from "../../components/ui/CurrencyField";
import { Field } from "../../components/ui/Field";









































export function LoanWhatIfTab({ runtime }: {runtime: LoanSimulatorRuntime;}) {
  const { whatIfEntryMode, setWhatIfEntryMode, newWhatIfDate, setNewWhatIfDate, newWhatIfAmount, setNewWhatIfAmount, newWhatIfLabel, setNewWhatIfLabel, whatIfAdjustmentDate, setWhatIfAdjustmentDate, whatIfAdjustmentEndDate, setWhatIfAdjustmentEndDate, whatIfAdjustmentAmount, setWhatIfAdjustmentAmount, whatIfAdjustmentDueDay, setWhatIfAdjustmentDueDay, whatIfPauseFromMonth, setWhatIfPauseFromMonth, whatIfPauseToMonth, setWhatIfPauseToMonth, whatIfPauseMode, setWhatIfPauseMode, whatIfActionError, currentTheme, whatIfMinDateValue, addWhatIfPayment, resetWhatIf } = runtime;
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
                onChange={() => setWhatIfEntryMode("one-time")} />
              
                            Add one-time anticipated payment
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                type="radio"
                name="what-if-entry-mode"
                checked={whatIfEntryMode === "monthly-extra"}
                onChange={() => setWhatIfEntryMode("monthly-extra")} />
              
                            Update monthly extra payment
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                type="radio"
                name="what-if-entry-mode"
                checked={whatIfEntryMode === "minimum"}
                onChange={() => setWhatIfEntryMode("minimum")} />
              
                            Update minimum payment
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                type="radio"
                name="what-if-entry-mode"
                checked={whatIfEntryMode === "pause"}
                onChange={() => setWhatIfEntryMode("pause")} />
              
                            Pause / forbearance
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                            <input
                type="radio"
                name="what-if-entry-mode"
                checked={whatIfEntryMode === "due-day"}
                onChange={() => setWhatIfEntryMode("due-day")} />
              
                            Change payment due date
                          </label>
                        </div>
                        {whatIfEntryMode === "one-time" ?
          <>
                            <DateField
              id="new-what-if-date"
              label="Future payment date"
              minDate={whatIfMinDateValue}
              value={newWhatIfDate}
              onChange={setNewWhatIfDate} />
            
                            <CurrencyField
              id="new-what-if-amount"
              label="Payment amount"
              value={newWhatIfAmount}
              onChange={setNewWhatIfAmount} />
            
                            <Field
              id="new-what-if-label"
              label="Memo"
              value={newWhatIfLabel}
              onChange={setNewWhatIfLabel} />
            
                          </> :
          whatIfEntryMode === "pause" ?
          <>
                            <MonthYearField
              id="what-if-pause-from"
              label="From"
              value={whatIfPauseFromMonth}
              onChange={setWhatIfPauseFromMonth} />
            
                            <MonthYearField
              id="what-if-pause-to"
              label="To"
              value={whatIfPauseToMonth}
              onChange={setWhatIfPauseToMonth} />
            
                            <div style={{ display: "grid", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Pause behavior</span>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                                <input
                  type="radio"
                  name="what-if-pause-mode"
                  checked={whatIfPauseMode === "accrues"}
                  onChange={() => setWhatIfPauseMode("accrues")} />
                
                                Interest continues to accrue
                              </label>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                                <input
                  type="radio"
                  name="what-if-pause-mode"
                  checked={whatIfPauseMode === "paused"}
                  onChange={() => setWhatIfPauseMode("paused")} />
                
                                Interest is paused
                              </label>
                            </div>
                          </> :
          whatIfEntryMode === "due-day" ?
          <>
                            <MonthYearField id="what-if-adjustment-date" label="Beginning month" value={whatIfAdjustmentDate} onChange={setWhatIfAdjustmentDate} />
                            <MonthYearField id="what-if-adjustment-end-date" label="Ending month (optional)" value={whatIfAdjustmentEndDate} onChange={setWhatIfAdjustmentEndDate} />
                            <Field id="what-if-adjustment-due-day" label="New due day" value={whatIfAdjustmentDueDay} onChange={setWhatIfAdjustmentDueDay} />
                          </> :

          <>
                            <MonthYearField
              id="what-if-adjustment-date"
              label="Month"
              value={whatIfAdjustmentDate}
              onChange={setWhatIfAdjustmentDate} />
            
                            <MonthYearField
              id="what-if-adjustment-end-date"
              label="Ending month (optional)"
              value={whatIfAdjustmentEndDate}
              onChange={setWhatIfAdjustmentEndDate} />
            
                            <Field
              id="what-if-adjustment-amount"
              label={whatIfEntryMode === "minimum" ? "New minimum payment" : "New monthly extra payment"}
              value={whatIfAdjustmentAmount}
              onChange={setWhatIfAdjustmentAmount} />
            
                          </>
          }
                        <button
            type="button"
            onClick={() => addWhatIfPayment?.()}
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
            
                          {whatIfEntryMode === "one-time" ?
            "Add anticipated payment" :
            whatIfEntryMode === "pause" ?
            "Apply pause" :
            whatIfEntryMode === "due-day" ?
            "Apply due-date change" :
            whatIfEntryMode === "minimum" ?
            "Update minimum payment" :
            "Update monthly extra payment"}
                        </button>
                        {whatIfActionError ?
          <div
            style={{
              border: "1px solid var(--app-danger-border, #fecaca)",
              background: "var(--app-danger-bg, #fff1f2)",
              color: "var(--app-danger-text, #991b1b)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13
            }}>
            
                            {whatIfActionError}
                          </div> :
          null}
                      </div>
      
                      <button
          type="button"
          onClick={() => resetWhatIf?.()}
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

