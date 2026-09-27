import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateAnnualFederalTax,
  estimatePaycheck,
  estimateStateWithholding,
  resolveStateWithholding,
} from "../src/lib/paycheck.ts";

const paycheckInputs = (overrides = {}) => ({
  annualSalary: 75_000,
  dentalPerPaycheck: 0,
  filingStatus: "single",
  hsaPerPaycheck: 0,
  imputedIncomePerPaycheck: 0,
  medicalPerPaycheck: 0,
  otherPreTaxPerPaycheck: 0,
  postTaxBenefitsPerPaycheck: 0,
  payFrequency: "biweekly",
  roth401kPercent: 0,
  stateWithholdingPerPaycheck: 0,
  traditional401kPercent: 0,
  visionPerPaycheck: 0,
  w4AdditionalWithholding: 0,
  w4Credits: 0,
  w4Deductions: 0,
  w4OtherIncome: 0,
  w4Step2Checked: false,
  ...overrides,
});

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

test("state withholding returns supported estimates and null for unsupported states", () => {
  assert.equal(estimateStateWithholding("PA", 1_000), 30.7);
  assert.equal(estimateStateWithholding("PA", -1_000), 0);
  assert.equal(estimateStateWithholding("TX", 1_000), 0);
  assert.equal(estimateStateWithholding("CA", 1_000), null);
});

test("an entered state withholding amount overrides the estimate", () => {
  assert.equal(resolveStateWithholding("PA", 2_000, 47.83), 47.83);
  assert.equal(resolveStateWithholding("PA", 2_000, 0), 61.4);
  assert.equal(resolveStateWithholding("CA", 2_000, 0), null);
});

test("salary federal withholding matches the annualized 2026 single-filer table", () => {
  const result = estimatePaycheck(paycheckInputs());

  assert.equal(result.grossPay, 2_884.62);
  assert.equal(result.taxableFederalWages, 2_884.62);
  assert.equal(result.federalIncomeTax, 295);
  assert.equal(result.socialSecurityTax, 178.85);
  assert.equal(result.medicareTax, 43.27);
  assert.equal(result.netPay, 2_367.5);
});

test("annualized withholding remains consistent across pay frequencies", () => {
  const expectedPerPeriod = {
    weekly: 147.5,
    biweekly: 295,
    semimonthly: 319.58,
    monthly: 639.17,
  };

  for (const [payFrequency, expected] of Object.entries(expectedPerPeriod)) {
    assert.equal(estimatePaycheck(paycheckInputs({ payFrequency })).federalIncomeTax, expected);
  }
});

test("W-4 step 2, credits, deductions, other income, and extra withholding affect FIT", () => {
  assert.equal(estimatePaycheck(paycheckInputs({ w4Step2Checked: true })).federalIncomeTax, 475.65);
  assert.equal(estimatePaycheck(paycheckInputs({ w4Credits: 2_600 })).federalIncomeTax, 195);
  assert.equal(estimatePaycheck(paycheckInputs({ w4Deductions: 12_000 })).federalIncomeTax, 206.92);
  assert.equal(estimatePaycheck(paycheckInputs({ w4OtherIncome: 12_000 })).federalIncomeTax, 396.54);
  assert.equal(estimatePaycheck(paycheckInputs({ w4AdditionalWithholding: 25 })).federalIncomeTax, 320);
});

test("pre-tax benefits and traditional 401(k) affect the appropriate wage bases", () => {
  const result = estimatePaycheck(paycheckInputs({
    annualSalary: 100_000,
    traditional401kPercent: 6,
    medicalPerPaycheck: 100,
  }));

  assert.equal(result.benefitDeductions, 100);
  assert.equal(result.traditional401k, 230.77);
  assert.equal(result.taxableFederalWages, 3_515.38);
  assert.equal(result.socialSecurityTax, 232.26);
  assert.equal(result.medicareTax, 54.32);
});

test("imputed income is taxable for federal and FICA purposes", () => {
  const result = estimatePaycheck(paycheckInputs({
    annualSalary: 52_000,
    imputedIncomePerPaycheck: 100,
  }));

  assert.equal(result.taxableFederalWages, 2_100);
  assert.equal(result.socialSecurityTax, 130.2);
  assert.equal(result.medicareTax, 30.45);
});

test("Social Security and Additional Medicare taxes apply their wage thresholds", () => {
  const result = estimatePaycheck(paycheckInputs({ annualSalary: 250_000 }));

  assert.equal(result.socialSecurityTax, 439.96);
  assert.equal(result.medicareTax, 156.73);
});

test("negative or non-finite paycheck inputs cannot create negative withholding", () => {
  const result = estimatePaycheck(paycheckInputs({
    annualSalary: -1,
    w4Credits: Number.POSITIVE_INFINITY,
    w4AdditionalWithholding: -10,
  }));

  assert.equal(result.grossPay, 0);
  assert.equal(result.federalIncomeTax, 0);
  assert.equal(result.netPay, 0);
});

test("annual federal estimate applies the standard deduction and tax brackets", () => {
  const result = estimateAnnualFederalTax(annualTaxInputs({
    federalWithholding: 6_000,
    estimatedPayments: 1_000,
  }));

  assert.equal(result.deduction, 16_100);
  assert.equal(result.taxableIncome, 58_900);
  assert.equal(result.federalIncomeTax, 7_670);
  assert.equal(result.paymentsAndWithholding, 7_000);
  assert.equal(result.projectedBalance, -670);
});

test("annual federal estimate supports itemized deductions and credits", () => {
  const result = estimateAnnualFederalTax(annualTaxInputs({
    credits: 1_000,
    deductionMethod: "itemized",
    itemizedDeductions: 20_000,
  }));

  assert.equal(result.deduction, 20_000);
  assert.equal(result.taxableIncome, 55_000);
  assert.equal(result.federalIncomeTax, 5_812);
});

test("self-employment tax observes the Social Security wage cap", () => {
  const result = estimateAnnualFederalTax(annualTaxInputs({
    selfEmploymentIncome: 50_000,
    w2SocialSecurityWages: 180_000,
  }));

  assert.equal(result.selfEmploymentTax, 1_897.08);
  assert.equal(result.taxableIncome, 107_951.46);
  assert.equal(result.federalIncomeTax, 18_506.35);
  assert.equal(result.totalFederalTax, 20_403.43);
});

test("annual federal estimate supports married and head-of-household brackets", () => {
  const married = estimateAnnualFederalTax(annualTaxInputs({
    filingStatus: "married",
    w2TaxableWages: 150_000,
    w2SocialSecurityWages: 150_000,
  }));
  const head = estimateAnnualFederalTax(annualTaxInputs({
    filingStatus: "head",
    w2TaxableWages: 100_000,
    w2SocialSecurityWages: 100_000,
  }));

  assert.equal(married.deduction, 32_200);
  assert.equal(married.taxableIncome, 117_800);
  assert.equal(married.federalIncomeTax, 15_340);
  assert.equal(head.deduction, 24_150);
  assert.equal(head.taxableIncome, 75_850);
  assert.equal(head.federalIncomeTax, 9_588);
});