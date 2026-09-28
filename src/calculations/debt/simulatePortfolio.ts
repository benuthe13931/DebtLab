export type PortfolioStrategy = "avalanche" | "snowball" | "minimum";

export type PortfolioLoan = {
  apr: number;
  balance: number;
  id: string;
  minimum: number;
  name: string;
};

export type PortfolioSnapshot = {
  date: Date;
  balances: Record<string, number>;
};

export type PortfolioResult = {
  negativeAmortization: boolean;
  months: number;
  payoffDate: Date | null;
  snapshots: PortfolioSnapshot[];
  startingTotal: number;
  totalInterest: number;
};

export function simulatePortfolio(
  loans: PortfolioLoan[],
  strategy: PortfolioStrategy,
  extra: number,
): PortfolioResult {
  const balances = new Map(loans.map((loan) => [loan.id, loan.balance]));
  const startingTotal = loans.reduce((sum, loan) => sum + loan.balance, 0);
  const fixedBudget = loans.reduce((sum, loan) => sum + loan.minimum, 0) + (strategy === "minimum" ? 0 : extra);
  const snapshots: PortfolioSnapshot[] = [];
  let totalInterest = 0;
  let month = 0;
  let negativeAmortization = false;

  while ([...balances.values()].some((balance) => balance > 0.005) && month < 1200) {
    month += 1;
    const balancesBeforeInterest = new Map(balances);
    for (const loan of loans) {
      const balance = balances.get(loan.id) ?? 0;
      if (balance <= 0) continue;
      const interest = balance * loan.apr / 100 / 12;
      balances.set(loan.id, balance + interest);
      totalInterest += interest;
    }
    let spent = 0;
    for (const loan of loans) {
      const balance = balances.get(loan.id) ?? 0;
      const payment = Math.min(balance, loan.minimum);
      balances.set(loan.id, balance - payment);
      spent += payment;
    }
    if (strategy !== "minimum") {
      let remaining = Math.max(0, fixedBudget - spent);
      const ordered = [...loans].sort((a, b) => strategy === "avalanche"
        ? b.apr - a.apr || a.balance - b.balance
        : (balances.get(a.id) ?? 0) - (balances.get(b.id) ?? 0) || b.apr - a.apr);
      for (const loan of ordered) {
        const balance = balances.get(loan.id) ?? 0;
        const payment = Math.min(balance, remaining);
        balances.set(loan.id, balance - payment);
        remaining -= payment;
        if (remaining <= 0.005) break;
      }
    }
    for (const loan of loans) {
      if ((balances.get(loan.id) ?? 0) > (balancesBeforeInterest.get(loan.id) ?? 0) + 0.005) {
        negativeAmortization = true;
      }
    }
    if (month <= 12) {
      snapshots.push({
        date: new Date(new Date().getFullYear(), new Date().getMonth() + month, 1),
        balances: Object.fromEntries(balances),
      });
    }
  }

  const payoffDate = month >= 1200 ? null : new Date(new Date().getFullYear(), new Date().getMonth() + month, 1);
  return { negativeAmortization, payoffDate, months: month, snapshots, startingTotal, totalInterest };
}
