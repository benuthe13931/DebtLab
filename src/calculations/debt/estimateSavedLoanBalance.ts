export type SavedLoanBalanceInput = {
  aprPercent: number;
  additionalMonthlyPayment: number;
  minimumPayment: number;
  oneOffPayments: Array<{ amount: number; date: Date | null }>;
  startingPrincipal: number;
  startingPrincipalDate: Date | null;
  targetDate: Date | null;
};

export function estimateSavedLoanBalance(input: SavedLoanBalanceInput): number {
  let balance = input.startingPrincipal;
  const { startingPrincipalDate, targetDate } = input;
  if (!startingPrincipalDate || !targetDate || targetDate <= startingPrincipalDate) return balance;

  const payment = input.minimumPayment + input.additionalMonthlyPayment;
  const months = Math.max(
    0,
    (targetDate.getFullYear() - startingPrincipalDate.getFullYear()) * 12 +
      targetDate.getMonth() - startingPrincipalDate.getMonth(),
  );
  for (let month = 0; month < months && balance > 0; month += 1) {
    balance = Math.max(0, balance + balance * input.aprPercent / 100 / 12 - payment);
  }
  const oneOffPaid = input.oneOffPayments.reduce(
    (sum, item) => sum + (item.date && item.date <= targetDate ? item.amount : 0),
    0,
  );
  return Math.max(0, balance - oneOffPaid);
}