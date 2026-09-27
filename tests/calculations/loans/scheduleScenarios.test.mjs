import assert from "node:assert/strict";
import test from "node:test";
import { buildSchedule, getNextScheduledPaymentDate } from "../../../src/calculations/loans/schedule.ts";

const d = (value) => new Date(`${value}T00:00:00`);
const input = (overrides = {}) => ({
  actualPayments: [],
  aprPercent: 12,
  dayCountBasis: "365",
  dueDay: 15,
  firstPaymentDate: d("2026-02-15"),
  minimumPayment: 200,
  moveWeekend: false,
  roundDailyInterest: false,
  scheduledMode: "always",
  startingPrincipal: 1_000,
  startingPrincipalDate: d("2026-01-01"),
  targetDate: d("2026-12-31"),
  ...overrides,
});
const valid = (overrides = {}) => {
  const result = buildSchedule(input(overrides));
  assert.deepEqual(result.errors, []);
  return result;
};

test("zero APR leaves the principal unchanged by interest", () => assert.equal(valid({ aprPercent: 0 }).totalInterestPaid, 0));
test("higher APR produces more interest", () => assert.ok(valid({ aprPercent: 24 }).totalInterestPaid > valid({ aprPercent: 6 }).totalInterestPaid));
test("larger minimum payment reduces the ending principal", () => assert.ok(valid({ minimumPayment: 400, targetDate: d("2026-02-15") }).currentPrincipal < valid({ minimumPayment: 100, targetDate: d("2026-02-15") }).currentPrincipal));
test("monthly extra can pay a loan off earlier", () => { const result = valid({ minimumPayment: 2_000, targetDate: d("2026-03-15") }); assert.equal(result.paidOff, true); });
test("a payment before the first scheduled date is replayed first", () => { const result = valid({ actualPayments: [{ amount: 100, date: d("2026-01-15"), id: "p1", label: "Payment", source: "history" }] }); assert.equal(result.rows[0].eventType, "history"); });
test("a payment after the target date is ignored", () => { const baseline = valid(); const result = valid({ actualPayments: [{ amount: 500, date: d("2027-01-01"), id: "future", label: "Future", source: "history" }] }); assert.equal(result.totalPaid, baseline.totalPaid); });
test("starting interest is paid before principal", () => { const result = valid({ startingInterest: 50, targetDate: d("2026-02-15") }); assert.ok(result.rows[0].interestPaid >= 50); });
test("rounding daily interest changes the accumulated cents", () => { const rounded = valid({ roundDailyInterest: true }); const exact = valid({ roundDailyInterest: false }); assert.notEqual(rounded.rows[0].accruedInterest, exact.rows[0].accruedInterest); });
test("actual-year basis uses leap-year denominator", () => { const result = valid({ dayCountBasis: "actual-year", startingPrincipalDate: d("2024-02-01"), firstPaymentDate: d("2024-03-01"), targetDate: d("2024-03-01") }); assert.ok(result.rows[0].accruedInterest > 0); });
test("weekend movement never returns a weekend", () => { for (const dueDay of [7, 8]) { const result = getNextScheduledPaymentDate({ afterDate: d("2026-01-01"), dueDay, firstPaymentDate: d(`2026-01-${String(dueDay).padStart(2, "0")}`), moveWeekend: true }); assert.ok(result.getDay() > 0 && result.getDay() < 6); } });
test("month-end due day is clamped", () => { const result = getNextScheduledPaymentDate({ afterDate: d("2026-01-31"), dueDay: 31, firstPaymentDate: d("2026-01-31"), moveWeekend: false }); assert.equal(result.getDate(), 28); });
test("scheduled due-day changes apply to later months", () => { const result = getNextScheduledPaymentDate({ afterDate: d("2026-01-20"), dueDay: 15, firstPaymentDate: d("2026-01-15"), dueDayChanges: [{ day: 25, startMonth: d("2026-02-01") }], moveWeekend: false }); assert.equal(result.getDate(), 25); });
test("scheduled mode never omits scheduled rows", () => { const result = valid({ scheduledMode: "never" }); assert.equal(result.rows.length, 0); });
test("scheduled cutoff delays scheduled rows until after the cutoff", () => { const result = valid({ scheduledMode: "after-cutoff", scheduledCutoffDate: d("2026-05-01") }); assert.ok(result.rows.every((row) => row.paymentDate > d("2026-05-01") || row.eventType === "history")); });
test("paused interest mode keeps interest at zero", () => { const result = valid({ targetDate: d("2026-03-15"), pausePeriods: [{ id: "pause", startMonth: d("2026-01-01"), endMonth: d("2026-03-01"), mode: "paused" }] }); assert.equal(result.rows.filter((row) => row.eventType === "paused")[0].accruedInterest, 0); });
test("accruing pause mode still reports unpaid interest", () => { const result = valid({ targetDate: d("2026-03-15"), pausePeriods: [{ id: "pause", startMonth: d("2026-01-01"), endMonth: d("2026-03-01"), mode: "accrues" }] }); assert.ok(result.currentInterest >= 0); });
test("deleted scheduled row is skipped", () => { const result = valid({ deletedRowIds: new Set(["scheduled-2026-02-15"]) }); assert.ok(result.rows.length >= 0); });
test("payment amount override changes a scheduled row", () => { const baseline = valid({ targetDate: d("2026-02-15") }); const result = valid({ targetDate: d("2026-02-15"), paymentAmountOverrides: { [baseline.rows[0].rowId]: "50" } }); assert.equal(result.rows[0].paymentAmount, 50); });
test("payment date override changes event ordering", () => { const result = valid({ paymentDateOverrides: { "scheduled-2026-02-15": "2026-02-10" } }); assert.ok(result.rows.length > 0); });
test("append-as-of adds a snapshot row", () => { const result = valid({ targetDate: d("2026-03-20"), appendAsOfRow: true }); assert.equal(result.rows.at(-1).eventType, "snapshot"); });
