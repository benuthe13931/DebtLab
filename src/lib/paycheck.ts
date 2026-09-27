export type FilingStatus = "single" | "married" | "head";
export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export type PaycheckInputs = {
  annualSalary: number;
  dentalPerPaycheck: number;
  filingStatus: FilingStatus;
  hsaPerPaycheck: number;
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

type Bracket = {
  baseTax: number;
  lower: number;
  rate: number;
  upper: number;
};

const STANDARD_BRACKETS: Record<FilingStatus, Bracket[]> = {
  married: [
    { lower: 0, upper: 19_300, baseTax: 0, rate: 0 },
    { lower: 19_300, upper: 44_100, baseTax: 0, rate: 0.1 },
    { lower: 44_100, upper: 120_100, baseTax: 2_480, rate: 0.12 },
    { lower: 120_100, upper: 230_700, baseTax: 11_600, rate: 0.22 },
    { lower: 230_700, upper: 422_850, baseTax: 35_932, rate: 0.24 },
    { lower: 422_850, upper: 531_750, baseTax: 82_048, rate: 0.32 },
    { lower: 531_750, upper: 788_000, baseTax: 116_896, rate: 0.35 },
    { lower: 788_000, upper: Number.POSITIVE_INFINITY, baseTax: 206_583.5, rate: 0.37 },
  ],
  single: [
    { lower: 0, upper: 7_500, baseTax: 0, rate: 0 },
    { lower: 7_500, upper: 19_900, baseTax: 0, rate: 0.1 },
    { lower: 19_900, upper: 57_900, baseTax: 1_240, rate: 0.12 },
    { lower: 57_900, upper: 113_200, baseTax: 5_800, rate: 0.22 },
    { lower: 113_200, upper: 209_275, baseTax: 17_966, rate: 0.24 },
    { lower: 209_275, upper: 263_725, baseTax: 41_024, rate: 0.32 },
    { lower: 263_725, upper: 648_100, baseTax: 58_448, rate: 0.35 },
    { lower: 648_100, upper: Number.POSITIVE_INFINITY, baseTax: 192_979.25, rate: 0.37 },
  ],
  head: [
    { lower: 0, upper: 15_550, baseTax: 0, rate: 0 },
    { lower: 15_550, upper: 33_250, baseTax: 0, rate: 0.1 },
    { lower: 33_250, upper: 83_000, baseTax: 1_770, rate: 0.12 },
    { lower: 83_000, upper: 121_250, baseTax: 7_740, rate: 0.22 },
    { lower: 121_250, upper: 217_300, baseTax: 16_155, rate: 0.24 },
    { lower: 217_300, upper: 271_750, baseTax: 39_207, rate: 0.32 },
    { lower: 271_750, upper: 656_150, baseTax: 56_631, rate: 0.35 },
    { lower: 656_150, upper: Number.POSITIVE_INFINITY, baseTax: 191_171, rate: 0.37 },
  ],
};

const STEP_TWO_BRACKETS: Record<FilingStatus, Bracket[]> = {
  married: [
    { lower: 0, upper: 16_100, baseTax: 0, rate: 0 },
    { lower: 16_100, upper: 28_500, baseTax: 0, rate: 0.1 },
    { lower: 28_500, upper: 66_500, baseTax: 1_240, rate: 0.12 },
    { lower: 66_500, upper: 121_800, baseTax: 5_800, rate: 0.22 },
    { lower: 121_800, upper: 217_875, baseTax: 17_966, rate: 0.24 },
    { lower: 217_875, upper: 272_325, baseTax: 41_024, rate: 0.32 },
    { lower: 272_325, upper: 400_450, baseTax: 58_448, rate: 0.35 },
    { lower: 400_450, upper: Number.POSITIVE_INFINITY, baseTax: 103_291.75, rate: 0.37 },
  ],
  single: [
    { lower: 0, upper: 8_050, baseTax: 0, rate: 0 },
    { lower: 8_050, upper: 14_250, baseTax: 0, rate: 0.1 },
    { lower: 14_250, upper: 33_250, baseTax: 620, rate: 0.12 },
    { lower: 33_250, upper: 60_900, baseTax: 2_900, rate: 0.22 },
    { lower: 60_900, upper: 108_938, baseTax: 8_983, rate: 0.24 },
    { lower: 108_938, upper: 136_163, baseTax: 20_512, rate: 0.32 },
    { lower: 136_163, upper: 328_350, baseTax: 29_224, rate: 0.35 },
    { lower: 328_350, upper: Number.POSITIVE_INFINITY, baseTax: 96_489.63, rate: 0.37 },
  ],
  head: [
    { lower: 0, upper: 12_075, baseTax: 0, rate: 0 },
    { lower: 12_075, upper: 20_925, baseTax: 0, rate: 0.1 },
    { lower: 20_925, upper: 45_800, baseTax: 885, rate: 0.12 },
    { lower: 45_800, upper: 64_925, baseTax: 3_870, rate: 0.22 },
    { lower: 64_925, upper: 112_950, baseTax: 8_077.5, rate: 0.24 },
    { lower: 112_950, upper: 140_175, baseTax: 19_603.5, rate: 0.32 },
    { lower: 140_175, upper: 332_375, baseTax: 28_315.5, rate: 0.35 },
    { lower: 332_375, upper: Number.POSITIVE_INFINITY, baseTax: 95_585.5, rate: 0.37 },
  ],
};

export const PAY_PERIODS: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

const roundCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

function annualTaxFromTable(amount: number, status: FilingStatus, stepTwo: boolean): number {
  const table = stepTwo ? STEP_TWO_BRACKETS[status] : STANDARD_BRACKETS[status];
  const bracket = table.find((row) => amount >= row.lower && amount < row.upper) ?? table[table.length - 1];
  return bracket.baseTax + (amount - bracket.lower) * bracket.rate;
}

export function estimatePaycheck(inputs: PaycheckInputs): PaycheckResult {
  const periodsPerYear = PAY_PERIODS[inputs.payFrequency];
  const grossPay = nonNegative(inputs.annualSalary) / periodsPerYear;
  const traditional401k = grossPay * Math.min(100, nonNegative(inputs.traditional401kPercent)) / 100;
  const roth401k = grossPay * Math.min(100, nonNegative(inputs.roth401kPercent)) / 100;
  const hsa = nonNegative(inputs.hsaPerPaycheck);
  const benefitDeductions =
    nonNegative(inputs.medicalPerPaycheck) +
    nonNegative(inputs.dentalPerPaycheck) +
    nonNegative(inputs.visionPerPaycheck) +
    hsa +
    nonNegative(inputs.otherPreTaxPerPaycheck);

  // Section 125 benefits reduce FIT and FICA wages. Traditional 401(k) reduces FIT wages,
  // but elective deferrals remain subject to Social Security and Medicare.
  const taxableFederalWages = nonNegative(grossPay - benefitDeductions - traditional401k);
  const ficaWages = nonNegative(grossPay - benefitDeductions);
  const annualizedFederalWages = taxableFederalWages * periodsPerYear;
  const worksheetAdjustment = inputs.w4Step2Checked ? 0 : inputs.filingStatus === "married" ? 12_900 : 8_600;
  const adjustedAnnualWages = nonNegative(
    annualizedFederalWages + nonNegative(inputs.w4OtherIncome) - nonNegative(inputs.w4Deductions) - worksheetAdjustment,
  );
  const tentativeAnnualFederal = annualTaxFromTable(
    adjustedAnnualWages,
    inputs.filingStatus,
    inputs.w4Step2Checked,
  );
  const federalIncomeTax = nonNegative(
    (tentativeAnnualFederal - nonNegative(inputs.w4Credits)) / periodsPerYear +
      nonNegative(inputs.w4AdditionalWithholding),
  );

  const annualFicaWages = ficaWages * periodsPerYear;
  const socialSecurityTax = Math.min(annualFicaWages, 184_500) * 0.062 / periodsPerYear;
  const medicareTax =
    annualFicaWages * 0.0145 / periodsPerYear +
    Math.max(0, annualFicaWages - 200_000) * 0.009 / periodsPerYear;
  const stateWithholding = nonNegative(inputs.stateWithholdingPerPaycheck);
  const postTaxBenefits = nonNegative(inputs.postTaxBenefitsPerPaycheck);
  const netPay = nonNegative(
    grossPay -
      benefitDeductions -
      traditional401k -
      roth401k -
      federalIncomeTax -
      socialSecurityTax -
      medicareTax -
      stateWithholding -
      postTaxBenefits,
  );

  return {
    annualNet: roundCents(netPay * periodsPerYear),
    benefitDeductions: roundCents(benefitDeductions),
    federalIncomeTax: roundCents(federalIncomeTax),
    grossPay: roundCents(grossPay),
    hsa: roundCents(hsa),
    medicareTax: roundCents(medicareTax),
    netPay: roundCents(netPay),
    postTaxBenefits: roundCents(postTaxBenefits),
    periodsPerYear,
    roth401k: roundCents(roth401k),
    socialSecurityTax: roundCents(socialSecurityTax),
    stateWithholding: roundCents(stateWithholding),
    taxableFederalWages: roundCents(taxableFederalWages),
    traditional401k: roundCents(traditional401k),
  };
}
