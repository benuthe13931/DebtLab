import type { AppState } from './types';

const today = new Date();

const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  .toISOString()
  .slice(0, 10);

const monthsFromNow = (months: number) =>
  new Date(today.getFullYear(), today.getMonth() + months, 15)
    .toISOString()
    .slice(0, 10);

export const defaultState: AppState = {
  settings: {
    monthlyBudgetCents: 195000,
    strategy: 'hybrid',
    startDate: monthStart,
    theme: 'ocean',
  },
  debts: [
    {
      id: 'chase-freedom',
      name: 'Chase Freedom Unlimited',
      groupName: null,
      debtType: 'credit_card',
      startingBalanceCents: 418240,
      balanceCents: 418240,
      minimumPaymentCents: 9500,
      aprBps: 2999,
      dueDay: 21,
      interestMethod: 'daily',
      balancePresentation: 'capitalized_balance',
      notes: 'High APR revolving debt.',
    },
    {
      id: 'best-buy',
      name: 'Best Buy Card',
      groupName: null,
      debtType: 'credit_card',
      startingBalanceCents: 146500,
      balanceCents: 146500,
      minimumPaymentCents: 4500,
      aprBps: 3199,
      dueDay: 11,
      interestMethod: 'daily',
      balancePresentation: 'capitalized_balance',
      notes: 'Store card with painful APR.',
    },
    {
      id: 'chase-ink',
      name: 'Chase Ink Promo',
      groupName: null,
      debtType: 'credit_card',
      startingBalanceCents: 540000,
      balanceCents: 540000,
      minimumPaymentCents: 12000,
      aprBps: 2499,
      dueDay: 27,
      interestMethod: 'daily',
      balancePresentation: 'capitalized_balance',
      promoAprBps: 0,
      promoEndDate: monthsFromNow(8),
      notes: '0% promo that should not crowd out high-interest debt too early.',
    },
    {
      id: 'care-credit',
      name: 'CareCredit Deferred',
      groupName: null,
      debtType: 'medical',
      startingBalanceCents: 182400,
      balanceCents: 182400,
      minimumPaymentCents: 3500,
      aprBps: 2699,
      dueDay: 5,
      interestMethod: 'daily',
      balancePresentation: 'capitalized_balance',
      promoAprBps: 0,
      promoEndDate: monthsFromNow(5),
      deferredInterest: true,
      notes: 'Needs payoff by the promo deadline.',
    },
    {
      id: 'student-loan',
      name: 'Student Loan',
      groupName: 'Student Loans',
      debtType: 'education',
      startingBalanceCents: 982500,
      balanceCents: 982500,
      minimumPaymentCents: 11400,
      aprBps: 625,
      dueDay: 14,
      interestMethod: 'daily',
      balancePresentation: 'capitalized_balance',
      notes: 'Lower APR installment debt.',
    },
  ],
};
