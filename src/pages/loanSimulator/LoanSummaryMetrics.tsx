





import { SummaryGroupLabel, SummaryValue } from "../../components/ui/summary";


import { LabelWithNotes } from "../../components/loans/schedulePresentation";





































import { parseCurrency } from "../../utils/currency";

import { formatCurrency, formatMonthYear, formatPercent, getDifferenceLabel } from "../../utils/formatting";



const normalizeSummaryTone = (tone: string): "default" | "positive" | "negative" | "benchmark" => tone === "positive" || tone === "negative" || tone === "benchmark" ? tone : "default";

export function LoanSummaryMetrics({ runtime }: {runtime: LoanSimulatorRuntime;}) {
  const { loanName, startingPrincipal, minimumPayment, additionalMonthlyPayment, aprPercent, targetDate, activeView, showHistoricalDetails, setShowHistoricalDetails, showFutureDetails, setShowFutureDetails, showLifetimeDetails, setShowLifetimeDetails, showComparisonDetails, setShowComparisonDetails, totalMonthlyPayment, currentTheme, assumedResult, historyResult, nextPaymentDate, whatIfProjection, minimumOnlyLifetimeInterest, assumedInterestSavedAsOfToday, helperInterestSavedAsOfToday, assumedScenarioLifetimeInterest, assumedScenarioLifetimeSaved, assumedScenarioRemainingInterest, assumedScenarioRemainingSaved, helperScenarioLifetimeInterest, helperScenarioLifetimeSaved, helperScenarioRemainingInterest, helperScenarioRemainingSaved, whatIfProjectedExtrasSavedRemaining, whatIfScenarioRemainingInterest, whatIfScenarioLifetimeInterest, whatIfScenarioSaved, activePayoffPercent, activeProjectedPayoffDate, activeDailyInterestCost, activePayoffDuration, activeTimeSavedLabel, softDangerMessage, whatIfDeltaInterest, whatIfBaselinePayoffDate, whatIfTimeChangeLabel, assumedLifetimeSavedTone, helperLifetimeSavedTone, whatIfLifetimeSavedTone, assumedRemainingInterestNotes, assumedRemainingSavedNotes, assumedLifetimeSavedNotes, helperRemainingInterestNotes, helperRemainingSavedNotes, helperLifetimeSavedNotes, whatIfRemainingInterestNotes, whatIfAdditionalSavedNotes, whatIfLifetimeSavedNotes, footnote2Text, negativeAmortizationWarning } = runtime;
  return (
    <>
                  <div
        style={{
          background: currentTheme.surface,
          border: `1px solid ${currentTheme.cardBorder}`,
          borderRadius: 18,
          padding: 20,
          display: "grid",
          gap: 20,
          boxShadow: currentTheme.cardShadow
        }}>
        
                    <div style={{ display: "grid", gap: 4 }}>
                      <h2 style={{ margin: 0, fontSize: 22 }}>{loanName || "Loan"} summary</h2>
                      <div style={{ fontSize: 12, color: currentTheme.textMuted }}>Current state as of {targetDate || "-"}</div>
                    </div>
                    <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))"
          }}>
          
                      <SummaryValue label="APR" value={formatPercent(Number(aprPercent) || 0)} />
                      <SummaryValue label="Starting balance" value={formatCurrency(parseCurrency(startingPrincipal))} />
                      <SummaryValue label="Minimum payment" value={formatCurrency(parseCurrency(minimumPayment))} />
                      <SummaryValue label="Monthly extra payment" value={formatCurrency(parseCurrency(additionalMonthlyPayment))} />
                      <SummaryValue
            label="Total scheduled payment"
            value={formatCurrency(parseCurrency(totalMonthlyPayment))}
            subtext="Minimum payment + monthly extra payment" />
          
                      <SummaryValue label="Next scheduled payment date" value={nextPaymentDate} />
                    </div>
                    <div style={{ display: "grid", gap: 14 }}>
                      <SummaryGroupLabel label="OUTSTANDING BALANCES" />
                      <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
            }}>
            
                        <SummaryValue
              label="Principal"
              value={formatCurrency(activeView === "assumed" ? assumedResult.currentPrincipal : historyResult.currentPrincipal)} />
            
                        <SummaryValue
              label="Interest"
              value={formatCurrency(activeView === "assumed" ? assumedResult.currentInterest : historyResult.currentInterest)} />
            
                        <SummaryValue
              label="Total balance"
              value={formatCurrency(activeView === "assumed" ? assumedResult.totalBalance : historyResult.totalBalance)}
              emphasized
              tone="benchmark" />
            
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 14 }}>
                      <SummaryGroupLabel label="PAYOFF OUTLOOK" />
                      <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
            }}>
            
                        <SummaryValue
              label="Payoff progress"
              value={formatPercent(activePayoffPercent)}
              emphasized
              subtext={
              <div style={{ display: "grid", gap: 8 }}>
                              <div>{`You've paid off ${Math.round(activePayoffPercent)}% of your loan`}</div>
                              <div
                  style={{
                    width: "100%",
                    height: 8,
                    borderRadius: 999,
                    background: currentTheme.isDark ? "rgba(96, 165, 250, 0.18)" : "#dbeafe",
                    overflow: "hidden"
                  }}>
                  
                                <div
                    style={{
                      width: `${Math.max(0, Math.min(100, activePayoffPercent))}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${currentTheme.accent}, ${currentTheme.isDark ? "#93c5fd" : "#38bdf8"})`,
                      borderRadius: 999
                    }} />
                  
                              </div>
                            </div>
              } />
            
                        <SummaryValue
              label="Projected payoff"
              value={formatMonthYear(activeProjectedPayoffDate)}
              emphasized
              subtext={activePayoffDuration === "-" ? undefined : `~${activePayoffDuration} remaining`} />
            
                        <SummaryValue
              label={<LabelWithNotes text="Time difference vs minimum-only plan" notes={[1]} />}
              value={activeTimeSavedLabel}
              emphasized />
            
                      </div>
                    </div>
                    {negativeAmortizationWarning ?
        <div
          style={{
            border: "1px solid #fbbf24",
            background: currentTheme.isDark ? "rgba(146, 64, 14, 0.18)" : "#fffbeb",
            color: "#92400e",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 14,
            fontWeight: 600
          }}>
          
                        Negative amortization detected: at least one cycle has a payment that does not
                        reduce principal, so the balance can grow.
                      </div> :
        null}
                    {!negativeAmortizationWarning && softDangerMessage ?
        <div
          style={{
            border: "1px solid #fde68a",
            background: currentTheme.isDark ? "rgba(146, 64, 14, 0.18)" : "#fffbeb",
            color: "#92400e",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 14,
            fontWeight: 600
          }}>
          
                        {softDangerMessage}
                      </div> :
        null}
                    <div
          style={{
            display: "grid",
            gap: 12,
            padding: 14,
            borderRadius: 14,
            background: currentTheme.surfaceMuted,
            border: `1px solid ${currentTheme.cardBorder}`
          }}>
          
                      <div style={{ fontSize: 14, fontWeight: 700, color: currentTheme.text }}>Additional details</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => setShowHistoricalDetails((value) => !value)} style={{ border: `1px solid ${showHistoricalDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showHistoricalDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Historical details</button>
                        <button type="button" onClick={() => setShowFutureDetails((value) => !value)} style={{ border: `1px solid ${showFutureDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showFutureDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Future projection details</button>
                        <button type="button" onClick={() => setShowLifetimeDetails((value) => !value)} style={{ border: `1px solid ${showLifetimeDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showLifetimeDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Lifetime details</button>
                        {activeView === "whatif" ?
            <button type="button" onClick={() => setShowComparisonDetails((value) => !value)} style={{ border: `1px solid ${showComparisonDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showComparisonDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Comparison details</button> :
            null}
                        <button type="button" onClick={() => {setShowHistoricalDetails(true);setShowFutureDetails(true);setShowLifetimeDetails(true);setShowComparisonDetails(activeView === "whatif");}} style={{ border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Expand all</button>
                        <button type="button" onClick={() => {setShowHistoricalDetails(false);setShowFutureDetails(false);setShowLifetimeDetails(false);setShowComparisonDetails(false);}} style={{ border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Collapse all</button>
                      </div>
                    </div>
                    {activeView === "assumed" && showHistoricalDetails ?
        <div style={{ display: "grid", gap: 22 }}>
                        <div style={{ display: "grid", gap: 14 }}>
                          <SummaryGroupLabel label={`PAID AS OF ${targetDate || "-"}`} />
                          <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}>
              
                            <SummaryValue
                label="Principal paid"
                value={formatCurrency(assumedResult.totalPrincipalPaid)} />
              
                            <SummaryValue
                label="Interest paid"
                value={formatCurrency(assumedResult.totalInterestPaid)} />
              
                            <SummaryValue
                label={<LabelWithNotes text="Interest difference vs minimum-only plan" notes={[1]} />}
                value={formatCurrency(assumedInterestSavedAsOfToday)} />
              
                          </div>
                        </div>
                      </div> :
        null}
                    {activeView === "assumed" && showFutureDetails ?
        <div style={{ display: "grid", gap: 22 }}>
                        <div style={{ display: "grid", gap: 14 }}>
                          <SummaryGroupLabel label="REMAINING INTEREST" />
                          <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}>
              
                            <SummaryValue
                label={<LabelWithNotes text="Interest" notes={assumedRemainingInterestNotes} />}
                value={formatCurrency(assumedScenarioRemainingInterest)} />
              
                            <SummaryValue
                label={<LabelWithNotes text={getDifferenceLabel({ negative: "Additional interest cost", positive: "Additional interest saved", value: assumedScenarioRemainingSaved })} notes={assumedRemainingSavedNotes} />}
                value={formatCurrency(Math.abs(assumedScenarioRemainingSaved))} />
              
                          </div>
                        </div>
                      </div> :
        null}
                    {activeView === "assumed" && showLifetimeDetails ?
        <div style={{ display: "grid", gap: 22 }}>
                        <div style={{ display: "grid", gap: 14 }}>
                          <SummaryGroupLabel label="LIFETIME INTEREST" />
                          <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}>
              
                            <SummaryValue
                label="Minimum only payments"
                value={formatCurrency(minimumOnlyLifetimeInterest)}
                emphasized
                tone="benchmark" />
              
                            <SummaryValue
                label={<LabelWithNotes text="Actual interest" notes={[3]} />}
                value={formatCurrency(assumedScenarioLifetimeInterest)}
                emphasized />
              
                            <SummaryValue
                label={<LabelWithNotes text="Daily interest cost" notes={[3]} />}
                value={`${formatCurrency(activeDailyInterestCost)} / day`}
                emphasized />
              
                            <SummaryValue
                label={<LabelWithNotes text={getDifferenceLabel({ negative: "Extra interest vs minimum-only plan", positive: "Interest saved vs minimum-only plan", value: assumedScenarioLifetimeSaved })} notes={assumedLifetimeSavedNotes} />}
                value={formatCurrency(Math.abs(assumedScenarioLifetimeSaved))}
                emphasized
                tone={normalizeSummaryTone(assumedLifetimeSavedTone)} />
              
                          </div>
                        </div>
                      </div> :
        null}
                    {activeView === "history" && showHistoricalDetails ?
        <div style={{ display: "grid", gap: 22 }}>
                        <div style={{ display: "grid", gap: 14 }}>
                          <SummaryGroupLabel label={`PAID AS OF ${targetDate || "-"}`} />
                          <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}>
              
                            <SummaryValue
                label="Principal paid"
                value={formatCurrency(historyResult.totalPrincipalPaid)} />
              
                            <SummaryValue
                label="Interest paid"
                value={formatCurrency(historyResult.totalInterestPaid)} />
              
                            <SummaryValue
                label={<LabelWithNotes text="Interest difference vs minimum-only plan" notes={[1]} />}
                value={formatCurrency(helperInterestSavedAsOfToday)} />
              
                          </div>
                        </div>
                      </div> :
        null}
                    {activeView === "history" && showFutureDetails ?
        <div style={{ display: "grid", gap: 22 }}>
                        <div style={{ display: "grid", gap: 14 }}>
                          <SummaryGroupLabel label="REMAINING INTEREST" />
                          <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}>
              
                            <SummaryValue
                label={<LabelWithNotes text="Interest" notes={helperRemainingInterestNotes} />}
                value={formatCurrency(helperScenarioRemainingInterest)} />
              
                            <SummaryValue
                label={<LabelWithNotes text={getDifferenceLabel({ negative: "Additional interest cost", positive: "Additional interest saved", value: helperScenarioRemainingSaved })} notes={helperRemainingSavedNotes} />}
                value={formatCurrency(Math.abs(helperScenarioRemainingSaved))} />
              
                          </div>
                        </div>
                      </div> :
        null}
                    {activeView === "history" && showLifetimeDetails ?
        <div style={{ display: "grid", gap: 22 }}>
                        <div style={{ display: "grid", gap: 14 }}>
                          <SummaryGroupLabel label="LIFETIME INTEREST" />
                          <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}>
              
                            <SummaryValue
                label="Minimum only payments"
                value={formatCurrency(minimumOnlyLifetimeInterest)}
                emphasized
                tone="benchmark" />
              
                            <SummaryValue
                label={<LabelWithNotes text="Actual interest" notes={[3]} />}
                value={formatCurrency(helperScenarioLifetimeInterest)}
                emphasized />
              
                            <SummaryValue
                label={<LabelWithNotes text="Daily interest cost" notes={[3]} />}
                value={`${formatCurrency(activeDailyInterestCost)} / day`}
                emphasized />
              
                            <SummaryValue
                label={<LabelWithNotes text={getDifferenceLabel({ negative: "Extra interest vs minimum-only plan", positive: "Interest saved vs minimum-only plan", value: helperScenarioLifetimeSaved })} notes={helperLifetimeSavedNotes} />}
                value={formatCurrency(Math.abs(helperScenarioLifetimeSaved))}
                emphasized
                tone={normalizeSummaryTone(helperLifetimeSavedTone)} />
              
                          </div>
                        </div>
                      </div> :
        null}
                    {activeView === "whatif" && showHistoricalDetails ?
        <div style={{ display: "grid", gap: 22 }}>
                        <div style={{ display: "grid", gap: 14 }}>
                          <SummaryGroupLabel label={`PAID AS OF ${targetDate || "-"}`} />
                          <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}>
              
                            <SummaryValue
                label="Principal paid"
                value={formatCurrency(historyResult.totalPrincipalPaid)} />
              
                            <SummaryValue
                label="Interest paid"
                value={formatCurrency(historyResult.totalInterestPaid)} />
              
                            <SummaryValue
                label={<LabelWithNotes text="Interest difference vs minimum-only plan" notes={[1]} />}
                value={formatCurrency(helperInterestSavedAsOfToday)} />
              
                          </div>
                        </div>
                      </div> :
        null}
                    {activeView === "whatif" && showFutureDetails ?
        <div style={{ display: "grid", gap: 22 }}>
                        <div style={{ display: "grid", gap: 14 }}>
                          <SummaryGroupLabel label="REMAINING INTEREST" />
                          <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}>
              
                            <SummaryValue
                label={<LabelWithNotes text="Interest" notes={whatIfRemainingInterestNotes} />}
                value={formatCurrency(whatIfScenarioRemainingInterest)} />
              
                            <SummaryValue
                label={<LabelWithNotes text={getDifferenceLabel({ negative: "Additional interest cost", positive: "Additional interest saved", value: whatIfProjectedExtrasSavedRemaining })} notes={whatIfAdditionalSavedNotes} />}
                value={formatCurrency(Math.abs(whatIfProjectedExtrasSavedRemaining))} />
              
                          </div>
                        </div>
                      </div> :
        null}
                    {activeView === "whatif" && showLifetimeDetails ?
        <div style={{ display: "grid", gap: 22 }}>
                        <div style={{ display: "grid", gap: 14 }}>
                          <SummaryGroupLabel label="LIFETIME INTEREST" />
                          <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}>
              
                            <SummaryValue
                label="Minimum only payments"
                value={formatCurrency(minimumOnlyLifetimeInterest)}
                emphasized
                tone="benchmark" />
              
                            <SummaryValue
                label={<LabelWithNotes text="Actual interest" notes={[3]} />}
                value={formatCurrency(whatIfScenarioLifetimeInterest)}
                emphasized />
              
                            <SummaryValue
                label={<LabelWithNotes text="Daily interest cost" notes={[3]} />}
                value={`${formatCurrency(activeDailyInterestCost)} / day`}
                emphasized />
              
                            <SummaryValue
                label={<LabelWithNotes text={getDifferenceLabel({ negative: "Extra interest vs minimum-only plan", positive: "Interest saved vs minimum-only plan", value: whatIfScenarioSaved })} notes={whatIfLifetimeSavedNotes} />}
                value={formatCurrency(Math.abs(whatIfScenarioSaved))}
                emphasized
                tone={normalizeSummaryTone(whatIfLifetimeSavedTone)} />
              
                          </div>
                        </div>
                      </div> :
        null}
                    {activeView === "whatif" && showComparisonDetails ?
        <div style={{ display: "grid", gap: 22 }}>
                        <div
            style={{
              border: `1px solid ${currentTheme.isDark ? currentTheme.accent : "#dbeafe"}`,
              background: currentTheme.isDark ? "rgba(30, 58, 95, 0.45)" : "#f8fbff",
              borderRadius: 12,
              padding: 14,
              display: "grid",
              gap: 10
            }}>
            
                          <div style={{ fontSize: 13, fontWeight: 700, color: currentTheme.isDark ? "#93c5fd" : "#1d4ed8" }}>
                            Current baseline plan vs what-if plan
                          </div>
                          <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}>
              
                            <SummaryValue
                label={getDifferenceLabel({ negative: "Interest difference vs current baseline", positive: "Interest difference vs current baseline", value: whatIfDeltaInterest })}
                value={formatCurrency(Math.abs(whatIfDeltaInterest))}
                subtext={
                whatIfDeltaInterest < 0 ?
                "Higher than the current baseline" :
                whatIfDeltaInterest > 0 ?
                "Lower than the current baseline" :
                undefined
                } />
              
                            <SummaryValue
                label="Time difference vs current baseline"
                value={whatIfTimeChangeLabel} />
              
                            <SummaryValue
                label="Payoff date vs current baseline"
                value={formatMonthYear(whatIfProjection.payoffDate)}
                subtext={`Current baseline: ${formatMonthYear(whatIfBaselinePayoffDate)}`} />
              
                          </div>
                        </div>
                      </div> :
        null}
                    <div style={{ display: "grid", gap: 6, fontSize: 12, color: currentTheme.textMuted, marginTop: 4 }}>
                      <div>1. Compared to minimum-only payments.</div>
                      <div>{footnote2Text}</div>
                    </div>
                  </div>
      
      
    </>);

}
 
import type { LoanSimulatorRuntime } from "../../types/loanSimulatorRuntime";

