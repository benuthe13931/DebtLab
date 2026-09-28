




import { DateField } from "../../components/ui/date-fields";
import { FormSection } from "../../components/ui/summary";



import { CurrencyField } from "../../components/ui/CurrencyField";
import { Field } from "../../components/ui/Field";









































export function LoanDetailsTab({ runtime }: {runtime: LoanSimulatorRuntime;}) {
  const { currentLoanId, loanName, setLoanName, accountType, promoType, setPromoType, promoEndDate, setPromoEndDate, cardMinimumMode, setCardMinimumMode, cardMinimumPercent, setCardMinimumPercent, cardMinimumFloor, setCardMinimumFloor, postPromoMinimumMode, setPostPromoMinimumMode, postPromoMinimumPercent, setPostPromoMinimumPercent, postPromoMinimumFloor, setPostPromoMinimumFloor, postPromoFixedMinimum, setPostPromoFixedMinimum, cardStatementDate, setCardStatementDate, startingPrincipal, setStartingPrincipal, startingPrincipalDate, setStartingPrincipalDate, firstPaymentDate, setFirstPaymentDate, minimumPayment, setMinimumPayment, additionalMonthlyPayment, setAdditionalMonthlyPayment, aprPercent, setAprPercent, dueDay, setDueDay, targetDate, setTargetDate, moveWeekend, setMoveWeekend, roundDailyInterest, setRoundDailyInterest, dayCountBasis, setDayCountBasis, currentTheme, saveCurrentLoan, targetDateMinValue } = runtime;
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
    </>);

}
import type { LoanSimulatorRuntime } from "../../types/loanSimulatorRuntime";
