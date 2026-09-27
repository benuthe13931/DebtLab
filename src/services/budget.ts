export type BudgetBill = {
  amount: number;
  category: string;
  id: string;
  name: string;
};

type PayScenario = {
  incomeType?: string;
  inputs?: { annualSalary?: number };
  hourlyRate?: number;
  hoursPerWeek?: number;
};

const asFiniteAmount = (value: unknown) => {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

export function loadBudgetBills(userId: string): BudgetBill[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(`loan-sim:budget:${userId}`) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((bill): bill is BudgetBill => Boolean(bill && typeof bill === "object" && typeof (bill as BudgetBill).id === "string" && typeof (bill as BudgetBill).name === "string" && typeof (bill as BudgetBill).category === "string" && asFiniteAmount((bill as BudgetBill).amount) > 0)).map((bill) => ({ ...bill, amount: asFiniteAmount(bill.amount) }));
  } catch {
    return [];
  }
}

export function saveBudgetBills(userId: string, bills: BudgetBill[]) {
  localStorage.setItem(`loan-sim:budget:${userId}`, JSON.stringify(bills));
}

export function estimateMonthlyIncome(userId: string): number {
  try {
    const saved = JSON.parse(localStorage.getItem(`loan-sim:paycheck-scenarios:${userId}`) ?? "null") as { scenarios?: PayScenario[] } | null;
    return (saved?.scenarios ?? []).reduce((sum, scenario) => {
      const annual = scenario.incomeType === "hourly"
        ? (scenario.hourlyRate ?? 0) * (scenario.hoursPerWeek ?? 0) * 52
        : (scenario.inputs?.annualSalary ?? 0);
      return sum + (Number.isFinite(annual) ? annual / 12 : 0);
    }, 0);
  } catch {
    return 0;
  }
}

export function totalBudgetBills(bills: BudgetBill[]) {
  return bills.reduce((sum, bill) => sum + asFiniteAmount(bill.amount), 0);
}
