import assert from "node:assert/strict";
import test from "node:test";
import {
  addMonths,
  clampToMonth,
  formatMonth,
  parseDate,
  toDateInputValue,
} from "../../../src/calculations/loans/dateUtils.ts";

test("date input conversion and month formatting use local calendar fields", () => {
  const value = new Date(2024, 1, 29);

  assert.equal(toDateInputValue(value), "2024-02-29");
  assert.equal(formatMonth(value), "2024-02");
  assert.equal(toDateInputValue(parseDate("2024-02-29")), "2024-02-29");
  assert.equal(parseDate(""), null);
});

test("month addition preserves end-of-month clamping", () => {
  assert.equal(toDateInputValue(addMonths(new Date(2024, 0, 31), 1)), "2024-02-29");
  assert.equal(toDateInputValue(addMonths(new Date(2023, 0, 31), 1)), "2023-02-28");
});

test("clampToMonth limits due days to the month length", () => {
  assert.equal(toDateInputValue(clampToMonth(2024, 1, 31)), "2024-02-29");
  assert.equal(toDateInputValue(clampToMonth(2025, 3, 15)), "2025-04-15");
});