export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function compareDateOnly(a: Date, b: Date): number {
  const aTime = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bTime = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  if (aTime === bTime) return 0;
  return aTime < bTime ? -1 : 1;
}

export function parseMonthInput(value: string): Date | null {
  if (!value) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

export function normalizeDateDraftInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 8);
  if (digitsOnly.length <= 4) return digitsOnly;
  if (digitsOnly.length <= 6) return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4)}`;
  return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6)}`;
}

export function monthValue(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}
