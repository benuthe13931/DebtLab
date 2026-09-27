import assert from "node:assert/strict";
import test from "node:test";
import { accrueInterest } from "../../../src/calculations/loans/accrueInterest.ts";

const date = (value) => new Date(`${value}T00:00:00`);
const baseInput = (overrides = {}) => ({
  aprPercent: 12,
  dayCountBasis: "actual-year",
  endDate: date("2024-01-04"),
  pausePeriods: [],
  principal: 1_000,
  roundDailyInterest: false,
  startDate: date("2024-01-01"),
  ...overrides,
});

test("actual-year accrual uses 366 days in a leap year", () => {
  assert.ok(Math.abs(accrueInterest(baseInput()) - (1_000 * 0.12 / 366 * 3)) < 1e-12);
});

test("fixed-365 accrual uses 365 days even during a leap year", () => {
  assert.ok(Math.abs(accrueInterest(baseInput({ dayCountBasis: "365" })) - (1_000 * 0.12 / 365 * 3)) < 1e-12);
});

test("daily rounding happens before daily interest is summed", () => {
  assert.equal(accrueInterest(baseInput({ dayCountBasis: "365", roundDailyInterest: true })), 0.99);
});

test("interest-paused months exclude each covered accrual day", () => {
  const pausePeriod = {
    endMonth: date("2024-01-01"),
    id: "pause-jan",
    mode: "paused",
    startMonth: date("2024-01-01"),
  };

  assert.equal(accrueInterest(baseInput({ pausePeriods: [pausePeriod] })), 0);
  assert.ok(Math.abs(accrueInterest(baseInput({ pausePeriods: [{ ...pausePeriod, mode: "accrues" }] })) - (1_000 * 0.12 / 366 * 3)) < 1e-12);
});

test("empty intervals and non-positive balances accrue no interest", () => {
  assert.equal(accrueInterest(baseInput({ endDate: date("2024-01-01") })), 0);
  assert.equal(accrueInterest(baseInput({ principal: 0 })), 0);
  assert.equal(accrueInterest(baseInput({ aprPercent: -1 })), 0);
});