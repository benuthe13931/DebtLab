import type { PaymentEvent, ScheduleResult, ScheduleRow } from "../../types/loans";

type CardScheduleInput = {
  startingPrincipal: number;
  startingPrincipalDate: Date;
  targetDate: Date;
  firstPaymentDate: Date;
  dueDay: number;
  aprPercent: number;
  minimumMode: "percent" | "fixed";
  minimumPercent: number;
  minimumFloor: number;
  fixedMinimum: number;
  postPromoMinimumMode: "percent" | "fixed";
  postPromoMinimumPercent: number;
  postPromoMinimumFloor: number;
  postPromoFixedMinimum: number;
  extraPayment: number;
  promoType: "none" | "zero" | "deferred";
  promoEndDate?: Date;
  transactions: PaymentEvent[];
};

const empty = (errors: string[]): ScheduleResult => ({ currentInterest: 0, currentPrincipal: 0, errors, paidOff: false, payoffDate: null, rows: [], hasNegativeAmortization: false, totalBalance: 0, totalInterestPaid: 0, totalPaid: 0, totalPrincipalPaid: 0 });
const monthsBetween = (a: Date, b: Date) => Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());

export function buildCreditCardSchedule(input: CardScheduleInput): ScheduleResult {
  if (input.startingPrincipal <= 0 || input.targetDate < input.startingPrincipalDate || input.firstPaymentDate <= input.startingPrincipalDate) return empty([input.targetDate < input.startingPrincipalDate ? "Target date cannot be earlier than the card account date." : "Enter valid card balance and payment values."]);
  let principal = input.startingPrincipal;
  let interest = 0;
  let totalPaid = 0;
  let totalInterestPaid = 0;
  let totalPrincipalPaid = 0;
  let shadowDeferredInterest = 0;
  let previous = new Date(input.startingPrincipalDate);
  const rows: ScheduleRow[] = [];
  const entries = input.transactions.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
  const endMonth = monthsBetween(input.firstPaymentDate, input.targetDate) + 1;
  for (let cycle = 0; cycle <= endMonth && principal + interest > 0.005; cycle += 1) {
    const due = cycle === 0 ? new Date(input.firstPaymentDate) : new Date(input.firstPaymentDate.getFullYear(), input.firstPaymentDate.getMonth() + cycle, Math.min(28, Math.max(1, input.dueDay)));
    if (due > input.targetDate) break;
    const beforeEntries = entries.filter((entry) => entry.date > previous && entry.date <= due);
    for (const entry of beforeEntries) {
      const charge = entry.source === "history";
      if (charge) principal += entry.amount;
      else principal = Math.max(0, principal - entry.amount);
    }
    const promoActive = input.promoEndDate && input.promoType !== "none" && due <= input.promoEndDate;
    const monthlyInterest = promoActive && input.promoType === "zero" ? 0 : principal * input.aprPercent / 100 / 12;
    if (promoActive && input.promoType === "deferred") shadowDeferredInterest += monthlyInterest;
    else interest += monthlyInterest;
    if (input.promoEndDate && input.promoType === "deferred" && due >= input.promoEndDate && shadowDeferredInterest > 0) { interest += shadowDeferredInterest; shadowDeferredInterest = 0; }
    const postPromo = Boolean(input.promoEndDate && !promoActive && input.promoType !== "none");
    const minimum = postPromo
      ? input.postPromoMinimumMode === "percent" ? Math.max(input.postPromoMinimumFloor, principal * input.postPromoMinimumPercent / 100) : input.postPromoFixedMinimum
      : input.minimumMode === "percent" ? Math.max(input.minimumFloor, principal * input.minimumPercent / 100) : input.fixedMinimum;
    const payment = Math.min(principal + interest, Math.max(0, minimum + input.extraPayment));
    const interestPaid = Math.min(payment, interest);
    const principalPaid = Math.min(principal, Math.max(0, payment - interestPaid));
    interest = Math.max(0, interest - interestPaid);
    principal = Math.max(0, principal - principalPaid);
    totalPaid += payment; totalInterestPaid += interestPaid; totalPrincipalPaid += principalPaid;
    rows.push({ accruedInterest: monthlyInterest, cycle: cycle + 1, daysAccrued: Math.max(0, Math.round((due.getTime() - previous.getTime()) / 86400000)), endingInterest: interest, endingPrincipal: principal, eventType: "scheduled", interestPaid, label: "Card payment", negativeAmortization: payment < interestPaid, paymentAmount: payment, paymentDate: due, principalShareOfPayment: payment > 0 ? principalPaid / payment : null, principalPaid, rowId: `card-${cycle}`, startingInterest: interest, startingPrincipal: principal, totalInterestBeforePayment: interest + interestPaid });
    previous = due;
  }
  const payoffDate = principal + interest <= 0.005 ? rows.at(-1)?.paymentDate ?? null : null;
  return { currentInterest: interest + shadowDeferredInterest, currentPrincipal: principal, errors: [], paidOff: Boolean(payoffDate), payoffDate, rows, hasNegativeAmortization: rows.some((row) => row.negativeAmortization), totalBalance: principal + interest + shadowDeferredInterest, totalInterestPaid, totalPaid, totalPrincipalPaid };
}
