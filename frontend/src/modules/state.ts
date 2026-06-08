import type { AppState, DebtType, ModelAdvice, ParsedStatementDocument, PaymentRecord, ReconciliationItem, SimulationResult, SnapshotRecord, UserProfile } from '../types';
import type { TabId, AccountAreaTab, ThemeChoice, AuthMode, PaymentDraft, AccountDraft, ParsedAccountDraft, ProjectionDateDraft, QuickPayDraft, QuickPayCalendarState, PaymentEditDraft, InlineGroupEditorState, DeletedDebtState } from './types';
import { SESSION_STORAGE_KEY } from './config';

type PlannerResponse = AppState & {
  simulation: SimulationResult;
  snapshots: SnapshotRecord[];
  reconciliation: ReconciliationItem[];
  payments: PaymentRecord[];
  modelAdvice: ModelAdvice[];
};

export const createEmptyAccountDraft = (): AccountDraft => ({
  name: '',
  groupName: '',
  debtType: 'other',
  startingBalance: '',
  balance: '',
  minimumPayment: '',
  apr: '',
  dueDay: '15',
  interestMethodChoice: 'daily',
  promoApr: '',
  promoEndDate: '',
  deferredInterest: false,
  notes: '',
});

export const state: {
  planner: PlannerResponse | null;
  activeTab: TabId;
  selectedAccountId: string | null;
  loading: boolean;
  saving: boolean;
  parsing: boolean;
  error: string | null;
  parseError: string | null;
  overviewQuoteIndex: number;
  accountQuoteIndex: number;
  importDraft: string;
  paymentDrafts: PaymentDraft[];
  parsedStatement: ParsedStatementDocument | null;
  parsedMappings: Record<string, string>;
  parsedSelections: Record<string, boolean>;
  parsedAccountDrafts: Record<string, ParsedAccountDraft>;
  parsedCursor: number;
  statementTargetDebtId: string | null;
  accountTypeFilter: 'all' | DebtType | `group:${string}`;
  accountProjectionDate: string;
  projectionDateDraft: ProjectionDateDraft;
  quickPayDrafts: Record<string, QuickPayDraft>;
  quickPayCalendar: QuickPayCalendarState;
  editingPaymentId: string | null;
  editingPaymentDraft: PaymentEditDraft;
  showFocusExplanation: boolean;
  editingBudget: boolean;
  showAccountCreator: boolean;
  accountDraft: AccountDraft;
  draftGroupMode: 'existing' | 'new';
  draftGroupSelection: string;
  deletedDebt: DeletedDebtState | null;
  deleteConfirmDebtId: string | null;
  theme: ThemeChoice;
  inlineGroupEditor: InlineGroupEditorState;
  sessionToken: string | null;
  currentUser: UserProfile | null;
  authMode: AuthMode;
  accountAreaTab: AccountAreaTab;
  profileMenuOpen: boolean;
  accountInfoViewMode: 'advice' | 'payments';
  authDraft: {
    displayName: string;
    email: string;
    password: string;
  };
} = {
  planner: null,
  activeTab: 'overview',
  selectedAccountId: null,
  loading: true,
  saving: false,
  parsing: false,
  error: null,
  parseError: null,
  overviewQuoteIndex: 0,
  accountQuoteIndex: 0,
  importDraft: '',
  paymentDrafts: [
    { id: Math.random().toString(36).slice(2, 10), debtId: '', paymentDate: new Date().toISOString().slice(0, 10), amount: '', note: '' },
  ],
  parsedStatement: null,
  parsedMappings: {},
  parsedSelections: {},
  parsedAccountDrafts: {},
  parsedCursor: 0,
  statementTargetDebtId: null,
  accountTypeFilter: 'all',
  accountProjectionDate: new Date().toISOString().slice(0, 10),
  projectionDateDraft: {
    selectedDebtId: null,
    value: new Date().toISOString().slice(0, 10),
  },
  quickPayDrafts: {},
  quickPayCalendar: {
    debtId: null,
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
  },
  editingPaymentId: null,
  editingPaymentDraft: {
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: '',
    note: '',
  },
  showFocusExplanation: false,
  editingBudget: false,
  showAccountCreator: false,
  accountDraft: createEmptyAccountDraft(),
  draftGroupMode: 'existing',
  draftGroupSelection: '',
  deletedDebt: null,
  deleteConfirmDebtId: null,
  theme: 'ocean',
  inlineGroupEditor: {
    mode: null,
    debtId: null,
    value: '',
  },
  sessionToken: window.localStorage.getItem(SESSION_STORAGE_KEY),
  currentUser: null,
  authMode: 'login',
  accountAreaTab: 'info',
  profileMenuOpen: false,
  accountInfoViewMode: 'advice',
  authDraft: {
    displayName: '',
    email: '',
    password: '',
  },
};