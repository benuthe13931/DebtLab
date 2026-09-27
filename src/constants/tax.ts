import type { FilingStatus, PayFrequency } from "../types/paycheck";

export type TaxBracket = {
  baseTax: number;
  lower: number;
  rate: number;
  upper: number;
};

export const STANDARD_WITHHOLDING_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  married: [
    { lower: 0, upper: 19_300, baseTax: 0, rate: 0 }, { lower: 19_300, upper: 44_100, baseTax: 0, rate: 0.1 }, { lower: 44_100, upper: 120_100, baseTax: 2_480, rate: 0.12 }, { lower: 120_100, upper: 230_700, baseTax: 11_600, rate: 0.22 }, { lower: 230_700, upper: 422_850, baseTax: 35_932, rate: 0.24 }, { lower: 422_850, upper: 531_750, baseTax: 82_048, rate: 0.32 }, { lower: 531_750, upper: 788_000, baseTax: 116_896, rate: 0.35 }, { lower: 788_000, upper: Number.POSITIVE_INFINITY, baseTax: 206_583.5, rate: 0.37 },
  ],
  single: [
    { lower: 0, upper: 7_500, baseTax: 0, rate: 0 }, { lower: 7_500, upper: 19_900, baseTax: 0, rate: 0.1 }, { lower: 19_900, upper: 57_900, baseTax: 1_240, rate: 0.12 }, { lower: 57_900, upper: 113_200, baseTax: 5_800, rate: 0.22 }, { lower: 113_200, upper: 209_275, baseTax: 17_966, rate: 0.24 }, { lower: 209_275, upper: 263_725, baseTax: 41_024, rate: 0.32 }, { lower: 263_725, upper: 648_100, baseTax: 58_448, rate: 0.35 }, { lower: 648_100, upper: Number.POSITIVE_INFINITY, baseTax: 192_979.25, rate: 0.37 },
  ],
  head: [
    { lower: 0, upper: 15_550, baseTax: 0, rate: 0 }, { lower: 15_550, upper: 33_250, baseTax: 0, rate: 0.1 }, { lower: 33_250, upper: 83_000, baseTax: 1_770, rate: 0.12 }, { lower: 83_000, upper: 121_250, baseTax: 7_740, rate: 0.22 }, { lower: 121_250, upper: 217_300, baseTax: 16_155, rate: 0.24 }, { lower: 217_300, upper: 271_750, baseTax: 39_207, rate: 0.32 }, { lower: 271_750, upper: 656_150, baseTax: 56_631, rate: 0.35 }, { lower: 656_150, upper: Number.POSITIVE_INFINITY, baseTax: 191_171, rate: 0.37 },
  ],
};

export const STEP_TWO_WITHHOLDING_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  married: [
    { lower: 0, upper: 16_100, baseTax: 0, rate: 0 }, { lower: 16_100, upper: 28_500, baseTax: 0, rate: 0.1 }, { lower: 28_500, upper: 66_500, baseTax: 1_240, rate: 0.12 }, { lower: 66_500, upper: 121_800, baseTax: 5_800, rate: 0.22 }, { lower: 121_800, upper: 217_875, baseTax: 17_966, rate: 0.24 }, { lower: 217_875, upper: 272_325, baseTax: 41_024, rate: 0.32 }, { lower: 272_325, upper: 400_450, baseTax: 58_448, rate: 0.35 }, { lower: 400_450, upper: Number.POSITIVE_INFINITY, baseTax: 103_291.75, rate: 0.37 },
  ],
  single: [
    { lower: 0, upper: 8_050, baseTax: 0, rate: 0 }, { lower: 8_050, upper: 14_250, baseTax: 0, rate: 0.1 }, { lower: 14_250, upper: 33_250, baseTax: 620, rate: 0.12 }, { lower: 33_250, upper: 60_900, baseTax: 2_900, rate: 0.22 }, { lower: 60_900, upper: 108_938, baseTax: 8_983, rate: 0.24 }, { lower: 108_938, upper: 136_163, baseTax: 20_512, rate: 0.32 }, { lower: 136_163, upper: 328_350, baseTax: 29_224, rate: 0.35 }, { lower: 328_350, upper: Number.POSITIVE_INFINITY, baseTax: 96_489.63, rate: 0.37 },
  ],
  head: [
    { lower: 0, upper: 12_075, baseTax: 0, rate: 0 }, { lower: 12_075, upper: 20_925, baseTax: 0, rate: 0.1 }, { lower: 20_925, upper: 45_800, baseTax: 885, rate: 0.12 }, { lower: 45_800, upper: 64_925, baseTax: 3_870, rate: 0.22 }, { lower: 64_925, upper: 112_950, baseTax: 8_077.5, rate: 0.24 }, { lower: 112_950, upper: 140_175, baseTax: 19_603.5, rate: 0.32 }, { lower: 140_175, upper: 332_375, baseTax: 28_315.5, rate: 0.35 }, { lower: 332_375, upper: Number.POSITIVE_INFINITY, baseTax: 95_585.5, rate: 0.37 },
  ],
};

export const ANNUAL_RETURN_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  married: [{ lower: 0, upper: 24_800, baseTax: 0, rate: 0.1 }, { lower: 24_800, upper: 100_800, baseTax: 2_480, rate: 0.12 }, { lower: 100_800, upper: 211_400, baseTax: 11_600, rate: 0.22 }, { lower: 211_400, upper: 403_550, baseTax: 35_932, rate: 0.24 }, { lower: 403_550, upper: 512_450, baseTax: 82_048, rate: 0.32 }, { lower: 512_450, upper: 768_700, baseTax: 116_896, rate: 0.35 }, { lower: 768_700, upper: Number.POSITIVE_INFINITY, baseTax: 206_583.5, rate: 0.37 }],
  single: [{ lower: 0, upper: 12_400, baseTax: 0, rate: 0.1 }, { lower: 12_400, upper: 50_400, baseTax: 1_240, rate: 0.12 }, { lower: 50_400, upper: 105_700, baseTax: 5_800, rate: 0.22 }, { lower: 105_700, upper: 201_775, baseTax: 17_966, rate: 0.24 }, { lower: 201_775, upper: 256_225, baseTax: 41_024, rate: 0.32 }, { lower: 256_225, upper: 640_600, baseTax: 58_448, rate: 0.35 }, { lower: 640_600, upper: Number.POSITIVE_INFINITY, baseTax: 192_979.25, rate: 0.37 }],
  head: [{ lower: 0, upper: 17_700, baseTax: 0, rate: 0.1 }, { lower: 17_700, upper: 67_450, baseTax: 1_770, rate: 0.12 }, { lower: 67_450, upper: 105_700, baseTax: 7_740, rate: 0.22 }, { lower: 105_700, upper: 201_750, baseTax: 16_155, rate: 0.24 }, { lower: 201_750, upper: 256_200, baseTax: 39_207, rate: 0.32 }, { lower: 256_200, upper: 640_600, baseTax: 56_631, rate: 0.35 }, { lower: 640_600, upper: Number.POSITIVE_INFINITY, baseTax: 191_171, rate: 0.37 }],
};

export const STANDARD_DEDUCTIONS: Record<FilingStatus, number> = { single: 16_100, married: 32_200, head: 24_150 };
export const PAY_PERIODS: Record<PayFrequency, number> = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };
