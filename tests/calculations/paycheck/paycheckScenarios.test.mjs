import assert from "node:assert/strict";
import test from "node:test";
import { estimatePaycheck, estimateStateWithholding, resolveStateWithholding } from "../../../src/calculations/paycheck/paycheck.ts";

const base = (overrides = {}) => ({ annualSalary: 80_000, dentalPerPaycheck: 0, filingStatus: "single", hsaPerPaycheck: 0, imputedIncomePerPaycheck: 0, medicalPerPaycheck: 0, otherPreTaxPerPaycheck: 0, postTaxBenefitsPerPaycheck: 0, payFrequency: "biweekly", roth401kPercent: 0, stateWithholdingPerPaycheck: 0, traditional401kPercent: 0, visionPerPaycheck: 0, w4AdditionalWithholding: 0, w4Credits: 0, w4Deductions: 0, w4OtherIncome: 0, w4Step2Checked: false, ...overrides });
const result = (overrides = {}) => estimatePaycheck(base(overrides));

test("salary scales to each pay frequency", () => { for (const [payFrequency, periods] of Object.entries({ weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 })) assert.equal(result({ payFrequency }).periodsPerYear, periods); });
test("gross pay is salary divided by periods", () => assert.equal(result({ annualSalary: 52_000 }).grossPay, 2_000));
test("zero salary produces zero pay", () => { const r = result({ annualSalary: 0 }); assert.equal(r.grossPay, 0); assert.equal(r.netPay, 0); });
test("negative salary is clamped", () => assert.equal(result({ annualSalary: -5_000 }).grossPay, 0));
test("traditional 401k reduces federal wages", () => assert.ok(result({ traditional401kPercent: 10 }).taxableFederalWages < result().taxableFederalWages));
test("traditional 401k remains in FICA wages", () => { const r = result({ traditional401kPercent: 10 }); assert.equal(r.socialSecurityTax, result().socialSecurityTax); });
test("Roth 401k reduces net pay without reducing federal wages", () => { const r = result({ roth401kPercent: 10 }); assert.equal(r.taxableFederalWages, result().taxableFederalWages); assert.ok(r.netPay < result().netPay); });
test("medical dental vision and HSA reduce taxable wages", () => { const r = result({ medicalPerPaycheck: 100, dentalPerPaycheck: 25, visionPerPaycheck: 10, hsaPerPaycheck: 50 }); assert.equal(r.benefitDeductions, 185); assert.ok(r.taxableFederalWages < result().taxableFederalWages); });
test("other pre-tax benefits reduce federal wages", () => assert.ok(result({ otherPreTaxPerPaycheck: 100 }).taxableFederalWages < result().taxableFederalWages));
test("post-tax benefits do not change taxable wages", () => { const r = result({ postTaxBenefitsPerPaycheck: 100 }); assert.equal(r.taxableFederalWages, result().taxableFederalWages); assert.equal(r.postTaxBenefits, 100); });
test("imputed income increases taxable wages", () => assert.ok(result({ imputedIncomePerPaycheck: 100 }).taxableFederalWages > result().taxableFederalWages));
test("imputed income increases FICA taxes", () => assert.ok(result({ imputedIncomePerPaycheck: 100 }).medicareTax > result().medicareTax));
test("married filing status changes federal withholding", () => assert.notEqual(result({ filingStatus: "married" }).federalIncomeTax, result().federalIncomeTax));
test("head of household filing status is supported", () => assert.ok(result({ filingStatus: "head" }).federalIncomeTax >= 0));
test("step two withholding increases federal withholding", () => assert.ok(result({ w4Step2Checked: true }).federalIncomeTax > result().federalIncomeTax));
test("credits reduce federal withholding", () => assert.ok(result({ w4Credits: 2_000 }).federalIncomeTax < result().federalIncomeTax));
test("other income increases federal withholding", () => assert.ok(result({ w4OtherIncome: 10_000 }).federalIncomeTax > result().federalIncomeTax));
test("additional withholding is added per paycheck", () => assert.equal(result({ w4AdditionalWithholding: 75 }).federalIncomeTax, result().federalIncomeTax + 75));
test("state withholding override is honored", () => assert.equal(resolveStateWithholding("PA", 2_000, 47.83), 47.83));
test("supported no-income-tax states return zero", () => { for (const state of ["AK", "FL", "NV", "TX", "WA"]) assert.equal(estimateStateWithholding(state, 2_000), 0); });
test("unsupported state returns null", () => assert.equal(estimateStateWithholding("CA", 2_000), null));
