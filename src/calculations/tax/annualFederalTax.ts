import { ANNUAL_RETURN_BRACKETS, STANDARD_DEDUCTIONS } from "../../constants/tax.ts";
import type { AnnualTaxInputs, AnnualTaxResult } from "../../types/tax.ts";


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
    : STANDARD_DEDUCTIONS[inputs.filingStatus];
  const adjustedIncome = w2Wages + nonNegative(inputs.selfEmploymentIncome) + nonNegative(inputs.additionalIncome) - selfEmploymentTax / 2;
  const taxableIncome = nonNegative(adjustedIncome - deduction);
  const bracket = ANNUAL_RETURN_BRACKETS[inputs.filingStatus].find((row) => taxableIncome >= row.lower && taxableIncome < row.upper) ?? ANNUAL_RETURN_BRACKETS[inputs.filingStatus].at(-1)!;
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
