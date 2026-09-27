export type FilingStatus = "single" | "married" | "head";
export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export type PaycheckInputs = {
  annualSalary: number;
  dentalPerPaycheck: number;
  filingStatus: FilingStatus;
  hsaPerPaycheck: number;
  imputedIncomePerPaycheck: number;
  medicalPerPaycheck: number;
  otherPreTaxPerPaycheck: number;
  postTaxBenefitsPerPaycheck: number;
  payFrequency: PayFrequency;
  roth401kPercent: number;
  stateWithholdingPerPaycheck: number;
  traditional401kPercent: number;
  visionPerPaycheck: number;
  w4AdditionalWithholding: number;
  w4Credits: number;
  w4Deductions: number;
  w4OtherIncome: number;
  w4Step2Checked: boolean;
};

export type PaycheckResult = {
  annualNet: number;
  benefitDeductions: number;
  federalIncomeTax: number;
  grossPay: number;
  hsa: number;
  medicareTax: number;
  netPay: number;
  postTaxBenefits: number;
  periodsPerYear: number;
  roth401k: number;
  socialSecurityTax: number;
  stateWithholding: number;
  taxableFederalWages: number;
  traditional401k: number;
};
