import assert from "node:assert/strict";
import test from "node:test";
import { simulatePortfolio } from "../../../src/calculations/debt/simulatePortfolio.ts";

const loans = [
  { apr: 20, balance: 1_000, id: "large-high", minimum: 100, name: "High APR" },
  { apr: 5, balance: 500, id: "small-low", minimum: 50, name: "Low APR" },
];

test("portfolio payoff strategies preserve their baseline interest and duration", () => {
  const avalanche = simulatePortfolio(loans, "avalanche", 100);
  const snowball = simulatePortfolio(loans, "snowball", 100);
  const minimum = simulatePortfolio(loans, "minimum", 100);

  assert.equal(avalanche.startingTotal, 1_500);
  assert.equal(avalanche.months, 7);
  assert.equal(Math.round(avalanche.totalInterest * 100) / 100, 62.88);
  assert.equal(snowball.months, 7);
  assert.equal(Math.round(snowball.totalInterest * 100) / 100, 78.91);
  assert.equal(minimum.months, 12);
  assert.equal(Math.round(minimum.totalInterest * 100) / 100, 114.84);
});

test("portfolio reports negative amortization instead of implying a payoff", () => {
  const result = simulatePortfolio([
    { apr: 22.74, balance: 9_832.77, id: "card", minimum: 98.33, name: "Chase Ink" },
  ], "minimum", 0);

  assert.equal(result.negativeAmortization, true);
  assert.equal(result.payoffDate, null);
});

test("zero extra means avalanche and snowball use literal minimums", () => {
  const avalanche = simulatePortfolio(loans, "avalanche", 0);
  const snowball = simulatePortfolio(loans, "snowball", 0);
  const minimum = simulatePortfolio(loans, "minimum", 0);

  assert.equal(avalanche.months, minimum.months);
  assert.equal(snowball.months, minimum.months);
  assert.equal(avalanche.totalInterest, minimum.totalInterest);
  assert.equal(snowball.totalInterest, minimum.totalInterest);
});

test("avalanche and snowball target the expected balances in the first monthly snapshot", () => {
  const avalanche = simulatePortfolio(loans, "avalanche", 100);
  const snowball = simulatePortfolio(loans, "snowball", 100);
  const minimum = simulatePortfolio(loans, "minimum", 100);

  assert.ok(Math.abs(avalanche.snapshots[0].balances["large-high"] - 816.6666666666666) < 1e-9);
  assert.ok(Math.abs(avalanche.snapshots[0].balances["small-low"] - 452.0833333333333) < 1e-9);
  assert.ok(Math.abs(snowball.snapshots[0].balances["large-high"] - 916.6666666666666) < 1e-9);
  assert.ok(Math.abs(snowball.snapshots[0].balances["small-low"] - 352.0833333333333) < 1e-9);
  assert.deepEqual(minimum.snapshots[0].balances, {
    "large-high": 916.6666666666666,
    "small-low": 452.0833333333333,
  });
});

test("empty portfolio returns immediately with no snapshots", () => {
  const result = simulatePortfolio([], "avalanche", 100);

  assert.equal(result.startingTotal, 0);
  assert.equal(result.months, 0);
  assert.equal(result.totalInterest, 0);
  assert.deepEqual(result.snapshots, []);
  assert.equal(result.payoffDate?.getDate(), 1);
});
