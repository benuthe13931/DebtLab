import assert from "node:assert/strict";
import test from "node:test";
import { buildCreditCardSchedule } from "../../../src/calculations/cards/buildCreditCardSchedule.ts";

const baseInput = (overrides = {}) => ({
  startingPrincipal: 1_000,
  startingPrincipalDate: new Date(2026, 0, 1),
  targetDate: new Date(2026, 5, 30),
  firstPaymentDate: new Date(2026, 1, 1),
  dueDay: 1,
  aprPercent: 24,
  minimumMode: "percent",
  minimumPercent: 3,
  minimumFloor: 25,
  fixedMinimum: 50,
  postPromoMinimumMode: "fixed",
  postPromoMinimumPercent: 3,
  postPromoMinimumFloor: 25,
  postPromoFixedMinimum: 200,
  extraPayment: 0,
  promoType: "none",
  transactions: [],
  ...overrides,
});

test("credit card schedule switches to the post-promotion minimum", () => {
  const result = buildCreditCardSchedule(baseInput({ promoType: "zero", promoEndDate: new Date(2026, 2, 1) }));

  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].paymentAmount, 30);
  assert.equal(result.rows[1].paymentAmount, 29.1);
  assert.equal(result.rows[2].paymentAmount, 200);
  assert.ok(result.rows[2].accruedInterest > 0);
});

test("credit card transactions change the balance before scheduled payment", () => {
  const result = buildCreditCardSchedule(baseInput({
    fixedMinimum: 100,
    minimumMode: "fixed",
    transactions: [{ amount: 250, date: new Date(2026, 0, 15), label: "Purchase", source: "history" }],
  }));

  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].paymentAmount, 100);
  assert.ok(result.rows[0].endingPrincipal < 1_200);
  assert.ok(result.rows[0].endingPrincipal > 1_150);
});

test("credit card input validation reports invalid dates without a blank calculation", () => {
  const result = buildCreditCardSchedule(baseInput({ targetDate: new Date(2025, 11, 31) }));

  assert.equal(result.paidOff, false);
  assert.equal(result.payoffDate, null);
  assert.match(result.errors[0], /earlier than the card account date/);
});
