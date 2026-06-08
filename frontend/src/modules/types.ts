import type { DebtInput, DebtType } from '../types';

export type TabId =
  | 'overview'
  | 'accounts'
  | 'projections'
  | 'payments'
  | 'schedule'
  | 'reconciliation'
  | 'methodology'
  | 'resources'
  | 'account';

export type AccountAreaTab = 'info' | 'settings';
export type AccrualChoice = DebtInput['interestMethod'] | 'help';
export type FilterMode = 'all' | DebtType | `group:${string}`;
export type ThemeChoice = 'ocean' | 'stone' | 'meadow' | 'sunrise' | 'light';
export type AuthMode = 'login' | 'register';

export type PaymentDraft = {
  id: string;
  debtId: string;
  paymentDate: string;
  amount: string;
  note: string;
};

export type AccountDraft = {
  name: string;
  groupName: string;
  debtType: DebtType;
  startingBalance: string;
  balance: string;
  minimumPayment: string;
  apr: string;
  dueDay: string;
  interestMethodChoice: AccrualChoice;
  promoApr: string;
  promoEndDate: string;
  deferredInterest: boolean;
  notes: string;
};

export type ParsedAccountDraft = {
  name: string;
  groupName: string;
  debtType: DebtType;
  startingBalance: string;
  balance: string;
  minimumPayment: string;
  apr: string;
  aprMissing: boolean;
  dueDay: string;
  interestMethod: DebtInput['interestMethod'];
  promoApr: string;
  promoEndDate: string;
  deferredInterest: boolean;
  notes: string;
};

export type ProjectionDateDraft = {
  selectedDebtId: string | null;
  value: string;
};

export type QuickPayDraft = {
  paymentDate: string;
  customAmount: string;
};

export type QuickPayCalendarState = {
  debtId: string | null;
  viewYear: number;
  viewMonth: number;
};

export type PaymentEditDraft = {
  paymentDate: string;
  amount: string;
  note: string;
};

export type InlineGroupEditorState = {
  mode: 'detail' | 'create' | null;
  debtId: string | null;
  value: string;
};

export type DeletedDebtState = {
  debt: DebtInput;
  userId: string;
};