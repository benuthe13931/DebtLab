export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}