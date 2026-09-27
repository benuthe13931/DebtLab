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