export type DayCountBasis = "365" | "actual-year";

export type PauseMode = "accrues" | "paused";

export type PausePeriod = {
  endMonth: Date;
  id: string;
  mode: PauseMode;
  startMonth: Date;
};

export type PaymentEvent = {
  amount: number;
  date: Date;
  feeAmount?: number;
  id?: string;
  interestAmount?: number;
  label: string;
  principalAmount?: number;
  rawRow?: Record<string, string>;
  source: "history" | "extra";
};

export type FutureRecurringChange = {
  amount: number;
  effectiveDate: Date;
  endDate?: Date;
  id: string;
  kind: "minimum" | "monthly-extra";
};

export type DueDayChange = {
  day: number;
  endMonth?: Date;
  id: string;
  startMonth: Date;
};

export type ScheduleRow = {
  accruedInterest: number;
  cycle: number | null;
  daysAccrued: number;
  endingInterest: number;
  endingPrincipal: number;
  eventType: "scheduled" | "history" | "extra" | "paused" | "snapshot";
  interestPaid: number;
  label: string;
  negativeAmortization: boolean;
  paymentAmount: number;
  paymentDate: Date;
  principalShareOfPayment: number | null;
  principalPaid: number;
  rowId: string;
  startingInterest: number;
  startingPrincipal: number;
  totalInterestBeforePayment: number;
};

export type ScheduleResult = {
  currentInterest: number;
  currentPrincipal: number;
  errors: string[];
  paidOff: boolean;
  payoffDate: Date | null;
  rows: ScheduleRow[];
  hasNegativeAmortization: boolean;
  totalBalance: number;
  totalInterestPaid: number;
  totalPaid: number;
  totalPrincipalPaid: number;
};

export type ScheduledMode = "always" | "after-cutoff" | "never";
export type SerializedPaymentEvent = Omit<PaymentEvent, "date"> & {
  date: string;
};

export type SerializedFutureRecurringChange = Omit<FutureRecurringChange, "effectiveDate" | "endDate"> & {
  effectiveDate: string;
  endDate?: string;
};

export type SerializedPausePeriod = Omit<PausePeriod, "endMonth" | "startMonth"> & {
  endMonth: string;
  startMonth: string;
};

export type SerializedDueDayChange = Omit<DueDayChange, "endMonth" | "startMonth"> & {
  endMonth?: string;
  startMonth: string;
};

export type LoanSnapshot = {
  accountType?: "loan" | "credit-card";
  cardMinimumMode?: "percent" | "fixed";
  cardMinimumPercent?: string;
  cardMinimumFloor?: string;
  postPromoMinimumMode?: "percent" | "fixed";
  postPromoMinimumPercent?: string;
  postPromoMinimumFloor?: string;
  postPromoFixedMinimum?: string;
  cardStatementDate?: string;
  creditCardTransactions?: SerializedPaymentEvent[];
  activeView: "assumed" | "history" | "whatif";
  additionalMonthlyPayment: string;
  aprPercent: string;
  dayCountBasis: DayCountBasis;
  deletedHelperRowIds: string[];
  dueDay: string;
  editingPaymentAmount: string;
  editingPaymentDate: string;
  editingPaymentId: string;
  editingPaymentLabel: string;
  firstPaymentDate: string;
  helperActionError: string;
  helperAdjustmentAmount: string;
  helperAdjustmentDueDay: string;
  helperAdjustmentFromMonth: string;
  helperAdjustmentToMonth: string;
  helperBulkMode: "pause" | "monthly-extra" | "minimum" | "due-day";
  helperDueDayChanges: SerializedDueDayChange[];
  helperPauseFromMonth: string;
  helperPauseMode: PauseMode;
  helperPausePeriods: SerializedPausePeriod[];
  helperPauseToMonth: string;
  helperPaymentAmountOverrides: Record<string, string>;
  helperRecurringChanges: SerializedFutureRecurringChange[];
  loanName: string;
  minimumPayment: string;
  moveWeekend: boolean;
  newOneOffAmount: string;
  newOneOffDate: string;
  newOneOffLabel: string;
  newWhatIfAmount: string;
  newWhatIfDate: string;
  newWhatIfLabel: string;
  oneOffPayments: SerializedPaymentEvent[];
  overviewBalance?: number;
  overviewOriginalBalance?: number;
  promoType?: "none" | "zero" | "deferred";
  promoEndDate?: string;
  paymentDateOverrides: Record<string, string>;
  paymentLabelOverrides: Record<string, string>;
  roundDailyInterest: boolean;
  showAmortization: boolean;
  showComparisonDetails: boolean;
  showFutureDetails: boolean;
  showHelperAmortization: boolean;
  showHistoricalDetails: boolean;
  showLifetimeDetails: boolean;
  startingPrincipal: string;
  startingPrincipalDate: string;
  targetDate: string;
  whatIfActionError: string;
  whatIfAdjustmentAmount: string;
  whatIfAdjustmentDate: string;
  whatIfAdjustmentDueDay: string;
  whatIfAdjustmentEndDate: string;
  whatIfDueDayChanges: SerializedDueDayChange[];
  whatIfEntryMode: "minimum" | "monthly-extra" | "one-time" | "pause" | "due-day";
  whatIfPauseFromMonth: string;
  whatIfPauseMode: PauseMode;
  whatIfPausePeriods: SerializedPausePeriod[];
  whatIfPauseToMonth: string;
  whatIfPayments: SerializedPaymentEvent[];
  whatIfRecurringChanges: SerializedFutureRecurringChange[];
};

export type SavedLoanRecord = {
  data: LoanSnapshot;
  id: string;
  name: string;
};

