import assert from "node:assert/strict";
import test from "node:test";
import { estimateAnnualFederalTax } from "../../../src/calculations/tax/annualFederalTax.ts";

const annualTaxInputs = (overrides = {}) => ({
  additionalIncome: 0,
  credits: 0,
  deductionMethod: "standard",
  estimatedPayments: 0,
  federalWithholding: 0,
  filingStatus: "single",
  itemizedDeductions: 0,
  selfEmploymentIncome: 0,
  w2TaxableWages: 75_000,
  w2SocialSecurityWages: 75_000,
  ...overrides,
});

test("annual federal estimate applies the standard deduction and tax brackets", () => {
  const result = estimateAnnualFederalTax(annualTaxInputs({ federalWithholding: 6_000, estimatedPayments: 1_000 }));
  assert.equal(result.deduction, 16_100);
  assert.equal(result.taxableIncome, 58_900);
  assert.equal(result.federalIncomeTax, 7_670);
  assert.equal(result.paymentsAndWithholding, 7_000);
  assert.equal(result.projectedBalance, -670);
});

test("annual federal estimate supports itemized deductions and credits", () => {
  const result = estimateAnnualFederalTax(annualTaxInputs({ credits: 1_000, deductionMethod: "itemized", itemizedDeductions: 20_000 }));
  assert.equal(result.deduction, 20_000);
  assert.equal(result.taxableIncome, 55_000);
  assert.equal(result.federalIncomeTax, 5_812);
});

test("self-employment tax observes the Social Security wage cap", () => {
  const result = estimateAnnualFederalTax(annualTaxInputs({ selfEmploymentIncome: 50_000, w2SocialSecurityWages: 180_000 }));
  assert.equal(result.selfEmploymentTax, 1_897.08);
  assert.equal(result.taxableIncome, 107_951.46);
  assert.equal(result.federalIncomeTax, 18_506.35);
  assert.equal(result.totalFederalTax, 20_403.43);
});

test("annual federal estimate supports married and head-of-household brackets", () => {
  const married = estimateAnnualFederalTax(annualTaxInputs({ filingStatus: "married", w2TaxableWages: 150_000, w2SocialSecurityWages: 150_000 }));
  const head = estimateAnnualFederalTax(annualTaxInputs({ filingStatus: "head", w2TaxableWages: 100_000, w2SocialSecurityWages: 100_000 }));
  assert.equal(married.deduction, 32_200);
  assert.equal(married.taxableIncome, 117_800);
  assert.equal(married.federalIncomeTax, 15_340);
  assert.equal(head.deduction, 24_150);
  assert.equal(head.taxableIncome, 75_850);
  assert.equal(head.federalIncomeTax, 9_588);
});
