import type { FilingStatus } from "./paycheck";

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
