import type { DebtInput, PlannerResponse } from '../../types';

export const getGroupSummaries = (planner: PlannerResponse) =>
  [...planner.debts.reduce((map, debt) => {
    if (!debt.groupName) {
      return map;
    }

    const current = map.get(debt.groupName) ?? {
      groupName: debt.groupName,
      totalBalanceCents: 0,
      totalMinimumPaymentCents: 0,
      debtTypes: new Set<string>(),
      count: 0,
    };

    current.totalBalanceCents += debt.balanceCents;
    current.totalMinimumPaymentCents += debt.minimumPaymentCents;
    current.debtTypes.add(debt.debtType);
    current.count += 1;
    map.set(debt.groupName, current);
    return map;
  }, new Map<string, { groupName: string; totalBalanceCents: number; totalMinimumPaymentCents: number; debtTypes: Set<string>; count: number }>()).values()];

export const getExistingGroups = (planner: PlannerResponse) =>
  [...new Set(planner.debts.map((debt) => debt.groupName).filter((groupName): groupName is string => Boolean(groupName)))].sort();

export const getDebtTypeSummaries = (planner: PlannerResponse) =>
  [...planner.debts.reduce((map, debt) => {
    const current = map.get(debt.debtType) ?? {
      debtType: debt.debtType,
      totalBalanceCents: 0,
      totalMinimumPaymentCents: 0,
      count: 0,
    };
    current.totalBalanceCents += debt.balanceCents;
    current.totalMinimumPaymentCents += debt.minimumPaymentCents;
    current.count += 1;
    map.set(debt.debtType, current);
    return map;
  }, new Map<DebtInput['debtType'], { debtType: DebtInput['debtType']; totalBalanceCents: number; totalMinimumPaymentCents: number; count: number }>()).values()];
