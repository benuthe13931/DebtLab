import assert from "node:assert/strict";
import test from "node:test";
import { estimateSavedAccountMinimum, estimateSavedAccountMinimumForMonth, estimateSavedCurrentBalance, estimateSavedLoanBalance } from "../../../src/calculations/debt/savedAccount.ts";

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

test("saved credit-card minimum switches after promotion", () => {
  const minimum = estimateSavedAccountMinimum({
    accountType: "credit-card",
    startingPrincipal: "1000",
    startingPrincipalDate: "2026-01-01",
    cardStatementDate: "2026-01-01",
    firstPaymentDate: "2026-02-01",
    dueDay: "1",
    targetDate: "2027-01-01",
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

  assert.equal(minimum, 200);
});

test("current overview balance does not use a distant projection target", () => {
  assert.equal(estimateSavedCurrentBalance({
    accountType: "credit-card",
    startingPrincipal: "1000",
    overviewBalance: 1000,
    targetDate: "2046-01-01",
    aprPercent: "24",
    cardMinimumMode: "percent",
    cardMinimumPercent: "2",
    cardMinimumFloor: "25",
    additionalMonthlyPayment: "0",
    creditCardTransactions: [],
  }), 1000);
});

test("card portfolio minimum switches on the promotion end date", () => {
  const data = {
    accountType: "credit-card",
    cardMinimumMode: "percent",
    cardMinimumPercent: "1",
    cardMinimumFloor: "0",
    postPromoMinimumMode: "percent",
    postPromoMinimumPercent: "5",
    postPromoMinimumFloor: "0",
    promoType: "zero",
    promoEndDate: "2026-12-28",
    aprPercent: "22.74",
    additionalMonthlyPayment: "0",
    minimumPayment: "0",
  };
  assert.equal(estimateSavedAccountMinimumForMonth(data, 10_000, new Date("2026-12-01"), 0), 100);
  assert.ok(estimateSavedAccountMinimumForMonth(data, 10_000, new Date("2027-01-01"), 189.5) > 680);
});
