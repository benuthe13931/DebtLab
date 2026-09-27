import assert from "node:assert/strict";
import test from "node:test";
import { estimateAnnualFederalTax } from "../../../src/calculations/tax/annualFederalTax.ts";

const base = (overrides = {}) => ({ additionalIncome: 0, credits: 0, deductionMethod: "standard", estimatedPayments: 0, federalWithholding: 0, filingStatus: "single", itemizedDeductions: 0, selfEmploymentIncome: 0, w2SocialSecurityWages: 80_000, w2TaxableWages: 80_000, ...overrides });
const result = (overrides = {}) => estimateAnnualFederalTax(base(overrides));

test("standard deduction depends on filing status", () => { assert.ok(result({ filingStatus: "married" }).deduction > result().deduction); assert.ok(result({ filingStatus: "head" }).deduction > result().deduction); });
test("itemized deductions replace standard deduction", () => assert.equal(result({ deductionMethod: "itemized", itemizedDeductions: 30_000 }).deduction, 30_000));
test("additional income raises taxable income", () => assert.ok(result({ additionalIncome: 20_000 }).taxableIncome > result().taxableIncome));
test("credits reduce federal income tax", () => assert.ok(result({ credits: 1_000 }).federalIncomeTax < result().federalIncomeTax));
test("withholding creates a projected refund", () => assert.ok(result({ federalWithholding: 20_000 }).projectedBalance > result().projectedBalance));
test("estimated payments combine with withholding", () => assert.equal(result({ federalWithholding: 1_000, estimatedPayments: 2_000 }).paymentsAndWithholding, 3_000));
test("zero income has no tax", () => { const r = result({ w2TaxableWages: 0, w2SocialSecurityWages: 0 }); assert.equal(r.totalFederalTax, 0); });
test("negative income is clamped", () => assert.equal(result({ w2TaxableWages: -1 }).taxableIncome, 0));
test("self-employment income creates self-employment tax", () => assert.ok(result({ selfEmploymentIncome: 20_000, w2TaxableWages: 0, w2SocialSecurityWages: 0 }).selfEmploymentTax > 0));
test("self-employment deduction is reflected in taxable income", () => { const r = result({ selfEmploymentIncome: 20_000, w2TaxableWages: 0, w2SocialSecurityWages: 0 }); assert.ok(r.taxableIncome < 20_000); });
test("W-2 social security wages reduce remaining self-employment social security tax", () => { const low = result({ selfEmploymentIncome: 50_000, w2TaxableWages: 0, w2SocialSecurityWages: 0 }); const high = result({ selfEmploymentIncome: 50_000, w2TaxableWages: 0, w2SocialSecurityWages: 180_000 }); assert.ok(high.selfEmploymentTax < low.selfEmploymentTax); });
test("medicare self-employment tax remains after the social security cap", () => { const r = result({ selfEmploymentIncome: 500_000, w2TaxableWages: 184_500, w2SocialSecurityWages: 184_500, w2TaxableWages: 0 }); assert.ok(r.selfEmploymentTax > 0); });
test("non-finite credits cannot create negative tax", () => assert.ok(result({ credits: Number.POSITIVE_INFINITY }).federalIncomeTax >= 0));
test("tax is progressive for higher wages", () => assert.ok(result({ w2TaxableWages: 200_000 }).federalIncomeTax > result({ w2TaxableWages: 50_000 }).federalIncomeTax));
test("total federal tax includes self-employment tax", () => { const r = result({ selfEmploymentIncome: 10_000, w2TaxableWages: 0, w2SocialSecurityWages: 0 }); assert.equal(r.totalFederalTax, r.federalIncomeTax + r.selfEmploymentTax); });
