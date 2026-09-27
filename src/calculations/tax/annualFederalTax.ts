import type { FilingStatus } from "../paycheck/paycheck";

export type AnnualTaxInputs = {
  additionalIncome: number;
  credits: number;
  deductionMethod: "standard" | "itemized";
  estimatedPayments: number;
  federalWithholding: number;
  filingStatus: FilingStatus;
  itemizedDeductions: number;
  selfEmploymentIncome: number;
  w2TaxableWages: number;
  w2SocialSecurityWages: number;
};

export type AnnualTaxResult = {
  deduction: number;
  federalIncomeTax: number;
  paymentsAndWithholding: number;
  projectedBalance: number;
  selfEmploymentTax: number;
  taxableIncome: number;
  totalFederalTax: number;
};

type Bracket = {
  baseTax: number;
  lower: number;
  rate: number;
  upper: number;
};

const RETURN_BRACKETS: Record<FilingStatus, Bracket[]> = {
  married: [
    { lower: 0, upper: 24_800, baseTax: 0, rate: 0.1 },
    { lower: 24_800, upper: 100_800, baseTax: 2_480, rate: 0.12 },
    { lower: 100_800, upper: 211_400, baseTax: 11_600, rate: 0.22 },
    { lower: 211_400, upper: 403_550, baseTax: 35_932, rate: 0.24 },
    { lower: 403_550, upper: 512_450, baseTax: 82_048, rate: 0.32 },
    { lower: 512_450, upper: 768_700, baseTax: 116_896, rate: 0.35 },
    { lower: 768_700, upper: Number.POSITIVE_INFINITY, baseTax: 206_583.5, rate: 0.37 },
  ],
  single: [
    { lower: 0, upper: 12_400, baseTax: 0, rate: 0.1 },
    { lower: 12_400, upper: 50_400, baseTax: 1_240, rate: 0.12 },
    { lower: 50_400, upper: 105_700, baseTax: 5_800, rate: 0.22 },
    { lower: 105_700, upper: 201_775, baseTax: 17_966, rate: 0.24 },
    { lower: 201_775, upper: 256_225, baseTax: 41_024, rate: 0.32 },
    { lower: 256_225, upper: 640_600, baseTax: 58_448, rate: 0.35 },
    { lower: 640_600, upper: Number.POSITIVE_INFINITY, baseTax: 192_979.25, rate: 0.37 },
  ],
  head: [
    { lower: 0, upper: 17_700, baseTax: 0, rate: 0.1 },
    { lower: 17_700, upper: 67_450, baseTax: 1_770, rate: 0.12 },
    { lower: 67_450, upper: 105_700, baseTax: 7_740, rate: 0.22 },
    { lower: 105_700, upper: 201_750, baseTax: 16_155, rate: 0.24 },
    { lower: 201_750, upper: 256_200, baseTax: 39_207, rate: 0.32 },
    { lower: 256_200, upper: 640_600, baseTax: 56_631, rate: 0.35 },
    { lower: 640_600, upper: Number.POSITIVE_INFINITY, baseTax: 191_171, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 16_100,
  married: 32_200,
  head: 24_150,
};

const roundCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

export function estimateAnnualFederalTax(inputs: AnnualTaxInputs): AnnualTaxResult {
  const w2Wages = nonNegative(inputs.w2TaxableWages);
  const w2SocialSecurityWages = nonNegative(inputs.w2SocialSecurityWages);
  const selfEmploymentNetEarnings = nonNegative(inputs.selfEmploymentIncome) * 0.9235;
  const selfEmploymentSocialSecurityTax = Math.min(selfEmploymentNetEarnings, Math.max(0, 184_500 - w2SocialSecurityWages)) * 0.124;
  const selfEmploymentMedicareTax = selfEmploymentNetEarnings * 0.029;
  const selfEmploymentTax = selfEmploymentSocialSecurityTax + selfEmploymentMedicareTax;
  const deduction = inputs.deductionMethod === "itemized"
    ? nonNegative(inputs.itemizedDeductions)
    : STANDARD_DEDUCTION[inputs.filingStatus];
  const adjustedIncome = w2Wages + nonNegative(inputs.selfEmploymentIncome) + nonNegative(inputs.additionalIncome) - selfEmploymentTax / 2;
  const taxableIncome = nonNegative(adjustedIncome - deduction);
  const bracket = RETURN_BRACKETS[inputs.filingStatus].find((row) => taxableIncome >= row.lower && taxableIncome < row.upper) ?? RETURN_BRACKETS[inputs.filingStatus].at(-1)!;
  const federalIncomeTax = nonNegative(bracket.baseTax + (taxableIncome - bracket.lower) * bracket.rate - nonNegative(inputs.credits));
  const totalFederalTax = federalIncomeTax + selfEmploymentTax;
  const paymentsAndWithholding = nonNegative(inputs.federalWithholding) + nonNegative(inputs.estimatedPayments);
  return {
    deduction: roundCents(deduction),
    federalIncomeTax: roundCents(federalIncomeTax),
    paymentsAndWithholding: roundCents(paymentsAndWithholding),
    projectedBalance: roundCents(paymentsAndWithholding - totalFederalTax),
    selfEmploymentTax: roundCents(selfEmploymentTax),
    taxableIncome: roundCents(taxableIncome),
    totalFederalTax: roundCents(totalFederalTax),
  };
}
