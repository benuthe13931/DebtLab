import { formatMonth } from "../calculations/loans/dateUtils";
import type { PausePeriod } from "../types/loans";

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(n) ? n : 0);
}

export function formatPercent(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function formatMonthYear(date: Date | null): string {
  if (!date) return "-";
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export function formatDurationToPayoff(date: Date | null, fromDate: Date | null): string {
  if (!date || !fromDate || date <= fromDate) return "-";
  const totalMonths = (date.getFullYear() - fromDate.getFullYear()) * 12 + date.getMonth() - fromDate.getMonth();
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const yearLabel = years > 0 ? `${years} year${years === 1 ? "" : "s"}` : "";
  const monthLabel = months > 0 ? `${months} month${months === 1 ? "" : "s"}` : "";
  return [yearLabel, monthLabel].filter(Boolean).join(", ") || "Less than 1 month";
}

export function formatTimeShaved(deltaMonths: number): string {
  if (deltaMonths === 0) return "None";
  const absoluteMonths = Math.abs(deltaMonths);
  const years = Math.floor(absoluteMonths / 12);
  const months = absoluteMonths % 12;
  const yearLabel = years > 0 ? `${years} year${years === 1 ? "" : "s"}` : "";
  const monthLabel = months > 0 ? `${months} month${months === 1 ? "" : "s"}` : "";
  const value = [yearLabel, monthLabel].filter(Boolean).join(", ") || "0 months";
  return deltaMonths > 0 ? value : `${value} added`;
}

export function formatPauseRange(pausePeriod: PausePeriod): string {
  return `${formatMonth(pausePeriod.startMonth)} to ${formatMonth(pausePeriod.endMonth)}`;
}

export function getDifferenceLabel(params: { negative: string; positive: string; value: number; zero?: string }) {
  if (params.value < 0) return params.negative;
  if (params.value > 0) return params.positive;
  return params.zero ?? params.positive;
}
