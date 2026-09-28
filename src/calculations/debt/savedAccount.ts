import { estimateSavedLoanBalance as calculateSavedLoanBalance } from "./estimateSavedLoanBalance.ts";
import { parseDate, toDateInputValue } from "../loans/dateUtils.ts";
import { parseCurrency } from "../../utils/currency.ts";
import type { LoanSnapshot } from "../../types/loans";
import { buildCreditCardSchedule } from "../cards/buildCreditCardSchedule.ts";

function nextCardPaymentDate(start: Date, dueDay: number): Date {
  const day = Math.min(28, Math.max(1, dueDay || 1));
  let payment = new Date(start.getFullYear(), start.getMonth(), day);
  if (payment <= start) payment = new Date(start.getFullYear(), start.getMonth() + 1, day);
  return payment;
}

export function estimateSavedLoanBalance(data: LoanSnapshot) {
  if (data.accountType === "credit-card") {
    const start = parseDate(data.cardStatementDate ?? "") ?? parseDate(data.startingPrincipalDate) ?? new Date();
    const target = parseDate(data.targetDate) ?? new Date();
    if (target < start) return parseCurrency(data.startingPrincipal);
    const firstPayment = parseDate(data.firstPaymentDate) ?? nextCardPaymentDate(start, Number(data.dueDay) || 1);
    const result = buildCreditCardSchedule({
      startingPrincipal: parseCurrency(data.startingPrincipal),
      startingPrincipalDate: start,
      targetDate: target,
      firstPaymentDate: firstPayment,
      dueDay: Number(data.dueDay) || 1,
      aprPercent: Number(data.aprPercent) || 0,
      minimumMode: data.cardMinimumMode ?? "percent",
      minimumPercent: Number(data.cardMinimumPercent) || 0,
      minimumFloor: parseCurrency(data.cardMinimumFloor ?? "0"),
      fixedMinimum: parseCurrency(data.minimumPayment),
      postPromoMinimumMode: data.postPromoMinimumMode ?? "percent",
      postPromoMinimumPercent: Number(data.postPromoMinimumPercent) || 0,
      postPromoMinimumFloor: parseCurrency(data.postPromoMinimumFloor ?? "0"),
      postPromoFixedMinimum: parseCurrency(data.postPromoFixedMinimum ?? ""),
      extraPayment: parseCurrency(data.additionalMonthlyPayment),
      promoType: data.promoType ?? "none",
      promoEndDate: parseDate(data.promoEndDate ?? "") ?? undefined,
      transactions: (data.creditCardTransactions ?? []).flatMap((entry) => {
        const date = parseDate(entry.date);
        return date ? [{ ...entry, date }] : [];
      }),
    });
    return Math.max(0, result.totalBalance);
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

export function estimateSavedCurrentBalance(data: LoanSnapshot): number {
  if (typeof data.overviewBalance === "number" && Number.isFinite(data.overviewBalance)) {
    return Math.max(0, data.overviewBalance);
  }
  return estimateSavedLoanBalance({ ...data, targetDate: toDateInputValue(new Date()) });
}

export function estimateSavedAccountMinimum(data: LoanSnapshot): number {
  if (data.accountType !== "credit-card") return parseCurrency(data.minimumPayment) + parseCurrency(data.additionalMonthlyPayment);
  const balance = estimateSavedLoanBalance(data);
  const target = parseDate(data.targetDate ?? "");
  const promoEnd = parseDate(data.promoEndDate ?? "");
  const promoActive = Boolean(target && promoEnd && data.promoType !== "none" && target <= promoEnd);
  const mode = promoActive ? data.cardMinimumMode ?? "percent" : data.postPromoMinimumMode ?? data.cardMinimumMode ?? "percent";
  const percent = promoActive ? Number(data.cardMinimumPercent) || 0 : Number(data.postPromoMinimumPercent ?? data.cardMinimumPercent) || 0;
  const floor = promoActive ? parseCurrency(data.cardMinimumFloor ?? "0") : parseCurrency(data.postPromoMinimumFloor ?? data.cardMinimumFloor ?? "0");
  const monthlyInterest = promoActive ? 0 : balance * (Number(data.aprPercent) || 0) / 100 / 12;
  const minimum = mode === "fixed"
    ? promoActive ? parseCurrency(data.minimumPayment) : parseCurrency(data.postPromoFixedMinimum ?? data.minimumPayment)
    : Math.max(floor, balance * percent / 100 + monthlyInterest);
  return minimum + parseCurrency(data.additionalMonthlyPayment);
}

