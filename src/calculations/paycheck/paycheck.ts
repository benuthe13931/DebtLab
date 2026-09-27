import { PAY_PERIODS, STANDARD_WITHHOLDING_BRACKETS, STEP_TWO_WITHHOLDING_BRACKETS } from "../../constants/tax.ts";
import type { FilingStatus, PaycheckInputs, PaycheckResult } from "../../types/paycheck.ts";

export function estimateStateWithholding(state: string, taxablePay: number): number | null {
  if (["AK", "FL", "NV", "NH", "SD", "TN", "TX", "WA", "WY"].includes(state)) return 0;
  if (state === "PA") return roundCents(nonNegative(taxablePay) * 0.0307);
  return null;
}

export function resolveStateWithholding(state: string, taxablePay: number, override: number): number | null {
  const enteredAmount = nonNegative(override);
  return enteredAmount > 0 ? roundCents(enteredAmount) : estimateStateWithholding(state, taxablePay);
}

const roundCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

function annualTaxFromTable(amount: number, status: FilingStatus, stepTwo: boolean): number {
  const table = stepTwo ? STEP_TWO_WITHHOLDING_BRACKETS[status] : STANDARD_WITHHOLDING_BRACKETS[status];
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
  const imputedIncome = nonNegative(inputs.imputedIncomePerPaycheck);
  const taxableFederalWages = nonNegative(grossPay + imputedIncome - benefitDeductions - traditional401k);
  const ficaWages = nonNegative(grossPay + imputedIncome - benefitDeductions);
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

