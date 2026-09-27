import { estimateSavedLoanBalance as calculateSavedLoanBalance } from "./estimateSavedLoanBalance";
import { parseDate } from "../loans/dateUtils";
import { parseCurrency } from "../../utils/currency";
import type { LoanSnapshot } from "../../types/loans";
export function estimateSavedLoanBalance(data: LoanSnapshot) {
  if (data.accountType === "credit-card") {
    let balance = parseCurrency(data.startingPrincipal);
    const start = parseDate(data.startingPrincipalDate) ?? new Date();
    const target = parseDate(data.targetDate) ?? new Date();
    const promoEnd = parseDate(data.promoEndDate ?? "");
    const months = Math.max(0, (target.getFullYear() - start.getFullYear()) * 12 + target.getMonth() - start.getMonth());
    const entries = [...(data.creditCardTransactions ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    for (const entry of entries) { const date = parseDate(entry.date); if (date && date <= target && date >= start) balance += entry.source === "history" ? entry.amount : -entry.amount; }
    for (let month = 0; month < months && balance > 0; month += 1) {
      const at = new Date(start.getFullYear(), start.getMonth() + month, 1);
      const promoActive = promoEnd && data.promoType !== "none" && at <= promoEnd;
      if (!promoActive || data.promoType === "deferred") balance += balance * (Number(data.aprPercent) || 0) / 100 / 12;
      const minimum = data.cardMinimumMode === "percent" ? Math.max(parseCurrency(data.cardMinimumFloor ?? "0"), balance * (Number(data.cardMinimumPercent) || 0) / 100) : parseCurrency(data.minimumPayment);
      balance = Math.max(0, balance - minimum - parseCurrency(data.additionalMonthlyPayment));
    }
    return Math.max(0, balance);
  }
  return calculateSavedLoanBalance({
    aprPercent: Number(data.aprPercent) || 0,
    additionalMonthlyPayment: parseCurrency(data.additionalMonthlyPayment),
    minimumPayment: parseCurrency(data.minimumPayment),
    oneOffPayments: data.oneOffPayments.map((payment) => ({ amount: payment.amount, date: parseDate(payment.date) })),
    startingPrincipal: parseCurrency(data.startingPrincipal),
    startingPrincipalDate: parseDate(data.startingPrincipalDate),
    targetDate: parseDate(data.targetDate),
  });
}

export function estimateSavedAccountMinimum(data: LoanSnapshot): number {
  if (data.accountType !== "credit-card") return parseCurrency(data.minimumPayment) + parseCurrency(data.additionalMonthlyPayment);
  const balance = parseCurrency(data.startingPrincipal);
  const percentMinimum = Math.max(parseCurrency(data.cardMinimumFloor ?? "0"), balance * (Number(data.cardMinimumPercent) || 0) / 100);
  return (data.cardMinimumMode === "fixed" ? parseCurrency(data.minimumPayment) : percentMinimum) + parseCurrency(data.additionalMonthlyPayment);
}

