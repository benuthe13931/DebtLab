export type Strategy = 'hybrid' | 'avalanche' | 'snowball';

export type InterestMethod = 'daily' | 'monthly';

export type BalancePresentationMethod =
  | 'capitalized_balance'
  | 'principal_plus_accrued_interest';

export type DebtType =
  | 'credit_card'
  | 'education'
  | 'auto'
  | 'mortgage'
  | 'personal_loan'
  | 'medical'
  | 'collection'
  | 'other';

export interface DebtInput {
  id: string;
  name: string;
  groupName: string | null;
  debtType: DebtType;
  startingBalanceCents: number;
  balanceCents: number;
  minimumPaymentCents: number;
  aprBps: number;
  dueDay: number;
  interestMethod: InterestMethod;
  balancePresentation: BalancePresentationMethod;
  promoAprBps?: number;
  promoEndDate?: string;
  deferredInterest?: boolean;
  notes?: string;
}

export interface PlannerSettings {
  monthlyBudgetCents: number;
  strategy: Strategy;
  startDate: string;
  theme: string;
}

export interface AppState {
  debts: DebtInput[];
  settings: PlannerSettings;
}

export interface SnapshotRecord {
  id: string;
  debtId: string;
  snapshotDate: string;
  balanceCents: number;
  principalBalanceCents: number | null;
  accruedInterestCents: number | null;
  interestChargedCents: number | null;
  minimumDueCents: number | null;
  sourceNote: string;
}

export interface PaymentRecord {
  id: string;
  debtId: string;
  paymentDate: string;
  amountCents: number;
  note: string;
}

export interface DebtMonthResult {
  debtId: string;
  name: string;
  startingBalanceCents: number;
  paymentCents: number;
  interestCents: number;
  endingBalanceCents: number;
  aprLabel: string;
  note?: string;
}

export interface MonthResult {
  monthKey: string;
  label: string;
  totalPaymentCents: number;
  totalInterestCents: number;
  totalBalanceCents: number;
  focusDebtId?: string;
  focusDebtName?: string;
  items: DebtMonthResult[];
}

export interface SimulationResult {
  months: MonthResult[];
  warnings: string[];
  totalInterestCents: number;
  totalPaidCents: number;
  debtFreeDate?: string;
  monthsToPayoff: number;
  focusSequence: string[];
  completed: boolean;
}

export interface ReconciliationItem {
  snapshotId: string;
  debtId: string;
  debtName: string;
  snapshotDate: string;
  monthKey: string;
  observedBalanceCents: number;
  simulatedBalanceCents: number | null;
  balanceDriftCents: number | null;
  observedInterestCents: number | null;
  simulatedInterestCents: number | null;
  interestDriftCents: number | null;
  status: 'aligned' | 'drift' | 'missing-simulation';
  sourceNote: string;
}

export interface ModelAdvice {
  debtId: string;
  debtName: string;
  recommendationReady: boolean;
  recommendedInterestMethod?: InterestMethod;
  recommendedBalancePresentation?: BalancePresentationMethod;
  confidence: 'low' | 'medium' | 'high';
  message: string;
}

export interface ParsedStatementEntry {
  entryId: string;
  sourceDocumentName: string;
  accountLabel: string;
  debtType: DebtType | null;
  accountNumberHint: string | null;
  snapshotDate: string | null;
  balanceCents: number | null;
  principalBalanceCents: number | null;
  accruedInterestCents: number | null;
  interestChargedCents: number | null;
  minimumDueCents: number | null;
  aprBps: number | null;
  confidence: 'low' | 'medium' | 'high';
  matchedDebtId: string | null;
  sourceExcerpt: string;
}

export interface ParsedStatementDocument {
  documentName: string;
  issuerHint: string | null;
  statementDate: string | null;
  entries: ParsedStatementEntry[];
  warnings: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

export type PlannerResponse = AppState & {
  simulation: SimulationResult;
  snapshots: SnapshotRecord[];
  reconciliation: ReconciliationItem[];
  payments: PaymentRecord[];
  modelAdvice: ModelAdvice[];
};
