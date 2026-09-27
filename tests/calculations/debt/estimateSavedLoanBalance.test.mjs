import assert from "node:assert/strict";
import test from "node:test";
import { estimateSavedLoanBalance } from "../../../src/calculations/debt/estimateSavedLoanBalance.ts";

const date = (value) => new Date(`${value}T00:00:00`);

test("saved loan balance preserves the monthly projection and subtracts payments through the target date", () => {
  const balance = estimateSavedLoanBalance({
    aprPercent: 12,
    additionalMonthlyPayment: 0,
    minimumPayment: 100,
    oneOffPayments: [
      { amount: 50, date: date("2026-03-15") },
      { amount: 25, date: date("2026-04-01") },
      { amount: 200, date: date("2026-04-02") },
    ],
    startingPrincipal: 1_000,
    startingPrincipalDate: date("2026-01-01"),
    targetDate: date("2026-04-01"),
  });

  assert.equal(Math.round(balance * 100) / 100, 652.29);
});

test("saved loan balance returns the starting principal when dates are absent or target is not later", () => {
  const common = {
    aprPercent: 12,
    additionalMonthlyPayment: 0,
    minimumPayment: 100,
    oneOffPayments: [{ amount: 500, date: date("2026-02-01") }],
    startingPrincipal: 1_000,
    startingPrincipalDate: date("2026-01-01"),
  };

  assert.equal(estimateSavedLoanBalance({ ...common, startingPrincipalDate: null, targetDate: date("2026-04-01") }), 1_000);
  assert.equal(estimateSavedLoanBalance({ ...common, targetDate: date("2026-01-01") }), 1_000);
});

test("saved loan balance cannot become negative after large payments", () => {
  const balance = estimateSavedLoanBalance({
    aprPercent: 0,
    additionalMonthlyPayment: 0,
    minimumPayment: 100,
    oneOffPayments: [{ amount: 5_000, date: date("2026-02-01") }],
    startingPrincipal: 1_000,
    startingPrincipalDate: date("2026-01-01"),
    targetDate: date("2026-02-01"),
  });

  assert.equal(balance, 0);
});