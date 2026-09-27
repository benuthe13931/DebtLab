import assert from "node:assert/strict";
import test from "node:test";
import { buildSchedule, getNextScheduledPaymentDate } from "../../../src/calculations/loans/schedule.ts";

const date = (value) => new Date(`${value}T00:00:00`);
const scheduleInput = (overrides = {}) => ({
  actualPayments: [],
  aprPercent: 12,
  dayCountBasis: "365",
  dueDay: 31,
  firstPaymentDate: date("2024-01-31"),
  minimumPayment: 200,
  moveWeekend: false,
  roundDailyInterest: false,
  scheduledMode: "always",
  startingPrincipal: 1_000,
  startingPrincipalDate: date("2024-01-01"),
  targetDate: date("2024-01-31"),
  ...overrides,
});

test("scheduled payment allocates accrued interest before principal", () => {
  const result = buildSchedule(scheduleInput());

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].daysAccrued, 30);
  assert.ok(Math.abs(result.rows[0].accruedInterest - 9.863013698630137) < 1e-10);
  assert.ok(Math.abs(result.rows[0].interestPaid - 9.863013698630137) < 1e-10);
  assert.ok(Math.abs(result.rows[0].principalPaid - 190.13698630136986) < 1e-10);
  assert.ok(Math.abs(result.currentPrincipal - 809.8630136986301) < 1e-10);
});

test("actual payments are replayed chronologically before later scheduled payments", () => {
  const result = buildSchedule(scheduleInput({
    actualPayments: [{ amount: 100, date: date("2024-01-15"), id: "history-1", label: "Payment", source: "history" }],
  }));

  assert.deepEqual(result.rows.map((row) => row.eventType), ["history", "scheduled"]);
  assert.deepEqual(result.rows.map((row) => row.daysAccrued), [14, 16]);
  assert.deepEqual(result.rows.map((row) => row.paymentAmount), [100, 200]);
});

test("as-of snapshots accrue from the last payment date through the target date", () => {
  const result = buildSchedule(scheduleInput({ appendAsOfRow: true, targetDate: date("2024-02-10") }));

  assert.equal(result.rows.at(-1).eventType, "snapshot");
  assert.equal(result.rows.at(-1).daysAccrued, 10);
  assert.ok(result.currentInterest > 0);
  assert.equal(result.rows.at(-1).rowId, "snapshot-2024-02-10");
});

test("a paused scheduled payment is zero and follows the interest pause mode", () => {
  const pause = { endMonth: date("2024-01-01"), id: "pause", mode: "paused", startMonth: date("2024-01-01") };
  const result = buildSchedule(scheduleInput({ pausePeriods: [pause] }));

  assert.equal(result.rows[0].eventType, "paused");
  assert.equal(result.rows[0].paymentAmount, 0);
  assert.equal(result.rows[0].accruedInterest, 0);
});

test("invalid schedule dates and due days retain the existing validation errors", () => {
  assert.deepEqual(buildSchedule(scheduleInput({ dueDay: 32 })).errors, ["Due day must be between 1 and 31."]);
  assert.deepEqual(buildSchedule(scheduleInput({ firstPaymentDate: date("2024-01-01") })).errors, ["First payment date must be after the starting principal date."]);
});

test("next scheduled date advances, clamps month-end, and applies weekend movement", () => {
  const next = getNextScheduledPaymentDate({
    afterDate: date("2024-06-15"),
    dueDay: 31,
    firstPaymentDate: date("2024-06-01"),
    moveWeekend: true,
  });

  assert.equal(next.toISOString().slice(0, 10), "2024-07-31");
});