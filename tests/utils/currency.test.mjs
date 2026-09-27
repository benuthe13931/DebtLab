import assert from "node:assert/strict";
import test from "node:test";
import { parseCurrency } from "../../src/utils/currency.ts";

test("parseCurrency handles formatted amounts and invalid input", () => {
  assert.equal(parseCurrency("$1,234.56"), 1_234.56);
  assert.equal(parseCurrency(" 1 234.56 "), 1_234.56);
  assert.equal(parseCurrency(""), 0);
  assert.equal(parseCurrency("not an amount"), 0);
});