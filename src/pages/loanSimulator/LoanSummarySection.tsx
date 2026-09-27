// @ts-nocheck
import { LoanSummaryMetrics } from "./LoanSummaryMetrics";
import { LoanSummarySchedule } from "./LoanSummarySchedule";
export function LoanSummarySection({ runtime }: { runtime: Record<string, any> }) { return (<section style={{ display: runtime.activeLoanTab === "details" || runtime.activeLoanTab === "transactions" ? "none" : "grid", gap: 24, textAlign: "left", width: "100%", minWidth: 0 }}><LoanSummaryMetrics runtime={runtime} /><LoanSummarySchedule runtime={runtime} /></section>); }
