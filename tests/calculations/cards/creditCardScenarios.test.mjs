import assert from "node:assert/strict";
import test from "node:test";
import { buildCreditCardSchedule } from "../../../src/calculations/cards/buildCreditCardSchedule.ts";

const d = (value) => new Date(`${value}T00:00:00`);
const input = (overrides = {}) => ({
  startingPrincipal: 1_000,
  startingPrincipalDate: d("2026-01-01"),
  targetDate: d("2026-12-31"),
  firstPaymentDate: d("2026-02-01"),
  dueDay: 1,
  aprPercent: 24,
  minimumMode: "percent",
  minimumPercent: 3,
  minimumFloor: 25,
  fixedMinimum: 50,
  postPromoMinimumMode: "percent",
  postPromoMinimumPercent: 3,
  postPromoMinimumFloor: 25,
  postPromoFixedMinimum: 200,
  extraPayment: 0,
  promoType: "none",
  transactions: [],
  ...overrides,
});

const valid = (overrides = {}) => {
  const result = buildCreditCardSchedule(input(overrides));
  assert.deepEqual(result.errors, []);
  return result;
};

test("credit card fixed minimum uses the configured payment", () => {
  const result = valid({ minimumMode: "fixed", fixedMinimum: 75 });
  assert.equal(result.rows[0].paymentAmount, 75);
});

test("credit card percentage minimum honors the floor", () => {
  const result = valid({ minimumPercent: 1, minimumFloor: 40 });
  assert.equal(result.rows[0].paymentAmount, 40);
});

test("credit card percentage minimum grows with a purchase", () => {
  const baseline = valid({ targetDate: d("2026-02-01") });
  const purchase = valid({ targetDate: d("2026-02-01"), transactions: [{ amount: 1_000, date: d("2026-01-15"), label: "Purchase", source: "history" }] });
  assert.ok(purchase.rows[0].paymentAmount > baseline.rows[0].paymentAmount);
});

test("percentage minimum covers monthly interest after promotion", () => {
  const result = valid({ minimumPercent: 1, minimumFloor: 0, targetDate: d("2026-02-01") });
  assert.ok(result.rows[0].paymentAmount > 20);
});

test("standalone payment reduces the balance before the next cycle", () => {
  const result = valid({ targetDate: d("2026-03-01"), transactions: [{ amount: 200, date: d("2026-01-15"), label: "Payment", source: "payment" }] });
  assert.ok(result.rows[0].endingPrincipal < 1_000);
});

test("future transactions do not affect an earlier target", () => {
  const baseline = valid({ targetDate: d("2026-02-01") });
  const future = valid({ targetDate: d("2026-02-01"), transactions: [{ amount: 500, date: d("2026-04-01"), label: "Future", source: "history" }] });
  assert.equal(future.totalPaid, baseline.totalPaid);
});

test("transactions are processed chronologically", () => {
  const result = valid({ targetDate: d("2026-02-01"), transactions: [
    { amount: 100, date: d("2026-01-20"), label: "Payment", source: "payment" },
    { amount: 200, date: d("2026-01-10"), label: "Purchase", source: "history" },
  ] });
  assert.ok(result.rows[0].endingPrincipal > 700);
  assert.ok(result.rows[0].endingPrincipal > 1_000);
});

test("zero-interest promotion accrues no interest during the promotion", () => {
  const result = valid({ targetDate: d("2026-03-01"), promoType: "zero", promoEndDate: d("2026-06-01") });
  assert.equal(result.totalInterestPaid, 0);
  assert.equal(result.rows[0].accruedInterest, 0);
});

test("post-promotion fixed minimum replaces the promotional rule", () => {
  const result = valid({ promoType: "zero", promoEndDate: d("2026-03-01"), postPromoMinimumMode: "fixed", postPromoFixedMinimum: 250 });
  assert.equal(result.rows[2].paymentAmount, 250);
});

test("post-promotion percentage minimum honors its own floor", () => {
  const result = valid({ promoType: "zero", promoEndDate: d("2026-03-01"), postPromoMinimumMode: "percent", postPromoMinimumPercent: 1, postPromoMinimumFloor: 90 });
  assert.equal(result.rows[2].paymentAmount, 90);
});

test("deferred-interest promotion records interest when it ends", () => {
  const result = valid({ promoType: "deferred", promoEndDate: d("2026-03-01") });
  assert.ok(result.rows[0].accruedInterest > 0);
  assert.ok(result.rows[2].accruedInterest > 0);
  assert.ok(result.totalInterestPaid > 0);
});

test("extra payment accelerates principal reduction", () => {
  const baseline = valid({ targetDate: d("2026-06-01") });
  const extra = valid({ targetDate: d("2026-06-01"), extraPayment: 100 });
  assert.ok(extra.currentPrincipal < baseline.currentPrincipal);
  assert.ok(extra.totalPaid > baseline.totalPaid);
});

test("zero APR produces no interest", () => {
  const result = valid({ aprPercent: 0 });
  assert.equal(result.totalInterestPaid, 0);
});

test("a large payment can pay the card off", () => {
  const result = valid({ targetDate: d("2026-03-01"), minimumMode: "fixed", fixedMinimum: 2_000 });
  assert.equal(result.paidOff, true);
  assert.ok(result.payoffDate instanceof Date);
});

test("invalid balance returns a validation error", () => {
  const result = buildCreditCardSchedule(input({ startingPrincipal: 0 }));
  assert.deepEqual(result.errors, ["Enter valid card balance and payment values."]);
  assert.equal(result.rows.length, 0);
});

test("invalid first payment date returns a validation error", () => {
  const result = buildCreditCardSchedule(input({ firstPaymentDate: d("2026-01-01") }));
  assert.deepEqual(result.errors, ["Enter valid card balance and payment values."]);
});
