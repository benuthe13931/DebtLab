import assert from "node:assert/strict";
import test from "node:test";
import { estimateSavedLoanBalance } from "../../../src/calculations/debt/savedAccount.ts";

test("saved credit-card balance uses the post-promotion minimum rule", () => {
  const balance = estimateSavedLoanBalance({
    accountType: "credit-card",
    startingPrincipal: "1000",
    startingPrincipalDate: "2026-01-01",
    cardStatementDate: "2026-01-01",
    firstPaymentDate: "2026-02-01",
    dueDay: "1",
    targetDate: "2028-01-01",
    aprPercent: "24",
    cardMinimumMode: "percent",
    cardMinimumPercent: "2",
    cardMinimumFloor: "25",
    postPromoMinimumMode: "fixed",
    postPromoFixedMinimum: "200",
    postPromoMinimumPercent: "2",
    postPromoMinimumFloor: "25",
    additionalMonthlyPayment: "0",
    minimumPayment: "0",
    promoType: "zero",
    promoEndDate: "2026-04-01",
    creditCardTransactions: [],
  });

  assert.ok(balance < 1000);
});
