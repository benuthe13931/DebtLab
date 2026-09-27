import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PaycheckPage } from "./PaycheckPage";
import {
  cloudStorageEnabled,
  cloudStorageStatus,
  createCloudProfile,
  deleteCloudProfileData,
  getCloudSessionProfile,
  loadCloudLoans,
  loginCloudProfile,
  logoutCloudProfile,
  sendCloudPasswordResetEmail,
  saveCloudLoans,
  saveCloudProfile,
} from "./lib/cloudStorage";

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(n) ? n : 0);
}

function formatPercent(n: number): string {
  return `${n.toFixed(2)}%`;
}

function formatMonthYear(date: Date | null): string {
  if (!date) return "-";
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function formatDurationToPayoff(date: Date | null, fromDate: Date | null): string {
  if (!date || !fromDate || date <= fromDate) return "-";
  const totalMonths =
    (date.getFullYear() - fromDate.getFullYear()) * 12 + (date.getMonth() - fromDate.getMonth());
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const yearLabel = years > 0 ? `${years} year${years === 1 ? "" : "s"}` : "";
  const monthLabel = months > 0 ? `${months} month${months === 1 ? "" : "s"}` : "";
  return [yearLabel, monthLabel].filter(Boolean).join(", ") || "Less than 1 month";
}

function formatTimeShaved(deltaMonths: number): string {
  if (deltaMonths === 0) return "None";
  const absoluteMonths = Math.abs(deltaMonths);
  const years = Math.floor(absoluteMonths / 12);
  const months = absoluteMonths % 12;
  const yearLabel = years > 0 ? `${years} year${years === 1 ? "" : "s"}` : "";
  const monthLabel = months > 0 ? `${months} month${months === 1 ? "" : "s"}` : "";
  const value = [yearLabel, monthLabel].filter(Boolean).join(", ") || "0 months";
  return deltaMonths > 0 ? value : `${value} added`;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function compareDateOnly(a: Date, b: Date): number {
  const aTime = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bTime = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  if (aTime === bTime) return 0;
  return aTime < bTime ? -1 : 1;
}

function parseMonthInput(value: string): Date | null {
  if (!value) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    return null;
  }
  return new Date(year, month - 1, 1);
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function clampToMonth(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function moveToNextWeekday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  if (day === 0) d.setDate(d.getDate() + 1);
  return d;
}

function diffDays(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((endUtc - startUtc) / msPerDay));
}

type PaymentEvent = {
  amount: number;
  date: Date;
  feeAmount?: number;
  id?: string;
  interestAmount?: number;
  label: string;
  principalAmount?: number;
  rawRow?: Record<string, string>;
  source: "history" | "extra";
};

type FutureRecurringChange = {
  amount: number;
  effectiveDate: Date;
  endDate?: Date;
  id: string;
  kind: "minimum" | "monthly-extra";
};

type DueDayChange = {
  day: number;
  endMonth?: Date;
  id: string;
  startMonth: Date;
};

type SerializedPaymentEvent = Omit<PaymentEvent, "date"> & {
  date: string;
};

type SerializedFutureRecurringChange = Omit<FutureRecurringChange, "effectiveDate" | "endDate"> & {
  effectiveDate: string;
  endDate?: string;
};

type SerializedPausePeriod = Omit<PausePeriod, "endMonth" | "startMonth"> & {
  endMonth: string;
  startMonth: string;
};

type SerializedDueDayChange = Omit<DueDayChange, "endMonth" | "startMonth"> & {
  endMonth?: string;
  startMonth: string;
};

type LoanSnapshot = {
  activeView: "assumed" | "history" | "whatif";
  additionalMonthlyPayment: string;
  aprPercent: string;
  dayCountBasis: DayCountBasis;
  deletedHelperRowIds: string[];
  dueDay: string;
  editingPaymentAmount: string;
  editingPaymentDate: string;
  editingPaymentId: string;
  editingPaymentLabel: string;
  firstPaymentDate: string;
  helperActionError: string;
  helperAdjustmentAmount: string;
  helperAdjustmentDueDay: string;
  helperAdjustmentFromMonth: string;
  helperAdjustmentToMonth: string;
  helperBulkMode: "pause" | "monthly-extra" | "minimum" | "due-day";
  helperDueDayChanges: SerializedDueDayChange[];
  helperPauseFromMonth: string;
  helperPauseMode: PauseMode;
  helperPausePeriods: SerializedPausePeriod[];
  helperPauseToMonth: string;
  helperPaymentAmountOverrides: Record<string, string>;
  helperRecurringChanges: SerializedFutureRecurringChange[];
  loanName: string;
  minimumPayment: string;
  moveWeekend: boolean;
  newOneOffAmount: string;
  newOneOffDate: string;
  newOneOffLabel: string;
  newWhatIfAmount: string;
  newWhatIfDate: string;
  newWhatIfLabel: string;
  oneOffPayments: SerializedPaymentEvent[];
  paymentDateOverrides: Record<string, string>;
  paymentLabelOverrides: Record<string, string>;
  roundDailyInterest: boolean;
  showAmortization: boolean;
  showComparisonDetails: boolean;
  showFutureDetails: boolean;
  showHelperAmortization: boolean;
  showHistoricalDetails: boolean;
  showLifetimeDetails: boolean;
  startingPrincipal: string;
  startingPrincipalDate: string;
  targetDate: string;
  whatIfActionError: string;
  whatIfAdjustmentAmount: string;
  whatIfAdjustmentDate: string;
  whatIfAdjustmentDueDay: string;
  whatIfAdjustmentEndDate: string;
  whatIfDueDayChanges: SerializedDueDayChange[];
  whatIfEntryMode: "minimum" | "monthly-extra" | "one-time" | "pause" | "due-day";
  whatIfPauseFromMonth: string;
  whatIfPauseMode: PauseMode;
  whatIfPausePeriods: SerializedPausePeriod[];
  whatIfPauseToMonth: string;
  whatIfPayments: SerializedPaymentEvent[];
  whatIfRecurringChanges: SerializedFutureRecurringChange[];
};

type SavedLoanRecord = {
  data: LoanSnapshot;
  id: string;
  name: string;
};

type UserProfile = {
  displayName: string;
  email: string;
  id: string;
  name: string;
  password: string;
  passwordResetCode?: string;
  passwordResetIssuedAt?: string;
  themeId: ThemeId;
};

const asThemeId = (themeId: string | undefined): ThemeId =>
  themeId === "forest" || themeId === "sunset" || themeId === "midnight" || themeId === "rose" || themeId === "slate"
    ? themeId
    : "sky";

const normalizeProfile = (profile: UserProfile): UserProfile => ({
  ...profile,
  themeId: asThemeId(profile.themeId),
});

type ThemeId = "sky" | "forest" | "sunset" | "midnight" | "rose" | "slate";

type ThemeDefinition = {
  accent: string;
  accentSoft: string;
  appBackground: string;
  cardBorder: string;
  cardShadow: string;
  isDark: boolean;
  name: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
};

type PauseMode = "accrues" | "paused";

type PausePeriod = {
  endMonth: Date;
  id: string;
  mode: PauseMode;
  startMonth: Date;
};

type ScheduleRow = {
  accruedInterest: number;
  cycle: number | null;
  daysAccrued: number;
  endingInterest: number;
  endingPrincipal: number;
  eventType: "scheduled" | "history" | "extra" | "paused" | "snapshot";
  interestPaid: number;
  label: string;
  negativeAmortization: boolean;
  paymentAmount: number;
  paymentDate: Date;
  principalShareOfPayment: number | null;
  principalPaid: number;
  rowId: string;
  startingInterest: number;
  startingPrincipal: number;
  totalInterestBeforePayment: number;
};

type ScheduleResult = {
  currentInterest: number;
  currentPrincipal: number;
  errors: string[];
  paidOff: boolean;
  payoffDate: Date | null;
  rows: ScheduleRow[];
  hasNegativeAmortization: boolean;
  totalBalance: number;
  totalInterestPaid: number;
  totalPaid: number;
  totalPrincipalPaid: number;
};

type ScheduledMode = "always" | "after-cutoff" | "never";
type DayCountBasis = "365" | "actual-year";

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isMonthWithinPause(date: Date, pausePeriod: PausePeriod): boolean {
  const value = date.getFullYear() * 12 + date.getMonth();
  const start = pausePeriod.startMonth.getFullYear() * 12 + pausePeriod.startMonth.getMonth();
  const end = pausePeriod.endMonth.getFullYear() * 12 + pausePeriod.endMonth.getMonth();
  return value >= start && value <= end;
}

function getPausePeriodForDate(date: Date, pausePeriods: PausePeriod[]): PausePeriod | null {
  return pausePeriods.find((pausePeriod) => isMonthWithinPause(date, pausePeriod)) ?? null;
}

function formatPauseRange(pausePeriod: PausePeriod): string {
  return `${formatMonth(pausePeriod.startMonth)} to ${formatMonth(pausePeriod.endMonth)}`;
}

function normalizeDateDraftInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 8);
  if (digitsOnly.length <= 4) return digitsOnly;
  if (digitsOnly.length <= 6) return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4)}`;
  return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6)}`;
}

