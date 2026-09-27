import type { DayCountBasis, PausePeriod } from "../../types/loans";

export function isMonthWithinPause(date: Date, pausePeriod: PausePeriod): boolean {
  const value = date.getFullYear() * 12 + date.getMonth();
  const start = pausePeriod.startMonth.getFullYear() * 12 + pausePeriod.startMonth.getMonth();
  const end = pausePeriod.endMonth.getFullYear() * 12 + pausePeriod.endMonth.getMonth();
  return value >= start && value <= end;
}

export function accrueInterest(params: {
  aprPercent: number;
  dayCountBasis: DayCountBasis;
  endDate: Date;
  pausePeriods?: PausePeriod[];
  principal: number;
  roundDailyInterest: boolean;
  startDate: Date;
}): number {
  const { aprPercent, dayCountBasis, endDate, pausePeriods = [], principal, roundDailyInterest, startDate } = params;

  if (endDate <= startDate || principal <= 0 || aprPercent < 0) {
    return 0;
  }

  let accruedInterest = 0;
  const cursor = new Date(startDate);
  while (cursor < endDate) {
    const isInterestPaused = pausePeriods.some(
      (pausePeriod) => pausePeriod.mode === "paused" && isMonthWithinPause(cursor, pausePeriod),
    );

    if (!isInterestPaused) {
      const denominator = dayCountBasis === "365" ? 365 : isLeapYear(cursor.getFullYear()) ? 366 : 365;
      const dailyInterest = principal * (aprPercent / 100 / denominator);
      accruedInterest += roundDailyInterest
        ? Math.round(dailyInterest * 100) / 100
        : dailyInterest;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return accruedInterest;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}