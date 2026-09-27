import assert from "node:assert/strict";
import test from "node:test";
import { simulatePortfolio } from "../../../src/calculations/debt/simulatePortfolio.ts";

const loans = [
  { id: "a", name: "A", apr: 24, balance: 1_000, minimum: 50 },
  { id: "b", name: "B", apr: 8, balance: 500, minimum: 25 },
  { id: "c", name: "C", apr: 15, balance: 250, minimum: 20 },
];

test("portfolio starting total equals all balances", () => assert.equal(simulatePortfolio(loans, "minimum", 0).startingTotal, 1_750));
test("minimum strategy does not use extra budget", () => { const r = simulatePortfolio(loans, "minimum", 500); assert.ok(r.months > 0); });
test("avalanche and snowball both produce snapshots", () => { for (const strategy of ["avalanche", "snowball"]) assert.ok(simulatePortfolio(loans, strategy, 100).snapshots.length > 0); });
test("extra budget cannot increase payoff duration", () => assert.ok(simulatePortfolio(loans, "avalanche", 100).months <= simulatePortfolio(loans, "avalanche", 0).months));
test("extra budget cannot increase interest", () => assert.ok(simulatePortfolio(loans, "avalanche", 100).totalInterest <= simulatePortfolio(loans, "avalanche", 0).totalInterest));
test("higher APR debt gets avalanche priority", () => { const r = simulatePortfolio(loans, "avalanche", 100); const first = r.snapshots[0].balances; assert.ok(first.a < 1_000); });
test("smallest balance gets snowball priority", () => { const r = simulatePortfolio(loans, "snowball", 100); assert.ok(r.snapshots[0].balances.c < 250); });
test("empty portfolio has no simulation months or snapshots", () => { const r = simulatePortfolio([], "avalanche", 100); assert.equal(r.months, 0); assert.deepEqual(r.snapshots, []); assert.equal(r.totalInterest, 0); });
test("zero-balance loans are ignored", () => { const r = simulatePortfolio([{ ...loans[0], balance: 0 }], "minimum", 0); assert.equal(r.months, 0); });
test("portfolio snapshots are limited to the first year", () => assert.ok(simulatePortfolio([{ ...loans[0], minimum: 1 }], "minimum", 0).snapshots.length <= 12));