function monthValue(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

function pausePeriodsOverlap(left: PausePeriod, right: PausePeriod): boolean {
  return monthValue(left.startMonth) <= monthValue(right.endMonth) &&
    monthValue(right.startMonth) <= monthValue(left.endMonth);
}

function getEffectiveDueDayForMonth(
  date: Date,
  baseDueDay: number,
  dueDayChanges: Array<{ day: number; endMonth?: Date; startMonth: Date }>,
): number {
  const value = monthValue(date);
  const match = dueDayChanges.find((change) => {
    const start = monthValue(change.startMonth);
    const end = change.endMonth ? monthValue(change.endMonth) : Number.POSITIVE_INFINITY;
    return value >= start && value <= end;
  });
  return match?.day ?? baseDueDay;
}

function getDifferenceLabel(params: {
  negative: string;
  positive: string;
  value: number;
  zero?: string;
}) {
  const { negative, positive, value, zero } = params;
  if (value < 0) return negative;
  if (value > 0) return positive;
  return zero ?? positive;
}

const SAVED_LOANS_STORAGE_KEY = "loan-sim:saved-loans";
const USER_PROFILES_STORAGE_KEY = "loan-sim:user-profiles";
const CURRENT_USER_STORAGE_KEY = "loan-sim:current-user";

const THEME_DEFINITIONS: Record<ThemeId, ThemeDefinition> = {
  sky: {
    accent: "#2563eb",
    accentSoft: "#dbeafe",
    appBackground: "linear-gradient(180deg, #eef4ff 0%, #f8fafc 240px, #f8fafc 100%)",
    cardBorder: "#dbe2ea",
    cardShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
    isDark: false,
    name: "Sky Ledger",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
  forest: {
    accent: "#2f855a",
    accentSoft: "#dcfce7",
    appBackground: "linear-gradient(180deg, #ecfdf5 0%, #f7fee7 260px, #f8fafc 100%)",
    cardBorder: "#d1fae5",
    cardShadow: "0 20px 50px rgba(20, 83, 45, 0.10)",
    isDark: false,
    name: "Forest Ledger",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
  sunset: {
    accent: "#ea580c",
    accentSoft: "#ffedd5",
    appBackground: "linear-gradient(180deg, #fff7ed 0%, #fef2f2 260px, #f8fafc 100%)",
    cardBorder: "#fed7aa",
    cardShadow: "0 20px 50px rgba(154, 52, 18, 0.10)",
    isDark: false,
    name: "Sunset Ledger",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
  midnight: {
    accent: "#60a5fa",
    accentSoft: "#1e3a5f",
    appBackground: "linear-gradient(180deg, #020617 0%, #0f172a 220px, #111827 100%)",
    cardBorder: "#334155",
    cardShadow: "0 24px 60px rgba(2, 6, 23, 0.55)",
    isDark: true,
    name: "Midnight Ledger",
    surface: "#111827",
    surfaceMuted: "#1e293b",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
  },
  rose: {
    accent: "#be185d",
    accentSoft: "#fce7f3",
    appBackground: "linear-gradient(180deg, #fdf2f8 0%, #fff1f2 260px, #f8fafc 100%)",
    cardBorder: "#fbcfe8",
    cardShadow: "0 20px 50px rgba(157, 23, 77, 0.10)",
    isDark: false,
    name: "Rose Ledger",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
  slate: {
    accent: "#475569",
    accentSoft: "#e2e8f0",
    appBackground: "linear-gradient(180deg, #f1f5f9 0%, #f8fafc 260px, #ffffff 100%)",
    cardBorder: "#cbd5e1",
    cardShadow: "0 20px 50px rgba(71, 85, 105, 0.10)",
    isDark: false,
    name: "Slate Ledger",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
};

function accrueInterest(params: {
  aprPercent: number;
  dayCountBasis: DayCountBasis;
  endDate: Date;
  pausePeriods?: PausePeriod[];
  principal: number;
  roundDailyInterest: boolean;
  startDate: Date;
}) {
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
      const denominator =
        dayCountBasis === "365" ? 365 : isLeapYear(cursor.getFullYear()) ? 366 : 365;
      const dailyInterest = principal * (aprPercent / 100 / denominator);
      accruedInterest += roundDailyInterest
        ? Math.round(dailyInterest * 100) / 100
        : dailyInterest;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return accruedInterest;
}

function getNextScheduledPaymentDate(params: {
  afterDate: Date;
  dueDayChanges?: Array<{ day: number; endMonth?: Date; startMonth: Date }>;
  dueDay: number;
  firstPaymentDate: Date;
  moveWeekend: boolean;
}) {
  const { afterDate, dueDay, dueDayChanges = [], firstPaymentDate, moveWeekend } = params;
  let scheduledPaymentDate = new Date(firstPaymentDate);

  while (scheduledPaymentDate <= afterDate) {
    const nextMonthBase = addMonths(scheduledPaymentDate, 1);
    const effectiveDueDay = getEffectiveDueDayForMonth(nextMonthBase, dueDay, dueDayChanges);
    let nextPayment = clampToMonth(nextMonthBase.getFullYear(), nextMonthBase.getMonth(), effectiveDueDay);
    if (moveWeekend) nextPayment = moveToNextWeekday(nextPayment);
    scheduledPaymentDate = nextPayment;
  }

  return scheduledPaymentDate;
}


function buildSchedule(params: {
  actualPayments: PaymentEvent[];
  appendAsOfRow?: boolean;
  aprPercent: number;
  dayCountBasis: DayCountBasis;
  deletedRowIds?: Set<string>;
  dueDay: number;
  firstPaymentDate: Date;
  minimumPayment: number;
  moveWeekend: boolean;
  paymentAmountOverrides?: Record<string, string>;
  paymentDateOverrides?: Record<string, string>;
  paymentLabelOverrides?: Record<string, string>;
  pausePeriods?: PausePeriod[];
  roundDailyInterest: boolean;
  scheduledDueDayChanges?: Array<{ day: number; endMonth?: Date; startMonth: Date }>;
  scheduledPaymentAdjustments?: Array<{ amount: number; endDate?: Date; startDate: Date }>;
  scheduledCutoffDate?: Date;
  scheduledMode: ScheduledMode;
  startingInterest?: number;
  startingPrincipal: number;
  startingPrincipalDate: Date;
  targetDate: Date;
}) {
  const {
    actualPayments,
    appendAsOfRow = false,
    aprPercent,
    dayCountBasis,
    deletedRowIds,
    dueDay,
    firstPaymentDate,
    minimumPayment,
    moveWeekend,
    paymentAmountOverrides,
    paymentDateOverrides,
    paymentLabelOverrides,
    pausePeriods = [],
    roundDailyInterest,
    scheduledDueDayChanges = [],
    scheduledPaymentAdjustments = [],
    scheduledCutoffDate,
    scheduledMode,
    startingInterest = 0,
    startingPrincipal,
    startingPrincipalDate,
    targetDate,
  } = params;

  const emptyResult = (errors: string[]): ScheduleResult => ({
    currentInterest: 0,
    currentPrincipal: 0,
    errors,
    paidOff: false,
    payoffDate: null,
    rows: [],
    hasNegativeAmortization: false,
    totalBalance: 0,
    totalInterestPaid: 0,
    totalPaid: 0,
    totalPrincipalPaid: 0,
  });

  if (startingPrincipal <= 0 || aprPercent < 0 || minimumPayment < 0) {
    return emptyResult(["Enter valid numeric values."]);
  }
  if (targetDate < startingPrincipalDate) {
    return emptyResult(["Target date cannot be earlier than the starting principal date."]);
  }
  if (firstPaymentDate <= startingPrincipalDate) {
    return emptyResult(["First payment date must be after the starting principal date."]);
  }
  if (dueDay < 1 || dueDay > 31) {
    return emptyResult(["Due day must be between 1 and 31."]);
  }

  const rows: ScheduleRow[] = [];
  const errors: string[] = [];

  let principal = startingPrincipal;
  let unpaidInterest = startingInterest;
  let previousEventDate = new Date(startingPrincipalDate);
  let scheduledPaymentDate = new Date(firstPaymentDate);
  let cycle = 1;
  let paymentIndex = 0;
  let totalPaid = 0;
  let totalInterestPaid = 0;
  let totalPrincipalPaid = 0;
  let paidOff = false;
  let payoffDate: Date | null = null;

  const maxEvents = 3000;
  const cutoffTime = scheduledCutoffDate?.getTime() ?? Number.NEGATIVE_INFINITY;
  const amountOverrides = paymentAmountOverrides ?? {};
  const dateOverrides = paymentDateOverrides ?? {};
  const labelOverrides = paymentLabelOverrides ?? {};
  const deletedIds = deletedRowIds ?? new Set<string>();

  const canUseScheduledPayment = (date: Date) => {
    if (scheduledMode === "never") return false;
    if (scheduledMode === "always") return true;
    return date.getTime() > cutoffTime;
  };

  const shouldSkipDeletedScheduledRow = (rowId: string, date: Date) =>
    deletedIds.has(rowId) && !getPausePeriodForDate(date, pausePeriods);
  const getFollowingScheduledPaymentDate = (currentDate: Date) => {
    const nextMonthBase = addMonths(currentDate, 1);
    const effectiveDueDay = getEffectiveDueDayForMonth(nextMonthBase, dueDay, scheduledDueDayChanges);
    let nextPayment = clampToMonth(nextMonthBase.getFullYear(), nextMonthBase.getMonth(), effectiveDueDay);
    if (moveWeekend) nextPayment = moveToNextWeekday(nextPayment);
    return nextPayment;
  };

  const getAdjustedActualPayment = (payment: PaymentEvent) => {
    const rowId = payment.id ?? `${payment.source}-${toDateInputValue(payment.date)}-${payment.amount}`;
    const overriddenDate = dateOverrides[rowId] ? parseDate(dateOverrides[rowId]) : null;
    const overriddenAmount = amountOverrides[rowId] ? parseCurrency(amountOverrides[rowId]) : NaN;
    return {
      ...payment,
      amount: Number.isFinite(overriddenAmount) && overriddenAmount > 0 ? overriddenAmount : payment.amount,
      date: overriddenDate ?? payment.date,
      rowId,
    };
  };

  for (let eventCount = 0; eventCount < maxEvents; eventCount += 1) {
    while (paymentIndex < actualPayments.length) {
      const candidate = getAdjustedActualPayment(actualPayments[paymentIndex]);
      if (!deletedIds.has(candidate.rowId)) {
        break;
      }
      paymentIndex += 1;
    }

    const nextActual = paymentIndex < actualPayments.length ? getAdjustedActualPayment(actualPayments[paymentIndex]) : null;
    const nextActualTime = nextActual?.date.getTime() ?? Number.POSITIVE_INFINITY;

    let scheduledRowId = `scheduled-${cycle}`;
    let adjustedScheduledDate = dateOverrides[scheduledRowId]
      ? parseDate(dateOverrides[scheduledRowId]) ?? scheduledPaymentDate
      : scheduledPaymentDate;
    let adjustedScheduledAmount = amountOverrides[scheduledRowId]
      ? parseCurrency(amountOverrides[scheduledRowId])
      : minimumPayment;

    const scheduledAdjustment = scheduledPaymentAdjustments.reduce((sum, adjustment) => {
      const isAfterStart = adjustedScheduledDate >= adjustment.startDate;
      const isBeforeEnd = adjustment.endDate ? adjustedScheduledDate <= adjustment.endDate : true;
      return isAfterStart && isBeforeEnd ? sum + adjustment.amount : sum;
    }, 0);

    adjustedScheduledAmount += scheduledAdjustment;
    if (!(adjustedScheduledAmount > 0)) {
      adjustedScheduledAmount = minimumPayment;
    }

    while (
      (!canUseScheduledPayment(adjustedScheduledDate) || shouldSkipDeletedScheduledRow(scheduledRowId, adjustedScheduledDate)) &&
      scheduledPaymentDate <= targetDate
    ) {
      scheduledPaymentDate = getFollowingScheduledPaymentDate(scheduledPaymentDate);
      cycle += 1;
      scheduledRowId = `scheduled-${cycle}`;
      adjustedScheduledDate = dateOverrides[scheduledRowId]
        ? parseDate(dateOverrides[scheduledRowId]) ?? scheduledPaymentDate
        : scheduledPaymentDate;
      adjustedScheduledAmount = amountOverrides[scheduledRowId]
        ? parseCurrency(amountOverrides[scheduledRowId])
        : minimumPayment;
      const nextScheduledAdjustment = scheduledPaymentAdjustments.reduce((sum, adjustment) => {
        const isAfterStart = adjustedScheduledDate >= adjustment.startDate;
        const isBeforeEnd = adjustment.endDate ? adjustedScheduledDate <= adjustment.endDate : true;
        return isAfterStart && isBeforeEnd ? sum + adjustment.amount : sum;
      }, 0);
      adjustedScheduledAmount += nextScheduledAdjustment;
      if (!(adjustedScheduledAmount > 0)) {
        adjustedScheduledAmount = minimumPayment;
      }
    }

    const nextScheduledTime = canUseScheduledPayment(adjustedScheduledDate)
      ? adjustedScheduledDate.getTime()
      : Number.POSITIVE_INFINITY;

    if (nextActualTime === Number.POSITIVE_INFINITY && nextScheduledTime === Number.POSITIVE_INFINITY) {
      break;
    }

    const useActual = nextActualTime < nextScheduledTime;
    const eventDate = useActual ? new Date(nextActual!.date) : new Date(adjustedScheduledDate);
    if (eventDate > targetDate) {
      break;
    }

    if (principal <= 0.000001 && unpaidInterest <= 0.000001) {
      paidOff = true;
      payoffDate = new Date(previousEventDate);
      break;
    }

    const days = diffDays(previousEventDate, eventDate);
    const startingPrincipalForRow = principal;
    const startingInterestForRow = unpaidInterest;

    const accruedInterest = accrueInterest({
      aprPercent,
      dayCountBasis,
      endDate: eventDate,
      pausePeriods,
      principal: startingPrincipalForRow,
      roundDailyInterest,
      startDate: previousEventDate,
    });

    const totalInterestBeforePayment = startingInterestForRow + accruedInterest;
    const scheduledPausePeriod = useActual ? null : getPausePeriodForDate(eventDate, pausePeriods);
    const paymentAmount = scheduledPausePeriod ? 0 : useActual ? nextActual!.amount : adjustedScheduledAmount;
    const interestPaid = scheduledPausePeriod ? 0 : Math.min(paymentAmount, totalInterestBeforePayment);
    const principalPaid = scheduledPausePeriod
      ? 0
      : Math.min(startingPrincipalForRow, Math.max(0, paymentAmount - interestPaid));
    const negativeAmortization = scheduledPausePeriod
      ? scheduledPausePeriod.mode === "accrues" && accruedInterest > 0
      : paymentAmount > 0 && principalPaid <= 0.000001 && totalInterestBeforePayment > 0;

    unpaidInterest = Math.max(0, totalInterestBeforePayment - interestPaid);
    principal = Math.max(0, startingPrincipalForRow - principalPaid);

    rows.push({
      accruedInterest,
      cycle: useActual ? null : cycle,
      daysAccrued: days,
      endingInterest: unpaidInterest,
      endingPrincipal: principal,
      eventType: scheduledPausePeriod ? "paused" : useActual ? nextActual!.source : "scheduled",
      interestPaid,
      label: scheduledPausePeriod
        ? scheduledPausePeriod.mode === "paused"
          ? "Payment paused (interest paused)"
          : "Payment paused"
        : useActual
          ? labelOverrides[nextActual!.rowId] || nextActual!.label
          : labelOverrides[scheduledRowId] || "Scheduled payment",
      negativeAmortization,
      paymentAmount,
      paymentDate: new Date(eventDate),
      principalShareOfPayment: paymentAmount > 0 ? principalPaid / paymentAmount : 0,
      principalPaid,
      rowId: useActual ? nextActual!.rowId : scheduledRowId,
      startingInterest: startingInterestForRow,
      startingPrincipal: startingPrincipalForRow,
      totalInterestBeforePayment,
    });

    totalPaid += paymentAmount;
    totalInterestPaid += interestPaid;
    totalPrincipalPaid += principalPaid;
    previousEventDate = new Date(eventDate);

    if (useActual) {
      paymentIndex += 1;
    } else {
      scheduledPaymentDate = getFollowingScheduledPaymentDate(scheduledPaymentDate);
      cycle += 1;
    }

    if (principal <= 0.000001 && unpaidInterest <= 0.000001) {
      paidOff = true;
      payoffDate = new Date(eventDate);
      break;
    }
  }

  if (!paidOff && rows.length >= maxEvents) {
    errors.push("Reached event limit while simulating. Double-check payment amounts and dates.");
  }

  const finalAccruedInterest = accrueInterest({
    aprPercent,
    dayCountBasis,
    endDate: targetDate,
    pausePeriods,
    principal,
    roundDailyInterest,
    startDate: previousEventDate,
  });

  const currentInterest = unpaidInterest + finalAccruedInterest;
  const totalBalance = principal + currentInterest;

  if (appendAsOfRow && targetDate >= previousEventDate) {
    rows.push({
      accruedInterest: finalAccruedInterest,
      cycle: null,
      daysAccrued: diffDays(previousEventDate, targetDate),
      endingInterest: currentInterest,
      endingPrincipal: principal,
      eventType: "snapshot",
      interestPaid: 0,
      label: "As of target date",
      negativeAmortization: false,
      paymentAmount: 0,
      paymentDate: new Date(targetDate),
      principalShareOfPayment: null,
      principalPaid: 0,
      rowId: `snapshot-${toDateInputValue(targetDate)}`,
      startingInterest: unpaidInterest,
      startingPrincipal: principal,
      totalInterestBeforePayment: currentInterest,
    });
  }

  return {
    currentInterest,
    currentPrincipal: principal,
    errors,
    hasNegativeAmortization: rows.some((row) => row.negativeAmortization),
    paidOff,
    payoffDate,
    rows,
    totalBalance,
    totalInterestPaid,
    totalPaid,
    totalPrincipalPaid,
  };
}

type FieldProps = {
  commitMode?: "blur" | "change";
  id: string;
  label: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "month" | "password";
  value: string;
};

function Field({ commitMode = "change", id, label, onChange, type = "text", value }: FieldProps) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commit = () => {
    if (draftValue !== value) {
      onChange(draftValue);
    }
  };

  return (
    <label htmlFor={id} style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-heading, #334155)" }}>{label}</span>
      <input
        id={id}
        type={type}
        value={commitMode === "blur" ? draftValue : value}
        onBlur={commitMode === "blur" ? commit : undefined}
        onChange={(event) => {
          if (commitMode === "blur") {
            setDraftValue(event.target.value);
            return;
          }
          onChange(event.target.value);
        }}
        onKeyDown={
          commitMode === "blur"
            ? (event) => {
                if (event.key === "Enter") {
                  commit();
                }
              }
            : undefined
        }
        style={{
          border: "1px solid var(--app-border-strong, #cbd5e1)",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 15,
          background: "var(--app-input-bg, #fff)",
          color: "var(--app-text, #0f172a)",
        }}
      />
    </label>
  );
}

function DatePickerInput({
  compact = false,
  id,
  maxDate,
  minDate,
  onChange,
  value,
}: {
  compact?: boolean;
  id?: string;
  maxDate?: string;
  minDate?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const committedParsed = parseDate(value);
  const parsedMinDate = parseDate(minDate ?? "");
  const parsedMaxDate = parseDate(maxDate ?? "");
  const today = startOfDay(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"day" | "month" | "year">("day");
  const [draftValue, setDraftValue] = useState(value);
  const draftParsed = parseDate(draftValue);
  const parsed = draftParsed ?? committedParsed;
  const [viewDate, setViewDate] = useState(parsed ?? today);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    setViewDate(parsed ?? today);
  }, [parsed?.getFullYear(), parsed?.getMonth(), parsed?.getDate()]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setPickerMode("day");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const viewStartYear = Math.floor(viewYear / 10) * 10;
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstDayOfMonth + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return null;
    }
    return new Date(viewYear, viewMonth, dayNumber);
  });

  const buttonFontSize = compact ? 13 : 15;
  const clampDateToBounds = (date: Date) => {
    let nextDate = date;
    if (parsedMinDate && compareDateOnly(nextDate, parsedMinDate) < 0) {
      nextDate = parsedMinDate;
    }
    if (parsedMaxDate && compareDateOnly(nextDate, parsedMaxDate) > 0) {
      nextDate = parsedMaxDate;
    }
    return nextDate;
  };
  const isDateDisabled = (date: Date) =>
    (parsedMinDate ? compareDateOnly(date, parsedMinDate) < 0 : false) ||
    (parsedMaxDate ? compareDateOnly(date, parsedMaxDate) > 0 : false);
  const commitDraftValue = (nextValue: string) => {
    const trimmedValue = nextValue.trim();
    if (!trimmedValue) {
      setDraftValue("");
      onChange("");
      return;
    }

    const parsedNext = parseDate(trimmedValue);
    if (!parsedNext) {
      setDraftValue(value);
      return;
    }

    const clampedDate = clampDateToBounds(parsedNext);
    const resolvedValue = toDateInputValue(clampedDate);
    setDraftValue(resolvedValue);
    onChange(resolvedValue);
    setViewDate(clampedDate);
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative", minWidth: 0 }}>
      <div
        style={{
          width: "100%",
          border: "1px solid var(--app-border-strong, #cbd5e1)",
          borderRadius: compact ? 8 : 10,
          background: "var(--app-input-bg, #fff)",
          position: "relative",
          minWidth: 0,
        }}
      >
        <input
          id={id}
          type="text"
          inputMode="numeric"
          maxLength={10}
          pattern="\d{4}-\d{2}-\d{2}"
          title="Use yyyy-mm-dd"
          placeholder="yyyy-mm-dd"
          value={draftValue}
          onChange={(event) => setDraftValue(normalizeDateDraftInput(event.target.value))}
          onBlur={() => commitDraftValue(draftValue)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraftValue(draftValue);
            }
          }}
          style={{
            border: "none",
            outline: "none",
            borderRadius: compact ? 8 : 10,
            padding: compact ? "6px 30px 6px 8px" : "10px 36px 10px 12px",
            fontSize: buttonFontSize,
            background: "transparent",
            color: "var(--app-text, #0f172a)",
            minWidth: 0,
            width: "100%",
          }}
        />
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-label="Open calendar"
          style={{
            border: "0",
            borderLeft: "0",
            borderWidth: 0,
            borderStyle: "none",
            background: "transparent",
            color: "var(--app-text-muted, #64748b)",
            padding: 0,
            width: compact ? 24 : 28,
            height: compact ? 24 : 28,
            lineHeight: 1,
            cursor: "pointer",
            flexShrink: 0,
            position: "absolute",
            right: compact ? 6 : 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            appearance: "none",
            boxShadow: "none",
            outline: "none",
          }}
        >
          <svg
            aria-hidden="true"
            width={compact ? 14 : 16}
            height={compact ? 14 : 16}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 4.75V7.25M17 4.75V7.25M5.75 8.5H18.25M7.75 12H8.25M11.75 12H12.25M15.75 12H16.25M7.75 15.5H8.25M11.75 15.5H12.25M15.75 15.5H16.25M8 6H16C17.6569 6 19 7.34315 19 9V16C19 17.6569 17.6569 19 16 19H8C6.34315 19 5 17.6569 5 16V9C5 7.34315 6.34315 6 8 6Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {isOpen ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 30,
            width: 320,
            border: "1px solid var(--app-border-strong, #cbd5e1)",
            borderRadius: 14,
            padding: 14,
            background: "var(--app-surface, #ffffff)",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={() =>
                setViewDate((current) => {
                  if (pickerMode === "year") return new Date(current.getFullYear() - 10, current.getMonth(), 1);
                  if (pickerMode === "month") return new Date(current.getFullYear() - 1, current.getMonth(), 1);
                  return new Date(current.getFullYear(), current.getMonth() - 1, 1);
                })
              }
              style={{
                border: "1px solid var(--app-border-strong, #cbd5e1)",
                background: "var(--app-surface, #ffffff)",
                color: "var(--app-text, #0f172a)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Prev
            </button>
            {pickerMode === "day" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setPickerMode("month")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--app-heading, #334155)",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {viewDate.toLocaleString("en-US", { month: "long" })}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode("year")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--app-heading, #334155)",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {viewYear}
                </button>
              </div>
            ) : pickerMode === "month" ? (
              <button
                type="button"
                onClick={() => setPickerMode("year")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--app-heading, #334155)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {viewYear}
              </button>
            ) : (
              <div style={{ color: "var(--app-heading, #334155)", fontSize: 13, fontWeight: 700 }}>
                {viewStartYear} - {viewStartYear + 9}
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                setViewDate((current) => {
                  if (pickerMode === "year") return new Date(current.getFullYear() + 10, current.getMonth(), 1);
                  if (pickerMode === "month") return new Date(current.getFullYear() + 1, current.getMonth(), 1);
                  return new Date(current.getFullYear(), current.getMonth() + 1, 1);
                })
              }
              style={{
                border: "1px solid var(--app-border-strong, #cbd5e1)",
                background: "var(--app-surface, #ffffff)",
                color: "var(--app-text, #0f172a)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Next
            </button>
          </div>
          {pickerMode === "year" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--app-text-muted, #64748b)" }}>Year</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
                {Array.from({ length: 10 }, (_, index) => viewStartYear + index).map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setViewDate((current) => clampToMonth(year, current.getMonth(), current.getDate()));
                      setPickerMode("month");
                    }}
                    style={{
                      border: viewYear === year ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border-strong, #cbd5e1)",
                      background: viewYear === year ? "var(--app-accent-soft, #dbeafe)" : "var(--app-surface, #ffffff)",
                      color: "var(--app-text, #0f172a)",
                      borderRadius: 8,
                      padding: "10px 6px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          ) : pickerMode === "month" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--app-text-muted, #64748b)" }}>{viewYear}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                {Array.from({ length: 12 }, (_, index) => {
                  const monthLabel = new Date(2026, index, 1).toLocaleString("en-US", { month: "short" });
                  return (
                    <button
                      key={monthLabel}
                      type="button"
                      onClick={() => {
                        setViewDate((current) => clampToMonth(current.getFullYear(), index, current.getDate()));
                        setPickerMode("day");
                      }}
                      style={{
                        border: viewMonth === index ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border-strong, #cbd5e1)",
                        background: viewMonth === index ? "var(--app-accent-soft, #dbeafe)" : "var(--app-surface, #ffffff)",
                        color: "var(--app-text, #0f172a)",
                        borderRadius: 8,
                        padding: "10px 6px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {monthLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((weekday) => (
                  <div
                    key={weekday}
                    style={{ fontSize: 11, fontWeight: 700, color: "var(--app-text-muted, #64748b)", textAlign: "center" }}
                  >
                    {weekday}
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
                {dayCells.map((date, index) =>
                  date ? (
                    <button
                      key={toDateInputValue(date)}
                      type="button"
                      disabled={isDateDisabled(date)}
                      onClick={() => {
                        if (isDateDisabled(date)) return;
                        const resolvedValue = toDateInputValue(date);
                        setDraftValue(resolvedValue);
                        onChange(resolvedValue);
                        setViewDate(date);
                        setIsOpen(false);
                        setPickerMode("day");
                      }}
                      style={{
                        border:
                          parsed &&
                          parsed.getFullYear() === date.getFullYear() &&
                          parsed.getMonth() === date.getMonth() &&
                          parsed.getDate() === date.getDate()
                            ? "1px solid var(--app-accent, #2563eb)"
                            : "1px solid var(--app-border, #e2e8f0)",
                        background:
                          parsed &&
                          parsed.getFullYear() === date.getFullYear() &&
                          parsed.getMonth() === date.getMonth() &&
                          parsed.getDate() === date.getDate()
                            ? "var(--app-accent-soft, #dbeafe)"
                            : isDateDisabled(date)
                              ? "var(--app-surface-muted, #f8fafc)"
                              : "var(--app-surface, #ffffff)",
                        color: isDateDisabled(date) ? "#94a3b8" : "var(--app-text, #0f172a)",
                        opacity: isDateDisabled(date) ? 0.65 : 1,
                        borderRadius: 8,
                        padding: "8px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isDateDisabled(date) ? "not-allowed" : "pointer",
                      }}
                    >
                      {date.getDate()}
                    </button>
                  ) : (
                    <div key={`empty-${index}`} />
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DateField({
  id,
  label,
  maxDate,
  minDate,
  onChange,
  value,
}: {
  id: string;
  label: string;
  maxDate?: string;
  minDate?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label htmlFor={id} style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-heading, #334155)" }}>{label}</span>
      <DatePickerInput id={id} maxDate={maxDate} minDate={minDate} value={value} onChange={onChange} />
    </label>
  );
}

function MonthYearField({
  id,
  label,
  maxMonth,
  minMonth,
  onChange,
  value,
}: {
  id: string;
  label: string;
  maxMonth?: string;
  minMonth?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const parsed = parseMonthInput(value);
  const parsedMinMonth = parseMonthInput(minMonth ?? "");
  const parsedMaxMonth = parseMonthInput(maxMonth ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"month" | "year">("month");
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewStartYear, setViewStartYear] = useState(
    parsed ? Math.floor(parsed.getFullYear() / 10) * 10 : Math.floor(new Date().getFullYear() / 10) * 10,
  );
  const yearValue = parsed?.getFullYear() ?? null;
  const selectedMonthValue = parsed?.getMonth() ?? null;
  const wrapperRef = useRef<HTMLLabelElement | null>(null);
  const isMonthDisabled = (year: number, monthIndex: number) => {
    const date = new Date(year, monthIndex, 1);
    return (parsedMinMonth ? monthValue(date) < monthValue(parsedMinMonth) : false) ||
      (parsedMaxMonth ? monthValue(date) > monthValue(parsedMaxMonth) : false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setPickerMode("month");
    }
  }, [isOpen]);

  useEffect(() => {
    const resolvedYear = parsed?.getFullYear() ?? new Date().getFullYear();
    setViewYear(resolvedYear);
    setViewStartYear(Math.floor(resolvedYear / 10) * 10);
  }, [parsed?.getFullYear()]);

  const selectYear = (year: number) => {
    const resolvedMonth = selectedMonthValue ?? new Date().getMonth();
    setViewYear(year);
    setViewStartYear(Math.floor(year / 10) * 10);
    onChange(`${year}-${`${resolvedMonth + 1}`.padStart(2, "0")}`);
    setPickerMode("month");
  };

  const selectMonth = (monthIndex: number) => {
    const resolvedYear = viewYear;
    if (isMonthDisabled(resolvedYear, monthIndex)) {
      return;
    }
    onChange(`${resolvedYear}-${`${monthIndex + 1}`.padStart(2, "0")}`);
    setIsOpen(false);
  };

  return (
    <label htmlFor={id} ref={wrapperRef} style={{ display: "grid", gap: 6, position: "relative" }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-heading, #334155)" }}>{label}</span>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        style={{
          border: "1px solid var(--app-border-strong, #cbd5e1)",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 15,
          background: "var(--app-input-bg, #fff)",
          color: "var(--app-text, #0f172a)",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <span>{parsed ? formatMonthYear(parsed) : "Select month and year"}</span>
        <span style={{ color: "var(--app-text-muted, #64748b)", fontSize: 14, lineHeight: 1 }}>📅</span>
      </button>
      {isOpen ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 20,
            width: 320,
            border: "1px solid var(--app-border-strong, #cbd5e1)",
            borderRadius: 14,
            padding: 14,
            background: "var(--app-surface, #ffffff)",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => {
                if (pickerMode === "year") {
                  setViewStartYear((year) => year - 10);
                  return;
                }
                setViewYear((year) => year - 1);
              }}
              style={{
                border: "1px solid var(--app-border-strong, #cbd5e1)",
                background: "var(--app-surface, #ffffff)",
                color: "var(--app-text, #0f172a)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                if (pickerMode === "month") {
                  setPickerMode("year");
                  setViewStartYear(viewYear - (viewYear % 10));
                }
              }}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--app-heading, #334155)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {pickerMode === "month" ? `${viewYear}` : `${viewStartYear} - ${viewStartYear + 9}`}
            </button>
            <button
              type="button"
              onClick={() => {
                if (pickerMode === "year") {
                  setViewStartYear((year) => year + 10);
                  return;
                }
                setViewYear((year) => year + 1);
              }}
              style={{
                border: "1px solid var(--app-border-strong, #cbd5e1)",
                background: "var(--app-surface, #ffffff)",
                color: "var(--app-text, #0f172a)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Next
            </button>
          </div>
          {pickerMode === "year" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--app-text-muted, #64748b)" }}>Year</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
                {Array.from({ length: 10 }, (_, index) => viewStartYear + index).map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => selectYear(year)}
                    style={{
                      border: yearValue === year ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border-strong, #cbd5e1)",
                      background: yearValue === year ? "var(--app-accent-soft, #dbeafe)" : "var(--app-surface, #ffffff)",
                      color: "var(--app-text, #0f172a)",
                      borderRadius: 8,
                      padding: "10px 6px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--app-text-muted, #64748b)" }}>{viewYear}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                {Array.from({ length: 12 }, (_, index) => {
                  const monthLabel = new Date(2026, index, 1).toLocaleString("en-US", { month: "short" });
                  return (
                    <button
                      key={monthLabel}
                      type="button"
                      disabled={isMonthDisabled(viewYear, index)}
                      onClick={() => selectMonth(index)}
                      style={{
                        border: selectedMonthValue === index ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border-strong, #cbd5e1)",
                        background: selectedMonthValue === index ? "var(--app-accent-soft, #dbeafe)" : isMonthDisabled(viewYear, index) ? "var(--app-surface-muted, #f8fafc)" : "var(--app-surface, #ffffff)",
                        color: isMonthDisabled(viewYear, index) ? "#94a3b8" : "var(--app-text, #0f172a)",
                        opacity: isMonthDisabled(viewYear, index) ? 0.65 : 1,
                        borderRadius: 8,
                        padding: "10px 6px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isMonthDisabled(viewYear, index) ? "not-allowed" : "pointer",
                      }}
                    >
                      {monthLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </label>
  );
}

function SummaryValue({
  emphasized = false,
  label,
  subtext,
  tone = "default",
  value,
}: {
  emphasized?: boolean;
  label: ReactNode;
  subtext?: ReactNode;
  tone?: "benchmark" | "default" | "negative" | "positive";
  value: string;
}) {
  const emphasizedStyle =
    tone === "positive"
      ? {
          display: "grid",
          gap: 4,
          padding: 12,
          borderRadius: 14,
          background: "var(--app-positive-bg, #ecfdf5)",
          border: "1px solid var(--app-positive-border, #86efac)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
        }
      : tone === "negative"
        ? {
            display: "grid",
            gap: 4,
            padding: 12,
            borderRadius: 14,
            background: "var(--app-negative-bg, #fff1f2)",
            border: "1px solid var(--app-negative-border, #fda4af)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
          }
        : tone === "benchmark"
          ? {
              display: "grid",
              gap: 4,
              padding: 12,
              borderRadius: 14,
              background: "var(--app-benchmark-bg, #fefce8)",
              border: "1px solid var(--app-benchmark-border, #fde68a)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
            }
          : {
              display: "grid",
              gap: 4,
              padding: 12,
              borderRadius: 14,
              background: "var(--app-surface-muted, #f8fafc)",
              border: "1px solid var(--app-border, #dbe2ea)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
            };

  return (
    <div
      style={emphasized ? emphasizedStyle : { display: "grid", gap: 4 }}
    >
      <div
        style={{
          fontSize: emphasized ? 12 : 13,
          color:
            tone === "positive"
              ? "var(--app-positive-text, #15803d)"
              : tone === "negative"
                ? "var(--app-negative-text, #be123c)"
                : tone === "benchmark"
                  ? "var(--app-benchmark-text, #a16207)"
                  : emphasized
                    ? "var(--app-accent, #1d4ed8)"
                  : "var(--app-text-muted, #64748b)",
          fontWeight: emphasized ? 700 : 500,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, color: "var(--app-text, #0f172a)", letterSpacing: "-0.01em" }}>{value}</div>
      {subtext ? <div style={{ fontSize: 12, color: "var(--app-text-muted, #64748b)", lineHeight: 1.4 }}>{subtext}</div> : null}
    </div>
  );
}

function SummaryGroupLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "var(--app-text-muted, #475569)",
        marginTop: 8,
      }}
    >
      {label}
    </div>
  );
}

function FormSection({
  children,
  helper,
  title,
}: {
  children: ReactNode;
  helper?: ReactNode;
  title: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        padding: 14,
        borderRadius: 14,
        background: "var(--app-surface-muted, #f8fafc)",
        border: "1px solid var(--app-border, #e2e8f0)",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--app-heading, #334155)" }}>{title}</div>
        {helper ? <div style={{ fontSize: 12, color: "var(--app-text-muted, #64748b)", lineHeight: 1.4 }}>{helper}</div> : null}
      </div>
      {children}
    </div>
  );
}

const footnoteSupStyle = {
  fontSize: 10,
  lineHeight: 1,
  verticalAlign: "super" as const,
  marginLeft: 1,
};

function LabelWithNotes({ text, notes }: { text: string; notes?: number[] }) {
  return (
    <span>
      {text}
      {notes?.map((note) => (
        <sup key={`${text}-${note}`} style={footnoteSupStyle}>
          {note}
        </sup>
      ))}
    </span>
  );
}

function formatPrincipalShare(share: number | null): string {
  if (share === null || !Number.isFinite(share)) {
    return "-";
  }
  return `${Math.max(0, share * 100).toFixed(0)}%`;
}

function getEventTypeCode(eventType: ScheduleRow["eventType"]): string {
  switch (eventType) {
    case "scheduled":
      return "S";
    case "extra":
      return "E";
    case "history":
      return "H";
    case "paused":
      return "P";
    case "snapshot":
      return "A";
    default:
      return "-";
  }
}

function getEventTypeTitle(eventType: ScheduleRow["eventType"]): string {
  switch (eventType) {
    case "scheduled":
      return "Scheduled";
    case "extra":
      return "Extra";
    case "history":
      return "Historical";
    case "paused":
      return "Paused";
    case "snapshot":
      return "As-of snapshot";
    default:
      return eventType;
  }
}

function getTableRowStyle(row: ScheduleRow) {
  if (row.eventType === "paused") {
    return { background: "var(--app-row-paused, #fff7ed)" };
  }
  if (row.negativeAmortization) {
    return { background: "var(--app-row-negative, #fffbeb)" };
  }
  return undefined;
}

function TypeHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <span ref={wrapperRef} style={{ display: "inline-flex", alignItems: "center", gap: 6, position: "relative" }}>
      <span>Type</span>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Show type key"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "var(--app-accent, #2563eb)",
          color: "#ffffff",
          fontSize: 9,
          fontWeight: 700,
          cursor: "pointer",
          border: "none",
          padding: 0,
        }}
      >
        ?
      </button>
      {isOpen ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 10,
            minWidth: 220,
            border: "1px solid var(--app-border-strong, #cbd5e1)",
            borderRadius: 10,
            background: "var(--app-surface, #ffffff)",
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
            padding: 10,
            display: "grid",
            gap: 4,
            fontSize: 12,
            color: "var(--app-text, #334155)",
          }}
        >
          <div>S = Scheduled</div>
          <div>E = Extra payment</div>
          <div>H = Historical</div>
          <div>P = Paused</div>
          <div>A = As-of snapshot</div>
        </div>
      ) : null}
    </span>
  );
}

export default function LoanInterestSimulatorMockup() {
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "create">("login");
  const [authName, setAuthName] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [activePage, setActivePage] = useState<"simulator" | "paycheck" | "profile">("simulator");
  const [activeLoanTab, setActiveLoanTab] = useState<"details" | "assumed" | "history" | "whatif">("details");
  const [loanSidebarCollapsed, setLoanSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [deleteAccountConfirmOpen, setDeleteAccountConfirmOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [profileDraftName, setProfileDraftName] = useState("");
  const [profileDraftEmail, setProfileDraftEmail] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [passwordResetCodeInput, setPasswordResetCodeInput] = useState("");
  const [passwordResetNewPassword, setPasswordResetNewPassword] = useState("");
  const [passwordResetConfirmPassword, setPasswordResetConfirmPassword] = useState("");
  const [savedLoans, setSavedLoans] = useState<SavedLoanRecord[]>([]);
  const [currentLoanId, setCurrentLoanId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [loanName, setLoanName] = useState("");
  const [startingPrincipal, setStartingPrincipal] = useState("");
  const [startingPrincipalDate, setStartingPrincipalDate] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [additionalMonthlyPayment, setAdditionalMonthlyPayment] = useState("0");
  const [aprPercent, setAprPercent] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [targetDate, setTargetDate] = useState(toDateInputValue(new Date()));
  const [moveWeekend, setMoveWeekend] = useState(false);
  const [roundDailyInterest, setRoundDailyInterest] = useState(false);
  const [dayCountBasis, setDayCountBasis] = useState<DayCountBasis>("actual-year");
  const [activeView, setActiveView] = useState<"assumed" | "history" | "whatif">("assumed");
  const [showAmortization, setShowAmortization] = useState(false);
  const [showHelperAmortization, setShowHelperAmortization] = useState(false);
  const [oneOffPayments, setOneOffPayments] = useState<PaymentEvent[]>([]);
  const [newOneOffDate, setNewOneOffDate] = useState("");
  const [newOneOffAmount, setNewOneOffAmount] = useState("");
  const [newOneOffLabel, setNewOneOffLabel] = useState("Extra payment");
  const [helperPausePeriods, setHelperPausePeriods] = useState<PausePeriod[]>([]);
  const [helperPauseFromMonth, setHelperPauseFromMonth] = useState("");
  const [helperPauseToMonth, setHelperPauseToMonth] = useState("");
  const [helperPauseMode, setHelperPauseMode] = useState<PauseMode>("accrues");
  const [helperBulkMode, setHelperBulkMode] = useState<"pause" | "monthly-extra" | "minimum" | "due-day">("pause");
  const [helperAdjustmentFromMonth, setHelperAdjustmentFromMonth] = useState("");
  const [helperAdjustmentToMonth, setHelperAdjustmentToMonth] = useState("");
  const [helperAdjustmentAmount, setHelperAdjustmentAmount] = useState("");
  const [helperRecurringChanges, setHelperRecurringChanges] = useState<FutureRecurringChange[]>([]);
  const [helperDueDayChanges, setHelperDueDayChanges] = useState<DueDayChange[]>([]);
  const [helperAdjustmentDueDay, setHelperAdjustmentDueDay] = useState("");
  const [deletedHelperRowIds, setDeletedHelperRowIds] = useState<string[]>([]);
  const [helperActionError, setHelperActionError] = useState("");
  const [helperPaymentAmountOverrides, setHelperPaymentAmountOverrides] = useState<Record<string, string>>({});
  const [paymentDateOverrides, setPaymentDateOverrides] = useState<Record<string, string>>({});
  const [paymentLabelOverrides, setPaymentLabelOverrides] = useState<Record<string, string>>({});
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [editingPaymentDate, setEditingPaymentDate] = useState("");
  const [editingPaymentAmount, setEditingPaymentAmount] = useState("");
  const [editingPaymentLabel, setEditingPaymentLabel] = useState("");
  const [whatIfPayments, setWhatIfPayments] = useState<PaymentEvent[]>([]);
  const [whatIfRecurringChanges, setWhatIfRecurringChanges] = useState<FutureRecurringChange[]>([]);
  const [whatIfPausePeriods, setWhatIfPausePeriods] = useState<PausePeriod[]>([]);
  const [whatIfEntryMode, setWhatIfEntryMode] = useState<"minimum" | "monthly-extra" | "one-time" | "pause" | "due-day">("one-time");
  const [newWhatIfDate, setNewWhatIfDate] = useState("");
  const [newWhatIfAmount, setNewWhatIfAmount] = useState("");
  const [newWhatIfLabel, setNewWhatIfLabel] = useState("Anticipated one-time payment");
  const [whatIfAdjustmentDate, setWhatIfAdjustmentDate] = useState("");
  const [whatIfAdjustmentEndDate, setWhatIfAdjustmentEndDate] = useState("");
  const [whatIfAdjustmentAmount, setWhatIfAdjustmentAmount] = useState("");
  const [whatIfAdjustmentDueDay, setWhatIfAdjustmentDueDay] = useState("");
  const [whatIfDueDayChanges, setWhatIfDueDayChanges] = useState<DueDayChange[]>([]);
  const [whatIfPauseFromMonth, setWhatIfPauseFromMonth] = useState("");
  const [whatIfPauseToMonth, setWhatIfPauseToMonth] = useState("");
  const [whatIfPauseMode, setWhatIfPauseMode] = useState<PauseMode>("accrues");
  const [whatIfActionError, setWhatIfActionError] = useState("");
  const [showHistoricalDetails, setShowHistoricalDetails] = useState(false);
  const [showFutureDetails, setShowFutureDetails] = useState(false);
  const [showLifetimeDetails, setShowLifetimeDetails] = useState(false);
  const [showComparisonDetails, setShowComparisonDetails] = useState(false);
  const deferredStartingPrincipal = useDeferredValue(startingPrincipal);
  const deferredStartingPrincipalDate = useDeferredValue(startingPrincipalDate);
  const deferredFirstPaymentDate = useDeferredValue(firstPaymentDate);
  const deferredMinimumPayment = useDeferredValue(minimumPayment);
  const deferredAdditionalMonthlyPayment = useDeferredValue(additionalMonthlyPayment);
  const deferredAprPercent = useDeferredValue(aprPercent);
  const deferredDueDay = useDeferredValue(dueDay);
  const deferredTargetDate = useDeferredValue(targetDate);
  const totalMonthlyPayment = (parseCurrency(deferredMinimumPayment) + parseCurrency(deferredAdditionalMonthlyPayment)).toFixed(2);
  const todayDate = startOfDay(new Date());
  const todayValue = toDateInputValue(todayDate);
  const getSavedLoansStorageKey = (userId: string) => `${SAVED_LOANS_STORAGE_KEY}:${userId}`;
  const currentUser = currentUserId ? userProfiles.find((profile) => profile.id === currentUserId) ?? null : null;
  const currentTheme = THEME_DEFINITIONS[currentUser?.themeId ?? "sky"];
  const displayName = currentUser?.displayName || currentUser?.name.split("@")[0] || "User";
  const firstName = displayName.split(/\s+/)[0] || "User";
  const profileInitial = firstName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [profileMenuOpen]);

  const createBlankLoanSnapshot = (): LoanSnapshot => ({
    activeView: "assumed",
    additionalMonthlyPayment: "0",
    aprPercent: "",
    dayCountBasis: "actual-year",
    deletedHelperRowIds: [],
    dueDay: "1",
    editingPaymentAmount: "",
    editingPaymentDate: "",
    editingPaymentId: "",
    editingPaymentLabel: "",
    firstPaymentDate: "",
    helperActionError: "",
    helperAdjustmentAmount: "",
    helperAdjustmentDueDay: "",
    helperAdjustmentFromMonth: "",
    helperAdjustmentToMonth: "",
    helperBulkMode: "pause",
    helperDueDayChanges: [],
    helperPauseFromMonth: "",
    helperPauseMode: "accrues",
    helperPausePeriods: [],
    helperPauseToMonth: "",
    helperPaymentAmountOverrides: {},
    helperRecurringChanges: [],
    loanName: "",
    minimumPayment: "",
    moveWeekend: false,
    newOneOffAmount: "",
    newOneOffDate: "",
    newOneOffLabel: "Extra payment",
    newWhatIfAmount: "",
    newWhatIfDate: "",
    newWhatIfLabel: "Anticipated one-time payment",
    oneOffPayments: [],
    paymentDateOverrides: {},
    paymentLabelOverrides: {},
    roundDailyInterest: false,
    showAmortization: false,
    showComparisonDetails: false,
    showFutureDetails: false,
    showHelperAmortization: false,
    showHistoricalDetails: false,
    showLifetimeDetails: false,
    startingPrincipal: "",
    startingPrincipalDate: "",
    targetDate: todayValue,
    whatIfActionError: "",
    whatIfAdjustmentAmount: "",
    whatIfAdjustmentDate: "",
    whatIfAdjustmentDueDay: "",
    whatIfAdjustmentEndDate: "",
    whatIfDueDayChanges: [],
    whatIfEntryMode: "one-time",
    whatIfPauseFromMonth: "",
    whatIfPauseMode: "accrues",
    whatIfPausePeriods: [],
    whatIfPauseToMonth: "",
    whatIfPayments: [],
    whatIfRecurringChanges: [],
  });

  const serializePaymentEvent = (payment: PaymentEvent): SerializedPaymentEvent => ({
    ...payment,
    date: toDateInputValue(payment.date),
  });

  const deserializePaymentEvent = (payment: SerializedPaymentEvent): PaymentEvent => ({
    ...payment,
    date: parseDate(payment.date) ?? todayDate,
  });

  const serializeRecurringChange = (change: FutureRecurringChange): SerializedFutureRecurringChange => ({
    ...change,
    effectiveDate: toDateInputValue(change.effectiveDate),
    endDate: change.endDate ? toDateInputValue(change.endDate) : undefined,
  });

  const deserializeRecurringChange = (change: SerializedFutureRecurringChange): FutureRecurringChange => ({
    ...change,
    effectiveDate: parseDate(change.effectiveDate) ?? todayDate,
    endDate: change.endDate ? parseDate(change.endDate) ?? undefined : undefined,
  });

  const serializePausePeriod = (pausePeriod: PausePeriod): SerializedPausePeriod => ({
    ...pausePeriod,
    endMonth: formatMonth(pausePeriod.endMonth),
    startMonth: formatMonth(pausePeriod.startMonth),
  });

  const deserializePausePeriod = (pausePeriod: SerializedPausePeriod): PausePeriod => ({
    ...pausePeriod,
    endMonth: parseMonthInput(pausePeriod.endMonth) ?? new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
    startMonth: parseMonthInput(pausePeriod.startMonth) ?? new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
  });

  const serializeDueDayChange = (change: DueDayChange): SerializedDueDayChange => ({
    ...change,
    endMonth: change.endMonth ? formatMonth(change.endMonth) : undefined,
    startMonth: formatMonth(change.startMonth),
  });

  const deserializeDueDayChange = (change: SerializedDueDayChange): DueDayChange => ({
    ...change,
    endMonth: change.endMonth ? parseMonthInput(change.endMonth) ?? undefined : undefined,
    startMonth: parseMonthInput(change.startMonth) ?? new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
  });

  const applyLoanSnapshot = (snapshot: LoanSnapshot) => {
    setLoanName(snapshot.loanName);
    setStartingPrincipal(snapshot.startingPrincipal);
    setStartingPrincipalDate(snapshot.startingPrincipalDate);
    setFirstPaymentDate(snapshot.firstPaymentDate);
    setMinimumPayment(snapshot.minimumPayment);
    setAdditionalMonthlyPayment(snapshot.additionalMonthlyPayment);
    setAprPercent(snapshot.aprPercent);
    setDueDay(snapshot.dueDay);
    setTargetDate(snapshot.targetDate);
    setMoveWeekend(snapshot.moveWeekend);
    setRoundDailyInterest(snapshot.roundDailyInterest);
    setDayCountBasis(snapshot.dayCountBasis);
    setActiveView(snapshot.activeView);
    setShowAmortization(snapshot.showAmortization);
    setShowHelperAmortization(snapshot.showHelperAmortization);
    setOneOffPayments(snapshot.oneOffPayments.map(deserializePaymentEvent));
    setNewOneOffDate(snapshot.newOneOffDate);
    setNewOneOffAmount(snapshot.newOneOffAmount);
    setNewOneOffLabel(snapshot.newOneOffLabel);
    setHelperPausePeriods(snapshot.helperPausePeriods.map(deserializePausePeriod));
    setHelperPauseFromMonth(snapshot.helperPauseFromMonth);
    setHelperPauseToMonth(snapshot.helperPauseToMonth);
    setHelperPauseMode(snapshot.helperPauseMode);
    setHelperBulkMode(snapshot.helperBulkMode);
    setHelperAdjustmentFromMonth(snapshot.helperAdjustmentFromMonth);
    setHelperAdjustmentToMonth(snapshot.helperAdjustmentToMonth);
    setHelperAdjustmentAmount(snapshot.helperAdjustmentAmount);
    setHelperRecurringChanges(snapshot.helperRecurringChanges.map(deserializeRecurringChange));
    setHelperDueDayChanges(snapshot.helperDueDayChanges.map(deserializeDueDayChange));
    setHelperAdjustmentDueDay(snapshot.helperAdjustmentDueDay);
    setDeletedHelperRowIds(snapshot.deletedHelperRowIds);
    setHelperActionError(snapshot.helperActionError);
    setHelperPaymentAmountOverrides(snapshot.helperPaymentAmountOverrides);
    setPaymentDateOverrides(snapshot.paymentDateOverrides);
    setPaymentLabelOverrides(snapshot.paymentLabelOverrides);
    setEditingPaymentId(snapshot.editingPaymentId);
    setEditingPaymentDate(snapshot.editingPaymentDate);
    setEditingPaymentAmount(snapshot.editingPaymentAmount);
    setEditingPaymentLabel(snapshot.editingPaymentLabel);
    setWhatIfPayments(snapshot.whatIfPayments.map(deserializePaymentEvent));
    setWhatIfRecurringChanges(snapshot.whatIfRecurringChanges.map(deserializeRecurringChange));
    setWhatIfPausePeriods(snapshot.whatIfPausePeriods.map(deserializePausePeriod));
    setWhatIfEntryMode(snapshot.whatIfEntryMode);
    setNewWhatIfDate(snapshot.newWhatIfDate);
    setNewWhatIfAmount(snapshot.newWhatIfAmount);
    setNewWhatIfLabel(snapshot.newWhatIfLabel);
    setWhatIfAdjustmentDate(snapshot.whatIfAdjustmentDate);
    setWhatIfAdjustmentEndDate(snapshot.whatIfAdjustmentEndDate);
    setWhatIfAdjustmentAmount(snapshot.whatIfAdjustmentAmount);
    setWhatIfAdjustmentDueDay(snapshot.whatIfAdjustmentDueDay);
    setWhatIfDueDayChanges(snapshot.whatIfDueDayChanges.map(deserializeDueDayChange));
    setWhatIfPauseFromMonth(snapshot.whatIfPauseFromMonth);
    setWhatIfPauseToMonth(snapshot.whatIfPauseToMonth);
    setWhatIfPauseMode(snapshot.whatIfPauseMode);
    setWhatIfActionError(snapshot.whatIfActionError);
    setShowHistoricalDetails(snapshot.showHistoricalDetails);
    setShowFutureDetails(snapshot.showFutureDetails);
    setShowLifetimeDetails(snapshot.showLifetimeDetails);
    setShowComparisonDetails(snapshot.showComparisonDetails);
  };

  const buildLoanSnapshot = (): LoanSnapshot => ({
    activeView,
    additionalMonthlyPayment,
    aprPercent,
    dayCountBasis,
    deletedHelperRowIds,
    dueDay,
    editingPaymentAmount,
    editingPaymentDate,
    editingPaymentId,
    editingPaymentLabel,
    firstPaymentDate,
    helperActionError,
    helperAdjustmentAmount,
    helperAdjustmentDueDay,
    helperAdjustmentFromMonth,
    helperAdjustmentToMonth,
    helperBulkMode,
    helperDueDayChanges: helperDueDayChanges.map(serializeDueDayChange),
    helperPauseFromMonth,
    helperPauseMode,
    helperPausePeriods: helperPausePeriods.map(serializePausePeriod),
    helperPauseToMonth,
    helperPaymentAmountOverrides,
    helperRecurringChanges: helperRecurringChanges.map(serializeRecurringChange),
    loanName,
    minimumPayment,
    moveWeekend,
    newOneOffAmount,
    newOneOffDate,
    newOneOffLabel,
    newWhatIfAmount,
    newWhatIfDate,
    newWhatIfLabel,
    oneOffPayments: oneOffPayments.map(serializePaymentEvent),
    paymentDateOverrides,
    paymentLabelOverrides,
    roundDailyInterest,
    showAmortization,
    showComparisonDetails,
    showFutureDetails,
    showHelperAmortization,
    showHistoricalDetails,
    showLifetimeDetails,
    startingPrincipal,
    startingPrincipalDate,
    targetDate,
    whatIfActionError,
    whatIfAdjustmentAmount,
    whatIfAdjustmentDate,
    whatIfAdjustmentDueDay,
    whatIfAdjustmentEndDate,
    whatIfDueDayChanges: whatIfDueDayChanges.map(serializeDueDayChange),
    whatIfEntryMode,
    whatIfPauseFromMonth,
    whatIfPauseMode,
    whatIfPausePeriods: whatIfPausePeriods.map(serializePausePeriod),
    whatIfPauseToMonth,
    whatIfPayments: whatIfPayments.map(serializePaymentEvent),
    whatIfRecurringChanges: whatIfRecurringChanges.map(serializeRecurringChange),
  });

  const resetAll = () => {
    applyLoanSnapshot(createBlankLoanSnapshot());
  };

  const loadLoansForUser = async (userId: string) => {
    if (cloudStorageEnabled) {
      try {
        const parsed = await loadCloudLoans<SavedLoanRecord>(userId);
        if (parsed.length === 0) {
          setSavedLoans([]);
          setCurrentLoanId(null);
          applyLoanSnapshot(createBlankLoanSnapshot());
          return;
        }

        setSavedLoans(parsed);
        setCurrentLoanId(parsed[0].id);
        applyLoanSnapshot(parsed[0].data);
      } catch (error) {
        setSaveStatus(error instanceof Error ? error.message : "Could not load cloud loans.");
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot());
      }
      return;
    }

    try {
      const raw = localStorage.getItem(getSavedLoansStorageKey(userId));
      if (!raw) {
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot());
        return;
      }
      const parsed = JSON.parse(raw) as SavedLoanRecord[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot());
        return;
      }
      setSavedLoans(parsed);
      setCurrentLoanId(parsed[0].id);
      applyLoanSnapshot(parsed[0].data);
    } catch {
      setSavedLoans([]);
      setCurrentLoanId(null);
      applyLoanSnapshot(createBlankLoanSnapshot());
    }
  };

  useEffect(() => {
    let isMounted = true;
    console.info(
      cloudStorageEnabled
        ? "LoanSim cloud storage enabled: Supabase env vars are present."
        : "LoanSim local storage mode: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are missing.",
      cloudStorageStatus,
    );

    if (cloudStorageEnabled) {
      void (async () => {
        try {
          const profile = await getCloudSessionProfile();
          if (!isMounted) return;

          if (!profile) {
            setSaveStatus("Supabase connected. Sign in or create an account to load cloud loans.");
            setUserProfiles([]);
            setCurrentUserId(null);
            setSavedLoans([]);
            setCurrentLoanId(null);
            applyLoanSnapshot(createBlankLoanSnapshot());
            return;
          }

          const normalized = normalizeProfile(profile as UserProfile);
          setUserProfiles([normalized]);
          setCurrentUserId(normalized.id);
          await loadLoansForUser(normalized.id);
        } catch {
          if (!isMounted) return;
          setUserProfiles([]);
          setCurrentUserId(null);
          setSavedLoans([]);
          setCurrentLoanId(null);
          applyLoanSnapshot(createBlankLoanSnapshot());
        }
      })();

      return () => {
        isMounted = false;
      };
    }

    try {
      const rawProfiles = localStorage.getItem(USER_PROFILES_STORAGE_KEY);
      const parsedProfiles = rawProfiles ? (JSON.parse(rawProfiles) as Partial<UserProfile>[]) : [];
      const validProfiles = Array.isArray(parsedProfiles)
        ? parsedProfiles.map((profile) => ({
            displayName: profile.displayName ?? profile.name ?? "",
            email: profile.email ?? "",
            id: profile.id ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: profile.name ?? "",
            password: profile.password ?? "",
            passwordResetCode: profile.passwordResetCode,
            passwordResetIssuedAt: profile.passwordResetIssuedAt,
            themeId: profile.themeId ?? "sky",
          }))
          .map((profile) => normalizeProfile(profile as UserProfile))
        : [];
      setUserProfiles(validProfiles);

      const storedCurrentUserId = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      const initialUserId =
        storedCurrentUserId && validProfiles.some((profile) => profile.id === storedCurrentUserId)
          ? storedCurrentUserId
          : validProfiles[0]?.id ?? null;

      if (!initialUserId) {
        setCurrentUserId(null);
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot());
        return;
      }

      setCurrentUserId(initialUserId);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, initialUserId);
      loadLoansForUser(initialUserId);
    } catch {
      setUserProfiles([]);
      setCurrentUserId(null);
      setSavedLoans([]);
      setCurrentLoanId(null);
      applyLoanSnapshot(createBlankLoanSnapshot());
    }
  }, []);

  const persistSavedLoans = (nextLoans: SavedLoanRecord[], userId = currentUserId) => {
    setSavedLoans(nextLoans);
    if (!userId) return;
    if (cloudStorageEnabled) {
      void saveCloudLoans(userId, nextLoans).catch((error) => {
        setSaveStatus(error instanceof Error ? error.message : "Could not sync cloud loans.");
      });
      return;
    }
    localStorage.setItem(getSavedLoansStorageKey(userId), JSON.stringify(nextLoans));
  };

  const persistUserProfiles = (nextProfiles: UserProfile[]) => {
    setUserProfiles(nextProfiles);
    if (cloudStorageEnabled) {
      const currentProfile = currentUserId
        ? nextProfiles.find((profile) => profile.id === currentUserId)
        : nextProfiles[0];
      if (currentProfile) {
        void saveCloudProfile(currentProfile).catch((error) => {
          setProfileStatus(error instanceof Error ? error.message : "Could not sync cloud profile.");
        });
      }
      return;
    }
    localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(nextProfiles));
  };

  const updateCurrentUserProfile = (updater: (profile: UserProfile) => UserProfile) => {
    if (!currentUserId) return;
    const nextProfiles = userProfiles.map((profile) => (
      profile.id === currentUserId ? updater(profile) : profile
    ));
    persistUserProfiles(nextProfiles);
  };

  const loginUser = (userId: string, userName: string) => {
    setCurrentUserId(userId);
    if (!cloudStorageEnabled) {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
    }
    setActivePage("simulator");
    setActiveView("assumed");
    setSaveStatus(`Logged in as ${userName}`);
    setAuthError("");
    setAuthName("");
    setAuthDisplayName("");
    setAuthPassword("");
    setProfileStatus("");
    setPasswordResetCodeInput("");
    setPasswordResetNewPassword("");
    setPasswordResetConfirmPassword("");
    void loadLoansForUser(userId);
  };

  const handleAuthSubmit = async () => {
    const trimmedName = authName.trim();
    const trimmedDisplayName = authDisplayName.trim();
    if (!trimmedName || !authPassword) {
      setAuthError(`Enter both an ${cloudStorageEnabled ? "email" : "username"} and password.`);
      return;
    }

    if (cloudStorageEnabled) {
      try {
        if (authMode === "create" && !trimmedDisplayName) {
          setAuthError("Enter your name.");
          return;
        }
        const profile = authMode === "create"
          ? await createCloudProfile(trimmedName, authPassword, trimmedDisplayName)
          : await loginCloudProfile(trimmedName, authPassword);
        if (profile.needsEmailConfirmation) {
          setAuthError("Check your email to confirm the account, then log in.");
          setAuthPassword("");
          setAuthMode("login");
          return;
        }
        const normalized = normalizeProfile(profile as UserProfile);
        setUserProfiles([normalized]);
        applyLoanSnapshot(createBlankLoanSnapshot());
        setSavedLoans([]);
        setCurrentLoanId(null);
        loginUser(normalized.id, normalized.name);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Authentication failed.");
      }
      return;
    }

    if (authMode === "create") {
      const existingUser = userProfiles.find((profile) => profile.name.toLowerCase() === trimmedName.toLowerCase());
      if (existingUser) {
        setAuthError("That username already exists.");
        return;
      }
      const nextProfile: UserProfile = {
        displayName: trimmedDisplayName || trimmedName,
        email: "",
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmedName,
        password: authPassword,
        themeId: "sky",
      };
      const nextProfiles = [...userProfiles, nextProfile];
      persistUserProfiles(nextProfiles);
      setUserProfiles(nextProfiles);
      applyLoanSnapshot(createBlankLoanSnapshot());
      setSavedLoans([]);
      setCurrentLoanId(null);
      loginUser(nextProfile.id, nextProfile.name);
      return;
    }

    const matchingUser = userProfiles.find((profile) => profile.name.toLowerCase() === trimmedName.toLowerCase());
    if (!matchingUser || matchingUser.password !== authPassword) {
      setAuthError("Invalid username or password.");
      return;
    }
    loginUser(matchingUser.id, matchingUser.name);
  };

  const logoutUser = () => {
    if (cloudStorageEnabled) {
      void logoutCloudProfile().catch(() => undefined);
    } else {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
    setCurrentUserId(null);
    setSavedLoans([]);
    setCurrentLoanId(null);
    setActivePage("simulator");
    setSaveStatus("");
    setAuthPassword("");
    setAuthError("");
    applyLoanSnapshot(createBlankLoanSnapshot());
  };

  const deleteCurrentUserProfile = async () => {
    if (!currentUserId) return;
    const selectedProfile = userProfiles.find((profile) => profile.id === currentUserId);
    if (!selectedProfile) return;
    if (cloudStorageEnabled) {
      try {
        await deleteCloudProfileData();
        await logoutCloudProfile().catch(() => undefined);
      } catch (error) {
        setSaveStatus(error instanceof Error ? error.message : "Could not delete cloud profile data.");
        setDeleteAccountConfirmOpen(false);
        return;
      }
    } else {
      localStorage.removeItem(getSavedLoansStorageKey(currentUserId));
    }
    const nextProfiles = userProfiles.filter((profile) => profile.id !== currentUserId);
    persistUserProfiles(nextProfiles);

    if (!cloudStorageEnabled) {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
    setCurrentUserId(null);
    setSavedLoans([]);
    setCurrentLoanId(null);
    setSaveStatus(`Deleted ${selectedProfile.name}`);
    setAuthMode("login");
    setAuthName("");
    setAuthPassword("");
    setAuthError("");
    setDeleteAccountConfirmOpen(false);
    applyLoanSnapshot(createBlankLoanSnapshot());
  };

  useEffect(() => {
    if (!currentUser) {
      setProfileDraftName("");
      setProfileDraftEmail("");
      setProfileStatus("");
      setPasswordResetCodeInput("");
      setPasswordResetNewPassword("");
      setPasswordResetConfirmPassword("");
      return;
    }
    setProfileDraftName(currentUser.displayName || currentUser.name);
    setProfileDraftEmail(currentUser.email);
  }, [currentUser?.id, currentUser?.displayName, currentUser?.email, currentUser?.name]);

  const saveProfileDetails = () => {
    if (!currentUser) return;
    const trimmedDisplayName = profileDraftName.trim();
    const trimmedEmail = profileDraftEmail.trim();
    if (!trimmedDisplayName) {
      setProfileStatus("Enter a display name.");
      return;
    }
    updateCurrentUserProfile((profile) => ({
      ...profile,
      displayName: trimmedDisplayName,
      email: trimmedEmail,
    }));
    setProfileStatus("Profile updated.");
  };

  const applyThemeToProfile = (themeId: ThemeId) => {
    updateCurrentUserProfile((profile) => ({
      ...profile,
      themeId,
    }));
  };

  const sendPasswordResetEmail = () => {
    if (!currentUser) return;
    const email = profileDraftEmail.trim() || currentUser.email.trim();
    if (!email) {
      setProfileStatus("Add an email address before requesting a password reset.");
      return;
    }
    if (cloudStorageEnabled) {
      void sendCloudPasswordResetEmail(email)
        .then(() => {
          setProfileDraftEmail(email);
          setProfileStatus(`Password reset email sent to ${email}. Follow the Supabase email link to finish.`);
        })
        .catch((error) => {
          setProfileStatus(error instanceof Error ? error.message : "Could not send password reset email.");
        });
      return;
    }
    const resetCode = `${Math.floor(100000 + Math.random() * 900000)}`;
    updateCurrentUserProfile((profile) => ({
      ...profile,
      email,
      passwordResetCode: resetCode,
      passwordResetIssuedAt: new Date().toISOString(),
    }));
    setProfileDraftEmail(email);
    setPasswordResetCodeInput("");
    setPasswordResetNewPassword("");
    setPasswordResetConfirmPassword("");
    setProfileStatus(`Password reset email sent to ${email}. Local demo code: ${resetCode}`);
  };

  const applyPasswordReset = () => {
    if (!currentUser) return;
    if (cloudStorageEnabled) {
      setProfileStatus("Use the Supabase password reset email link to change your password.");
      return;
    }
    if (!currentUser.passwordResetCode) {
      setProfileStatus("Request a password reset email first.");
      return;
    }
    if (passwordResetCodeInput.trim() !== currentUser.passwordResetCode) {
      setProfileStatus("The one-time reset code is invalid.");
      return;
    }
    if (!passwordResetNewPassword || passwordResetNewPassword !== passwordResetConfirmPassword) {
      setProfileStatus("New passwords must match.");
      return;
    }
    updateCurrentUserProfile((profile) => ({
      ...profile,
      password: passwordResetNewPassword,
      passwordResetCode: undefined,
      passwordResetIssuedAt: undefined,
    }));
    setPasswordResetCodeInput("");
    setPasswordResetNewPassword("");
    setPasswordResetConfirmPassword("");
    setProfileStatus("Password updated.");
  };

  const saveCurrentLoan = () => {
    if (!currentUserId) {
      window.alert("Create or select a profile before saving a loan.");
      return;
    }
    const snapshot = buildLoanSnapshot();
    const trimmedName = loanName.trim() || "Untitled loan";
    const loanId = currentLoanId ?? `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextRecord: SavedLoanRecord = {
      data: {
        ...snapshot,
        loanName: trimmedName,
      },
      id: loanId,
      name: trimmedName,
    };

    const nextLoans = currentLoanId
      ? savedLoans.map((loan) => (loan.id === currentLoanId ? nextRecord : loan))
      : [...savedLoans, nextRecord];

    setLoanName(trimmedName);
    setCurrentLoanId(loanId);
    persistSavedLoans(nextLoans);
    setSaveStatus(`Saved ${trimmedName}`);
  };

  const startNewLoan = () => {
    setCurrentLoanId(null);
    setSaveStatus("");
    applyLoanSnapshot(createBlankLoanSnapshot());
    setActiveLoanTab("details");
    setActiveView("assumed");
  };

  const loadSavedLoan = (loanId: string) => {
    const selectedLoan = savedLoans.find((loan) => loan.id === loanId);
    if (!selectedLoan) return;
    setCurrentLoanId(selectedLoan.id);
    setSaveStatus("");
    applyLoanSnapshot(selectedLoan.data);
    setActiveLoanTab("details");
    setActiveView("assumed");
  };

  const deleteCurrentLoan = () => {
    if (!currentLoanId) return;
    const selectedLoan = savedLoans.find((loan) => loan.id === currentLoanId);
    if (!selectedLoan) return;
    const confirmed = window.confirm(`Delete saved loan "${selectedLoan.name}"?`);
    if (!confirmed) return;

    const nextLoans = savedLoans.filter((loan) => loan.id !== currentLoanId);
    persistSavedLoans(nextLoans);
    setSaveStatus(`Deleted ${selectedLoan.name}`);

    if (nextLoans.length > 0) {
      setCurrentLoanId(nextLoans[0].id);
      applyLoanSnapshot(nextLoans[0].data);
      return;
    }

    setCurrentLoanId(null);
    applyLoanSnapshot(createBlankLoanSnapshot());
  };

  const loginScreen = (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eef4ff 0%, #f8fafc 240px, #f8fafc 100%)",
        padding: "24px 16px 48px",
        color: "var(--app-text, #0f172a)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#ffffff",
          border: "1px solid #dbe2ea",
          borderRadius: 20,
          padding: 24,
          display: "grid",
          gap: 18,
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>Loan Interest Simulator</h1>
          <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
            {cloudStorageEnabled
              ? "Sign in with Supabase to sync saved loans across browsers and devices."
              : "Sign in to your local account to access your saved loans, or create a new user to start tracking a different set of loans."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => { setAuthMode("login"); setAuthError(""); setAuthDisplayName(""); }}
            style={{
              border: authMode === "login" ? "1px solid var(--app-accent, #2563eb)" : "1px solid #cbd5e1",
              background: authMode === "login" ? "var(--app-accent-soft, #dbeafe)" : "#ffffff",
              color: "#0f172a",
              borderRadius: 999,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("create"); setAuthError(""); }}
            style={{
              border: authMode === "create" ? "1px solid var(--app-accent, #2563eb)" : "1px solid #cbd5e1",
              background: authMode === "create" ? "var(--app-accent-soft, #dbeafe)" : "#ffffff",
              color: "#0f172a",
              borderRadius: 999,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create account
          </button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {authMode === "create" ? <Field id="auth-display-name" label="Your name" value={authDisplayName} onChange={setAuthDisplayName} /> : null}
          <Field id="auth-name" label={cloudStorageEnabled ? "Email" : "Username"} value={authName} onChange={setAuthName} />
          <Field id="auth-password" label="Password" type="password" value={authPassword} onChange={setAuthPassword} />
          {authError ? (
            <div style={{ border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
              {authError}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleAuthSubmit}
            style={{
              border: "1px solid var(--app-accent, #2563eb)",
              background: "var(--app-accent, #2563eb)",
              color: "#ffffff",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {authMode === "login" ? "Login" : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );

  const helperVisiblePayments = useMemo(() => {
    return [...oneOffPayments]
      .map((payment) => {
        const override = payment.id ? paymentDateOverrides[payment.id] : undefined;
        const overriddenDate = override ? parseDate(override) : null;
        return {
          ...payment,
          date: overriddenDate ?? payment.date,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [oneOffPayments, paymentDateOverrides]);

  const helperPaymentsThroughTarget = useMemo(() => {
    const target = parseDate(targetDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    return helperVisiblePayments
      .filter((payment) => payment.date.getTime() <= target)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [helperVisiblePayments, targetDate]);

  const helperPausePeriodsThroughTarget = useMemo(() => {
    const target = parseDate(targetDate);
    if (!target) {
      return helperPausePeriods;
    }
    const targetMonthValue = target.getFullYear() * 12 + target.getMonth();
    return helperPausePeriods
      .filter((pausePeriod) => {
        const startMonthValue =
          pausePeriod.startMonth.getFullYear() * 12 + pausePeriod.startMonth.getMonth();
        return startMonthValue <= targetMonthValue;
      })
      .map((pausePeriod) => {
        const endMonthValue =
          pausePeriod.endMonth.getFullYear() * 12 + pausePeriod.endMonth.getMonth();
        if (endMonthValue <= targetMonthValue) {
          return pausePeriod;
        }
        return {
          ...pausePeriod,
          endMonth: new Date(target.getFullYear(), target.getMonth(), 1),
        };
      });
  }, [helperPausePeriods, targetDate]);

  const helperScheduledAdjustments = useMemo(() => {
    const baseMinimum = parseCurrency(minimumPayment);
    const baseExtra = parseCurrency(additionalMonthlyPayment);
    return helperRecurringChanges
      .map((change) => {
        const targetTotal =
          change.kind === "minimum" ? change.amount + baseExtra : baseMinimum + change.amount;
        const baseTotal = baseMinimum + baseExtra;
        const startDate = clampToMonth(
          change.effectiveDate.getFullYear(),
          change.effectiveDate.getMonth(),
          Number(dueDay) || 1,
        );
        const endDate = change.endDate
          ? clampToMonth(change.endDate.getFullYear(), change.endDate.getMonth(), Number(dueDay) || 1)
          : undefined;
        return {
          amount: targetTotal - baseTotal,
          endDate,
          startDate,
        };
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [additionalMonthlyPayment, dueDay, helperRecurringChanges, minimumPayment]);

  const helperDueDayAdjustments = useMemo(
    () =>
      [...helperDueDayChanges]
        .sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime())
        .map((change) => ({
          day: change.day,
          endMonth: change.endMonth,
          startMonth: change.startMonth,
        })),
    [helperDueDayChanges],
  );

  const assumedResult = useMemo(
    () =>
      buildSchedule({
        actualPayments: [],
        startingPrincipal: parseCurrency(deferredStartingPrincipal),
        startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
        aprPercent: Number(deferredAprPercent) || 0,
        dayCountBasis,
        minimumPayment: parseCurrency(totalMonthlyPayment),
        firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
        dueDay: Number(deferredDueDay) || 0,
        moveWeekend,
        targetDate: parseDate(deferredTargetDate) ?? new Date(),
        roundDailyInterest,
        scheduledMode: "always",
      }),
    [
      deferredStartingPrincipal,
      deferredStartingPrincipalDate,
      deferredAprPercent,
      dayCountBasis,
      totalMonthlyPayment,
      deferredFirstPaymentDate,
      deferredDueDay,
      moveWeekend,
      deferredTargetDate,
      roundDailyInterest,
    ],
  );

  const minimumOnlyToDateProjection = useMemo(
    () =>
      buildSchedule({
        actualPayments: [],
        appendAsOfRow: true,
        startingPrincipal: parseCurrency(deferredStartingPrincipal),
        startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
        aprPercent: Number(deferredAprPercent) || 0,
        dayCountBasis,
        minimumPayment: parseCurrency(deferredMinimumPayment),
        firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
        dueDay: Number(deferredDueDay) || 0,
        moveWeekend,
        targetDate: parseDate(deferredTargetDate) ?? new Date(),
        roundDailyInterest,
        scheduledMode: "always",
      }),
    [
      deferredAprPercent,
      dayCountBasis,
      deferredDueDay,
      deferredFirstPaymentDate,
      deferredMinimumPayment,
      moveWeekend,
      roundDailyInterest,
      deferredStartingPrincipal,
      deferredStartingPrincipalDate,
      deferredTargetDate,
    ],
  );

  const amortizationTargetDate = useMemo(() => {
    const start = parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredTargetDate]);

  const fullLoanTargetDate = useMemo(() => {
    const start = parseDate(deferredStartingPrincipalDate) ?? parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredStartingPrincipalDate, deferredTargetDate]);

  const assumedCurrentPlanProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0,
      };
    }

    return buildSchedule({
      actualPayments: [],
      startingPrincipal: assumedResult.currentPrincipal,
      startingInterest: assumedResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        firstPaymentDate: firstPayment,
        moveWeekend,
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      targetDate: amortizationTargetDate,
      roundDailyInterest,
      scheduledMode: "always",
    });
  }, [
    amortizationTargetDate,
    deferredAprPercent,
    assumedResult.currentInterest,
    assumedResult.currentPrincipal,
    dayCountBasis,
    deferredDueDay,
    deferredFirstPaymentDate,
    moveWeekend,
    roundDailyInterest,
    deferredTargetDate,
    totalMonthlyPayment,
  ]);

  const amortizationProjection = assumedCurrentPlanProjection;

  const minimumOnlyFullProjection = useMemo(
    () =>
      buildSchedule({
        actualPayments: [],
        startingPrincipal: parseCurrency(deferredStartingPrincipal),
        startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
        aprPercent: Number(deferredAprPercent) || 0,
        dayCountBasis,
        minimumPayment: parseCurrency(deferredMinimumPayment),
        firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
        dueDay: Number(deferredDueDay) || 0,
        moveWeekend,
        targetDate: fullLoanTargetDate,
        roundDailyInterest,
        scheduledMode: "always",
      }),
    [
      deferredAprPercent,
      dayCountBasis,
      deferredDueDay,
      deferredFirstPaymentDate,
      fullLoanTargetDate,
      deferredMinimumPayment,
      moveWeekend,
      roundDailyInterest,
      deferredStartingPrincipal,
      deferredStartingPrincipalDate,
    ],
  );

  const assumedFullProjection = useMemo(
    () =>
      buildSchedule({
        actualPayments: [],
        startingPrincipal: parseCurrency(deferredStartingPrincipal),
        startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
        aprPercent: Number(deferredAprPercent) || 0,
        dayCountBasis,
        minimumPayment: parseCurrency(totalMonthlyPayment),
        firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
        dueDay: Number(deferredDueDay) || 0,
        moveWeekend,
        targetDate: fullLoanTargetDate,
        roundDailyInterest,
        scheduledMode: "always",
      }),
    [
      deferredAprPercent,
      dayCountBasis,
      deferredDueDay,
      deferredFirstPaymentDate,
      fullLoanTargetDate,
      moveWeekend,
      roundDailyInterest,
      deferredStartingPrincipal,
      deferredStartingPrincipalDate,
      totalMonthlyPayment,
    ],
  );

  const historyResult = useMemo(
    () =>
      buildSchedule({
        actualPayments: helperPaymentsThroughTarget,
        appendAsOfRow: true,
        startingPrincipal: parseCurrency(deferredStartingPrincipal),
        startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
        aprPercent: Number(deferredAprPercent) || 0,
        dayCountBasis,
        deletedRowIds: new Set(deletedHelperRowIds),
        minimumPayment: parseCurrency(totalMonthlyPayment),
        firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
        dueDay: Number(deferredDueDay) || 0,
        moveWeekend,
        pausePeriods: helperPausePeriodsThroughTarget,
        paymentAmountOverrides: helperPaymentAmountOverrides,
        paymentDateOverrides,
        paymentLabelOverrides,
        scheduledDueDayChanges: helperDueDayAdjustments,
        scheduledPaymentAdjustments: helperScheduledAdjustments,
        targetDate: parseDate(deferredTargetDate) ?? new Date(),
        roundDailyInterest,
        scheduledMode: "always",
      }),
    [
      deferredAprPercent,
      dayCountBasis,
      deletedHelperRowIds,
      deferredDueDay,
      deferredFirstPaymentDate,
      helperPaymentAmountOverrides,
      helperPaymentsThroughTarget,
      helperDueDayAdjustments,
      moveWeekend,
      paymentDateOverrides,
      paymentLabelOverrides,
      helperPausePeriodsThroughTarget,
      helperScheduledAdjustments,
      roundDailyInterest,
      deferredStartingPrincipal,
      deferredStartingPrincipalDate,
      deferredTargetDate,
      totalMonthlyPayment,
    ],
  );

  const helperAmortizationTargetDate = useMemo(() => {
    const start = parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredTargetDate]);

  const helperProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0,
      };
    }

    return buildSchedule({
      actualPayments: helperVisiblePayments.filter((payment) => payment.date > target),
      appendAsOfRow: false,
      startingPrincipal: historyResult.currentPrincipal,
      startingInterest: historyResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        dueDayChanges: helperDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend,
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      paymentLabelOverrides,
      scheduledDueDayChanges: helperDueDayAdjustments,
      scheduledPaymentAdjustments: helperScheduledAdjustments,
      targetDate: helperAmortizationTargetDate,
      roundDailyInterest,
      scheduledMode: "always",
    });
  }, [
    deferredAprPercent,
    deferredDueDay,
    deferredFirstPaymentDate,
    helperAmortizationTargetDate,
    helperVisiblePayments,
    historyResult.currentInterest,
    historyResult.currentPrincipal,
    minimumPayment,
    moveWeekend,
    paymentLabelOverrides,
    helperDueDayAdjustments,
    helperScheduledAdjustments,
    helperVisiblePayments,
    roundDailyInterest,
    deferredTargetDate,
    totalMonthlyPayment,
    dayCountBasis,
  ]);

  const helperCurrentPlanProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0,
      };
    }

    return buildSchedule({
      actualPayments: helperVisiblePayments.filter((payment) => payment.date > target),
      appendAsOfRow: false,
      startingPrincipal: historyResult.currentPrincipal,
      startingInterest: historyResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        dueDayChanges: helperDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend,
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      paymentLabelOverrides,
      scheduledDueDayChanges: helperDueDayAdjustments,
      scheduledPaymentAdjustments: helperScheduledAdjustments,
      targetDate: helperAmortizationTargetDate,
      roundDailyInterest,
      scheduledMode: "always",
    });
  }, [
    deferredAprPercent,
    dayCountBasis,
    deferredDueDay,
    deferredFirstPaymentDate,
    helperAmortizationTargetDate,
    helperVisiblePayments,
    historyResult.currentInterest,
    historyResult.currentPrincipal,
    moveWeekend,
    paymentLabelOverrides,
    helperDueDayAdjustments,
    helperScheduledAdjustments,
    roundDailyInterest,
    deferredTargetDate,
    totalMonthlyPayment,
  ]);

  const whatIfTargetDate = useMemo(() => {
    const start = parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredTargetDate]);

  const nextPaymentDate = useMemo(() => {
    const firstPayment = parseDate(deferredFirstPaymentDate);
    const anchorDate = parseDate(deferredTargetDate);
    const numericDueDay = Number(deferredDueDay) || 0;
    if (!firstPayment || !anchorDate || numericDueDay < 1 || numericDueDay > 31) {
      return "-";
    }
    return toDateInputValue(
      getNextScheduledPaymentDate({
        afterDate: anchorDate,
        dueDay: numericDueDay,
        dueDayChanges:
          activeView === "whatif"
            ? whatIfDueDayChanges.map((change) => ({ day: change.day, endMonth: change.endMonth, startMonth: change.startMonth }))
            : helperDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend,
      }),
    );
  }, [activeView, deferredDueDay, deferredFirstPaymentDate, helperDueDayAdjustments, moveWeekend, deferredTargetDate, whatIfDueDayChanges]);

  const whatIfAllPayments = useMemo(
    () => [...whatIfPayments].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [whatIfPayments],
  );

  const whatIfRecurringAdjustments = useMemo(() => {
    const baseMinimum = parseCurrency(deferredMinimumPayment);
    const baseExtra = parseCurrency(deferredAdditionalMonthlyPayment);
    let currentMinimum = baseMinimum;
    let currentExtra = baseExtra;
    let previousTotal = baseMinimum + baseExtra;

    return [...whatIfRecurringChanges]
      .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime())
      .map((change) => {
        if (change.kind === "minimum") {
          currentMinimum = change.amount;
        } else {
          currentExtra = change.amount;
        }
        const nextTotal = currentMinimum + currentExtra;
        const delta = nextTotal - previousTotal;
        previousTotal = nextTotal;
        return {
          amount: delta,
          startDate: change.effectiveDate,
        };
      });
  }, [deferredAdditionalMonthlyPayment, deferredMinimumPayment, whatIfRecurringChanges]);

  const whatIfDueDayAdjustments = useMemo(
    () =>
      [...whatIfDueDayChanges]
        .sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime())
        .map((change) => ({
          day: change.day,
          endMonth: change.endMonth,
          startMonth: change.startMonth,
        })),
    [whatIfDueDayChanges],
  );

  const whatIfProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0,
      };
    }

    return buildSchedule({
      actualPayments: whatIfAllPayments
        .filter((payment) => payment.date > target)
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
      appendAsOfRow: false,
      startingPrincipal: historyResult.currentPrincipal,
      startingInterest: historyResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        dueDayChanges: whatIfDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend,
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      pausePeriods: whatIfPausePeriods,
      scheduledDueDayChanges: whatIfDueDayAdjustments,
      scheduledPaymentAdjustments: whatIfRecurringAdjustments,
      targetDate: whatIfTargetDate,
      roundDailyInterest,
      scheduledMode: "always",
    });
  }, [
    deferredAprPercent,
    dayCountBasis,
    deferredDueDay,
    deferredFirstPaymentDate,
    historyResult.currentInterest,
    historyResult.currentPrincipal,
    minimumPayment,
    moveWeekend,
    whatIfPausePeriods,
    whatIfDueDayAdjustments,
    roundDailyInterest,
    deferredTargetDate,
    totalMonthlyPayment,
    whatIfAllPayments,
    whatIfRecurringAdjustments,
    whatIfTargetDate,
  ]);

  const historyErrors = [
    ...historyResult.errors,
  ];

  const assumedInterestSaved =
    minimumOnlyFullProjection.totalInterestPaid - assumedFullProjection.totalInterestPaid;
  const minimumOnlyLifetimeInterest = minimumOnlyFullProjection.totalInterestPaid;

  const assumedInterestSavedAsOfToday =
    minimumOnlyToDateProjection.totalInterestPaid - assumedResult.totalInterestPaid;

  const assumedInterestSavedFromTodayForward =
    assumedInterestSaved - assumedInterestSavedAsOfToday;

  const helperInterestSavedAsOfToday =
    minimumOnlyToDateProjection.totalInterestPaid - historyResult.totalInterestPaid;

  const helperInterestSavedOverall =
    minimumOnlyFullProjection.totalInterestPaid -
    (historyResult.totalInterestPaid + helperCurrentPlanProjection.totalInterestPaid);

  const helperInterestSavedFromTodayForward =
    helperInterestSavedOverall - helperInterestSavedAsOfToday;

  const assumedInterestStillOwedWithAdditional = Math.max(
    0,
    assumedFullProjection.totalInterestPaid - assumedResult.totalInterestPaid,
  );

  const helperTotalExpectedInterestPaidIncludingAdditional =
    historyResult.totalInterestPaid + helperCurrentPlanProjection.totalInterestPaid;

  const whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly =
    historyResult.totalInterestPaid + helperCurrentPlanProjection.totalInterestPaid;

  const whatIfTotalExpectedInterestPaidIncludingAnticipated =
    historyResult.totalInterestPaid + whatIfProjection.totalInterestPaid;

  const whatIfHasProjectedExtras =
    whatIfPayments.length > 0 || whatIfRecurringChanges.length > 0 || whatIfPausePeriods.length > 0 || whatIfDueDayChanges.length > 0;

  const assumedScenarioLifetimeInterest = assumedResult.totalInterestPaid + assumedCurrentPlanProjection.totalInterestPaid;
  const assumedScenarioLifetimeSaved = minimumOnlyLifetimeInterest - assumedScenarioLifetimeInterest;
  const assumedScenarioRemainingInterest = assumedInterestStillOwedWithAdditional;
  const assumedScenarioRemainingSaved = assumedInterestSavedFromTodayForward;

  const helperScenarioLifetimeInterest = helperTotalExpectedInterestPaidIncludingAdditional;
  const helperScenarioLifetimeSaved = minimumOnlyLifetimeInterest - helperScenarioLifetimeInterest;
  const helperScenarioRemainingInterest = helperCurrentPlanProjection.totalInterestPaid;
  const helperScenarioRemainingSaved = helperInterestSavedFromTodayForward;

  const minimumOnlyRemainingInterest = Math.max(
    0,
    minimumOnlyFullProjection.totalInterestPaid - minimumOnlyToDateProjection.totalInterestPaid,
  );
  const whatIfBaseRemainingInterest = helperCurrentPlanProjection.totalInterestPaid;
  const whatIfBaseLifetimeInterest = whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly;
  const whatIfProjectedExtrasSavedRemaining = minimumOnlyRemainingInterest - whatIfProjection.totalInterestPaid;
  const whatIfScenarioRemainingInterest = whatIfHasProjectedExtras
    ? whatIfProjection.totalInterestPaid
    : whatIfBaseRemainingInterest;
  const whatIfScenarioLifetimeInterest = whatIfHasProjectedExtras
    ? whatIfTotalExpectedInterestPaidIncludingAnticipated
    : whatIfBaseLifetimeInterest;
  const whatIfScenarioSaved = minimumOnlyLifetimeInterest - whatIfScenarioLifetimeInterest;
  const startingPrincipalAmount = parseCurrency(deferredStartingPrincipal);
  const assumedPayoffPercent =
    startingPrincipalAmount > 0 ? Math.min(100, (assumedResult.totalPrincipalPaid / startingPrincipalAmount) * 100) : 0;
  const historyPayoffPercent =
    startingPrincipalAmount > 0 ? Math.min(100, (historyResult.totalPrincipalPaid / startingPrincipalAmount) * 100) : 0;
  const activePayoffPercent =
    activeView === "assumed" ? assumedPayoffPercent : historyPayoffPercent;
  const activeProjectedPayoffDate =
    activeView === "assumed"
      ? assumedCurrentPlanProjection.payoffDate
      : activeView === "history"
        ? helperCurrentPlanProjection.payoffDate
        : whatIfProjection.payoffDate;
  const canShowAssumedSchedule =
    Boolean(parseDate(deferredStartingPrincipalDate)) && Boolean(parseDate(deferredFirstPaymentDate));
  const baselinePayoffDate = minimumOnlyFullProjection.payoffDate;
  const activeAsOfDate = parseDate(deferredTargetDate);
  const projectedScenarioPrincipalForDailyCost =
    activeView === "whatif"
      ? (whatIfProjection.rows.find((row) => row.principalPaid > 0)?.endingPrincipal ?? historyResult.currentPrincipal)
      : activeView === "assumed"
        ? assumedResult.currentPrincipal
        : historyResult.currentPrincipal;
  const activeInterestStartDate = activeAsOfDate ?? new Date();
  const activeInterestEndDate = new Date(activeInterestStartDate);
  activeInterestEndDate.setDate(activeInterestEndDate.getDate() + 1);
  const activeDailyInterestCost = accrueInterest({
    aprPercent: Number(deferredAprPercent) || 0,
    dayCountBasis,
    endDate: activeInterestEndDate,
    principal: projectedScenarioPrincipalForDailyCost,
    roundDailyInterest,
    startDate: activeInterestStartDate,
  });
  const activePayoffDuration = formatDurationToPayoff(activeProjectedPayoffDate, activeAsOfDate);
  const baselinePayoffDeltaMonths =
    activeProjectedPayoffDate && baselinePayoffDate
      ? (baselinePayoffDate.getFullYear() - activeProjectedPayoffDate.getFullYear()) * 12 +
        (baselinePayoffDate.getMonth() - activeProjectedPayoffDate.getMonth())
      : 0;
  const activeTimeSavedLabel =
    baselinePayoffDate && activeProjectedPayoffDate
      ? formatTimeShaved(baselinePayoffDeltaMonths)
      : "-";
  const assumedReferenceRow = [...assumedResult.rows].reverse().find((row) => row.paymentAmount > 0) ?? null;
  const historyReferenceRow = [...historyResult.rows].reverse().find((row) => row.paymentAmount > 0) ?? null;
  const whatIfReferenceRow = whatIfProjection.rows.find((row) => row.paymentAmount > 0) ?? null;
  const activeReferenceRow =
    activeView === "assumed" ? assumedReferenceRow : activeView === "history" ? historyReferenceRow : whatIfReferenceRow;
  const activePrincipalShare = activeReferenceRow?.principalShareOfPayment ?? null;
  const activeInterestShare = activeReferenceRow?.paymentAmount
    ? activeReferenceRow.interestPaid / activeReferenceRow.paymentAmount
    : null;
  const softDangerMessage =
    activeReferenceRow?.negativeAmortization
      ? null
      : activeInterestShare !== null && activeInterestShare >= 0.7
        ? "Most of your payment is going to interest."
        : activePrincipalShare !== null && activePrincipalShare < 0.3
          ? "Only a small share of this payment is reaching principal."
          : null;
  const whatIfDeltaInterest = whatIfBaseLifetimeInterest - whatIfScenarioLifetimeInterest;
  const whatIfBaselinePayoffDate = helperCurrentPlanProjection.payoffDate;
  const whatIfDeltaMonths =
    whatIfProjection.payoffDate && whatIfBaselinePayoffDate
      ? (whatIfBaselinePayoffDate.getFullYear() - whatIfProjection.payoffDate.getFullYear()) * 12 +
        (whatIfBaselinePayoffDate.getMonth() - whatIfProjection.payoffDate.getMonth())
      : 0;
  const whatIfTimeChangeLabel =
    whatIfProjection.payoffDate && whatIfBaselinePayoffDate
      ? formatTimeShaved(whatIfDeltaMonths)
      : "-";
  const assumedLifetimeSavedTone =
    assumedScenarioLifetimeSaved > 0 ? "positive" : assumedScenarioLifetimeSaved < 0 ? "negative" : "default";
  const helperLifetimeSavedTone =
    helperScenarioLifetimeSaved > 0 ? "positive" : helperScenarioLifetimeSaved < 0 ? "negative" : "default";
  const whatIfLifetimeSavedTone =
    whatIfScenarioSaved > 0 ? "positive" : whatIfScenarioSaved < 0 ? "negative" : "default";
  const assumedRemainingInterestNotes = [2];
  const assumedRemainingSavedNotes = [1, 2];
  const assumedLifetimeSavedNotes = [1, 2];
  const helperRemainingInterestNotes = [2];
  const helperRemainingSavedNotes = [1, 2];
  const helperLifetimeSavedNotes = [1, 2];
  const whatIfRemainingInterestNotes: number[] = [];
  const whatIfAdditionalSavedNotes = [1];
  const whatIfLifetimeSavedNotes = [1, 2];
  const footnote2Text = "2. Assumes you keep paying your minimum payment plus monthly extra payment.";
  const assumedHasNegativeAmortization =
    assumedResult.hasNegativeAmortization || assumedCurrentPlanProjection.hasNegativeAmortization;
  const historyHasNegativeAmortization =
    historyResult.hasNegativeAmortization || helperProjection.hasNegativeAmortization;
  const whatIfHasNegativeAmortization = whatIfProjection.hasNegativeAmortization;
  const negativeAmortizationWarning =
    activeView === "assumed"
      ? assumedHasNegativeAmortization
      : activeView === "history"
        ? historyHasNegativeAmortization
        : whatIfHasNegativeAmortization;
  const startingPrincipalDateValue = parseDate(startingPrincipalDate);
  const minimumTargetDate = startingPrincipalDateValue && compareDateOnly(startingPrincipalDateValue, todayDate) > 0
    ? startingPrincipalDateValue
    : todayDate;
  const targetDateMinValue = toDateInputValue(minimumTargetDate);
  const helperMaxMonthValue = todayValue.slice(0, 7);
  const whatIfMinimumPaymentDate = parseDate(targetDate);
  const whatIfMinDate = whatIfMinimumPaymentDate && compareDateOnly(whatIfMinimumPaymentDate, todayDate) > 0
    ? whatIfMinimumPaymentDate
    : todayDate;
  const whatIfMinDateValue = toDateInputValue(whatIfMinDate);

  const addHelperPausePeriod = () => {
    const startMonth = parseMonthInput(helperPauseFromMonth);
    const endMonth = parseMonthInput(helperPauseToMonth);
    if (!startMonth || !endMonth || endMonth < startMonth) {
      setHelperActionError("Choose a valid pause range.");
      return;
    }

    const nextPausePeriod: PausePeriod = {
      endMonth,
      id: `helper-pause-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mode: helperPauseMode,
      startMonth,
    };
    const hasOverlap = helperPausePeriods.some((pausePeriod) => pausePeriodsOverlap(pausePeriod, nextPausePeriod));
    if (hasOverlap) {
      setHelperActionError("A payment is already paused in that date range.");
      return;
    }

    setHelperPausePeriods((current) =>
      [
        ...current,
        nextPausePeriod,
      ].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()),
    );
    setHelperActionError("");
    setHelperPauseFromMonth("");
    setHelperPauseToMonth("");
    setHelperPauseMode("accrues");
  };

  const deleteHelperPausePeriod = (pauseId: string) => {
    setHelperPausePeriods((current) => current.filter((pausePeriod) => pausePeriod.id !== pauseId));
  };

  const addHelperBulkAdjustment = () => {
    if (helperBulkMode === "pause") {
      addHelperPausePeriod();
      return;
    }

    if (helperBulkMode === "due-day") {
      const startMonth = parseMonthInput(helperAdjustmentFromMonth);
      const endMonth = parseMonthInput(helperAdjustmentToMonth);
      const day = Number(helperAdjustmentDueDay);
      if (!startMonth || (helperAdjustmentToMonth && !endMonth) || (endMonth && endMonth < startMonth) || day < 1 || day > 31) {
        setHelperActionError("Choose a valid due day and month range.");
        return;
      }
      const nextChange: DueDayChange = {
        day,
        endMonth: endMonth ?? undefined,
        id: `helper-due-day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startMonth,
      };
      setHelperDueDayChanges((current) => [...current, nextChange].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()));
      setHelperActionError("");
      setHelperAdjustmentFromMonth("");
      setHelperAdjustmentToMonth("");
      setHelperAdjustmentDueDay("");
      return;
    }

    const startMonth = parseMonthInput(helperAdjustmentFromMonth);
    const endMonth = parseMonthInput(helperAdjustmentToMonth);
    const amount = parseCurrency(helperAdjustmentAmount);
    if (!startMonth || !endMonth || endMonth < startMonth || amount < 0) {
      return;
    }

    setHelperRecurringChanges((current) =>
      [
        ...current,
        {
          amount,
          effectiveDate: startMonth,
          endDate: endMonth,
          id: `helper-adjust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind: helperBulkMode,
        },
      ].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime()),
    );
    setHelperAdjustmentFromMonth("");
    setHelperAdjustmentToMonth("");
    setHelperAdjustmentAmount("");
  };

  const deleteHelperRecurringChange = (changeId: string) => {
    setHelperRecurringChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const deleteHelperDueDayChange = (changeId: string) => {
    setHelperDueDayChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const addOneOffPayment = () => {
    const date = parseDate(newOneOffDate);
    const amount = parseCurrency(newOneOffAmount);
    if (!date || amount <= 0) {
      setHelperActionError("Enter a valid payment date and amount.");
      return;
    }
    if (compareDateOnly(date, todayDate) > 0) {
      setHelperActionError("Payment History Helper dates cannot be in the future.");
      return;
    }

    const newPayment: PaymentEvent = {
      amount,
      date,
      id: `oneoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: newOneOffLabel.trim() || "Extra payment",
      source: "extra",
    };

    setOneOffPayments((current) =>
      [...current, newPayment].sort((a, b) => a.date.getTime() - b.date.getTime()),
    );
    setHelperActionError("");
    setNewOneOffDate("");
    setNewOneOffAmount("");
    setNewOneOffLabel("Extra payment");
  };

  const startEditingReplayRow = (row: ScheduleRow) => {
    setEditingPaymentId(row.rowId);
    setEditingPaymentDate(toDateInputValue(row.paymentDate));
    setEditingPaymentAmount(row.paymentAmount.toFixed(2));
    setEditingPaymentLabel(row.label);
  };

  const saveEditedPayment = () => {
    const parsed = parseDate(editingPaymentDate);
    const parsedAmount = parseCurrency(editingPaymentAmount);
    if (!parsed || !editingPaymentId || !(parsedAmount > 0)) {
      setHelperActionError("Enter a valid edited payment date and amount.");
      return;
    }
    if (compareDateOnly(parsed, todayDate) > 0) {
      setHelperActionError("Payment History Helper dates cannot be in the future.");
      return;
    }

    setPaymentDateOverrides((current) => ({
      ...current,
      [editingPaymentId]: toDateInputValue(parsed),
    }));
    setHelperPaymentAmountOverrides((current) => ({
      ...current,
      [editingPaymentId]: parsedAmount.toFixed(2),
    }));
    setPaymentLabelOverrides((current) => {
      const trimmed = editingPaymentLabel.trim();
      if (!trimmed) {
        const next = { ...current };
        delete next[editingPaymentId];
        return next;
      }
      return {
        ...current,
        [editingPaymentId]: trimmed,
      };
    });

    setHelperActionError("");
    setEditingPaymentId("");
    setEditingPaymentDate("");
    setEditingPaymentAmount("");
    setEditingPaymentLabel("");
  };

  const cancelEditingPayment = () => {
    setEditingPaymentId("");
    setEditingPaymentDate("");
    setEditingPaymentAmount("");
    setEditingPaymentLabel("");
  };

  const deleteHelperRow = (rowId: string) => {
    setDeletedHelperRowIds((current) => (current.includes(rowId) ? current : [...current, rowId]));
    if (editingPaymentId === rowId) {
      cancelEditingPayment();
    }
  };

  const addWhatIfPayment = () => {
    if (whatIfEntryMode === "pause") {
      const startMonth = parseMonthInput(whatIfPauseFromMonth);
      const endMonth = parseMonthInput(whatIfPauseToMonth);
      if (!startMonth || !endMonth || endMonth < startMonth) {
        setWhatIfActionError("Choose a valid pause range.");
        return;
      }
      const nextPausePeriod: PausePeriod = {
        endMonth,
        id: `whatif-pause-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: whatIfPauseMode,
        startMonth,
      };
      const hasOverlap = whatIfPausePeriods.some((pausePeriod) => pausePeriodsOverlap(pausePeriod, nextPausePeriod));
      if (hasOverlap) {
        setWhatIfActionError("A payment is already paused in that date range.");
        return;
      }
      setWhatIfPausePeriods((current) =>
        [
          ...current,
          nextPausePeriod,
        ].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()),
      );
      setWhatIfActionError("");
      setWhatIfPauseFromMonth("");
      setWhatIfPauseToMonth("");
      setWhatIfPauseMode("accrues");
      return;
    }

    if (whatIfEntryMode === "due-day") {
      const startMonth = parseMonthInput(whatIfAdjustmentDate);
      const endMonth = parseMonthInput(whatIfAdjustmentEndDate);
      const day = Number(whatIfAdjustmentDueDay);
      const currentTarget = parseDate(targetDate);
      if (!startMonth || (whatIfAdjustmentEndDate && !endMonth) || (endMonth && endMonth < startMonth) || day < 1 || day > 31) {
        setWhatIfActionError("Choose a valid due day and month range.");
        return;
      }
      const start = currentTarget ? monthValue(startMonth) : null;
      const currentMonth = currentTarget ? monthValue(new Date(currentTarget.getFullYear(), currentTarget.getMonth(), 1)) : null;
      if (start !== null && currentMonth !== null && start <= currentMonth) {
        setWhatIfActionError("Choose a due-date change that starts after the current baseline month.");
        return;
      }
      setWhatIfDueDayChanges((current) =>
        [
          ...current,
          {
            day,
            endMonth: endMonth ?? undefined,
            id: `whatif-due-day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            startMonth,
          },
        ].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()),
      );
      setWhatIfActionError("");
      setWhatIfAdjustmentDate("");
      setWhatIfAdjustmentEndDate("");
      setWhatIfAdjustmentDueDay("");
      return;
    }

    if (whatIfEntryMode !== "one-time") {
      const startMonth = parseMonthInput(whatIfAdjustmentDate);
      const amount = parseCurrency(whatIfAdjustmentAmount);
      const currentTarget = parseDate(targetDate);
      const start = startMonth
        ? clampToMonth(startMonth.getFullYear(), startMonth.getMonth(), Number(dueDay) || 1)
        : null;
      if (!start || amount <= 0 || (currentTarget && start <= currentTarget)) {
        setWhatIfActionError("Choose a valid future month and amount.");
        return;
      }
      setWhatIfRecurringChanges((current) =>
        [...current, {
          amount,
          effectiveDate: start,
          id: `change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind: (whatIfEntryMode === "minimum" ? "minimum" : "monthly-extra") as "minimum" | "monthly-extra",
        }].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime()),
      );
      setWhatIfActionError("");
      setWhatIfAdjustmentDate("");
      setWhatIfAdjustmentEndDate("");
      setWhatIfAdjustmentAmount("");
      return;
    }

    const date = parseDate(newWhatIfDate);
    const amount = parseCurrency(newWhatIfAmount);
    const currentTarget = parseDate(targetDate);
    if (!date || amount <= 0 || (currentTarget && date <= currentTarget)) {
      setWhatIfActionError("Choose a valid future payment date and amount.");
      return;
    }
    if (compareDateOnly(date, todayDate) < 0) {
      setWhatIfActionError("Future payment dates cannot be before today.");
      return;
    }

    const payment: PaymentEvent = {
      amount,
      date,
      id: `whatif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: newWhatIfLabel.trim() || "Anticipated one-time payment",
      source: "extra",
    };

    setWhatIfPayments((current) =>
      [...current, payment].sort((a, b) => a.date.getTime() - b.date.getTime()),
    );
    setWhatIfActionError("");
    setNewWhatIfDate("");
    setNewWhatIfAmount("");
    setNewWhatIfLabel("Anticipated one-time payment");
  };

  const deleteWhatIfPayment = (paymentId: string) => {
    setWhatIfPayments((current) => current.filter((payment) => payment.id !== paymentId));
  };

  const deleteWhatIfRecurringChange = (changeId: string) => {
    setWhatIfRecurringChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const deleteWhatIfDueDayChange = (changeId: string) => {
    setWhatIfDueDayChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const deleteWhatIfPausePeriod = (pauseId: string) => {
    setWhatIfPausePeriods((current) => current.filter((pausePeriod) => pausePeriod.id !== pauseId));
  };

  const resetHelper = () => {
    setOneOffPayments([]);
    setHelperPausePeriods([]);
    setHelperPauseFromMonth("");
    setHelperPauseToMonth("");
    setHelperPauseMode("accrues");
    setHelperBulkMode("pause");
    setHelperAdjustmentFromMonth("");
    setHelperAdjustmentToMonth("");
    setHelperAdjustmentAmount("");
    setHelperAdjustmentDueDay("");
    setHelperRecurringChanges([]);
    setHelperDueDayChanges([]);
    setDeletedHelperRowIds([]);
    setHelperActionError("");
    setHelperPaymentAmountOverrides({});
    setPaymentDateOverrides({});
    setPaymentLabelOverrides({});
    setEditingPaymentId("");
    setEditingPaymentDate("");
    setEditingPaymentAmount("");
    setNewOneOffDate("");
    setNewOneOffAmount("");
    setNewOneOffLabel("Extra payment");
  };

  const resetWhatIf = () => {
    setWhatIfPayments([]);
    setWhatIfRecurringChanges([]);
    setWhatIfPausePeriods([]);
    setWhatIfEntryMode("one-time");
    setNewWhatIfDate("");
    setNewWhatIfAmount("");
    setNewWhatIfLabel("Anticipated one-time payment");
    setWhatIfAdjustmentDate("");
    setWhatIfAdjustmentEndDate("");
    setWhatIfAdjustmentAmount("");
    setWhatIfAdjustmentDueDay("");
    setWhatIfDueDayChanges([]);
    setWhatIfPauseFromMonth("");
    setWhatIfPauseToMonth("");
    setWhatIfPauseMode("accrues");
    setWhatIfActionError("");
  };

  if (!currentUserId) {
    return loginScreen;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: currentTheme.appBackground,
        padding: "24px 16px 48px",
        color: currentTheme.text,
        ["--app-accent" as string]: currentTheme.accent,
        ["--app-accent-soft" as string]: currentTheme.accentSoft,
        ["--app-border" as string]: currentTheme.cardBorder,
        ["--app-border-strong" as string]: currentTheme.cardBorder,
        ["--app-heading" as string]: currentTheme.text,
        ["--app-input-bg" as string]: currentTheme.surface,
        ["--app-danger-bg" as string]: currentTheme.isDark ? "rgba(127, 29, 29, 0.35)" : "#fff1f2",
        ["--app-danger-border" as string]: currentTheme.isDark ? "#7f1d1d" : "#fecaca",
        ["--app-danger-text" as string]: currentTheme.isDark ? "#fecaca" : "#991b1b",
        ["--app-negative-bg" as string]: currentTheme.isDark ? "rgba(157, 23, 77, 0.25)" : "#fff1f2",
        ["--app-negative-border" as string]: currentTheme.isDark ? "#9d174d" : "#fda4af",
        ["--app-negative-text" as string]: currentTheme.isDark ? "#f9a8d4" : "#be123c",
        ["--app-positive-bg" as string]: currentTheme.isDark ? "rgba(21, 128, 61, 0.22)" : "#ecfdf5",
        ["--app-positive-border" as string]: currentTheme.isDark ? "#166534" : "#86efac",
        ["--app-positive-text" as string]: currentTheme.isDark ? "#86efac" : "#15803d",
        ["--app-benchmark-bg" as string]: currentTheme.isDark ? "rgba(180, 83, 9, 0.22)" : "#fefce8",
        ["--app-benchmark-border" as string]: currentTheme.isDark ? "#92400e" : "#fde68a",
        ["--app-benchmark-text" as string]: currentTheme.isDark ? "#fcd34d" : "#a16207",
        ["--app-row-negative" as string]: currentTheme.isDark ? "rgba(146, 64, 14, 0.18)" : "#fffbeb",
        ["--app-row-paused" as string]: currentTheme.isDark ? "rgba(194, 65, 12, 0.16)" : "#fff7ed",
        ["--app-surface" as string]: currentTheme.surface,
        ["--app-surface-muted" as string]: currentTheme.surfaceMuted,
        ["--app-table-header" as string]: currentTheme.surfaceMuted,
        ["--app-table-border" as string]: currentTheme.cardBorder,
        ["--app-text" as string]: currentTheme.text,
        ["--app-text-muted" as string]: currentTheme.textMuted,
      }}
    >
      <div
        style={{
          maxWidth: 1760,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <header style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
          <button type="button" onClick={() => { setActivePage("simulator"); setActiveLoanTab("details"); setActiveView("assumed"); }} style={{ display: "flex", gap: 14, alignItems: "center", border: 0, padding: 0, background: "transparent", color: currentTheme.text, cursor: "pointer", textAlign: "left" }}>
            <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.accent})`, boxShadow: currentTheme.cardShadow, flexShrink: 0 }} />
            <span>
              <span style={{ display: "block", fontSize: 34, fontWeight: 750, lineHeight: 1.1 }}>DebtLab</span>
              <span style={{ display: "block", marginTop: 6, color: currentTheme.textMuted, fontSize: 15 }}>
                {activePage === "paycheck" ? "Estimate take-home pay and future changes." : activePage === "profile" ? "Manage your account and preferences." : "Model loan payments and plan your payoff."}
              </span>
            </span>
          </button>
          <div ref={profileMenuRef} style={{ position: "relative" }}>
            <button type="button" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)} style={{ display: "flex", gap: 10, alignItems: "center", border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "7px 12px 7px 7px", fontWeight: 700, cursor: "pointer", boxShadow: currentTheme.cardShadow }}>
              <span aria-hidden="true" style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: currentTheme.accent, color: "#fff", fontSize: 14 }}>{profileInitial}</span>
              <span>Welcome, {firstName}</span>
              <span aria-hidden="true" style={{ fontSize: 11, color: currentTheme.textMuted }}>{profileMenuOpen ? "▲" : "▼"}</span>
            </button>
            {profileMenuOpen ? (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 30, width: 220, padding: 8, display: "grid", gap: 4, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 14, background: currentTheme.surface, boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)" }}>
                {[
                  { label: "View profile", action: () => setActivePage("profile") },
                  { label: "Paycheck estimator", action: () => setActivePage("paycheck") },
                  { label: "Log out", action: logoutUser },
                ].map((item) => (
                  <button key={item.label} type="button" onClick={() => { setProfileMenuOpen(false); item.action(); }} style={{ border: 0, borderRadius: 9, padding: "10px 12px", background: "transparent", color: currentTheme.text, textAlign: "left", fontWeight: 600, cursor: "pointer" }}>{item.label}</button>
                ))}
              </div>
            ) : null}
          </div>
        </header>
        {activePage === "profile" ? (
          <main
            style={{
              display: "grid",
              gap: 24,
            }}
          >
            <section
              style={{
                background: currentTheme.surface,
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: 20,
                padding: 24,
                boxShadow: currentTheme.cardShadow,
                display: "grid",
                gap: 24,
              }}
            >
              <div style={{ display: "grid", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 28 }}>Profile</h2>
                <p style={{ margin: 0, color: currentTheme.textMuted, lineHeight: 1.6, maxWidth: 760 }}>
                  Keep your account details up to date, pick a theme for the simulator, and use a one-time reset code emailed to you when you want to change your password.
                </p>
              </div>

              {profileStatus ? (
                <div
                  style={{
                    border: `1px solid ${currentTheme.cardBorder}`,
                    background: currentTheme.accentSoft,
                    color: currentTheme.text,
                    borderRadius: 14,
                    padding: "12px 14px",
                    fontSize: 14,
                  }}
                >
                  {profileStatus}
                </div>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gap: 24,
                  gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
                }}
              >
                <div
                  style={{
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 18,
                    padding: 20,
                    display: "grid",
                    gap: 16,
                    alignContent: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 20 }}>Account details</h3>
                      <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                      Your username stays the same for login. Your profile name is what shows in the app.
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Username</span>
                      <div
                        style={{
                          border: `1px solid ${currentTheme.cardBorder}`,
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 15,
                          background: currentTheme.surfaceMuted,
                          color: currentTheme.textMuted,
                        }}
                      >
                        {currentUser?.name}
                      </div>
                    </div>
                    <Field
                      id="profile-display-name"
                      label="Your name"
                      value={profileDraftName}
                      onChange={setProfileDraftName}
                    />
                    <Field
                      id="profile-email"
                      label="Email for password resets"
                      value={profileDraftEmail}
                      onChange={setProfileDraftEmail}
                    />
                    <button
                      type="button"
                      onClick={saveProfileDetails}
                      style={{
                        border: `1px solid ${currentTheme.accent}`,
                        background: currentTheme.accent,
                        color: "#ffffff",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        justifySelf: "start",
                      }}
                    >
                      Save profile
                    </button>
                    <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${currentTheme.cardBorder}`, display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: currentTheme.text }}>Delete account</div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: currentTheme.textMuted }}>Permanently remove your profile and all saved loan data.</div>
                      <button type="button" onClick={() => setDeleteAccountConfirmOpen(true)} style={{ justifySelf: "start", border: "1px solid #ef4444", background: currentTheme.surface, color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        Delete account
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 18,
                    padding: 20,
                    display: "grid",
                    gap: 16,
                    alignContent: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 20 }}>Security</h3>
                      <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                      Changing your password requires a one-time reset code tied to your email address.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={sendPasswordResetEmail}
                    style={{
                      border: `1px solid ${currentTheme.accent}`,
                      background: currentTheme.accent,
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      justifySelf: "start",
                      boxShadow: currentTheme.cardShadow,
                      appearance: "none",
                    }}
                  >
                    Send reset email
                  </button>
                  <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.5 }}>
                    Local demo note: the one-time reset code is shown in-app after you send it, since this app does not have a real mail service yet.
                  </div>
                  <div style={{ display: "grid", gap: 14 }}>
                    <Field
                      id="password-reset-code"
                      label="One-time reset code"
                      value={passwordResetCodeInput}
                      onChange={setPasswordResetCodeInput}
                    />
                    <Field
                      id="password-reset-new"
                      label="New password"
                      type="password"
                      value={passwordResetNewPassword}
                      onChange={setPasswordResetNewPassword}
                    />
                    <Field
                      id="password-reset-confirm"
                      label="Confirm new password"
                      type="password"
                      value={passwordResetConfirmPassword}
                      onChange={setPasswordResetConfirmPassword}
                    />
                    <button
                      type="button"
                      onClick={applyPasswordReset}
                      style={{
                        border: `1px solid ${currentTheme.accent}`,
                        background: currentTheme.accent,
                        color: "#ffffff",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        justifySelf: "start",
                      }}
                    >
                      Change password
                    </button>
                  </div>
                </div>
              </div>

              <section
                style={{
                  border: `1px solid ${currentTheme.cardBorder}`,
                  borderRadius: 18,
                  padding: 20,
                  display: "grid",
                  gap: 16,
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 20 }}>Theme</h3>
                  <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                    Choose the look you want to use across the signed-in simulator.
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 14,
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  }}
                >
                  {Object.entries(THEME_DEFINITIONS).map(([themeId, theme]) => {
                    const isSelected = currentUser?.themeId === themeId;
                    return (
                      <button
                        key={themeId}
                        type="button"
                        onClick={() => applyThemeToProfile(themeId as ThemeId)}
                        style={{
                          border: isSelected ? `2px solid ${theme.accent}` : `1px solid ${theme.cardBorder}`,
                          background: theme.appBackground,
                          borderRadius: 16,
                          padding: 14,
                          display: "grid",
                          gap: 12,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8 }}>
                          {[theme.accent, theme.accentSoft, "#ffffff"].map((color) => (
                            <span
                              key={color}
                              aria-hidden="true"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                background: color,
                                border: "1px solid rgba(148, 163, 184, 0.35)",
                              }}
                            />
                          ))}
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{theme.name}</span>
                          <span style={{ fontSize: 12, color: theme.textMuted }}>
                            {isSelected ? "Current theme" : "Apply this theme"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </section>
          </main>
        ) : activePage === "paycheck" ? (
          <PaycheckPage userId={currentUserId} />
        ) : (
        <main style={{ display: "grid", gap: 20, gridTemplateColumns: loanSidebarCollapsed ? "72px minmax(0, 1fr)" : "260px minmax(0, 1fr)", alignItems: "start" }}>
          <aside style={{ position: "sticky", top: 16, minHeight: 420, padding: loanSidebarCollapsed ? 10 : 16, display: "grid", alignContent: "start", gap: 14, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 18, background: currentTheme.surface, boxShadow: currentTheme.cardShadow }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: loanSidebarCollapsed ? "center" : "space-between", gap: 8 }}>
              {!loanSidebarCollapsed ? <strong style={{ fontSize: 16 }}>Your loans</strong> : null}
              <button type="button" aria-label={loanSidebarCollapsed ? "Expand loan sidebar" : "Collapse loan sidebar"} onClick={() => setLoanSidebarCollapsed((collapsed) => !collapsed)} style={{ width: 36, height: 36, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, background: currentTheme.surfaceMuted, color: currentTheme.text, cursor: "pointer", fontWeight: 800 }}>{loanSidebarCollapsed ? "›" : "‹"}</button>
            </div>
            <button type="button" onClick={startNewLoan} title="Add loan" style={{ display: "flex", justifyContent: loanSidebarCollapsed ? "center" : "flex-start", alignItems: "center", gap: 9, width: "100%", border: `1px solid ${currentTheme.accent}`, borderRadius: 11, padding: loanSidebarCollapsed ? "10px 0" : "10px 12px", background: currentTheme.accent, color: "#fff", fontWeight: 750, cursor: "pointer" }}>
              <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>+</span>{!loanSidebarCollapsed ? "Add loan" : null}
            </button>
            <div style={{ display: "grid", gap: 7 }}>
              {!currentLoanId && loanName ? <div style={{ padding: loanSidebarCollapsed ? "10px 0" : "10px 12px", textAlign: loanSidebarCollapsed ? "center" : "left", borderRadius: 10, background: currentTheme.accentSoft, color: currentTheme.text, fontSize: 13, fontWeight: 700 }} title="Unsaved loan">{loanSidebarCollapsed ? "•" : `${loanName || "New loan"} (draft)`}</div> : null}
              {savedLoans.map((loan) => {
                const selected = loan.id === currentLoanId;
                return <button key={loan.id} type="button" title={loan.name} onClick={() => loadSavedLoan(loan.id)} style={{ width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: loanSidebarCollapsed ? "center" : "left", border: selected ? `1px solid ${currentTheme.accent}` : "1px solid transparent", borderRadius: 10, padding: loanSidebarCollapsed ? "10px 0" : "10px 12px", background: selected ? currentTheme.accentSoft : "transparent", color: currentTheme.text, fontWeight: selected ? 750 : 600, cursor: "pointer" }}>{loanSidebarCollapsed ? loan.name.charAt(0).toUpperCase() : loan.name}</button>;
              })}
              {savedLoans.length === 0 && !loanSidebarCollapsed ? <div style={{ padding: "12px 4px", color: currentTheme.textMuted, fontSize: 12, lineHeight: 1.5 }}>Add your first loan to begin building a payoff plan.</div> : null}
            </div>
            {!loanSidebarCollapsed && saveStatus ? <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4 }}>{saveStatus}</div> : null}
          </aside>
          <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
            <nav aria-label="Loan workspace" style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: 6, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 14, background: currentTheme.surface, boxShadow: currentTheme.cardShadow }}>
              {([
                ["details", "Loan Details"],
                ["assumed", "Assumed Schedule"],
                ["history", "Payment History Helper"],
                ["whatif", "What If"],
              ] as const).map(([tab, label]) => (
                <button key={tab} type="button" onClick={() => { setActiveLoanTab(tab); if (tab !== "details") setActiveView(tab); else setActiveView("assumed"); }} style={{ border: activeLoanTab === tab ? `1px solid ${currentTheme.accent}` : "1px solid transparent", borderRadius: 10, padding: "10px 14px", background: activeLoanTab === tab ? currentTheme.accentSoft : "transparent", color: currentTheme.text, fontWeight: 700, cursor: "pointer" }}>{label}</button>
              ))}
            </nav>
            <div style={{ display: "grid", gap: 24, gridTemplateColumns: activeLoanTab === "assumed" ? "minmax(0, 1fr)" : "360px minmax(0, 1fr)", alignItems: "start", minWidth: 0 }}>
          <section
            style={{
              background: currentTheme.surface,
              border: `1px solid ${currentTheme.cardBorder}`,
              borderRadius: 18,
              padding: 20,
              textAlign: "left",
              display: activeLoanTab === "assumed" ? "none" : "grid",
              gap: 16,
              boxShadow: currentTheme.cardShadow,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 22 }}>
              {activeLoanTab === "details"
                ? "Loan Details"
                : activeLoanTab === "history"
                  ? "Payment History Helper"
                  : "What If"}
            </h2>
            {activeLoanTab === "details" ? (
              <>
                <FormSection title="Loan basics">
                  <Field label="Loan name" id="loan-name" value={loanName} onChange={setLoanName} />
                  <Field label="Starting principal" id="starting-principal" value={startingPrincipal} onChange={setStartingPrincipal} />
                  <Field label="APR (%)" id="apr" value={aprPercent} onChange={setAprPercent} />
                </FormSection>
                <FormSection title="Timeline">
                  <DateField label="Starting principal date" id="starting-date" value={startingPrincipalDate} onChange={setStartingPrincipalDate} />
                  <DateField label="First scheduled payment date" id="first-payment-date" value={firstPaymentDate} onChange={setFirstPaymentDate} />
                  <DateField label="Calculate current balance through" id="target-date" value={targetDate} minDate={targetDateMinValue} onChange={setTargetDate} />
                </FormSection>
                <FormSection title="Recurring payment rules">
                  <Field label="Minimum payment" id="minimum-payment" value={minimumPayment} onChange={setMinimumPayment} />
                  <Field label="Monthly extra payment" id="additional-monthly-payment" value={additionalMonthlyPayment} onChange={setAdditionalMonthlyPayment} />
                  <Field label="Recurring due day" id="due-day" value={dueDay} onChange={setDueDay} />
                </FormSection>
                <FormSection title="Accrual / calendar behavior" helper="These rules control how scheduled dates and daily interest are calculated.">
                  <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                    <input type="checkbox" checked={moveWeekend} onChange={(event) => setMoveWeekend(event.target.checked)} />
                    Move scheduled due dates that fall on weekends to next weekday
                  </label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                    <input type="checkbox" checked={roundDailyInterest} onChange={(event) => setRoundDailyInterest(event.target.checked)} />
                    Round daily interest before summing
                  </label>
                  <div style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Daily interest basis</span>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                        <input type="radio" name="day-count-basis" checked={dayCountBasis === "365"} onChange={() => setDayCountBasis("365")} />
                        Always divide APR by 365
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                        <input type="radio" name="day-count-basis" checked={dayCountBasis === "actual-year"} onChange={() => setDayCountBasis("actual-year")} />
                        Use 366 during leap years
                      </label>
                    </div>
                    <span style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4 }}>
                      Your July 3, 2024 first-payment example strongly suggests your lender may be using 366 for 2024.
                    </span>
                  </div>
                </FormSection>
                <FormSection title="Actions">
                  <button type="button" onClick={saveCurrentLoan} style={{ border: `1px solid ${currentTheme.accent}`, background: currentTheme.accent, color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{currentLoanId ? "Save changes" : "Create loan"}</button>
                  <button type="button" onClick={resetAll} style={{ border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Reset all inputs</button>
                  {currentLoanId ? <button type="button" onClick={deleteCurrentLoan} style={{ border: "1px solid #ef4444", background: currentTheme.surface, color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Delete loan</button> : null}
                </FormSection>
              </>
            ) : activeLoanTab === "history" ? (
              <>
                <div
                  style={{
                    background: currentTheme.surfaceMuted,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 12,
                    padding: 14,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Add one-time payment</div>
                    <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4, marginTop: 4 }}>
                      Insert a single payment by date and amount. The helper will drop it into the
                      recurring schedule and recalculate from there.
                    </div>
                  </div>
                  <DateField
                    id="new-one-off-date"
                    label="Payment date"
                    maxDate={todayValue}
                    value={newOneOffDate}
                    onChange={setNewOneOffDate}
                  />
                  <Field
                    id="new-one-off-amount"
                    label="Payment amount"
                    value={newOneOffAmount}
                    onChange={setNewOneOffAmount}
                  />
                  <Field
                    id="new-one-off-label"
                    label="Memo"
                    value={newOneOffLabel}
                    onChange={setNewOneOffLabel}
                  />
                  <button
                    type="button"
                    onClick={addOneOffPayment}
                    style={{
                      border: `1px solid ${currentTheme.accent}`,
                      background: currentTheme.accent,
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Add one-time payment
                  </button>
                </div>

                <div
                  style={{
                    background: currentTheme.surfaceMuted,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 12,
                    padding: 14,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Bulk adjust schedule</div>
                    <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4, marginTop: 4 }}>
                      Apply a month-range change instead of editing several scheduled rows one at a time.
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="helper-bulk-mode"
                        checked={helperBulkMode === "pause"}
                        onChange={() => setHelperBulkMode("pause")}
                      />
                      Pause / stop payments
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="helper-bulk-mode"
                        checked={helperBulkMode === "monthly-extra"}
                        onChange={() => setHelperBulkMode("monthly-extra")}
                      />
                      Update monthly extra payment
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="helper-bulk-mode"
                        checked={helperBulkMode === "minimum"}
                        onChange={() => setHelperBulkMode("minimum")}
                      />
                      Update minimum payment
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="helper-bulk-mode"
                        checked={helperBulkMode === "due-day"}
                        onChange={() => setHelperBulkMode("due-day")}
                      />
                      Change payment due date
                    </label>
                  </div>
                  <MonthYearField
                    id="helper-pause-from"
                    label="From"
                    maxMonth={helperMaxMonthValue}
                    value={helperBulkMode === "pause" ? helperPauseFromMonth : helperAdjustmentFromMonth}
                    onChange={helperBulkMode === "pause" ? setHelperPauseFromMonth : setHelperAdjustmentFromMonth}
                  />
                  <MonthYearField
                    id="helper-pause-to"
                    label="To"
                    maxMonth={helperMaxMonthValue}
                    value={helperBulkMode === "pause" ? helperPauseToMonth : helperAdjustmentToMonth}
                    onChange={helperBulkMode === "pause" ? setHelperPauseToMonth : setHelperAdjustmentToMonth}
                  />
                  {helperBulkMode === "pause" ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Pause behavior</span>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                        <input
                          type="radio"
                          name="helper-pause-mode"
                          checked={helperPauseMode === "accrues"}
                          onChange={() => setHelperPauseMode("accrues")}
                        />
                        Interest continues to accrue
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                        <input
                          type="radio"
                          name="helper-pause-mode"
                          checked={helperPauseMode === "paused"}
                          onChange={() => setHelperPauseMode("paused")}
                        />
                        Interest is paused
                      </label>
                    </div>
                  ) : helperBulkMode === "due-day" ? (
                    <Field
                      id="helper-adjustment-due-day"
                      label="New due day"
                      value={helperAdjustmentDueDay}
                      onChange={setHelperAdjustmentDueDay}
                    />
                  ) : (
                    <Field
                      id="helper-adjustment-amount"
                      label={helperBulkMode === "minimum" ? "New minimum payment" : "New monthly extra payment"}
                      value={helperAdjustmentAmount}
                      onChange={setHelperAdjustmentAmount}
                    />
                  )}
                  <button
                    type="button"
                    onClick={addHelperBulkAdjustment}
                    style={{
                      border: `1px solid ${currentTheme.accent}`,
                      background: currentTheme.accent,
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {helperBulkMode === "pause" ? "Apply pause" : helperBulkMode === "due-day" ? "Apply due-date change" : "Apply adjustment"}
                  </button>
                  {helperActionError ? (
                    <div
                      style={{
                        border: "1px solid var(--app-danger-border, #fecaca)",
                        background: "var(--app-danger-bg, #fff1f2)",
                        color: "var(--app-danger-text, #991b1b)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontSize: 13,
                      }}
                    >
                      {helperActionError}
                    </div>
                  ) : null}
                  {helperPausePeriods.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {helperPausePeriods.map((pausePeriod) => (
                        <div
                          key={pausePeriod.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                            borderTop: `1px solid ${currentTheme.cardBorder}`,
                            paddingTop: 8,
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            Pause payments from {formatPauseRange(pausePeriod)} with{" "}
                            {pausePeriod.mode === "paused" ? "interest paused" : "interest accruing"}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteHelperPausePeriod(pausePeriod.id)}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {helperRecurringChanges.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {helperRecurringChanges.map((change) => (
                        <div
                          key={change.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                            borderTop: `1px solid ${currentTheme.cardBorder}`,
                            paddingTop: 8,
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            {change.kind === "minimum" ? "Minimum payment" : "Monthly extra payment"} becomes{" "}
                            {formatCurrency(change.amount)} from {formatPauseRange({
                              startMonth: change.effectiveDate,
                              endMonth: change.endDate ?? change.effectiveDate,
                              id: change.id,
                              mode: "accrues",
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteHelperRecurringChange(change.id)}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {helperDueDayChanges.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {helperDueDayChanges.map((change) => (
                        <div
                          key={change.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                            borderTop: `1px solid ${currentTheme.cardBorder}`,
                            paddingTop: 8,
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            Due day becomes {change.day} from {formatMonth(change.startMonth)}{change.endMonth ? ` through ${formatMonth(change.endMonth)}` : ""}
                          </div>
                          <button type="button" onClick={() => deleteHelperDueDayChange(change.id)} style={{ border: "1px solid #ef4444", background: currentTheme.surface, color: "#b91c1c", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>Delete</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={resetHelper}
                  style={{
                    border: `1px solid ${currentTheme.cardBorder}`,
                    background: currentTheme.surface,
                    color: currentTheme.text,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Reset all changes
                </button>
              </>
            ) : activeLoanTab === "whatif" ? (
              <>
                <div
                  style={{
                    background: currentTheme.surfaceMuted,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 12,
                    padding: 14,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Adjust projected payments</div>
                    <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4, marginTop: 4 }}>
                      This starts from the payment-history balance as of the selected date, then applies
                      future payment changes to project a new payoff path.
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="what-if-entry-mode"
                        checked={whatIfEntryMode === "one-time"}
                        onChange={() => setWhatIfEntryMode("one-time")}
                      />
                      Add one-time anticipated payment
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="what-if-entry-mode"
                        checked={whatIfEntryMode === "monthly-extra"}
                        onChange={() => setWhatIfEntryMode("monthly-extra")}
                      />
                      Update monthly extra payment
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="what-if-entry-mode"
                        checked={whatIfEntryMode === "minimum"}
                        onChange={() => setWhatIfEntryMode("minimum")}
                      />
                      Update minimum payment
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="what-if-entry-mode"
                        checked={whatIfEntryMode === "pause"}
                        onChange={() => setWhatIfEntryMode("pause")}
                      />
                      Pause / forbearance
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="what-if-entry-mode"
                        checked={whatIfEntryMode === "due-day"}
                        onChange={() => setWhatIfEntryMode("due-day")}
                      />
                      Change payment due date
                    </label>
                  </div>
                  {whatIfEntryMode === "one-time" ? (
                    <>
                      <DateField
                        id="new-what-if-date"
                        label="Future payment date"
                        minDate={whatIfMinDateValue}
                        value={newWhatIfDate}
                        onChange={setNewWhatIfDate}
                      />
                      <Field
                        id="new-what-if-amount"
                        label="Payment amount"
                        value={newWhatIfAmount}
                        onChange={setNewWhatIfAmount}
                      />
                      <Field
                        id="new-what-if-label"
                        label="Memo"
                        value={newWhatIfLabel}
                        onChange={setNewWhatIfLabel}
                      />
                    </>
                  ) : whatIfEntryMode === "pause" ? (
                    <>
                      <MonthYearField
                        id="what-if-pause-from"
                        label="From"
                        value={whatIfPauseFromMonth}
                        onChange={setWhatIfPauseFromMonth}
                      />
                      <MonthYearField
                        id="what-if-pause-to"
                        label="To"
                        value={whatIfPauseToMonth}
                        onChange={setWhatIfPauseToMonth}
                      />
                      <div style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Pause behavior</span>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                          <input
                            type="radio"
                            name="what-if-pause-mode"
                            checked={whatIfPauseMode === "accrues"}
                            onChange={() => setWhatIfPauseMode("accrues")}
                          />
                          Interest continues to accrue
                        </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                          <input
                            type="radio"
                            name="what-if-pause-mode"
                            checked={whatIfPauseMode === "paused"}
                            onChange={() => setWhatIfPauseMode("paused")}
                          />
                          Interest is paused
                        </label>
                      </div>
                    </>
                  ) : whatIfEntryMode === "due-day" ? (
                    <>
                      <MonthYearField id="what-if-adjustment-date" label="Beginning month" value={whatIfAdjustmentDate} onChange={setWhatIfAdjustmentDate} />
                      <MonthYearField id="what-if-adjustment-end-date" label="Ending month (optional)" value={whatIfAdjustmentEndDate} onChange={setWhatIfAdjustmentEndDate} />
                      <Field id="what-if-adjustment-due-day" label="New due day" value={whatIfAdjustmentDueDay} onChange={setWhatIfAdjustmentDueDay} />
                    </>
                  ) : (
                    <>
                      <MonthYearField
                        id="what-if-adjustment-date"
                        label="Month"
                        value={whatIfAdjustmentDate}
                        onChange={setWhatIfAdjustmentDate}
                      />
                      <MonthYearField
                        id="what-if-adjustment-end-date"
                        label="Ending month (optional)"
                        value={whatIfAdjustmentEndDate}
                        onChange={setWhatIfAdjustmentEndDate}
                      />
                      <Field
                        id="what-if-adjustment-amount"
                        label={whatIfEntryMode === "minimum" ? "New minimum payment" : "New monthly extra payment"}
                        value={whatIfAdjustmentAmount}
                        onChange={setWhatIfAdjustmentAmount}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={addWhatIfPayment}
                    style={{
                      border: `1px solid ${currentTheme.accent}`,
                      background: currentTheme.accent,
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {whatIfEntryMode === "one-time"
                      ? "Add anticipated payment"
                      : whatIfEntryMode === "pause"
                        ? "Apply pause"
                      : whatIfEntryMode === "due-day"
                        ? "Apply due-date change"
                      : whatIfEntryMode === "minimum"
                        ? "Update minimum payment"
                        : "Update monthly extra payment"}
                  </button>
                  {whatIfActionError ? (
                    <div
                      style={{
                        border: "1px solid var(--app-danger-border, #fecaca)",
                        background: "var(--app-danger-bg, #fff1f2)",
                        color: "var(--app-danger-text, #991b1b)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontSize: 13,
                      }}
                    >
                      {whatIfActionError}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={resetWhatIf}
                  style={{
                    border: `1px solid ${currentTheme.cardBorder}`,
                    background: currentTheme.surface,
                    color: currentTheme.text,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Reset all changes
                </button>
              </>
            ) : null}
          </section>

          <section style={{ display: "grid", gap: 24, textAlign: "left", width: "100%", minWidth: 0 }}>
            <div
              style={{
                background: currentTheme.surface,
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: 18,
                padding: 20,
                display: "grid",
                gap: 20,
                boxShadow: currentTheme.cardShadow,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>{loanName || "Loan"} summary</h2>
                <div style={{ fontSize: 12, color: currentTheme.textMuted }}>Current state as of {targetDate || "-"}</div>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                }}
              >
                <SummaryValue label="APR" value={formatPercent(Number(aprPercent) || 0)} />
                <SummaryValue label="Starting balance" value={formatCurrency(parseCurrency(startingPrincipal))} />
                <SummaryValue label="Minimum payment" value={formatCurrency(parseCurrency(minimumPayment))} />
                <SummaryValue label="Monthly extra payment" value={formatCurrency(parseCurrency(additionalMonthlyPayment))} />
                <SummaryValue
                  label="Total scheduled payment"
                  value={formatCurrency(parseCurrency(totalMonthlyPayment))}
                  subtext="Minimum payment + monthly extra payment"
                />
                <SummaryValue label="Next scheduled payment date" value={nextPaymentDate} />
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <SummaryGroupLabel label="OUTSTANDING BALANCES" />
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  }}
                >
                  <SummaryValue
                    label="Principal"
                    value={formatCurrency(activeView === "assumed" ? assumedResult.currentPrincipal : historyResult.currentPrincipal)}
                  />
                  <SummaryValue
                    label="Interest"
                    value={formatCurrency(activeView === "assumed" ? assumedResult.currentInterest : historyResult.currentInterest)}
                  />
                  <SummaryValue
                    label="Total balance"
                    value={formatCurrency(activeView === "assumed" ? assumedResult.totalBalance : historyResult.totalBalance)}
                    emphasized
                    tone="benchmark"
                  />
                </div>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <SummaryGroupLabel label="PAYOFF OUTLOOK" />
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  }}
                >
                  <SummaryValue
                    label="Payoff progress"
                    value={formatPercent(activePayoffPercent)}
                    emphasized
                    subtext={
                      <div style={{ display: "grid", gap: 8 }}>
                        <div>{`You've paid off ${Math.round(activePayoffPercent)}% of your loan`}</div>
                        <div
                          style={{
                            width: "100%",
                            height: 8,
                            borderRadius: 999,
                            background: currentTheme.isDark ? "rgba(96, 165, 250, 0.18)" : "#dbeafe",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                            width: `${Math.max(0, Math.min(100, activePayoffPercent))}%`,
                            height: "100%",
                              background: `linear-gradient(90deg, ${currentTheme.accent}, ${currentTheme.isDark ? "#93c5fd" : "#38bdf8"})`,
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </div>
                    }
                  />
                  <SummaryValue
                    label="Projected payoff"
                    value={formatMonthYear(activeProjectedPayoffDate)}
                    emphasized
                    subtext={activePayoffDuration === "-" ? undefined : `~${activePayoffDuration} remaining`}
                  />
                  <SummaryValue
                    label={<LabelWithNotes text="Time difference vs minimum-only plan" notes={[1]} />}
                    value={activeTimeSavedLabel}
                    emphasized
                  />
                </div>
              </div>
              {negativeAmortizationWarning ? (
                <div
                  style={{
                    border: "1px solid #fbbf24",
                    background: currentTheme.isDark ? "rgba(146, 64, 14, 0.18)" : "#fffbeb",
                    color: "#92400e",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Negative amortization detected: at least one cycle has a payment that does not
                  reduce principal, so the balance can grow.
                </div>
              ) : null}
              {!negativeAmortizationWarning && softDangerMessage ? (
                <div
                  style={{
                    border: "1px solid #fde68a",
                    background: currentTheme.isDark ? "rgba(146, 64, 14, 0.18)" : "#fffbeb",
                    color: "#92400e",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {softDangerMessage}
                </div>
              ) : null}
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 14,
                  borderRadius: 14,
                  background: currentTheme.surfaceMuted,
                  border: `1px solid ${currentTheme.cardBorder}`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: currentTheme.text }}>Additional details</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setShowHistoricalDetails((value) => !value)} style={{ border: `1px solid ${showHistoricalDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showHistoricalDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Historical details</button>
                  <button type="button" onClick={() => setShowFutureDetails((value) => !value)} style={{ border: `1px solid ${showFutureDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showFutureDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Future projection details</button>
                  <button type="button" onClick={() => setShowLifetimeDetails((value) => !value)} style={{ border: `1px solid ${showLifetimeDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showLifetimeDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Lifetime details</button>
                  {activeView === "whatif" ? (
                    <button type="button" onClick={() => setShowComparisonDetails((value) => !value)} style={{ border: `1px solid ${showComparisonDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showComparisonDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Comparison details</button>
                  ) : null}
                  <button type="button" onClick={() => { setShowHistoricalDetails(true); setShowFutureDetails(true); setShowLifetimeDetails(true); setShowComparisonDetails(activeView === "whatif"); }} style={{ border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Expand all</button>
                  <button type="button" onClick={() => { setShowHistoricalDetails(false); setShowFutureDetails(false); setShowLifetimeDetails(false); setShowComparisonDetails(false); }} style={{ border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Collapse all</button>
                </div>
              </div>
              {activeView === "assumed" && showHistoricalDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label={`PAID AS OF ${targetDate || "-"}`} />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Principal paid"
                        value={formatCurrency(assumedResult.totalPrincipalPaid)}
                      />
                      <SummaryValue
                        label="Interest paid"
                        value={formatCurrency(assumedResult.totalInterestPaid)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Interest difference vs minimum-only plan" notes={[1]} />}
                        value={formatCurrency(assumedInterestSavedAsOfToday)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "assumed" && showFutureDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="REMAINING INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label={<LabelWithNotes text="Interest" notes={assumedRemainingInterestNotes} />}
                        value={formatCurrency(assumedScenarioRemainingInterest)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Additional interest cost", positive: "Additional interest saved", value: assumedScenarioRemainingSaved })} notes={assumedRemainingSavedNotes} />}
                        value={formatCurrency(Math.abs(assumedScenarioRemainingSaved))}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "assumed" && showLifetimeDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="LIFETIME INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Minimum only payments"
                        value={formatCurrency(minimumOnlyLifetimeInterest)}
                        emphasized
                        tone="benchmark"
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Actual interest" notes={[3]} />}
                        value={formatCurrency(assumedScenarioLifetimeInterest)}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Daily interest cost" notes={[3]} />}
                        value={`${formatCurrency(activeDailyInterestCost)} / day`}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Extra interest vs minimum-only plan", positive: "Interest saved vs minimum-only plan", value: assumedScenarioLifetimeSaved })} notes={assumedLifetimeSavedNotes} />}
                        value={formatCurrency(Math.abs(assumedScenarioLifetimeSaved))}
                        emphasized
                        tone={assumedLifetimeSavedTone}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "history" && showHistoricalDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label={`PAID AS OF ${targetDate || "-"}`} />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Principal paid"
                        value={formatCurrency(historyResult.totalPrincipalPaid)}
                      />
                      <SummaryValue
                        label="Interest paid"
                        value={formatCurrency(historyResult.totalInterestPaid)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Interest difference vs minimum-only plan" notes={[1]} />}
                        value={formatCurrency(helperInterestSavedAsOfToday)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "history" && showFutureDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="REMAINING INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label={<LabelWithNotes text="Interest" notes={helperRemainingInterestNotes} />}
                        value={formatCurrency(helperScenarioRemainingInterest)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Additional interest cost", positive: "Additional interest saved", value: helperScenarioRemainingSaved })} notes={helperRemainingSavedNotes} />}
                        value={formatCurrency(Math.abs(helperScenarioRemainingSaved))}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "history" && showLifetimeDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="LIFETIME INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Minimum only payments"
                        value={formatCurrency(minimumOnlyLifetimeInterest)}
                        emphasized
                        tone="benchmark"
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Actual interest" notes={[3]} />}
                        value={formatCurrency(helperScenarioLifetimeInterest)}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Daily interest cost" notes={[3]} />}
                        value={`${formatCurrency(activeDailyInterestCost)} / day`}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Extra interest vs minimum-only plan", positive: "Interest saved vs minimum-only plan", value: helperScenarioLifetimeSaved })} notes={helperLifetimeSavedNotes} />}
                        value={formatCurrency(Math.abs(helperScenarioLifetimeSaved))}
                        emphasized
                        tone={helperLifetimeSavedTone}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "whatif" && showHistoricalDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label={`PAID AS OF ${targetDate || "-"}`} />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Principal paid"
                        value={formatCurrency(historyResult.totalPrincipalPaid)}
                      />
                      <SummaryValue
                        label="Interest paid"
                        value={formatCurrency(historyResult.totalInterestPaid)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Interest difference vs minimum-only plan" notes={[1]} />}
                        value={formatCurrency(helperInterestSavedAsOfToday)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "whatif" && showFutureDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="REMAINING INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label={<LabelWithNotes text="Interest" notes={whatIfRemainingInterestNotes} />}
                        value={formatCurrency(whatIfScenarioRemainingInterest)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Additional interest cost", positive: "Additional interest saved", value: whatIfProjectedExtrasSavedRemaining })} notes={whatIfAdditionalSavedNotes} />}
                        value={formatCurrency(Math.abs(whatIfProjectedExtrasSavedRemaining))}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "whatif" && showLifetimeDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="LIFETIME INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Minimum only payments"
                        value={formatCurrency(minimumOnlyLifetimeInterest)}
                        emphasized
                        tone="benchmark"
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Actual interest" notes={[3]} />}
                        value={formatCurrency(whatIfScenarioLifetimeInterest)}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Daily interest cost" notes={[3]} />}
                        value={`${formatCurrency(activeDailyInterestCost)} / day`}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Extra interest vs minimum-only plan", positive: "Interest saved vs minimum-only plan", value: whatIfScenarioSaved })} notes={whatIfLifetimeSavedNotes} />}
                        value={formatCurrency(Math.abs(whatIfScenarioSaved))}
                        emphasized
                        tone={whatIfLifetimeSavedTone}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "whatif" && showComparisonDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div
                  style={{
                      border: `1px solid ${currentTheme.isDark ? currentTheme.accent : "#dbeafe"}`,
                      background: currentTheme.isDark ? "rgba(30, 58, 95, 0.45)" : "#f8fbff",
                      borderRadius: 12,
                      padding: 14,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: currentTheme.isDark ? "#93c5fd" : "#1d4ed8" }}>
                      Current baseline plan vs what-if plan
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label={getDifferenceLabel({ negative: "Interest difference vs current baseline", positive: "Interest difference vs current baseline", value: whatIfDeltaInterest })}
                        value={formatCurrency(Math.abs(whatIfDeltaInterest))}
                        subtext={
                          whatIfDeltaInterest < 0
                            ? "Higher than the current baseline"
                            : whatIfDeltaInterest > 0
                              ? "Lower than the current baseline"
                              : undefined
                        }
                      />
                      <SummaryValue
                        label="Time difference vs current baseline"
                        value={whatIfTimeChangeLabel}
                      />
                      <SummaryValue
                        label="Payoff date vs current baseline"
                        value={formatMonthYear(whatIfProjection.payoffDate)}
                        subtext={`Current baseline: ${formatMonthYear(whatIfBaselinePayoffDate)}`}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              <div style={{ display: "grid", gap: 6, fontSize: 12, color: currentTheme.textMuted, marginTop: 4 }}>
                <div>1. Compared to minimum-only payments.</div>
                <div>{footnote2Text}</div>
              </div>
            </div>

            {activeView === "assumed" ? (
              <>
                {assumedResult.errors.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {assumedResult.errors.map((error) => (
                      <div
                        key={error}
                        style={{
                          border: "1px solid var(--app-danger-border, #fecaca)",
                          background: "var(--app-danger-bg, #fff1f2)",
                          color: "var(--app-danger-text, #991b1b)",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div
                  style={{
                    background: currentTheme.surface,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 18,
                    padding: 20,
                    width: "100%",
                    minWidth: 0,
                    boxShadow: currentTheme.cardShadow,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 22 }}>Assumed payment schedule</h2>
                      <p style={{ margin: "8px 0 0", color: currentTheme.textMuted, fontSize: 14 }}>
                        This table is based only on the recurring minimum payment assumptions above.
                      </p>
                    </div>
                    <div style={{ display: "grid", gap: 8, justifyItems: "start", maxWidth: 320 }}>
                      <button
                        type="button"
                        onClick={() => setShowAmortization((value) => !value)}
                        style={{
                          border: `1px solid ${currentTheme.cardBorder}`,
                          background: currentTheme.surface,
                          color: currentTheme.text,
                          borderRadius: 999,
                          padding: "10px 16px",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {showAmortization ? "Hide future amortization" : "Show future amortization"}
                      </button>
                    </div>
                  </div>

                  {!canShowAssumedSchedule ? (
                    <div
                      style={{
                        border: `1px dashed ${currentTheme.cardBorder}`,
                        borderRadius: 12,
                        padding: 16,
                        color: currentTheme.textMuted,
                      }}
                    >
                      Enter both the starting principal date and first scheduled payment date to show
                      the assumed schedule.
                    </div>
                  ) : assumedResult.errors.length > 0 ? (
                    <div
                      style={{
                        border: `1px dashed ${currentTheme.cardBorder}`,
                        borderRadius: 12,
                        padding: 16,
                        color: currentTheme.textMuted,
                      }}
                    >
                      Enter the loan inputs to build the assumed schedule.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "14%" }} />
                        </colgroup>
                        <thead>
                          <tr style={{ background: currentTheme.surfaceMuted }}>
                            {["Date", "Payment", "Interest paid", "Principal paid", "% to principal", "Outstanding principal", "Outstanding interest", "Total outstanding balance"].map((heading) => (
                              <th
                                key={heading}
                                style={{
                                  padding: "10px 8px",
                                  borderBottom: `1px solid ${currentTheme.cardBorder}`,
                                  fontSize: 14,
                                  textAlign: "left",
                                  color: currentTheme.textMuted,
                                }}
                              >
                                {heading === "Type" ? <TypeHeader /> : heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(showAmortization ? amortizationProjection.rows : assumedResult.rows).map((row) => (
                            <tr key={`${row.eventType}-${row.label}-${row.paymentDate.toISOString()}`} style={getTableRowStyle(row)}>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14, whiteSpace: "nowrap" }}>{toDateInputValue(row.paymentDate)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.paymentAmount)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>
                                <div>{formatCurrency(row.interestPaid)}</div>
                                {row.eventType === "paused" && row.accruedInterest > 0 ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>
                                    Accrued {formatCurrency(row.accruedInterest)}
                                  </div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.principalPaid)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>
                                <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                {row.negativeAmortization ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>Negative amortization</div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.endingPrincipal)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.endingInterest)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.endingPrincipal + row.endingInterest)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : activeView === "history" ? (
              <>
                {historyErrors.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {historyErrors.map((error) => (
                      <div
                        key={error}
                        style={{
                          border: "1px solid var(--app-danger-border, #fecaca)",
                          background: "var(--app-danger-bg, #fff1f2)",
                          color: "var(--app-danger-text, #991b1b)",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                ) : null}
                {helperActionError ? (
                  <div
                    style={{
                      border: "1px solid var(--app-danger-border, #fecaca)",
                      background: "var(--app-danger-bg, #fff1f2)",
                      color: "var(--app-danger-text, #991b1b)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    {helperActionError}
                  </div>
                ) : null}

                <div
                  style={{
                    background: currentTheme.surface,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 18,
                    padding: 20,
                    width: "100%",
                    minWidth: 0,
                    boxShadow: currentTheme.cardShadow,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>Historical Replay To Current Date</h2>
                    <div style={{ display: "grid", gap: 8, justifyItems: "start", maxWidth: 320 }}>
                      <button
                        type="button"
                        onClick={() => {
                          cancelEditingPayment();
                          setShowHelperAmortization((value) => !value);
                        }}
                        style={{
                          border: `1px solid ${currentTheme.cardBorder}`,
                          background: currentTheme.surface,
                          color: currentTheme.text,
                          borderRadius: 999,
                          padding: "10px 16px",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {showHelperAmortization ? "Hide future amortization" : "Show future amortization"}
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: "0 0 16px", color: currentTheme.textMuted, fontSize: 14 }}>
                    This is the source-of-truth table for the helper. You can edit payment dates and
                    amounts directly here or delete rows to remove assumed payments, and the helper
                    will recalculate to the bottom `As of target date` row.
                  </p>
                  {(showHelperAmortization ? helperProjection.rows : historyResult.rows).length === 0 ? (
                    <div
                      style={{
                        border: `1px dashed ${currentTheme.cardBorder}`,
                        borderRadius: 12,
                        padding: 16,
                        color: currentTheme.textMuted,
                      }}
                    >
                      Add loan inputs and payment history to see the replay.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "5%" }} />
                          <col style={{ width: "14%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "10%" }} />
                        </colgroup>
                        <thead>
                          <tr style={{ background: currentTheme.surfaceMuted }}>
                            {["Type", "Memo", "Date", "Payment", "Interest paid", "Principal paid", "% to principal", "Outstanding principal", "Outstanding interest", "Total outstanding balance", "Actions"].map((heading) => (
                              <th
                                key={heading}
                                style={{
                                  padding: "10px 8px",
                                  borderBottom: `1px solid ${currentTheme.cardBorder}`,
                                  fontSize: 14,
                                  textAlign: "left",
                                  color: currentTheme.textMuted,
                                }}
                              >
                                {heading === "Type" ? <TypeHeader /> : heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(showHelperAmortization ? helperProjection.rows : historyResult.rows).map((row) => (
                            <tr key={row.rowId} style={getTableRowStyle(row)}>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }} title={getEventTypeTitle(row.eventType)}>{getEventTypeCode(row.eventType)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                {editingPaymentId === row.rowId ? (
                                  <input
                                    type="text"
                                    value={editingPaymentLabel}
                                    onChange={(event) => setEditingPaymentLabel(event.target.value)}
                                    style={{
                                      border: "1px solid #cbd5e1",
                                      borderRadius: 8,
                                      padding: "6px 8px",
                                      fontSize: 12,
                                      width: 140,
                                    }}
                                  />
                                ) : (
                                  row.label
                                )}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }}>
                                {editingPaymentId === row.rowId ? (
                                  <div style={{ width: 118 }}>
                                    <DatePickerInput
                                      compact
                                      maxDate={todayValue}
                                      value={editingPaymentDate}
                                      onChange={setEditingPaymentDate}
                                    />
                                  </div>
                                ) : (
                                  toDateInputValue(row.paymentDate)
                                )}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                {editingPaymentId === row.rowId ? (
                                  <input
                                    type="text"
                                    value={editingPaymentAmount}
                                    onChange={(event) => setEditingPaymentAmount(event.target.value)}
                                    style={{
                                      border: "1px solid #cbd5e1",
                                      borderRadius: 8,
                                      padding: "6px 8px",
                                      fontSize: 12,
                                      width: 74,
                                    }}
                                  />
                                ) : (
                                  formatCurrency(row.paymentAmount)
                                )}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                <div>{formatCurrency(row.interestPaid)}</div>
                                {row.eventType === "paused" && row.accruedInterest > 0 ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>
                                    Accrued {formatCurrency(row.accruedInterest)}
                                  </div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.principalPaid)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                {row.negativeAmortization ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>Negative amortization</div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingInterest)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal + row.endingInterest)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, minWidth: 138 }}>
                                {row.eventType === "snapshot" || row.eventType === "paused" || showHelperAmortization ? (
                                  <span style={{ color: currentTheme.textMuted, fontSize: 12 }}>Auto</span>
                                ) : editingPaymentId === row.rowId ? (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", whiteSpace: "nowrap" }}>
                                    <button
                                      type="button"
                                      onClick={saveEditedPayment}
                                      style={{
                                        border: `1px solid ${currentTheme.accent}`,
                                        background: currentTheme.accent,
                                        color: "#ffffff",
                                        borderRadius: 8,
                                        padding: "6px 10px",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditingPayment}
                                      style={{
                                        border: `1px solid ${currentTheme.cardBorder}`,
                                        background: currentTheme.surface,
                                        color: currentTheme.text,
                                        borderRadius: 8,
                                        padding: "6px 10px",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", whiteSpace: "nowrap" }}>
                                    <button
                                      type="button"
                                      onClick={() => startEditingReplayRow(row)}
                                      style={{
                                        border: `1px solid ${currentTheme.cardBorder}`,
                                        background: currentTheme.surface,
                                        color: currentTheme.text,
                                        borderRadius: 8,
                                        padding: "6px 10px",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteHelperRow(row.rowId)}
                                      style={{
                                        border: "1px solid #ef4444",
                                        background: "#ffffff",
                                        color: "#b91c1c",
                                        borderRadius: 8,
                                        padding: "6px 10px",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {historyErrors.length > 0 || whatIfProjection.errors.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {[...historyErrors, ...whatIfProjection.errors].map((error, index) => (
                      <div
                        key={`${error}-${index}`}
                        style={{
                          border: "1px solid var(--app-danger-border, #fecaca)",
                          background: "var(--app-danger-bg, #fff1f2)",
                          color: "var(--app-danger-text, #991b1b)",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div
                  style={{
                    background: currentTheme.surface,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 18,
                    padding: 20,
                    width: "100%",
                    minWidth: 0,
                    boxShadow: currentTheme.cardShadow,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 22 }}>What If Projection</h2>
                      <p style={{ margin: "8px 0 0", color: currentTheme.textMuted, fontSize: 14 }}>
                        This starts from the payment-history balance as of {targetDate || "today"} and
                        then applies your future payment adjustments to project a new payoff path.
                      </p>
                    </div>
                    <div />
                  </div>
                  {whatIfPayments.length > 0 || whatIfRecurringChanges.length > 0 || whatIfPausePeriods.length > 0 || whatIfDueDayChanges.length > 0 ? (
                    <div
                      style={{
                        background: currentTheme.surfaceMuted,
                        border: `1px solid ${currentTheme.cardBorder}`,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 16,
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Projected payment changes</div>
                      {whatIfPausePeriods.map((pausePeriod) => (
                        <div
                          key={pausePeriod.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            Pause payments from {formatPauseRange(pausePeriod)} with{" "}
                            {pausePeriod.mode === "paused" ? "interest paused" : "interest accruing"}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteWhatIfPausePeriod(pausePeriod.id)}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      {whatIfRecurringChanges.map((change) => (
                        <div
                          key={change.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            {change.kind === "minimum" ? "Minimum payment" : "Monthly extra"} becomes{" "}
                            {formatCurrency(change.amount)} starting in {formatMonth(change.effectiveDate)}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteWhatIfRecurringChange(change.id)}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      {whatIfDueDayChanges.map((change) => (
                        <div
                          key={change.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            Due day becomes {change.day} starting in {formatMonth(change.startMonth)}{change.endMonth ? ` through ${formatMonth(change.endMonth)}` : ""}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteWhatIfDueDayChange(change.id)}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      {whatIfPayments.map((payment) => (
                        <div
                          key={payment.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            {payment.label} on {toDateInputValue(payment.date)} for {formatCurrency(payment.amount)}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteWhatIfPayment(payment.id ?? "")}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {whatIfProjection.rows.length === 0 ? (
                    <div
                      style={{
                        border: `1px dashed ${currentTheme.cardBorder}`,
                        borderRadius: 12,
                        padding: 16,
                        color: currentTheme.textMuted,
                      }}
                    >
                      Add loan inputs first, then use the helper if needed, and this tab will project
                      forward from the current balance date.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "5%" }} />
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "13%" }} />
                        </colgroup>
                        <thead>
                          <tr style={{ background: currentTheme.surfaceMuted }}>
                            {["Type", "Memo", "Date", "Payment", "Interest paid", "Principal paid", "% to principal", "Outstanding principal", "Outstanding interest", "Total outstanding balance"].map((heading) => (
                              <th
                                key={heading}
                                style={{
                                  padding: "10px 8px",
                                  borderBottom: `1px solid ${currentTheme.cardBorder}`,
                                  fontSize: 14,
                                  textAlign: "left",
                                  color: currentTheme.textMuted,
                                }}
                              >
                                {heading === "Type" ? <TypeHeader /> : heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {whatIfProjection.rows.map((row) => (
                            <tr key={row.rowId} style={getTableRowStyle(row)}>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }} title={getEventTypeTitle(row.eventType)}>{getEventTypeCode(row.eventType)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{row.label}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }}>{toDateInputValue(row.paymentDate)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.paymentAmount)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                <div>{formatCurrency(row.interestPaid)}</div>
                                {row.eventType === "paused" && row.accruedInterest > 0 ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>
                                    Accrued {formatCurrency(row.accruedInterest)}
                                  </div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.principalPaid)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                {row.negativeAmortization ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>Negative amortization</div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingInterest)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal + row.endingInterest)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
            </div>
          </div>
        </main>
        )}
        {deleteAccountConfirmOpen ? (
          <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteAccountConfirmOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(15, 23, 42, 0.58)" }}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" style={{ width: "min(460px, 100%)", display: "grid", gap: 18, padding: 24, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 18, background: currentTheme.surface, boxShadow: "0 28px 70px rgba(15, 23, 42, 0.3)" }}>
              <div style={{ display: "grid", gap: 8 }}>
                <h2 id="delete-account-title" style={{ margin: 0, fontSize: 22 }}>Delete your account?</h2>
                <p style={{ margin: 0, color: currentTheme.textMuted, lineHeight: 1.6 }}>This permanently deletes your profile, saved loans, and paycheck plans. This action is irreversible.</p>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setDeleteAccountConfirmOpen(false)} style={{ border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button type="button" onClick={() => void deleteCurrentUserProfile()} style={{ border: "1px solid #dc2626", background: "#dc2626", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Delete account</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}



