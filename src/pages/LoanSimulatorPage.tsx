import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { PaycheckPage } from "./PaycheckPage";
import { DateField, DatePickerInput, MonthYearField } from "../components/ui/date-fields";
import { FormSection, SummaryGroupLabel, SummaryValue } from "../components/ui/summary";
import { LoanSidebar } from "../components/loans/LoanSidebar";
import { CreditCardActivityEditor } from "../components/loans/CreditCardActivityEditor";
import { CurrencyField, CurrencyInput } from "../components/ui/CurrencyField";
import { Field } from "../components/ui/Field";
import { LoginPage } from "./LoginPage";
import { estimateSavedLoanBalance, estimateSavedAccountMinimum } from "../calculations/debt/savedAccount";
import { simulatePortfolio, type PortfolioStrategy } from "../calculations/debt/simulatePortfolio";
import { accrueInterest } from "../calculations/loans/accrueInterest";
import { addMonths, clampToMonth, formatMonth, parseDate, toDateInputValue } from "../calculations/loans/dateUtils";
import { buildSchedule, getNextScheduledPaymentDate } from "../calculations/loans/schedule";
import { buildCreditCardSchedule } from "../calculations/cards/buildCreditCardSchedule";
import { estimateMonthlyIncome, loadBudgetBills, saveBudgetBills, totalBudgetBills, type BudgetBill } from "../services/budget";
import {
  cloudStorageEnabled,
  cloudStorageStatus,
  createCloudProfile,
  deleteCloudProfileData,
  getCloudSessionProfile,
  loadCloudLoans,
  loginCloudProfile,
  logoutCloudProfile,
  sendCloudPasswordResetEmail,
  saveCloudLoans,
  saveCloudProfile,
} from "../lib/cloudStorage";
import type {
  DayCountBasis,
  DueDayChange,
  FutureRecurringChange,
  LoanSnapshot,
  SavedLoanRecord,
  SerializedDueDayChange,
  SerializedFutureRecurringChange,
  SerializedPausePeriod,
  SerializedPaymentEvent,
  PaymentEvent,
  PauseMode,
  PausePeriod,
  ScheduleRow,
} from "../types/loans";
import { parseCurrency } from "../utils/currency";
import { compareDateOnly, monthValue, parseMonthInput, startOfDay } from "../utils/date";
import { formatCurrency, formatDurationToPayoff, formatMonthYear, formatPauseRange, formatPercent, formatTimeShaved, getDifferenceLabel } from "../utils/formatting";
import { THEME_DEFINITIONS, type ThemeDefinition, type ThemeId } from "../constants/theme";

function pausePeriodsOverlap(left: PausePeriod, right: PausePeriod): boolean {
  return monthValue(left.startMonth) <= monthValue(right.endMonth) && monthValue(right.startMonth) <= monthValue(left.endMonth);
}

const SAVED_LOANS_STORAGE_KEY = "loan-sim:saved-loans";
const USER_PROFILES_STORAGE_KEY = "loan-sim:user-profiles";
const CURRENT_USER_STORAGE_KEY = "loan-sim:current-user";

type UserProfile = {
  displayName: string;
  email: string;
  id: string;
  name: string;
  password: string;
  passwordResetCode?: string;
  passwordResetIssuedAt?: string;
  themeId: ThemeId;
};

const asThemeId = (themeId: string | undefined): ThemeId =>
  themeId === "forest" || themeId === "sunset" || themeId === "midnight" || themeId === "rose" || themeId === "slate"
    ? themeId
    : "sky";

const normalizeProfile = (profile: UserProfile): UserProfile => ({
  ...profile,
  themeId: asThemeId(profile.themeId),
});

function DebtOverview({ loans, theme, userId }: { loans: SavedLoanRecord[]; theme: ThemeDefinition; userId: string }) {
  const [extraPayment, setExtraPayment] = useState("0.00");
  const [strategy, setStrategy] = useState<PortfolioStrategy>("avalanche");
  const budgetKey = `loan-sim:budget:${userId}`;
  const [bills, setBills] = useState<Array<{ id: string; name: string; category: string; amount: number }>>(() => { try { return JSON.parse(localStorage.getItem(budgetKey) ?? "[]") as Array<{ id: string; name: string; category: string; amount: number }>; } catch { return []; } });
  const [billName, setBillName] = useState("");
  const [billCategory, setBillCategory] = useState("Utilities");
  const [billAmount, setBillAmount] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  useEffect(() => { localStorage.setItem(budgetKey, JSON.stringify(bills)); }, [budgetKey, bills]);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(`loan-sim:paycheck-scenarios:${userId}`) ?? "null") as { scenarios?: Array<{ incomeType?: string; inputs?: { annualSalary?: number }; hourlyRate?: number; hoursPerWeek?: number }> } | null; const scenarios = saved?.scenarios ?? []; setMonthlyIncome(scenarios.reduce((sum, s) => sum + (s.incomeType === "hourly" ? (s.hourlyRate ?? 0) * (s.hoursPerWeek ?? 0) * 52 / 12 : (s.inputs?.annualSalary ?? 0) / 12), 0)); } catch { setMonthlyIncome(0); } }, [userId]);
  const portfolioLoans = loans.map((loan) => ({ id: loan.id, name: loan.name, balance: estimateSavedLoanBalance(loan.data), apr: Number(loan.data.aprPercent) || 0, minimum: estimateSavedAccountMinimum(loan.data) })).filter((loan) => loan.balance > 0 && loan.minimum > 0);
  const extra = parseCurrency(extraPayment);
  const results = {
    avalanche: simulatePortfolio(portfolioLoans, "avalanche", extra),
    snowball: simulatePortfolio(portfolioLoans, "snowball", extra),
    minimum: simulatePortfolio(portfolioLoans, "minimum", 0),
  };
  const selected = results[strategy];
  const totalOriginal = loans.reduce((sum, loan) => sum + (loan.data.overviewOriginalBalance ?? parseCurrency(loan.data.startingPrincipal)), 0);
  const progress = totalOriginal > 0 ? Math.max(0, Math.min(100, (1 - selected.startingTotal / totalOriginal) * 100)) : 0;
  return <main style={{ display: "grid", gap: 20 }}>
    <section style={{ background: theme.surface, border: `1px solid ${theme.cardBorder}`, borderRadius: 18, padding: 22, boxShadow: theme.cardShadow, display: "grid", gap: 18 }}><div><h2 style={{ margin: 0 }}>Overall debt plan</h2><p style={{ margin: "6px 0 0", color: theme.textMuted }}>Compare payoff order across every saved loan. Add an extra monthly amount to see how each strategy changes interest and payoff timing.</p></div>{portfolioLoans.length === 0 ? <div style={{ padding: 18, border: `1px dashed ${theme.cardBorder}`, borderRadius: 12, color: theme.textMuted }}>Save at least one loan to build an overall payoff plan.</div> : <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}><SummaryValue label="Remaining debt" value={formatCurrency(selected.startingTotal)} emphasized /><SummaryValue label="Estimated payoff" value={formatMonthYear(selected.payoffDate)} emphasized /><SummaryValue label="Payoff progress" value={formatPercent(progress)} emphasized /></div><div style={{ height: 9, borderRadius: 999, overflow: "hidden", background: theme.surfaceMuted }}><div style={{ width: `${progress}%`, height: "100%", background: theme.accent }} /></div></>}</section>
    {portfolioLoans.length > 0 ? <><section style={{ background: theme.surface, border: `1px solid ${theme.cardBorder}`, borderRadius: 18, padding: 20, boxShadow: theme.cardShadow, display: "grid", gap: 16 }}><div style={{ maxWidth: 280 }}><CurrencyField id="portfolio-extra" label="Extra available for debt each month" value={extraPayment} onChange={setExtraPayment} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>{(["avalanche", "snowball", "minimum"] as const).map((method) => <button key={method} type="button" onClick={() => setStrategy(method)} style={{ border: `1px solid ${strategy === method ? theme.accent : theme.cardBorder}`, borderRadius: 14, padding: 14, background: strategy === method ? theme.accentSoft : theme.surface, color: theme.text, textAlign: "left", cursor: "pointer", display: "grid", gap: 6 }}><strong>{method === "avalanche" ? "Debt avalanche" : method === "snowball" ? "Debt snowball" : "Minimum payments"}</strong><span style={{ fontSize: 12, color: theme.textMuted }}>{method === "avalanche" ? "Highest APR first" : method === "snowball" ? "Smallest balance first" : "No targeted extra payment"}</span><span style={{ fontSize: 13 }}>{formatCurrency(results[method].totalInterest)} interest · {results[method].months} months</span></button>)}</div></section>
    <section style={{ background: theme.surface, border: `1px solid ${theme.cardBorder}`, borderRadius: 18, padding: 20, boxShadow: theme.cardShadow, overflow: "hidden" }}><h3 style={{ margin: "0 0 14px" }}>Loans</h3><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Loan", "Balance", "APR", "Monthly payment", "Priority"].map((heading) => <th key={heading} style={{ padding: 9, textAlign: "left", borderBottom: `1px solid ${theme.cardBorder}`, color: theme.textMuted, fontSize: 12 }}>{heading}</th>)}</tr></thead><tbody>{[...portfolioLoans].sort((a, b) => strategy === "avalanche" ? b.apr - a.apr : strategy === "snowball" ? a.balance - b.balance : 0).map((loan, index) => <tr key={loan.id}><td style={{ padding: 10, borderBottom: `1px solid ${theme.cardBorder}`, fontWeight: 650 }}>{loan.name}</td><td style={{ padding: 10, borderBottom: `1px solid ${theme.cardBorder}` }}>{formatCurrency(loan.balance)}</td><td style={{ padding: 10, borderBottom: `1px solid ${theme.cardBorder}` }}>{formatPercent(loan.apr)}</td><td style={{ padding: 10, borderBottom: `1px solid ${theme.cardBorder}` }}>{formatCurrency(loan.minimum)}</td><td style={{ padding: 10, borderBottom: `1px solid ${theme.cardBorder}` }}>{strategy === "minimum" ? "—" : index + 1}</td></tr>)}</tbody></table></section>
    <section style={{ background: theme.surface, border: `1px solid ${theme.cardBorder}`, borderRadius: 18, padding: 20, boxShadow: theme.cardShadow, overflowX: "auto" }}><h3 style={{ margin: "0 0 14px" }}>Next 12 months</h3><table style={{ borderCollapse: "collapse", minWidth: 980, width: "100%" }}><thead><tr><th style={{ position: "sticky", left: 0, background: theme.surface, padding: 8, textAlign: "left" }}>Loan</th>{selected.snapshots.map((snapshot) => <th key={snapshot.date.toISOString()} style={{ padding: 8, fontSize: 11, color: theme.textMuted }}>{snapshot.date.toLocaleString("en-US", { month: "short", year: "2-digit" })}</th>)}</tr></thead><tbody>{portfolioLoans.map((loan) => <tr key={loan.id}><td style={{ position: "sticky", left: 0, background: theme.surface, padding: 8, fontWeight: 650 }}>{loan.name}</td>{selected.snapshots.map((snapshot) => <td key={snapshot.date.toISOString()} style={{ padding: 8, fontSize: 12, borderTop: `1px solid ${theme.cardBorder}` }}>{formatCurrency(snapshot.balances[loan.id] ?? 0)}</td>)}</tr>)}</tbody></table></section></> : null}
    <section style={{ background: theme.surface, border: `1px solid ${theme.cardBorder}`, borderRadius: 18, padding: 20, boxShadow: theme.cardShadow, display: "none" }}><div><h3 style={{ margin: 0 }}>Monthly budget</h3><p style={{ margin: "5px 0 0", color: theme.textMuted, fontSize: 13 }}>Track recurring bills so the extra amount going to debt reflects real cash flow.</p></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}><input value={billName} onChange={(event) => setBillName(event.target.value)} placeholder="Bill name" style={{ padding: 10, borderRadius: 9, border: `1px solid ${theme.cardBorder}` }} /><input value={billCategory} onChange={(event) => setBillCategory(event.target.value)} placeholder="Category" style={{ padding: 10, borderRadius: 9, border: `1px solid ${theme.cardBorder}` }} /><input type="number" value={billAmount || ""} onChange={(event) => setBillAmount(Number(event.target.value) || 0)} placeholder="Monthly amount" style={{ padding: 10, borderRadius: 9, border: `1px solid ${theme.cardBorder}` }} /><button type="button" onClick={() => { if (!billName.trim() || billAmount <= 0) return; setBills((current) => [...current, { id: crypto.randomUUID(), name: billName.trim(), category: billCategory.trim() || "Other", amount: billAmount }]); setBillName(""); setBillAmount(0); }} style={{ border: 0, borderRadius: 9, background: theme.accent, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Add bill</button></div><div style={{ display: "grid", gap: 7 }}>{bills.map((bill) => <div key={bill.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 11px", borderRadius: 9, background: theme.surfaceMuted }}><span>{bill.name} <small style={{ color: theme.textMuted }}>({bill.category})</small></span><span><strong>{formatCurrency(bill.amount)}</strong> <button type="button" onClick={() => setBills((current) => current.filter((item) => item.id !== bill.id))} style={{ marginLeft: 8, border: 0, background: "transparent", color: "#b91c1c", cursor: "pointer" }}>×</button></span></div>)}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}><SummaryValue label="Estimated monthly income" value={monthlyIncome ? formatCurrency(monthlyIncome) : "Add a pay estimate"} /><SummaryValue label="Monthly bills" value={formatCurrency(bills.reduce((sum, bill) => sum + bill.amount, 0))} /><SummaryValue label="After bills and minimums" value={monthlyIncome ? formatCurrency(monthlyIncome - bills.reduce((sum, bill) => sum + bill.amount, 0) - portfolioLoans.reduce((sum, loan) => sum + loan.minimum, 0)) : "—"} /></div></section>
   </main>;
}

function BudgetPage({ loans, theme, userId, onClose }: { loans: SavedLoanRecord[]; theme: ThemeDefinition; userId: string; onClose: () => void }) {
  const [bills, setBills] = useState<BudgetBill[]>(() => loadBudgetBills(userId));
  const [name, setName] = useState(""); const [category, setCategory] = useState("Utilities"); const [amount, setAmount] = useState(0);
  const income = estimateMonthlyIncome(userId);
  useEffect(() => { saveBudgetBills(userId, bills); }, [userId, bills]);
  const totalBills = totalBudgetBills(bills); const minimums = loans.reduce((sum, loan) => sum + estimateSavedAccountMinimum(loan.data), 0);
  return <main style={{ display: "grid", gap: 20 }}><section style={{ background: theme.surface, border: `1px solid ${theme.cardBorder}`, borderRadius: 18, padding: 22, boxShadow: theme.cardShadow, display: "grid", gap: 18 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><div><h2 style={{ margin: 0 }}>Bills & budget</h2><p style={{ margin: "6px 0 0", color: theme.textMuted }}>Track recurring bills and see what remains after bills and minimum debt payments.</p></div><button type="button" onClick={onClose} aria-label="Close bills and budget" style={{ width: 38, height: 38, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, background: theme.surface, color: theme.text, fontSize: 22, cursor: "pointer" }}>×</button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}><SummaryValue label="Estimated monthly income" value={income ? formatCurrency(income) : "Add a pay estimate"} /><SummaryValue label="Monthly bills" value={formatCurrency(totalBills)} /><SummaryValue label="After bills and minimums" value={income ? formatCurrency(income - totalBills - minimums) : "—"} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bill name" style={{ padding: 10, borderRadius: 9, border: `1px solid ${theme.cardBorder}` }} /><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" style={{ padding: 10, borderRadius: 9, border: `1px solid ${theme.cardBorder}` }} /><input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value) || 0)} placeholder="Monthly amount" style={{ padding: 10, borderRadius: 9, border: `1px solid ${theme.cardBorder}` }} /><button type="button" onClick={() => { if (!name.trim() || amount <= 0) return; setBills((current) => [...current, { id: crypto.randomUUID(), name: name.trim(), category: category.trim() || "Other", amount }]); setName(""); setAmount(0); }} style={{ border: 0, borderRadius: 9, background: theme.accent, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Add bill</button></div><div style={{ display: "grid", gap: 7 }}>{bills.map((bill) => <div key={bill.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 11px", borderRadius: 9, background: theme.surfaceMuted }}><span>{bill.name} <small style={{ color: theme.textMuted }}>({bill.category})</small></span><span><strong>{formatCurrency(bill.amount)}</strong><button type="button" onClick={() => setBills((current) => current.filter((item) => item.id !== bill.id))} style={{ marginLeft: 8, border: 0, background: "transparent", color: "#b91c1c", cursor: "pointer" }}>×</button></span></div>)}</div></section></main>;
}

const footnoteSupStyle = {
  fontSize: 10,
  lineHeight: 1,
  verticalAlign: "super" as const,
  marginLeft: 1,
};

function LabelWithNotes({ text, notes }: { text: string; notes?: number[] }) {
  return (
    <span>
      {text}
      {notes?.map((note) => (
        <sup key={`${text}-${note}`} style={footnoteSupStyle}>
          {note}
        </sup>
      ))}
    </span>
  );
}

function formatPrincipalShare(share: number | null): string {
  if (share === null || !Number.isFinite(share)) {
    return "-";
  }
  return `${Math.max(0, share * 100).toFixed(0)}%`;
}

function getEventTypeCode(eventType: ScheduleRow["eventType"]): string {
  switch (eventType) {
    case "scheduled":
      return "S";
    case "extra":
      return "E";
    case "history":
      return "H";
    case "paused":
      return "P";
    case "snapshot":
      return "A";
    default:
      return "-";
  }
}

function getEventTypeTitle(eventType: ScheduleRow["eventType"]): string {
  switch (eventType) {
    case "scheduled":
      return "Scheduled";
    case "extra":
      return "Extra";
    case "history":
      return "Historical";
    case "paused":
      return "Paused";
    case "snapshot":
      return "As-of snapshot";
    default:
      return eventType;
  }
}

function getTableRowStyle(row: ScheduleRow) {
  if (row.eventType === "paused") {
    return { background: "var(--app-row-paused, #fff7ed)" };
  }
  if (row.negativeAmortization) {
    return { background: "var(--app-row-negative, #fffbeb)" };
  }
  return undefined;
}

export default function LoanInterestSimulatorMockup() {
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "create">("login");
  const [authName, setAuthName] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [activePage, setActivePage] = useState<"overview" | "simulator" | "paycheck" | "budget" | "profile">("simulator");
  const [activeLoanTab, setActiveLoanTab] = useState<"details" | "transactions" | "history" | "whatif">("details");
  const [loanSidebarCollapsed, setLoanSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [deleteAccountConfirmOpen, setDeleteAccountConfirmOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [profileDraftName, setProfileDraftName] = useState("");
  const [profileDraftEmail, setProfileDraftEmail] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [passwordResetCodeInput, setPasswordResetCodeInput] = useState("");
  const [passwordResetNewPassword, setPasswordResetNewPassword] = useState("");
  const [passwordResetConfirmPassword, setPasswordResetConfirmPassword] = useState("");
  const [savedLoans, setSavedLoans] = useState<SavedLoanRecord[]>([]);
  const [currentLoanId, setCurrentLoanId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [loanName, setLoanName] = useState("");
  const [accountType, setAccountType] = useState<"loan" | "credit-card">("loan");
  const [promoType, setPromoType] = useState<"none" | "zero" | "deferred">("none");
  const [promoEndDate, setPromoEndDate] = useState("");
  const [cardMinimumMode, setCardMinimumMode] = useState<"percent" | "fixed">("percent");
  const [cardMinimumPercent, setCardMinimumPercent] = useState("2");
  const [cardMinimumFloor, setCardMinimumFloor] = useState("25");
  const [postPromoMinimumMode, setPostPromoMinimumMode] = useState<"percent" | "fixed">("percent");
  const [postPromoMinimumPercent, setPostPromoMinimumPercent] = useState("2");
  const [postPromoMinimumFloor, setPostPromoMinimumFloor] = useState("25");
  const [postPromoFixedMinimum, setPostPromoFixedMinimum] = useState("");
  const [cardStatementDate, setCardStatementDate] = useState("");
  const [creditCardTransactions, setCreditCardTransactions] = useState<PaymentEvent[]>([]);
  const [startingPrincipal, setStartingPrincipal] = useState("");
  const [startingPrincipalDate, setStartingPrincipalDate] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [additionalMonthlyPayment, setAdditionalMonthlyPayment] = useState("0");
  const [aprPercent, setAprPercent] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [targetDate, setTargetDate] = useState(toDateInputValue(new Date()));
  const [moveWeekend, setMoveWeekend] = useState(false);
  const [roundDailyInterest, setRoundDailyInterest] = useState(false);
  const [dayCountBasis, setDayCountBasis] = useState<DayCountBasis>("actual-year");
  const [activeView, setActiveView] = useState<"assumed" | "history" | "whatif">("assumed");
  const [showAmortization, setShowAmortization] = useState(false);
  const [showHelperAmortization, setShowHelperAmortization] = useState(false);
  const [oneOffPayments, setOneOffPayments] = useState<PaymentEvent[]>([]);
  const [newOneOffDate, setNewOneOffDate] = useState("");
  const [newOneOffAmount, setNewOneOffAmount] = useState("");
  const [newOneOffLabel, setNewOneOffLabel] = useState("Extra payment");
  const [helperPausePeriods, setHelperPausePeriods] = useState<PausePeriod[]>([]);
  const [helperPauseFromMonth, setHelperPauseFromMonth] = useState("");
  const [helperPauseToMonth, setHelperPauseToMonth] = useState("");
  const [helperPauseMode, setHelperPauseMode] = useState<PauseMode>("accrues");
  const [helperBulkMode, setHelperBulkMode] = useState<"pause" | "monthly-extra" | "minimum" | "due-day">("pause");
  const [helperAdjustmentFromMonth, setHelperAdjustmentFromMonth] = useState("");
  const [helperAdjustmentToMonth, setHelperAdjustmentToMonth] = useState("");
  const [helperAdjustmentAmount, setHelperAdjustmentAmount] = useState("");
  const [helperRecurringChanges, setHelperRecurringChanges] = useState<FutureRecurringChange[]>([]);
  const [helperDueDayChanges, setHelperDueDayChanges] = useState<DueDayChange[]>([]);
  const [helperAdjustmentDueDay, setHelperAdjustmentDueDay] = useState("");
  const [deletedHelperRowIds, setDeletedHelperRowIds] = useState<string[]>([]);
  const [helperActionError, setHelperActionError] = useState("");
  const [helperPaymentAmountOverrides, setHelperPaymentAmountOverrides] = useState<Record<string, string>>({});
  const [paymentDateOverrides, setPaymentDateOverrides] = useState<Record<string, string>>({});
  const [paymentLabelOverrides, setPaymentLabelOverrides] = useState<Record<string, string>>({});
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [editingPaymentDate, setEditingPaymentDate] = useState("");
  const [editingPaymentAmount, setEditingPaymentAmount] = useState("");
  const [editingPaymentLabel, setEditingPaymentLabel] = useState("");
  const [whatIfPayments, setWhatIfPayments] = useState<PaymentEvent[]>([]);
  const [whatIfRecurringChanges, setWhatIfRecurringChanges] = useState<FutureRecurringChange[]>([]);
  const [whatIfPausePeriods, setWhatIfPausePeriods] = useState<PausePeriod[]>([]);
  const [whatIfEntryMode, setWhatIfEntryMode] = useState<"minimum" | "monthly-extra" | "one-time" | "pause" | "due-day">("one-time");
  const [newWhatIfDate, setNewWhatIfDate] = useState("");
  const [newWhatIfAmount, setNewWhatIfAmount] = useState("");
  const [newWhatIfLabel, setNewWhatIfLabel] = useState("Anticipated one-time payment");
  const [whatIfAdjustmentDate, setWhatIfAdjustmentDate] = useState("");
  const [whatIfAdjustmentEndDate, setWhatIfAdjustmentEndDate] = useState("");
  const [whatIfAdjustmentAmount, setWhatIfAdjustmentAmount] = useState("");
  const [whatIfAdjustmentDueDay, setWhatIfAdjustmentDueDay] = useState("");
  const [whatIfDueDayChanges, setWhatIfDueDayChanges] = useState<DueDayChange[]>([]);
  const [whatIfPauseFromMonth, setWhatIfPauseFromMonth] = useState("");
  const [whatIfPauseToMonth, setWhatIfPauseToMonth] = useState("");
  const [whatIfPauseMode, setWhatIfPauseMode] = useState<PauseMode>("accrues");
  const [whatIfActionError, setWhatIfActionError] = useState("");
  const [showHistoricalDetails, setShowHistoricalDetails] = useState(false);
  const [showFutureDetails, setShowFutureDetails] = useState(false);
  const [showLifetimeDetails, setShowLifetimeDetails] = useState(false);
  const [showComparisonDetails, setShowComparisonDetails] = useState(false);
  const cardScheduleStart = accountType === "credit-card" ? (cardStatementDate || toDateInputValue(new Date())) : startingPrincipalDate;
  const cardScheduleFirstPayment = (() => {
    if (accountType !== "credit-card") return firstPaymentDate;
    const base = parseDate(cardScheduleStart) ?? new Date();
    const day = Math.min(28, Math.max(1, Number(dueDay) || 1));
    let due = new Date(base.getFullYear(), base.getMonth(), day);
    if (due <= base) due = new Date(base.getFullYear(), base.getMonth() + 1, day);
    return toDateInputValue(due);
  })();
  const cardScheduleTarget = (() => {
    if (accountType !== "credit-card") return targetDate;
    const start = parseDate(cardScheduleStart);
    const target = parseDate(targetDate);
    return start && target && target < start ? cardScheduleStart : targetDate;
  })();
  const deferredStartingPrincipal = useDeferredValue(startingPrincipal);
  const deferredStartingPrincipalDate = useDeferredValue(cardScheduleStart);
  const deferredFirstPaymentDate = useDeferredValue(cardScheduleFirstPayment);
  const deferredMinimumPayment = useDeferredValue(minimumPayment);
  const deferredAdditionalMonthlyPayment = useDeferredValue(additionalMonthlyPayment);
  const deferredAprPercent = useDeferredValue(aprPercent);
  const deferredDueDay = useDeferredValue(dueDay);
  const deferredTargetDate = useDeferredValue(cardScheduleTarget);
  const cardMinimumPayment = accountType === "credit-card"
    ? (cardMinimumMode === "percent"
      ? Math.max(parseCurrency(cardMinimumFloor), parseCurrency(deferredStartingPrincipal) * (Number(cardMinimumPercent) || 0) / 100)
      : parseCurrency(deferredMinimumPayment))
    : parseCurrency(deferredMinimumPayment);
  const cardProjectionNudge = accountType === "credit-card" ? ((Number(postPromoMinimumPercent) || 0) + parseCurrency(postPromoMinimumFloor) + parseCurrency(postPromoFixedMinimum)) / 1_000_000_000 : 0;
  const effectiveMinimumPayment = accountType === "credit-card" ? (cardMinimumPayment + cardProjectionNudge).toFixed(9) : deferredMinimumPayment;
  const totalMonthlyPayment = (parseCurrency(effectiveMinimumPayment) + parseCurrency(deferredAdditionalMonthlyPayment)).toFixed(2);
  const buildProjection = (input: Parameters<typeof buildSchedule>[0]) => accountType === "credit-card"
    ? buildCreditCardSchedule({
      startingPrincipal: input.startingPrincipal,
      startingPrincipalDate: input.startingPrincipalDate,
      targetDate: input.targetDate,
      firstPaymentDate: input.firstPaymentDate,
      dueDay: input.dueDay,
      aprPercent: Number(deferredAprPercent) || 0,
      minimumMode: cardMinimumMode,
      minimumPercent: Number(cardMinimumPercent) || 0,
      minimumFloor: parseCurrency(cardMinimumFloor),
      fixedMinimum: parseCurrency(minimumPayment),
      postPromoMinimumMode,
      postPromoMinimumPercent: Number(postPromoMinimumPercent) || 0,
      postPromoMinimumFloor: parseCurrency(postPromoMinimumFloor),
      postPromoFixedMinimum: parseCurrency(postPromoFixedMinimum),
      extraPayment: parseCurrency(deferredAdditionalMonthlyPayment),
      promoType,
      promoEndDate: promoEndDate ? parseDate(promoEndDate) ?? undefined : undefined,
      transactions: [...creditCardTransactions, ...input.actualPayments],
    })
    : buildSchedule(input);
  const todayDate = startOfDay(new Date());
  const todayValue = toDateInputValue(todayDate);
  const getSavedLoansStorageKey = (userId: string) => `${SAVED_LOANS_STORAGE_KEY}:${userId}`;
  const currentUser = currentUserId ? userProfiles.find((profile) => profile.id === currentUserId) ?? null : null;
  const currentTheme = THEME_DEFINITIONS[currentUser?.themeId ?? "sky"];
  const displayName = currentUser?.displayName || currentUser?.name.split("@")[0] || "User";
  const firstName = displayName.split(/\s+/)[0] || "User";
  const profileInitial = firstName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [profileMenuOpen]);

  const createBlankLoanSnapshot = (): LoanSnapshot => ({
    accountType: "loan",
    cardMinimumMode: "percent",
    cardMinimumPercent: "2",
    cardMinimumFloor: "25",
    postPromoMinimumMode: "percent",
    postPromoMinimumPercent: "2",
    postPromoMinimumFloor: "25",
    postPromoFixedMinimum: "",
    cardStatementDate: "",
    creditCardTransactions: [],
    activeView: "assumed",
    additionalMonthlyPayment: "0",
    aprPercent: "",
    dayCountBasis: "actual-year",
    deletedHelperRowIds: [],
    dueDay: "1",
    editingPaymentAmount: "",
    editingPaymentDate: "",
    editingPaymentId: "",
    editingPaymentLabel: "",
    firstPaymentDate: "",
    helperActionError: "",
    helperAdjustmentAmount: "",
    helperAdjustmentDueDay: "",
    helperAdjustmentFromMonth: "",
    helperAdjustmentToMonth: "",
    helperBulkMode: "pause",
    helperDueDayChanges: [],
    helperPauseFromMonth: "",
    helperPauseMode: "accrues",
    helperPausePeriods: [],
    helperPauseToMonth: "",
    helperPaymentAmountOverrides: {},
    helperRecurringChanges: [],
    loanName: "",
    minimumPayment: "",
    moveWeekend: false,
    newOneOffAmount: "",
    newOneOffDate: "",
    newOneOffLabel: "Extra payment",
    newWhatIfAmount: "",
    newWhatIfDate: "",
    newWhatIfLabel: "Anticipated one-time payment",
    oneOffPayments: [],
    promoType: "none",
    promoEndDate: "",
    paymentDateOverrides: {},
    paymentLabelOverrides: {},
    roundDailyInterest: false,
    showAmortization: false,
    showComparisonDetails: false,
    showFutureDetails: false,
    showHelperAmortization: false,
    showHistoricalDetails: false,
    showLifetimeDetails: false,
    startingPrincipal: "",
    startingPrincipalDate: "",
    targetDate: todayValue,
    whatIfActionError: "",
    whatIfAdjustmentAmount: "",
    whatIfAdjustmentDate: "",
    whatIfAdjustmentDueDay: "",
    whatIfAdjustmentEndDate: "",
    whatIfDueDayChanges: [],
    whatIfEntryMode: "one-time",
    whatIfPauseFromMonth: "",
    whatIfPauseMode: "accrues",
    whatIfPausePeriods: [],
    whatIfPauseToMonth: "",
    whatIfPayments: [],
    whatIfRecurringChanges: [],
  });

  const serializePaymentEvent = (payment: PaymentEvent): SerializedPaymentEvent => ({
    ...payment,
    date: toDateInputValue(payment.date),
  });

  const deserializePaymentEvent = (payment: SerializedPaymentEvent): PaymentEvent => ({
    ...payment,
    date: parseDate(payment.date) ?? todayDate,
  });

  const serializeRecurringChange = (change: FutureRecurringChange): SerializedFutureRecurringChange => ({
    ...change,
    effectiveDate: toDateInputValue(change.effectiveDate),
    endDate: change.endDate ? toDateInputValue(change.endDate) : undefined,
  });

  const deserializeRecurringChange = (change: SerializedFutureRecurringChange): FutureRecurringChange => ({
    ...change,
    effectiveDate: parseDate(change.effectiveDate) ?? todayDate,
    endDate: change.endDate ? parseDate(change.endDate) ?? undefined : undefined,
  });

  const serializePausePeriod = (pausePeriod: PausePeriod): SerializedPausePeriod => ({
    ...pausePeriod,
    endMonth: formatMonth(pausePeriod.endMonth),
    startMonth: formatMonth(pausePeriod.startMonth),
  });

  const deserializePausePeriod = (pausePeriod: SerializedPausePeriod): PausePeriod => ({
    ...pausePeriod,
    endMonth: parseMonthInput(pausePeriod.endMonth) ?? new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
    startMonth: parseMonthInput(pausePeriod.startMonth) ?? new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
  });

  const serializeDueDayChange = (change: DueDayChange): SerializedDueDayChange => ({
    ...change,
    endMonth: change.endMonth ? formatMonth(change.endMonth) : undefined,
    startMonth: formatMonth(change.startMonth),
  });

  const deserializeDueDayChange = (change: SerializedDueDayChange): DueDayChange => ({
    ...change,
    endMonth: change.endMonth ? parseMonthInput(change.endMonth) ?? undefined : undefined,
    startMonth: parseMonthInput(change.startMonth) ?? new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
  });

  const applyLoanSnapshot = (snapshot: LoanSnapshot) => {
    setAccountType(snapshot.accountType ?? "loan");
    setPromoType(snapshot.promoType ?? "none");
    setPromoEndDate(snapshot.promoEndDate ?? "");
    setCardMinimumMode(snapshot.cardMinimumMode ?? "percent");
    setCardMinimumPercent(snapshot.cardMinimumPercent ?? "2");
    setCardMinimumFloor(snapshot.cardMinimumFloor ?? "25");
    setPostPromoMinimumMode(snapshot.postPromoMinimumMode ?? "percent");
    setPostPromoMinimumPercent(snapshot.postPromoMinimumPercent ?? "2");
    setPostPromoMinimumFloor(snapshot.postPromoMinimumFloor ?? "25");
    setPostPromoFixedMinimum(snapshot.postPromoFixedMinimum ?? "");
    setCardStatementDate(snapshot.cardStatementDate ?? "");
    setCreditCardTransactions((snapshot.creditCardTransactions ?? []).map(deserializePaymentEvent));
    setLoanName(snapshot.loanName);
    setStartingPrincipal(snapshot.startingPrincipal);
    setStartingPrincipalDate(snapshot.startingPrincipalDate);
    setFirstPaymentDate(snapshot.firstPaymentDate);
    setMinimumPayment(snapshot.minimumPayment);
    setAdditionalMonthlyPayment(snapshot.additionalMonthlyPayment);
    setAprPercent(snapshot.aprPercent);
    setDueDay(snapshot.dueDay);
    setTargetDate(snapshot.targetDate);
    setMoveWeekend(snapshot.moveWeekend);
    setRoundDailyInterest(snapshot.roundDailyInterest);
    setDayCountBasis(snapshot.dayCountBasis);
    setActiveView(snapshot.activeView);
    setShowAmortization(snapshot.showAmortization);
    setShowHelperAmortization(snapshot.showHelperAmortization);
    setOneOffPayments(snapshot.oneOffPayments.map(deserializePaymentEvent));
    setNewOneOffDate(snapshot.newOneOffDate);
    setNewOneOffAmount(snapshot.newOneOffAmount);
    setNewOneOffLabel(snapshot.newOneOffLabel);
    setHelperPausePeriods(snapshot.helperPausePeriods.map(deserializePausePeriod));
    setHelperPauseFromMonth(snapshot.helperPauseFromMonth);
    setHelperPauseToMonth(snapshot.helperPauseToMonth);
    setHelperPauseMode(snapshot.helperPauseMode);
    setHelperBulkMode(snapshot.helperBulkMode);
    setHelperAdjustmentFromMonth(snapshot.helperAdjustmentFromMonth);
    setHelperAdjustmentToMonth(snapshot.helperAdjustmentToMonth);
    setHelperAdjustmentAmount(snapshot.helperAdjustmentAmount);
    setHelperRecurringChanges(snapshot.helperRecurringChanges.map(deserializeRecurringChange));
    setHelperDueDayChanges(snapshot.helperDueDayChanges.map(deserializeDueDayChange));
    setHelperAdjustmentDueDay(snapshot.helperAdjustmentDueDay);
    setDeletedHelperRowIds(snapshot.deletedHelperRowIds);
    setHelperActionError(snapshot.helperActionError);
    setHelperPaymentAmountOverrides(snapshot.helperPaymentAmountOverrides);
    setPaymentDateOverrides(snapshot.paymentDateOverrides);
    setPaymentLabelOverrides(snapshot.paymentLabelOverrides);
    setEditingPaymentId(snapshot.editingPaymentId);
    setEditingPaymentDate(snapshot.editingPaymentDate);
    setEditingPaymentAmount(snapshot.editingPaymentAmount);
    setEditingPaymentLabel(snapshot.editingPaymentLabel);
    setWhatIfPayments(snapshot.whatIfPayments.map(deserializePaymentEvent));
    setWhatIfRecurringChanges(snapshot.whatIfRecurringChanges.map(deserializeRecurringChange));
    setWhatIfPausePeriods(snapshot.whatIfPausePeriods.map(deserializePausePeriod));
    setWhatIfEntryMode(snapshot.whatIfEntryMode);
    setNewWhatIfDate(snapshot.newWhatIfDate);
    setNewWhatIfAmount(snapshot.newWhatIfAmount);
    setNewWhatIfLabel(snapshot.newWhatIfLabel);
    setWhatIfAdjustmentDate(snapshot.whatIfAdjustmentDate);
    setWhatIfAdjustmentEndDate(snapshot.whatIfAdjustmentEndDate);
    setWhatIfAdjustmentAmount(snapshot.whatIfAdjustmentAmount);
    setWhatIfAdjustmentDueDay(snapshot.whatIfAdjustmentDueDay);
    setWhatIfDueDayChanges(snapshot.whatIfDueDayChanges.map(deserializeDueDayChange));
    setWhatIfPauseFromMonth(snapshot.whatIfPauseFromMonth);
    setWhatIfPauseToMonth(snapshot.whatIfPauseToMonth);
    setWhatIfPauseMode(snapshot.whatIfPauseMode);
    setWhatIfActionError(snapshot.whatIfActionError);
    setShowHistoricalDetails(snapshot.showHistoricalDetails);
    setShowFutureDetails(snapshot.showFutureDetails);
    setShowLifetimeDetails(snapshot.showLifetimeDetails);
    setShowComparisonDetails(snapshot.showComparisonDetails);
  };

  const buildLoanSnapshot = (): LoanSnapshot => ({
    accountType,
    cardMinimumMode,
    cardMinimumPercent,
    cardMinimumFloor,
    postPromoMinimumMode,
    postPromoMinimumPercent,
    postPromoMinimumFloor,
    postPromoFixedMinimum,
    cardStatementDate,
    activeView,
    additionalMonthlyPayment,
    aprPercent,
    dayCountBasis,
    deletedHelperRowIds,
    dueDay,
    editingPaymentAmount,
    editingPaymentDate,
    editingPaymentId,
    editingPaymentLabel,
    firstPaymentDate,
    helperActionError,
    helperAdjustmentAmount,
    helperAdjustmentDueDay,
    helperAdjustmentFromMonth,
    helperAdjustmentToMonth,
    helperBulkMode,
    helperDueDayChanges: helperDueDayChanges.map(serializeDueDayChange),
    helperPauseFromMonth,
    helperPauseMode,
    helperPausePeriods: helperPausePeriods.map(serializePausePeriod),
    helperPauseToMonth,
    helperPaymentAmountOverrides,
    helperRecurringChanges: helperRecurringChanges.map(serializeRecurringChange),
    loanName,
    minimumPayment,
    moveWeekend,
    newOneOffAmount,
    newOneOffDate,
    newOneOffLabel,
    newWhatIfAmount,
    newWhatIfDate,
    newWhatIfLabel,
    oneOffPayments: oneOffPayments.map(serializePaymentEvent),
    creditCardTransactions: creditCardTransactions.map(serializePaymentEvent),
    promoType,
    promoEndDate,
    paymentDateOverrides,
    paymentLabelOverrides,
    roundDailyInterest,
    showAmortization,
    showComparisonDetails,
    showFutureDetails,
    showHelperAmortization,
    showHistoricalDetails,
    showLifetimeDetails,
    startingPrincipal,
    startingPrincipalDate,
    targetDate,
    whatIfActionError,
    whatIfAdjustmentAmount,
    whatIfAdjustmentDate,
    whatIfAdjustmentDueDay,
    whatIfAdjustmentEndDate,
    whatIfDueDayChanges: whatIfDueDayChanges.map(serializeDueDayChange),
    whatIfEntryMode,
    whatIfPauseFromMonth,
    whatIfPauseMode,
    whatIfPausePeriods: whatIfPausePeriods.map(serializePausePeriod),
    whatIfPauseToMonth,
    whatIfPayments: whatIfPayments.map(serializePaymentEvent),
    whatIfRecurringChanges: whatIfRecurringChanges.map(serializeRecurringChange),
  });

  const loadLoansForUser = async (userId: string) => {
    if (cloudStorageEnabled) {
      try {
        const parsed = await loadCloudLoans<SavedLoanRecord>(userId);
        if (parsed.length === 0) {
          setSavedLoans([]);
          setCurrentLoanId(null);
          applyLoanSnapshot(createBlankLoanSnapshot());
          return;
        }

        setSavedLoans(parsed);
        setCurrentLoanId(parsed[0].id);
        applyLoanSnapshot(parsed[0].data);
      } catch (error) {
        setSaveStatus(error instanceof Error ? error.message : "Could not load cloud loans.");
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot());
      }
      return;
    }

    try {
      const raw = localStorage.getItem(getSavedLoansStorageKey(userId));
      if (!raw) {
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot());
        return;
      }
      const parsed = JSON.parse(raw) as SavedLoanRecord[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot());
        return;
      }
      setSavedLoans(parsed);
      setCurrentLoanId(parsed[0].id);
      applyLoanSnapshot(parsed[0].data);
    } catch {
      setSavedLoans([]);
      setCurrentLoanId(null);
      applyLoanSnapshot(createBlankLoanSnapshot());
    }
  };

  useEffect(() => {
    let isMounted = true;
    console.info(
      cloudStorageEnabled
        ? "LoanSim cloud storage enabled: Supabase env vars are present."
        : "LoanSim local storage mode: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are missing.",
      cloudStorageStatus,
    );

    if (cloudStorageEnabled) {
      void (async () => {
        try {
          const profile = await getCloudSessionProfile();
          if (!isMounted) return;

          if (!profile) {
            setSaveStatus("Supabase connected. Sign in or create an account to load cloud loans.");
            setUserProfiles([]);
            setCurrentUserId(null);
            setSavedLoans([]);
            setCurrentLoanId(null);
            applyLoanSnapshot(createBlankLoanSnapshot());
            return;
          }

          const normalized = normalizeProfile(profile as UserProfile);
          setUserProfiles([normalized]);
          setCurrentUserId(normalized.id);
          await loadLoansForUser(normalized.id);
        } catch {
          if (!isMounted) return;
          setUserProfiles([]);
          setCurrentUserId(null);
          setSavedLoans([]);
          setCurrentLoanId(null);
          applyLoanSnapshot(createBlankLoanSnapshot());
        }
      })();

      return () => {
        isMounted = false;
      };
    }

    try {
      const rawProfiles = localStorage.getItem(USER_PROFILES_STORAGE_KEY);
      const parsedProfiles = rawProfiles ? (JSON.parse(rawProfiles) as Partial<UserProfile>[]) : [];
      const validProfiles = Array.isArray(parsedProfiles)
        ? parsedProfiles.map((profile) => ({
            displayName: profile.displayName ?? profile.name ?? "",
            email: profile.email ?? "",
            id: profile.id ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: profile.name ?? "",
            password: profile.password ?? "",
            passwordResetCode: profile.passwordResetCode,
            passwordResetIssuedAt: profile.passwordResetIssuedAt,
            themeId: profile.themeId ?? "sky",
          }))
          .map((profile) => normalizeProfile(profile as UserProfile))
        : [];
      setUserProfiles(validProfiles);

      const storedCurrentUserId = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      const initialUserId =
        storedCurrentUserId && validProfiles.some((profile) => profile.id === storedCurrentUserId)
          ? storedCurrentUserId
          : validProfiles[0]?.id ?? null;

      if (!initialUserId) {
        setCurrentUserId(null);
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot());
        return;
      }

      setCurrentUserId(initialUserId);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, initialUserId);
      loadLoansForUser(initialUserId);
    } catch {
      setUserProfiles([]);
      setCurrentUserId(null);
      setSavedLoans([]);
      setCurrentLoanId(null);
      applyLoanSnapshot(createBlankLoanSnapshot());
    }
  }, []);

  const persistSavedLoans = (nextLoans: SavedLoanRecord[], userId = currentUserId) => {
    setSavedLoans(nextLoans);
    if (!userId) return;
    if (cloudStorageEnabled) {
      void saveCloudLoans(userId, nextLoans).catch((error) => {
        setSaveStatus(error instanceof Error ? error.message : "Could not sync cloud loans.");
      });
      return;
    }
    localStorage.setItem(getSavedLoansStorageKey(userId), JSON.stringify(nextLoans));
  };

  const persistUserProfiles = (nextProfiles: UserProfile[]) => {
    setUserProfiles(nextProfiles);
    if (cloudStorageEnabled) {
      const currentProfile = currentUserId
        ? nextProfiles.find((profile) => profile.id === currentUserId)
        : nextProfiles[0];
      if (currentProfile) {
        void saveCloudProfile(currentProfile).catch((error) => {
          setProfileStatus(error instanceof Error ? error.message : "Could not sync cloud profile.");
        });
      }
      return;
    }
    localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(nextProfiles));
  };

  const updateCurrentUserProfile = (updater: (profile: UserProfile) => UserProfile) => {
    if (!currentUserId) return;
    const nextProfiles = userProfiles.map((profile) => (
      profile.id === currentUserId ? updater(profile) : profile
    ));
    persistUserProfiles(nextProfiles);
  };

  const loginUser = (userId: string, userName: string) => {
    setCurrentUserId(userId);
    if (!cloudStorageEnabled) {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
    }
    setActivePage("simulator");
    setActiveView("assumed");
    setSaveStatus(`Logged in as ${userName}`);
    setAuthError("");
    setAuthName("");
    setAuthDisplayName("");
    setAuthPassword("");
    setProfileStatus("");
    setPasswordResetCodeInput("");
    setPasswordResetNewPassword("");
    setPasswordResetConfirmPassword("");
    void loadLoansForUser(userId);
  };

  const handleAuthSubmit = async () => {
    const trimmedName = authName.trim();
    const trimmedDisplayName = authDisplayName.trim();
    if (!trimmedName || !authPassword) {
      setAuthError(`Enter both an ${cloudStorageEnabled ? "email" : "username"} and password.`);
      return;
    }

    if (cloudStorageEnabled) {
      try {
        if (authMode === "create" && !trimmedDisplayName) {
          setAuthError("Enter your name.");
          return;
        }
        const profile = authMode === "create"
          ? await createCloudProfile(trimmedName, authPassword, trimmedDisplayName)
          : await loginCloudProfile(trimmedName, authPassword);
        if (profile.needsEmailConfirmation) {
          setAuthError("Check your email to confirm the account, then log in.");
          setAuthPassword("");
          setAuthMode("login");
          return;
        }
        const normalized = normalizeProfile(profile as UserProfile);
        setUserProfiles([normalized]);
        applyLoanSnapshot(createBlankLoanSnapshot());
        setSavedLoans([]);
        setCurrentLoanId(null);
        loginUser(normalized.id, normalized.name);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Authentication failed.");
      }
      return;
    }

    if (authMode === "create") {
      const existingUser = userProfiles.find((profile) => profile.name.toLowerCase() === trimmedName.toLowerCase());
      if (existingUser) {
        setAuthError("That username already exists.");
        return;
      }
      const nextProfile: UserProfile = {
        displayName: trimmedDisplayName || trimmedName,
        email: "",
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmedName,
        password: authPassword,
        themeId: "sky",
      };
      const nextProfiles = [...userProfiles, nextProfile];
      persistUserProfiles(nextProfiles);
      setUserProfiles(nextProfiles);
      applyLoanSnapshot(createBlankLoanSnapshot());
      setSavedLoans([]);
      setCurrentLoanId(null);
      loginUser(nextProfile.id, nextProfile.name);
      return;
    }

    const matchingUser = userProfiles.find((profile) => profile.name.toLowerCase() === trimmedName.toLowerCase());
    if (!matchingUser || matchingUser.password !== authPassword) {
      setAuthError("Invalid username or password.");
      return;
    }
    loginUser(matchingUser.id, matchingUser.name);
  };

  const logoutUser = () => {
    if (cloudStorageEnabled) {
      void logoutCloudProfile().catch(() => undefined);
    } else {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
    setCurrentUserId(null);
    setSavedLoans([]);
    setCurrentLoanId(null);
    setActivePage("simulator");
    setSaveStatus("");
    setAuthPassword("");
    setAuthError("");
    applyLoanSnapshot(createBlankLoanSnapshot());
  };

  const deleteCurrentUserProfile = async () => {
    if (!currentUserId) return;
    const selectedProfile = userProfiles.find((profile) => profile.id === currentUserId);
    if (!selectedProfile) return;
    if (cloudStorageEnabled) {
      try {
        await deleteCloudProfileData();
        await logoutCloudProfile().catch(() => undefined);
      } catch (error) {
        setSaveStatus(error instanceof Error ? error.message : "Could not delete cloud profile data.");
        setDeleteAccountConfirmOpen(false);
        return;
      }
    } else {
      localStorage.removeItem(getSavedLoansStorageKey(currentUserId));
    }
    const nextProfiles = userProfiles.filter((profile) => profile.id !== currentUserId);
    persistUserProfiles(nextProfiles);

    if (!cloudStorageEnabled) {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
    setCurrentUserId(null);
    setSavedLoans([]);
    setCurrentLoanId(null);
    setSaveStatus(`Deleted ${selectedProfile.name}`);
    setAuthMode("login");
    setAuthName("");
    setAuthPassword("");
    setAuthError("");
    setDeleteAccountConfirmOpen(false);
    applyLoanSnapshot(createBlankLoanSnapshot());
  };

  useEffect(() => {
    if (!currentUser) {
      setProfileDraftName("");
      setProfileDraftEmail("");
      setProfileStatus("");
      setPasswordResetCodeInput("");
      setPasswordResetNewPassword("");
      setPasswordResetConfirmPassword("");
      return;
    }
    setProfileDraftName(currentUser.displayName || currentUser.name);
    setProfileDraftEmail(currentUser.email);
  }, [currentUser?.id, currentUser?.displayName, currentUser?.email, currentUser?.name]);

  const saveProfileDetails = () => {
    if (!currentUser) return;
    const trimmedDisplayName = profileDraftName.trim();
    const trimmedEmail = profileDraftEmail.trim();
    if (!trimmedDisplayName) {
      setProfileStatus("Enter a display name.");
      return;
    }
    updateCurrentUserProfile((profile) => ({
      ...profile,
      displayName: trimmedDisplayName,
      email: trimmedEmail,
    }));
    setProfileStatus("Profile updated.");
  };

  const applyThemeToProfile = (themeId: ThemeId) => {
    updateCurrentUserProfile((profile) => ({
      ...profile,
      themeId,
    }));
  };

  const sendPasswordResetEmail = () => {
    if (!currentUser) return;
    const email = profileDraftEmail.trim() || currentUser.email.trim();
    if (!email) {
      setProfileStatus("Add an email address before requesting a password reset.");
      return;
    }
    if (cloudStorageEnabled) {
      void sendCloudPasswordResetEmail(email)
        .then(() => {
          setProfileDraftEmail(email);
          setProfileStatus(`Password reset email sent to ${email}. Follow the Supabase email link to finish.`);
        })
        .catch((error) => {
          setProfileStatus(error instanceof Error ? error.message : "Could not send password reset email.");
        });
      return;
    }
    const resetCode = `${Math.floor(100000 + Math.random() * 900000)}`;
    updateCurrentUserProfile((profile) => ({
      ...profile,
      email,
      passwordResetCode: resetCode,
      passwordResetIssuedAt: new Date().toISOString(),
    }));
    setProfileDraftEmail(email);
    setPasswordResetCodeInput("");
    setPasswordResetNewPassword("");
    setPasswordResetConfirmPassword("");
    setProfileStatus(`Password reset email sent to ${email}. Local demo code: ${resetCode}`);
  };

  const applyPasswordReset = () => {
    if (!currentUser) return;
    if (cloudStorageEnabled) {
      setProfileStatus("Use the Supabase password reset email link to change your password.");
      return;
    }
    if (!currentUser.passwordResetCode) {
      setProfileStatus("Request a password reset email first.");
      return;
    }
    if (passwordResetCodeInput.trim() !== currentUser.passwordResetCode) {
      setProfileStatus("The one-time reset code is invalid.");
      return;
    }
    if (!passwordResetNewPassword || passwordResetNewPassword !== passwordResetConfirmPassword) {
      setProfileStatus("New passwords must match.");
      return;
    }
    updateCurrentUserProfile((profile) => ({
      ...profile,
      password: passwordResetNewPassword,
      passwordResetCode: undefined,
      passwordResetIssuedAt: undefined,
    }));
    setPasswordResetCodeInput("");
    setPasswordResetNewPassword("");
    setPasswordResetConfirmPassword("");
    setProfileStatus("Password updated.");
  };

  const saveCurrentLoan = () => {
    if (!currentUserId) {
      window.alert("Create or select a profile before saving a loan.");
      return;
    }
    const snapshot = buildLoanSnapshot();
    const trimmedName = loanName.trim() || "Untitled loan";
    const loanId = currentLoanId ?? `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextRecord: SavedLoanRecord = {
      data: {
        ...snapshot,
        loanName: trimmedName,
        overviewBalance: parseCurrency(startingPrincipal),
        overviewOriginalBalance: parseCurrency(startingPrincipal),
      },
      id: loanId,
      name: trimmedName,
    };

    const nextLoans = currentLoanId
      ? savedLoans.map((loan) => (loan.id === currentLoanId ? nextRecord : loan))
      : [...savedLoans, nextRecord];

    setLoanName(trimmedName);
    setCurrentLoanId(loanId);
    persistSavedLoans(nextLoans);
    setSaveStatus(`Saved ${trimmedName}`);
  };

  const startNewLoan = (type: "loan" | "credit-card" = "loan") => {
    setCurrentLoanId(null);
    setSaveStatus("");
    applyLoanSnapshot(createBlankLoanSnapshot());
    setAccountType(type);
    setPromoType("none");
    setPromoEndDate("");
    setLoanName(type === "credit-card" ? "New credit card" : "");
    setActiveLoanTab("details");
    setActiveView("assumed");
  };

  const loadSavedLoan = (loanId: string) => {
    const selectedLoan = savedLoans.find((loan) => loan.id === loanId);
    if (!selectedLoan) return;
    setCurrentLoanId(selectedLoan.id);
    setSaveStatus("");
    applyLoanSnapshot(selectedLoan.data);
    setActiveLoanTab("details");
    setActiveView("assumed");
  };

  const deleteLoan = (loanId: string) => {
    const selectedLoan = savedLoans.find((loan) => loan.id === loanId);
    if (!selectedLoan) return;
    const confirmed = window.confirm(`Delete saved loan "${selectedLoan.name}"?`);
    if (!confirmed) return;

    const nextLoans = savedLoans.filter((loan) => loan.id !== loanId);
    persistSavedLoans(nextLoans);
    setSaveStatus(`Deleted ${selectedLoan.name}`);

    if (loanId !== currentLoanId) return;
    if (nextLoans.length > 0) {
      setCurrentLoanId(nextLoans[0].id);
      applyLoanSnapshot(nextLoans[0].data);
      return;
    }

    setCurrentLoanId(null);
    applyLoanSnapshot(createBlankLoanSnapshot());
  };

  const helperVisiblePayments = useMemo(() => {
    return [...oneOffPayments]
      .map((payment) => {
        const override = payment.id ? paymentDateOverrides[payment.id] : undefined;
        const overriddenDate = override ? parseDate(override) : null;
        return {
          ...payment,
          date: overriddenDate ?? payment.date,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [oneOffPayments, paymentDateOverrides]);

  const helperPaymentsThroughTarget = useMemo(() => {
    const target = parseDate(targetDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    return helperVisiblePayments
      .filter((payment) => payment.date.getTime() <= target)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [helperVisiblePayments, targetDate]);

  const helperPausePeriodsThroughTarget = useMemo(() => {
    const target = parseDate(targetDate);
    if (!target) {
      return helperPausePeriods;
    }
    const targetMonthValue = target.getFullYear() * 12 + target.getMonth();
    return helperPausePeriods
      .filter((pausePeriod) => {
        const startMonthValue =
          pausePeriod.startMonth.getFullYear() * 12 + pausePeriod.startMonth.getMonth();
        return startMonthValue <= targetMonthValue;
      })
      .map((pausePeriod) => {
        const endMonthValue =
          pausePeriod.endMonth.getFullYear() * 12 + pausePeriod.endMonth.getMonth();
        if (endMonthValue <= targetMonthValue) {
          return pausePeriod;
        }
        return {
          ...pausePeriod,
          endMonth: new Date(target.getFullYear(), target.getMonth(), 1),
        };
      });
  }, [helperPausePeriods, targetDate]);

  const helperScheduledAdjustments = useMemo(() => {
    const baseMinimum = parseCurrency(minimumPayment);
    const baseExtra = parseCurrency(additionalMonthlyPayment);
    return helperRecurringChanges
      .map((change) => {
        const targetTotal =
          change.kind === "minimum" ? change.amount + baseExtra : baseMinimum + change.amount;
        const baseTotal = baseMinimum + baseExtra;
        const startDate = clampToMonth(
          change.effectiveDate.getFullYear(),
          change.effectiveDate.getMonth(),
          Number(dueDay) || 1,
        );
        const endDate = change.endDate
          ? clampToMonth(change.endDate.getFullYear(), change.endDate.getMonth(), Number(dueDay) || 1)
          : undefined;
        return {
          amount: targetTotal - baseTotal,
          endDate,
          startDate,
        };
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [additionalMonthlyPayment, dueDay, helperRecurringChanges, minimumPayment]);

  const helperDueDayAdjustments = useMemo(
    () =>
      [...helperDueDayChanges]
        .sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime())
        .map((change) => ({
          day: change.day,
          endMonth: change.endMonth,
          startMonth: change.startMonth,
        })),
    [helperDueDayChanges],
  );

  const assumedResult = useMemo(
    () =>
      buildProjection({
        actualPayments: [],
        startingPrincipal: parseCurrency(deferredStartingPrincipal),
        startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
        aprPercent: Number(deferredAprPercent) || 0,
        dayCountBasis,
        minimumPayment: parseCurrency(totalMonthlyPayment),
        firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
        dueDay: Number(deferredDueDay) || 0,
        moveWeekend,
        targetDate: parseDate(deferredTargetDate) ?? new Date(),
        roundDailyInterest,
        scheduledMode: "always",
      }),
    [
      deferredStartingPrincipal,
      deferredStartingPrincipalDate,
      deferredAprPercent,
      dayCountBasis,
      totalMonthlyPayment,
      deferredFirstPaymentDate,
      deferredDueDay,
      moveWeekend,
      deferredTargetDate,
      roundDailyInterest,
    ],
  );

  const minimumOnlyToDateProjection = useMemo(
    () =>
      buildProjection({
        actualPayments: [],
        appendAsOfRow: true,
        startingPrincipal: parseCurrency(deferredStartingPrincipal),
        startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
        aprPercent: Number(deferredAprPercent) || 0,
        dayCountBasis,
        minimumPayment: parseCurrency(effectiveMinimumPayment),
        firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
        dueDay: Number(deferredDueDay) || 0,
        moveWeekend,
        targetDate: parseDate(deferredTargetDate) ?? new Date(),
        roundDailyInterest,
        scheduledMode: "always",
      }),
    [
      deferredAprPercent,
      dayCountBasis,
      deferredDueDay,
      deferredFirstPaymentDate,
      effectiveMinimumPayment,
      moveWeekend,
      roundDailyInterest,
      deferredStartingPrincipal,
      deferredStartingPrincipalDate,
      deferredTargetDate,
    ],
  );

  const amortizationTargetDate = useMemo(() => {
    const start = parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredTargetDate]);

  const fullLoanTargetDate = useMemo(() => {
    const start = parseDate(deferredStartingPrincipalDate) ?? parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredStartingPrincipalDate, deferredTargetDate]);

  const assumedCurrentPlanProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0,
      };
    }

    return buildProjection({
      actualPayments: [],
      startingPrincipal: assumedResult.currentPrincipal,
      startingInterest: assumedResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        firstPaymentDate: firstPayment,
        moveWeekend,
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      targetDate: amortizationTargetDate,
      roundDailyInterest,
      scheduledMode: "always",
    });
  }, [
    amortizationTargetDate,
    deferredAprPercent,
    assumedResult.currentInterest,
    assumedResult.currentPrincipal,
    dayCountBasis,
    deferredDueDay,
    deferredFirstPaymentDate,
    moveWeekend,
    roundDailyInterest,
    deferredTargetDate,
    totalMonthlyPayment,
  ]);

  const amortizationProjection = assumedCurrentPlanProjection;

  const minimumOnlyFullProjection = useMemo(
    () =>
      buildProjection({
        actualPayments: [],
        startingPrincipal: parseCurrency(deferredStartingPrincipal),
        startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
        aprPercent: Number(deferredAprPercent) || 0,
        dayCountBasis,
        minimumPayment: parseCurrency(effectiveMinimumPayment),
        firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
        dueDay: Number(deferredDueDay) || 0,
        moveWeekend,
        targetDate: fullLoanTargetDate,
        roundDailyInterest,
        scheduledMode: "always",
      }),
    [
      deferredAprPercent,
      dayCountBasis,
      deferredDueDay,
      deferredFirstPaymentDate,
      fullLoanTargetDate,
      effectiveMinimumPayment,
      moveWeekend,
      roundDailyInterest,
      deferredStartingPrincipal,
      deferredStartingPrincipalDate,
    ],
  );

  const assumedFullProjection = useMemo(
    () =>
      buildProjection({
        actualPayments: [],
        startingPrincipal: parseCurrency(deferredStartingPrincipal),
        startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
        aprPercent: Number(deferredAprPercent) || 0,
        dayCountBasis,
        minimumPayment: parseCurrency(totalMonthlyPayment),
        firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
        dueDay: Number(deferredDueDay) || 0,
        moveWeekend,
        targetDate: fullLoanTargetDate,
        roundDailyInterest,
        scheduledMode: "always",
      }),
    [
      deferredAprPercent,
      dayCountBasis,
      deferredDueDay,
      deferredFirstPaymentDate,
      fullLoanTargetDate,
      moveWeekend,
      roundDailyInterest,
      deferredStartingPrincipal,
      deferredStartingPrincipalDate,
      totalMonthlyPayment,
    ],
  );

  const historyResult = useMemo(
    () =>
      buildProjection({
        actualPayments: helperPaymentsThroughTarget,
        appendAsOfRow: true,
        startingPrincipal: parseCurrency(deferredStartingPrincipal),
        startingPrincipalDate: parseDate(deferredStartingPrincipalDate) ?? new Date(),
        aprPercent: Number(deferredAprPercent) || 0,
        dayCountBasis,
        deletedRowIds: new Set(deletedHelperRowIds),
        minimumPayment: parseCurrency(totalMonthlyPayment),
        firstPaymentDate: parseDate(deferredFirstPaymentDate) ?? new Date(),
        dueDay: Number(deferredDueDay) || 0,
        moveWeekend,
        pausePeriods: helperPausePeriodsThroughTarget,
        paymentAmountOverrides: helperPaymentAmountOverrides,
        paymentDateOverrides,
        paymentLabelOverrides,
        scheduledDueDayChanges: helperDueDayAdjustments,
        scheduledPaymentAdjustments: helperScheduledAdjustments,
        targetDate: parseDate(deferredTargetDate) ?? new Date(),
        roundDailyInterest,
        scheduledMode: "always",
      }),
    [
      deferredAprPercent,
      dayCountBasis,
      deletedHelperRowIds,
      deferredDueDay,
      deferredFirstPaymentDate,
      helperPaymentAmountOverrides,
      helperPaymentsThroughTarget,
      helperDueDayAdjustments,
      moveWeekend,
      paymentDateOverrides,
      paymentLabelOverrides,
      helperPausePeriodsThroughTarget,
      helperScheduledAdjustments,
      roundDailyInterest,
      deferredStartingPrincipal,
      deferredStartingPrincipalDate,
      deferredTargetDate,
      totalMonthlyPayment,
    ],
  );

  const helperAmortizationTargetDate = useMemo(() => {
    const start = parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredTargetDate]);

  const helperProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0,
      };
    }

    return buildProjection({
      actualPayments: helperVisiblePayments.filter((payment) => payment.date > target),
      appendAsOfRow: false,
      startingPrincipal: historyResult.currentPrincipal,
      startingInterest: historyResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        dueDayChanges: helperDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend,
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      paymentLabelOverrides,
      scheduledDueDayChanges: helperDueDayAdjustments,
      scheduledPaymentAdjustments: helperScheduledAdjustments,
      targetDate: helperAmortizationTargetDate,
      roundDailyInterest,
      scheduledMode: "always",
    });
  }, [
    deferredAprPercent,
    deferredDueDay,
    deferredFirstPaymentDate,
    helperAmortizationTargetDate,
    helperVisiblePayments,
    historyResult.currentInterest,
    historyResult.currentPrincipal,
    minimumPayment,
    moveWeekend,
    paymentLabelOverrides,
    helperDueDayAdjustments,
    helperScheduledAdjustments,
    helperVisiblePayments,
    roundDailyInterest,
    deferredTargetDate,
    totalMonthlyPayment,
    dayCountBasis,
  ]);

  const helperCurrentPlanProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0,
      };
    }

    return buildProjection({
      actualPayments: helperVisiblePayments.filter((payment) => payment.date > target),
      appendAsOfRow: false,
      startingPrincipal: historyResult.currentPrincipal,
      startingInterest: historyResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        dueDayChanges: helperDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend,
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      paymentLabelOverrides,
      scheduledDueDayChanges: helperDueDayAdjustments,
      scheduledPaymentAdjustments: helperScheduledAdjustments,
      targetDate: helperAmortizationTargetDate,
      roundDailyInterest,
      scheduledMode: "always",
    });
  }, [
    deferredAprPercent,
    dayCountBasis,
    deferredDueDay,
    deferredFirstPaymentDate,
    helperAmortizationTargetDate,
    helperVisiblePayments,
    historyResult.currentInterest,
    historyResult.currentPrincipal,
    moveWeekend,
    paymentLabelOverrides,
    helperDueDayAdjustments,
    helperScheduledAdjustments,
    roundDailyInterest,
    deferredTargetDate,
    totalMonthlyPayment,
  ]);

  const whatIfTargetDate = useMemo(() => {
    const start = parseDate(deferredTargetDate) ?? new Date();
    return addMonths(start, 240);
  }, [deferredTargetDate]);

  const nextPaymentDate = useMemo(() => {
    const firstPayment = parseDate(deferredFirstPaymentDate);
    const anchorDate = parseDate(deferredTargetDate);
    const numericDueDay = Number(deferredDueDay) || 0;
    if (!firstPayment || !anchorDate || numericDueDay < 1 || numericDueDay > 31) {
      return "-";
    }
    return toDateInputValue(
      getNextScheduledPaymentDate({
        afterDate: anchorDate,
        dueDay: numericDueDay,
        dueDayChanges:
          activeView === "whatif"
            ? whatIfDueDayChanges.map((change) => ({ day: change.day, endMonth: change.endMonth, startMonth: change.startMonth }))
            : helperDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend,
      }),
    );
  }, [activeView, deferredDueDay, deferredFirstPaymentDate, helperDueDayAdjustments, moveWeekend, deferredTargetDate, whatIfDueDayChanges]);

  const whatIfAllPayments = useMemo(
    () => [...whatIfPayments].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [whatIfPayments],
  );

  const whatIfRecurringAdjustments = useMemo(() => {
    const baseMinimum = parseCurrency(effectiveMinimumPayment);
    const baseExtra = parseCurrency(deferredAdditionalMonthlyPayment);
    let currentMinimum = baseMinimum;
    let currentExtra = baseExtra;
    let previousTotal = baseMinimum + baseExtra;

    return [...whatIfRecurringChanges]
      .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime())
      .map((change) => {
        if (change.kind === "minimum") {
          currentMinimum = change.amount;
        } else {
          currentExtra = change.amount;
        }
        const nextTotal = currentMinimum + currentExtra;
        const delta = nextTotal - previousTotal;
        previousTotal = nextTotal;
        return {
          amount: delta,
          startDate: change.effectiveDate,
        };
      });
  }, [deferredAdditionalMonthlyPayment, effectiveMinimumPayment, whatIfRecurringChanges]);

  const whatIfDueDayAdjustments = useMemo(
    () =>
      [...whatIfDueDayChanges]
        .sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime())
        .map((change) => ({
          day: change.day,
          endMonth: change.endMonth,
          startMonth: change.startMonth,
        })),
    [whatIfDueDayChanges],
  );

  const whatIfProjection = useMemo(() => {
    const target = parseDate(deferredTargetDate);
    const firstPayment = parseDate(deferredFirstPaymentDate);
    if (!target || !firstPayment) {
      return {
        currentInterest: 0,
        currentPrincipal: 0,
        errors: [],
        paidOff: false,
        payoffDate: null,
        rows: [],
        hasNegativeAmortization: false,
        totalBalance: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        totalPrincipalPaid: 0,
      };
    }

    return buildProjection({
      actualPayments: whatIfAllPayments
        .filter((payment) => payment.date > target)
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
      appendAsOfRow: false,
      startingPrincipal: historyResult.currentPrincipal,
      startingInterest: historyResult.currentInterest,
      startingPrincipalDate: target,
      aprPercent: Number(deferredAprPercent) || 0,
      dayCountBasis,
      minimumPayment: parseCurrency(totalMonthlyPayment),
      firstPaymentDate: getNextScheduledPaymentDate({
        afterDate: target,
        dueDay: Number(deferredDueDay) || 0,
        dueDayChanges: whatIfDueDayAdjustments,
        firstPaymentDate: firstPayment,
        moveWeekend,
      }),
      dueDay: Number(deferredDueDay) || 0,
      moveWeekend,
      pausePeriods: whatIfPausePeriods,
      scheduledDueDayChanges: whatIfDueDayAdjustments,
      scheduledPaymentAdjustments: whatIfRecurringAdjustments,
      targetDate: whatIfTargetDate,
      roundDailyInterest,
      scheduledMode: "always",
    });
  }, [
    deferredAprPercent,
    dayCountBasis,
    deferredDueDay,
    deferredFirstPaymentDate,
    historyResult.currentInterest,
    historyResult.currentPrincipal,
    minimumPayment,
    moveWeekend,
    whatIfPausePeriods,
    whatIfDueDayAdjustments,
    roundDailyInterest,
    deferredTargetDate,
    totalMonthlyPayment,
    whatIfAllPayments,
    whatIfRecurringAdjustments,
    whatIfTargetDate,
  ]);

  const loanInputsReady = parseCurrency(deferredStartingPrincipal) > 0 && parseCurrency(effectiveMinimumPayment) > 0 && Boolean(parseDate(deferredStartingPrincipalDate)) && Boolean(parseDate(deferredFirstPaymentDate));
  const historyErrors = loanInputsReady ? [...historyResult.errors] : [];

  const assumedInterestSaved =
    minimumOnlyFullProjection.totalInterestPaid - assumedFullProjection.totalInterestPaid;
  const minimumOnlyLifetimeInterest = minimumOnlyFullProjection.totalInterestPaid;

  const assumedInterestSavedAsOfToday =
    minimumOnlyToDateProjection.totalInterestPaid - assumedResult.totalInterestPaid;

  const assumedInterestSavedFromTodayForward =
    assumedInterestSaved - assumedInterestSavedAsOfToday;

  const helperInterestSavedAsOfToday =
    minimumOnlyToDateProjection.totalInterestPaid - historyResult.totalInterestPaid;

  const helperInterestSavedOverall =
    minimumOnlyFullProjection.totalInterestPaid -
    (historyResult.totalInterestPaid + helperCurrentPlanProjection.totalInterestPaid);

  const helperInterestSavedFromTodayForward =
    helperInterestSavedOverall - helperInterestSavedAsOfToday;

  const assumedInterestStillOwedWithAdditional = Math.max(
    0,
    assumedFullProjection.totalInterestPaid - assumedResult.totalInterestPaid,
  );

  const helperTotalExpectedInterestPaidIncludingAdditional =
    historyResult.totalInterestPaid + helperCurrentPlanProjection.totalInterestPaid;

  const whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly =
    historyResult.totalInterestPaid + helperCurrentPlanProjection.totalInterestPaid;

  const whatIfTotalExpectedInterestPaidIncludingAnticipated =
    historyResult.totalInterestPaid + whatIfProjection.totalInterestPaid;

  const whatIfHasProjectedExtras =
    whatIfPayments.length > 0 || whatIfRecurringChanges.length > 0 || whatIfPausePeriods.length > 0 || whatIfDueDayChanges.length > 0;

  const assumedScenarioLifetimeInterest = assumedResult.totalInterestPaid + assumedCurrentPlanProjection.totalInterestPaid;
  const assumedScenarioLifetimeSaved = minimumOnlyLifetimeInterest - assumedScenarioLifetimeInterest;
  const assumedScenarioRemainingInterest = assumedInterestStillOwedWithAdditional;
  const assumedScenarioRemainingSaved = assumedInterestSavedFromTodayForward;

  const helperScenarioLifetimeInterest = helperTotalExpectedInterestPaidIncludingAdditional;
  const helperScenarioLifetimeSaved = minimumOnlyLifetimeInterest - helperScenarioLifetimeInterest;
  const helperScenarioRemainingInterest = helperCurrentPlanProjection.totalInterestPaid;
  const helperScenarioRemainingSaved = helperInterestSavedFromTodayForward;

  const minimumOnlyRemainingInterest = Math.max(
    0,
    minimumOnlyFullProjection.totalInterestPaid - minimumOnlyToDateProjection.totalInterestPaid,
  );
  const whatIfBaseRemainingInterest = helperCurrentPlanProjection.totalInterestPaid;
  const whatIfBaseLifetimeInterest = whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly;
  const whatIfProjectedExtrasSavedRemaining = minimumOnlyRemainingInterest - whatIfProjection.totalInterestPaid;
  const whatIfScenarioRemainingInterest = whatIfHasProjectedExtras
    ? whatIfProjection.totalInterestPaid
    : whatIfBaseRemainingInterest;
  const whatIfScenarioLifetimeInterest = whatIfHasProjectedExtras
    ? whatIfTotalExpectedInterestPaidIncludingAnticipated
    : whatIfBaseLifetimeInterest;
  const whatIfScenarioSaved = minimumOnlyLifetimeInterest - whatIfScenarioLifetimeInterest;
  const startingPrincipalAmount = parseCurrency(deferredStartingPrincipal);
  const assumedPayoffPercent =
    startingPrincipalAmount > 0 ? Math.min(100, (assumedResult.totalPrincipalPaid / startingPrincipalAmount) * 100) : 0;
  const historyPayoffPercent =
    startingPrincipalAmount > 0 ? Math.min(100, (historyResult.totalPrincipalPaid / startingPrincipalAmount) * 100) : 0;
  const activePayoffPercent =
    activeView === "assumed" ? assumedPayoffPercent : historyPayoffPercent;
  const activeProjectedPayoffDate =
    activeView === "assumed"
      ? assumedCurrentPlanProjection.payoffDate
      : activeView === "history"
        ? helperCurrentPlanProjection.payoffDate
        : whatIfProjection.payoffDate;
  const canShowAssumedSchedule =
    Boolean(parseDate(deferredStartingPrincipalDate)) && Boolean(parseDate(deferredFirstPaymentDate));
  const baselinePayoffDate = minimumOnlyFullProjection.payoffDate;
  const activeAsOfDate = parseDate(deferredTargetDate);
  const projectedScenarioPrincipalForDailyCost =
    activeView === "whatif"
      ? (whatIfProjection.rows.find((row) => row.principalPaid > 0)?.endingPrincipal ?? historyResult.currentPrincipal)
      : activeView === "assumed"
        ? assumedResult.currentPrincipal
        : historyResult.currentPrincipal;
  const activeInterestStartDate = activeAsOfDate ?? new Date();
  const activeInterestEndDate = new Date(activeInterestStartDate);
  activeInterestEndDate.setDate(activeInterestEndDate.getDate() + 1);
  const activeDailyInterestCost = accrueInterest({
    aprPercent: Number(deferredAprPercent) || 0,
    dayCountBasis,
    endDate: activeInterestEndDate,
    principal: projectedScenarioPrincipalForDailyCost,
    roundDailyInterest,
    startDate: activeInterestStartDate,
  });
  const activePayoffDuration = formatDurationToPayoff(activeProjectedPayoffDate, activeAsOfDate);
  const baselinePayoffDeltaMonths =
    activeProjectedPayoffDate && baselinePayoffDate
      ? (baselinePayoffDate.getFullYear() - activeProjectedPayoffDate.getFullYear()) * 12 +
        (baselinePayoffDate.getMonth() - activeProjectedPayoffDate.getMonth())
      : 0;
  const activeTimeSavedLabel =
    baselinePayoffDate && activeProjectedPayoffDate
      ? formatTimeShaved(baselinePayoffDeltaMonths)
      : "-";
  const assumedReferenceRow = [...assumedResult.rows].reverse().find((row) => row.paymentAmount > 0) ?? null;
  const historyReferenceRow = [...historyResult.rows].reverse().find((row) => row.paymentAmount > 0) ?? null;
  const whatIfReferenceRow = whatIfProjection.rows.find((row) => row.paymentAmount > 0) ?? null;
  const activeReferenceRow =
    activeView === "assumed" ? assumedReferenceRow : activeView === "history" ? historyReferenceRow : whatIfReferenceRow;
  const activePrincipalShare = activeReferenceRow?.principalShareOfPayment ?? null;
  const activeInterestShare = activeReferenceRow?.paymentAmount
    ? activeReferenceRow.interestPaid / activeReferenceRow.paymentAmount
    : null;
  const softDangerMessage =
    activeReferenceRow?.negativeAmortization
      ? null
      : activeInterestShare !== null && activeInterestShare >= 0.7
        ? "Most of your payment is going to interest."
        : activePrincipalShare !== null && activePrincipalShare < 0.3
          ? "Only a small share of this payment is reaching principal."
          : null;
  const whatIfDeltaInterest = whatIfBaseLifetimeInterest - whatIfScenarioLifetimeInterest;
  const whatIfBaselinePayoffDate = helperCurrentPlanProjection.payoffDate;
  const whatIfDeltaMonths =
    whatIfProjection.payoffDate && whatIfBaselinePayoffDate
      ? (whatIfBaselinePayoffDate.getFullYear() - whatIfProjection.payoffDate.getFullYear()) * 12 +
        (whatIfBaselinePayoffDate.getMonth() - whatIfProjection.payoffDate.getMonth())
      : 0;
  const whatIfTimeChangeLabel =
    whatIfProjection.payoffDate && whatIfBaselinePayoffDate
      ? formatTimeShaved(whatIfDeltaMonths)
      : "-";
  const assumedLifetimeSavedTone =
    assumedScenarioLifetimeSaved > 0 ? "positive" : assumedScenarioLifetimeSaved < 0 ? "negative" : "default";
  const helperLifetimeSavedTone =
    helperScenarioLifetimeSaved > 0 ? "positive" : helperScenarioLifetimeSaved < 0 ? "negative" : "default";
  const whatIfLifetimeSavedTone =
    whatIfScenarioSaved > 0 ? "positive" : whatIfScenarioSaved < 0 ? "negative" : "default";
  const assumedRemainingInterestNotes = [2];
  const assumedRemainingSavedNotes = [1, 2];
  const assumedLifetimeSavedNotes = [1, 2];
  const helperRemainingInterestNotes = [2];
  const helperRemainingSavedNotes = [1, 2];
  const helperLifetimeSavedNotes = [1, 2];
  const whatIfRemainingInterestNotes: number[] = [];
  const whatIfAdditionalSavedNotes = [1];
  const whatIfLifetimeSavedNotes = [1, 2];
  const footnote2Text = "2. Assumes you keep paying your minimum payment plus monthly extra payment.";
  const assumedHasNegativeAmortization =
    assumedResult.hasNegativeAmortization || assumedCurrentPlanProjection.hasNegativeAmortization;
  const historyHasNegativeAmortization =
    historyResult.hasNegativeAmortization || helperProjection.hasNegativeAmortization;
  const whatIfHasNegativeAmortization = whatIfProjection.hasNegativeAmortization;
  const negativeAmortizationWarning =
    activeView === "assumed"
      ? assumedHasNegativeAmortization
      : activeView === "history"
        ? historyHasNegativeAmortization
        : whatIfHasNegativeAmortization;
  const startingPrincipalDateValue = parseDate(startingPrincipalDate);
  const minimumTargetDate = startingPrincipalDateValue && compareDateOnly(startingPrincipalDateValue, todayDate) > 0
    ? startingPrincipalDateValue
    : todayDate;
  const targetDateMinValue = toDateInputValue(minimumTargetDate);
  const helperMaxMonthValue = todayValue.slice(0, 7);
  const whatIfMinimumPaymentDate = parseDate(targetDate);
  const whatIfMinDate = whatIfMinimumPaymentDate && compareDateOnly(whatIfMinimumPaymentDate, todayDate) > 0
    ? whatIfMinimumPaymentDate
    : todayDate;
  const whatIfMinDateValue = toDateInputValue(whatIfMinDate);

  const addHelperPausePeriod = () => {
    const startMonth = parseMonthInput(helperPauseFromMonth);
    const endMonth = parseMonthInput(helperPauseToMonth);
    if (!startMonth || !endMonth || endMonth < startMonth) {
      setHelperActionError("Choose a valid pause range.");
      return;
    }

    const nextPausePeriod: PausePeriod = {
      endMonth,
      id: `helper-pause-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mode: helperPauseMode,
      startMonth,
    };
    const hasOverlap = helperPausePeriods.some((pausePeriod) => pausePeriodsOverlap(pausePeriod, nextPausePeriod));
    if (hasOverlap) {
      setHelperActionError("A payment is already paused in that date range.");
      return;
    }

    setHelperPausePeriods((current) =>
      [
        ...current,
        nextPausePeriod,
      ].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()),
    );
    setHelperActionError("");
    setHelperPauseFromMonth("");
    setHelperPauseToMonth("");
    setHelperPauseMode("accrues");
  };

  const deleteHelperPausePeriod = (pauseId: string) => {
    setHelperPausePeriods((current) => current.filter((pausePeriod) => pausePeriod.id !== pauseId));
  };

  const addHelperBulkAdjustment = () => {
    if (helperBulkMode === "pause") {
      addHelperPausePeriod();
      return;
    }

    if (helperBulkMode === "due-day") {
      const startMonth = parseMonthInput(helperAdjustmentFromMonth);
      const endMonth = parseMonthInput(helperAdjustmentToMonth);
      const day = Number(helperAdjustmentDueDay);
      if (!startMonth || (helperAdjustmentToMonth && !endMonth) || (endMonth && endMonth < startMonth) || day < 1 || day > 31) {
        setHelperActionError("Choose a valid due day and month range.");
        return;
      }
      const nextChange: DueDayChange = {
        day,
        endMonth: endMonth ?? undefined,
        id: `helper-due-day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startMonth,
      };
      setHelperDueDayChanges((current) => [...current, nextChange].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()));
      setHelperActionError("");
      setHelperAdjustmentFromMonth("");
      setHelperAdjustmentToMonth("");
      setHelperAdjustmentDueDay("");
      return;
    }

    const startMonth = parseMonthInput(helperAdjustmentFromMonth);
    const endMonth = parseMonthInput(helperAdjustmentToMonth);
    const amount = parseCurrency(helperAdjustmentAmount);
    if (!startMonth || !endMonth || endMonth < startMonth || amount < 0) {
      return;
    }

    setHelperRecurringChanges((current) =>
      [
        ...current,
        {
          amount,
          effectiveDate: startMonth,
          endDate: endMonth,
          id: `helper-adjust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind: helperBulkMode,
        },
      ].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime()),
    );
    setHelperAdjustmentFromMonth("");
    setHelperAdjustmentToMonth("");
    setHelperAdjustmentAmount("");
  };

  const deleteHelperRecurringChange = (changeId: string) => {
    setHelperRecurringChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const deleteHelperDueDayChange = (changeId: string) => {
    setHelperDueDayChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const addOneOffPayment = () => {
    const date = parseDate(newOneOffDate);
    const amount = parseCurrency(newOneOffAmount);
    if (!date || amount <= 0) {
      setHelperActionError("Enter a valid payment date and amount.");
      return;
    }
    if (compareDateOnly(date, todayDate) > 0) {
      setHelperActionError("Payment dates cannot be in the future.");
      return;
    }

    const newPayment: PaymentEvent = {
      amount,
      date,
      id: `oneoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: newOneOffLabel.trim() || "Extra payment",
      source: "extra",
    };

    setOneOffPayments((current) =>
      [...current, newPayment].sort((a, b) => a.date.getTime() - b.date.getTime()),
    );
    setHelperActionError("");
    setNewOneOffDate("");
    setNewOneOffAmount("");
    setNewOneOffLabel("Extra payment");
  };

  const startEditingReplayRow = (row: ScheduleRow) => {
    setEditingPaymentId(row.rowId);
    setEditingPaymentDate(toDateInputValue(row.paymentDate));
    setEditingPaymentAmount(row.paymentAmount.toFixed(2));
    setEditingPaymentLabel(row.label);
  };

  const saveEditedPayment = () => {
    const parsed = parseDate(editingPaymentDate);
    const parsedAmount = parseCurrency(editingPaymentAmount);
    if (!parsed || !editingPaymentId || !(parsedAmount > 0)) {
      setHelperActionError("Enter a valid edited payment date and amount.");
      return;
    }
    if (compareDateOnly(parsed, todayDate) > 0) {
      setHelperActionError("Payment dates cannot be in the future.");
      return;
    }

    setPaymentDateOverrides((current) => ({
      ...current,
      [editingPaymentId]: toDateInputValue(parsed),
    }));
    setHelperPaymentAmountOverrides((current) => ({
      ...current,
      [editingPaymentId]: parsedAmount.toFixed(2),
    }));
    setPaymentLabelOverrides((current) => {
      const trimmed = editingPaymentLabel.trim();
      if (!trimmed) {
        const next = { ...current };
        delete next[editingPaymentId];
        return next;
      }
      return {
        ...current,
        [editingPaymentId]: trimmed,
      };
    });

    setHelperActionError("");
    setEditingPaymentId("");
    setEditingPaymentDate("");
    setEditingPaymentAmount("");
    setEditingPaymentLabel("");
  };

  const cancelEditingPayment = () => {
    setEditingPaymentId("");
    setEditingPaymentDate("");
    setEditingPaymentAmount("");
    setEditingPaymentLabel("");
  };

  const deleteHelperRow = (rowId: string) => {
    setDeletedHelperRowIds((current) => (current.includes(rowId) ? current : [...current, rowId]));
    if (editingPaymentId === rowId) {
      cancelEditingPayment();
    }
  };

  const addWhatIfPayment = () => {
    if (whatIfEntryMode === "pause") {
      const startMonth = parseMonthInput(whatIfPauseFromMonth);
      const endMonth = parseMonthInput(whatIfPauseToMonth);
      if (!startMonth || !endMonth || endMonth < startMonth) {
        setWhatIfActionError("Choose a valid pause range.");
        return;
      }
      const nextPausePeriod: PausePeriod = {
        endMonth,
        id: `whatif-pause-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: whatIfPauseMode,
        startMonth,
      };
      const hasOverlap = whatIfPausePeriods.some((pausePeriod) => pausePeriodsOverlap(pausePeriod, nextPausePeriod));
      if (hasOverlap) {
        setWhatIfActionError("A payment is already paused in that date range.");
        return;
      }
      setWhatIfPausePeriods((current) =>
        [
          ...current,
          nextPausePeriod,
        ].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()),
      );
      setWhatIfActionError("");
      setWhatIfPauseFromMonth("");
      setWhatIfPauseToMonth("");
      setWhatIfPauseMode("accrues");
      return;
    }

    if (whatIfEntryMode === "due-day") {
      const startMonth = parseMonthInput(whatIfAdjustmentDate);
      const endMonth = parseMonthInput(whatIfAdjustmentEndDate);
      const day = Number(whatIfAdjustmentDueDay);
      const currentTarget = parseDate(targetDate);
      if (!startMonth || (whatIfAdjustmentEndDate && !endMonth) || (endMonth && endMonth < startMonth) || day < 1 || day > 31) {
        setWhatIfActionError("Choose a valid due day and month range.");
        return;
      }
      const start = currentTarget ? monthValue(startMonth) : null;
      const currentMonth = currentTarget ? monthValue(new Date(currentTarget.getFullYear(), currentTarget.getMonth(), 1)) : null;
      if (start !== null && currentMonth !== null && start <= currentMonth) {
        setWhatIfActionError("Choose a due-date change that starts after the current baseline month.");
        return;
      }
      setWhatIfDueDayChanges((current) =>
        [
          ...current,
          {
            day,
            endMonth: endMonth ?? undefined,
            id: `whatif-due-day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            startMonth,
          },
        ].sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime()),
      );
      setWhatIfActionError("");
      setWhatIfAdjustmentDate("");
      setWhatIfAdjustmentEndDate("");
      setWhatIfAdjustmentDueDay("");
      return;
    }

    if (whatIfEntryMode !== "one-time") {
      const startMonth = parseMonthInput(whatIfAdjustmentDate);
      const amount = parseCurrency(whatIfAdjustmentAmount);
      const currentTarget = parseDate(targetDate);
      const start = startMonth
        ? clampToMonth(startMonth.getFullYear(), startMonth.getMonth(), Number(dueDay) || 1)
        : null;
      if (!start || amount <= 0 || (currentTarget && start <= currentTarget)) {
        setWhatIfActionError("Choose a valid future month and amount.");
        return;
      }
      setWhatIfRecurringChanges((current) =>
        [...current, {
          amount,
          effectiveDate: start,
          id: `change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind: (whatIfEntryMode === "minimum" ? "minimum" : "monthly-extra") as "minimum" | "monthly-extra",
        }].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime()),
      );
      setWhatIfActionError("");
      setWhatIfAdjustmentDate("");
      setWhatIfAdjustmentEndDate("");
      setWhatIfAdjustmentAmount("");
      return;
    }

    const date = parseDate(newWhatIfDate);
    const amount = parseCurrency(newWhatIfAmount);
    const currentTarget = parseDate(targetDate);
    if (!date || amount <= 0 || (currentTarget && date <= currentTarget)) {
      setWhatIfActionError("Choose a valid future payment date and amount.");
      return;
    }
    if (compareDateOnly(date, todayDate) < 0) {
      setWhatIfActionError("Future payment dates cannot be before today.");
      return;
    }

    const payment: PaymentEvent = {
      amount,
      date,
      id: `whatif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: newWhatIfLabel.trim() || "Anticipated one-time payment",
      source: "extra",
    };

    setWhatIfPayments((current) =>
      [...current, payment].sort((a, b) => a.date.getTime() - b.date.getTime()),
    );
    setWhatIfActionError("");
    setNewWhatIfDate("");
    setNewWhatIfAmount("");
    setNewWhatIfLabel("Anticipated one-time payment");
  };

  const deleteWhatIfPayment = (paymentId: string) => {
    setWhatIfPayments((current) => current.filter((payment) => payment.id !== paymentId));
  };

  const deleteWhatIfRecurringChange = (changeId: string) => {
    setWhatIfRecurringChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const deleteWhatIfDueDayChange = (changeId: string) => {
    setWhatIfDueDayChanges((current) => current.filter((change) => change.id !== changeId));
  };

  const deleteWhatIfPausePeriod = (pauseId: string) => {
    setWhatIfPausePeriods((current) => current.filter((pausePeriod) => pausePeriod.id !== pauseId));
  };

  const resetHelper = () => {
    setOneOffPayments([]);
    setHelperPausePeriods([]);
    setHelperPauseFromMonth("");
    setHelperPauseToMonth("");
    setHelperPauseMode("accrues");
    setHelperBulkMode("pause");
    setHelperAdjustmentFromMonth("");
    setHelperAdjustmentToMonth("");
    setHelperAdjustmentAmount("");
    setHelperAdjustmentDueDay("");
    setHelperRecurringChanges([]);
    setHelperDueDayChanges([]);
    setDeletedHelperRowIds([]);
    setHelperActionError("");
    setHelperPaymentAmountOverrides({});
    setPaymentDateOverrides({});
    setPaymentLabelOverrides({});
    setEditingPaymentId("");
    setEditingPaymentDate("");
    setEditingPaymentAmount("");
    setNewOneOffDate("");
    setNewOneOffAmount("");
    setNewOneOffLabel("Extra payment");
  };

  const resetWhatIf = () => {
    setWhatIfPayments([]);
    setWhatIfRecurringChanges([]);
    setWhatIfPausePeriods([]);
    setWhatIfEntryMode("one-time");
    setNewWhatIfDate("");
    setNewWhatIfAmount("");
    setNewWhatIfLabel("Anticipated one-time payment");
    setWhatIfAdjustmentDate("");
    setWhatIfAdjustmentEndDate("");
    setWhatIfAdjustmentAmount("");
    setWhatIfAdjustmentDueDay("");
    setWhatIfDueDayChanges([]);
    setWhatIfPauseFromMonth("");
    setWhatIfPauseToMonth("");
    setWhatIfPauseMode("accrues");
    setWhatIfActionError("");
  };

  const headerLoans = savedLoans.map((loan) => ({ id: loan.id, name: loan.name, balance: estimateSavedLoanBalance(loan.data), apr: Number(loan.data.aprPercent) || 0, minimum: estimateSavedAccountMinimum(loan.data) })).filter((loan) => loan.balance > 0 && loan.minimum > 0);
  const headerProjection = simulatePortfolio(headerLoans, "avalanche", 0);
  const headerOriginalDebt = savedLoans.reduce((sum, loan) => sum + (loan.data.overviewOriginalBalance ?? parseCurrency(loan.data.startingPrincipal)), 0);
  const headerProgress = headerOriginalDebt > 0 ? Math.max(0, Math.min(100, (1 - headerProjection.startingTotal / headerOriginalDebt) * 100)) : 0;

  if (!currentUserId) {
    return (
      <LoginPage
        authDisplayName={authDisplayName}
        authError={authError}
        authMode={authMode}
        authName={authName}
        authPassword={authPassword}
        cloudStorageEnabled={cloudStorageEnabled}
        onAuthDisplayNameChange={setAuthDisplayName}
        onAuthErrorChange={setAuthError}
        onAuthModeChange={setAuthMode}
        onAuthNameChange={setAuthName}
        onAuthPasswordChange={setAuthPassword}
        onSubmit={() => void handleAuthSubmit()}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: currentTheme.appBackground,
        padding: "24px 16px 48px",
        color: currentTheme.text,
        ["--app-accent" as string]: currentTheme.accent,
        ["--app-accent-soft" as string]: currentTheme.accentSoft,
        ["--app-border" as string]: currentTheme.cardBorder,
        ["--app-border-strong" as string]: currentTheme.cardBorder,
        ["--app-heading" as string]: currentTheme.text,
        ["--app-input-bg" as string]: currentTheme.surface,
        ["--app-danger-bg" as string]: currentTheme.isDark ? "rgba(127, 29, 29, 0.35)" : "#fff1f2",
        ["--app-danger-border" as string]: currentTheme.isDark ? "#7f1d1d" : "#fecaca",
        ["--app-danger-text" as string]: currentTheme.isDark ? "#fecaca" : "#991b1b",
        ["--app-negative-bg" as string]: currentTheme.isDark ? "rgba(157, 23, 77, 0.25)" : "#fff1f2",
        ["--app-negative-border" as string]: currentTheme.isDark ? "#9d174d" : "#fda4af",
        ["--app-negative-text" as string]: currentTheme.isDark ? "#f9a8d4" : "#be123c",
        ["--app-positive-bg" as string]: currentTheme.isDark ? "rgba(21, 128, 61, 0.22)" : "#ecfdf5",
        ["--app-positive-border" as string]: currentTheme.isDark ? "#166534" : "#86efac",
        ["--app-positive-text" as string]: currentTheme.isDark ? "#86efac" : "#15803d",
        ["--app-benchmark-bg" as string]: currentTheme.isDark ? "rgba(180, 83, 9, 0.22)" : "#fefce8",
        ["--app-benchmark-border" as string]: currentTheme.isDark ? "#92400e" : "#fde68a",
        ["--app-benchmark-text" as string]: currentTheme.isDark ? "#fcd34d" : "#a16207",
        ["--app-row-negative" as string]: currentTheme.isDark ? "rgba(146, 64, 14, 0.18)" : "#fffbeb",
        ["--app-row-paused" as string]: currentTheme.isDark ? "rgba(194, 65, 12, 0.16)" : "#fff7ed",
        ["--app-surface" as string]: currentTheme.surface,
        ["--app-surface-muted" as string]: currentTheme.surfaceMuted,
        ["--app-table-header" as string]: currentTheme.surfaceMuted,
        ["--app-table-border" as string]: currentTheme.cardBorder,
        ["--app-text" as string]: currentTheme.text,
        ["--app-text-muted" as string]: currentTheme.textMuted,
      }}
    >
      <div
        style={{
          maxWidth: 1760,
          margin: "0 auto",
          display: "grid",
          gap: 20,
          gridTemplateColumns: loanSidebarCollapsed ? "44px minmax(0, 1fr)" : "260px minmax(0, 1fr)",
          alignItems: "start",
        }}
      >
        <LoanSidebar
          collapsed={loanSidebarCollapsed}
          currentLoanId={currentLoanId}
          loanName={loanName}
          loans={savedLoans}
          onAdd={(type) => { startNewLoan(type); setActivePage("simulator"); }}
          onCollapse={() => setLoanSidebarCollapsed((collapsed) => !collapsed)}
          onDelete={deleteLoan}
          onOverview={() => setActivePage("overview")}
          onSelect={(loanId) => { loadSavedLoan(loanId); setActivePage("simulator"); }}
          saveStatus={saveStatus}
        />
        <div style={{ display: "grid", gap: 24, minWidth: 0 }}>
        <header style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
          <button type="button" onClick={() => { setActivePage("simulator"); setActiveLoanTab("details"); setActiveView("assumed"); }} style={{ display: "flex", gap: 14, alignItems: "center", border: 0, padding: 0, background: "transparent", color: currentTheme.text, cursor: "pointer", textAlign: "left" }}>
            <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.accent})`, boxShadow: currentTheme.cardShadow, flexShrink: 0 }} />
            <span>
              <span style={{ display: "block", fontSize: 34, fontWeight: 750, lineHeight: 1.1 }}>DebtLab</span>
              <span style={{ display: "block", marginTop: 6, color: currentTheme.textMuted, fontSize: 15 }}>
                {activePage === "paycheck" ? "Estimate pay and annual taxes." : activePage === "budget" ? "Track recurring bills and available cash flow." : activePage === "profile" ? "Manage your account and preferences." : activePage === "overview" ? "Compare payoff strategies across all saved loans." : "Model loan payments and plan your payoff."}
              </span>
            </span>
          </button>
          {headerLoans.length > 0 ? <button type="button" onClick={() => setActivePage("overview")} style={{ marginLeft: "auto", minWidth: 320, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 16px", border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 14, padding: "10px 14px", background: currentTheme.surface, color: currentTheme.text, textAlign: "left", cursor: "pointer", boxShadow: currentTheme.cardShadow }}><span style={{ fontSize: 11, color: currentTheme.textMuted }}>Remaining debt</span><span style={{ fontSize: 11, color: currentTheme.textMuted }}>Estimated payoff</span><strong>{formatCurrency(headerProjection.startingTotal)}</strong><strong>{formatMonthYear(headerProjection.payoffDate)}</strong><span style={{ gridColumn: "1 / 3", height: 5, borderRadius: 999, overflow: "hidden", background: currentTheme.surfaceMuted }}><span style={{ display: "block", width: `${headerProgress}%`, height: "100%", background: currentTheme.accent }} /></span></button> : null}
          <div ref={profileMenuRef} style={{ position: "relative" }}>
            <button type="button" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)} style={{ display: "flex", gap: 10, alignItems: "center", border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "7px 12px 7px 7px", fontWeight: 700, cursor: "pointer", boxShadow: currentTheme.cardShadow }}>
              <span aria-hidden="true" style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: currentTheme.accent, color: "#fff", fontSize: 14 }}>{profileInitial}</span>
              <span>Welcome, {firstName}</span>
              <span aria-hidden="true" style={{ fontSize: 11, color: currentTheme.textMuted }}>{profileMenuOpen ? "▲" : "▼"}</span>
            </button>
            {profileMenuOpen ? (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 30, width: 220, padding: 8, display: "grid", gap: 4, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 14, background: currentTheme.surface, boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)" }}>
                {[
                  { label: "View profile", action: () => setActivePage("profile") },
                  { label: "Pay & tax estimator", action: () => setActivePage("paycheck") },
                  { label: "Bills & budget", action: () => setActivePage("budget") },
                  { label: "Log out", action: logoutUser },
                ].map((item) => (
                  <button key={item.label} type="button" onClick={() => { setProfileMenuOpen(false); item.action(); }} style={{ border: 0, borderRadius: 9, padding: "10px 12px", background: "transparent", color: currentTheme.text, textAlign: "left", fontWeight: 600, cursor: "pointer" }}>{item.label}</button>
                ))}
              </div>
            ) : null}
          </div>
        </header>
        {saveStatus.startsWith("Saved") ? <div role="status" style={{ position: "fixed", right: 24, bottom: 24, zIndex: 60, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 12, padding: "10px 14px", background: currentTheme.surface, color: currentTheme.text, boxShadow: currentTheme.cardShadow, fontWeight: 700 }}>{saveStatus}</div> : null}
        {activePage === "overview" ? (
          <DebtOverview loans={savedLoans} theme={currentTheme} userId={currentUserId} />
        ) : activePage === "profile" ? (
          <main
            style={{
              display: "grid",
              gap: 24,
            }}
          >
            <section
              style={{
                background: currentTheme.surface,
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: 20,
                padding: 24,
                boxShadow: currentTheme.cardShadow,
                display: "grid",
                gap: 24,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
                <div style={{ display: "grid", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 28 }}>Profile</h2>
                <p style={{ margin: 0, color: currentTheme.textMuted, lineHeight: 1.6, maxWidth: 760 }}>
                  Keep your account details up to date, pick a theme for the simulator, and use a one-time reset code emailed to you when you want to change your password.
                </p>
                </div>
                <button type="button" aria-label="Close profile" onClick={() => { setActivePage("simulator"); setActiveLoanTab("details"); setActiveView("assumed"); }} style={{ width: 38, height: 38, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, background: currentTheme.surface, color: currentTheme.text, fontSize: 22, cursor: "pointer" }}>×</button>
              </div>

              {profileStatus ? (
                <div
                  style={{
                    border: `1px solid ${currentTheme.cardBorder}`,
                    background: currentTheme.accentSoft,
                    color: currentTheme.text,
                    borderRadius: 14,
                    padding: "12px 14px",
                    fontSize: 14,
                  }}
                >
                  {profileStatus}
                </div>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gap: 24,
                  gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
                }}
              >
                <div
                  style={{
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 18,
                    padding: 20,
                    display: "grid",
                    gap: 16,
                    alignContent: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 20 }}>Account details</h3>
                      <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                      Your username stays the same for login. Your profile name is what shows in the app.
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Username</span>
                      <div
                        style={{
                          border: `1px solid ${currentTheme.cardBorder}`,
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 15,
                          background: currentTheme.surfaceMuted,
                          color: currentTheme.textMuted,
                        }}
                      >
                        {currentUser?.name}
                      </div>
                    </div>
                    <Field
                      id="profile-display-name"
                      label="Your name"
                      value={profileDraftName}
                      onChange={setProfileDraftName}
                    />
                    <Field
                      id="profile-email"
                      label="Email"
                      value={profileDraftEmail}
                      onChange={setProfileDraftEmail}
                    />
                    <button
                      type="button"
                      onClick={saveProfileDetails}
                      style={{
                        border: `1px solid ${currentTheme.accent}`,
                        background: currentTheme.accent,
                        color: "#ffffff",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        justifySelf: "start",
                      }}
                    >
                      Save profile
                    </button>
                    <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${currentTheme.cardBorder}`, display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: currentTheme.text }}>Delete account</div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: currentTheme.textMuted }}>Permanently remove your profile and all saved loan data.</div>
                      <button type="button" onClick={() => setDeleteAccountConfirmOpen(true)} style={{ justifySelf: "start", border: "1px solid #ef4444", background: currentTheme.surface, color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        Delete account
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 18,
                    padding: 20,
                    display: "grid",
                    gap: 16,
                    alignContent: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 20 }}>Security</h3>
                      <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                      We will email a secure password-reset link to the address on your account.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={sendPasswordResetEmail}
                    style={{
                      border: `1px solid ${currentTheme.accent}`,
                      background: currentTheme.accent,
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      justifySelf: "start",
                      boxShadow: currentTheme.cardShadow,
                      appearance: "none",
                    }}
                  >
                    Email password-reset link
                  </button>
                  {!cloudStorageEnabled ? <div style={{ display: "grid", gap: 14 }}>
                    <Field
                      id="password-reset-code"
                      label="One-time reset code"
                      value={passwordResetCodeInput}
                      onChange={setPasswordResetCodeInput}
                    />
                    <Field
                      id="password-reset-new"
                      label="New password"
                      type="password"
                      value={passwordResetNewPassword}
                      onChange={setPasswordResetNewPassword}
                    />
                    <Field
                      id="password-reset-confirm"
                      label="Confirm new password"
                      type="password"
                      value={passwordResetConfirmPassword}
                      onChange={setPasswordResetConfirmPassword}
                    />
                    <button
                      type="button"
                      onClick={applyPasswordReset}
                      style={{
                        border: `1px solid ${currentTheme.accent}`,
                        background: currentTheme.accent,
                        color: "#ffffff",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        justifySelf: "start",
                      }}
                    >
                      Change password
                    </button>
                  </div> : null}
                </div>
              </div>

              <section
                style={{
                  border: `1px solid ${currentTheme.cardBorder}`,
                  borderRadius: 18,
                  padding: 20,
                  display: "grid",
                  gap: 16,
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 20 }}>Theme</h3>
                  <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                    Choose the look you want to use across the signed-in simulator.
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 14,
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  }}
                >
                  {Object.entries(THEME_DEFINITIONS).map(([themeId, theme]) => {
                    const isSelected = currentUser?.themeId === themeId;
                    return (
                      <button
                        key={themeId}
                        type="button"
                        onClick={() => applyThemeToProfile(themeId as ThemeId)}
                        style={{
                          border: isSelected ? `2px solid ${theme.accent}` : `1px solid ${theme.cardBorder}`,
                          background: theme.appBackground,
                          borderRadius: 16,
                          padding: 14,
                          display: "grid",
                          gap: 12,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8 }}>
                          {[theme.accent, theme.accentSoft, "#ffffff"].map((color) => (
                            <span
                              key={color}
                              aria-hidden="true"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                background: color,
                                border: "1px solid rgba(148, 163, 184, 0.35)",
                              }}
                            />
                          ))}
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{theme.name}</span>
                          <span style={{ fontSize: 12, color: theme.textMuted }}>
                            {isSelected ? "Current theme" : "Apply this theme"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </section>
          </main>
        ) : activePage === "paycheck" ? (
          <PaycheckPage userId={currentUserId} onClose={() => { setActivePage("simulator"); setActiveLoanTab("details"); setActiveView("assumed"); }} />
        ) : activePage === "budget" ? (
          <BudgetPage loans={savedLoans} theme={currentTheme} userId={currentUserId} onClose={() => setActivePage("simulator")} />
        ) : (
        <main style={{ display: "grid", gap: 0, minWidth: 0 }}>
            <nav aria-label="Loan workspace" style={{ display: "flex", alignItems: "end", borderBottom: `1px solid ${currentTheme.cardBorder}` }}>
              {([
                ["details", accountType === "credit-card" ? "Card Details" : "Loan Details"],
                ...(accountType === "credit-card" ? [["transactions", "Transactions"]] : []),
                ["history", "Payoff Schedule"],
                ["whatif", "What If"],
              ] as const).map(([tab, label]) => (
                <button key={tab} type="button" onClick={() => { setActiveLoanTab(tab as "details" | "transactions" | "history" | "whatif"); if (tab === "history" || tab === "whatif") setActiveView(tab); else setActiveView("assumed"); }} style={{ flex: "1 1 0", marginBottom: -1, border: `1px solid ${currentTheme.cardBorder}`, borderBottomColor: activeLoanTab === tab ? currentTheme.surface : currentTheme.cardBorder, borderRadius: "14px 14px 0 0", padding: "13px 16px", background: activeLoanTab === tab ? currentTheme.surface : currentTheme.surfaceMuted, color: currentTheme.text, fontWeight: 700, cursor: "pointer" }}>{label}</button>
              ))}
            </nav>
            <div style={{ display: "grid", gap: 24, gridTemplateColumns: activeLoanTab === "details" || activeLoanTab === "transactions" ? "minmax(0, 1fr)" : "360px minmax(0, 1fr)", alignItems: "start", minWidth: 0, paddingTop: 20 }}>
          <section
            style={{
              background: currentTheme.surface,
              border: `1px solid ${currentTheme.cardBorder}`,
              borderRadius: 18,
              padding: 20,
              textAlign: "left",
              display: "grid",
              gridTemplateColumns: activeLoanTab === "details" ? "repeat(auto-fit, minmax(280px, 1fr))" : undefined,
              gap: 16,
              boxShadow: currentTheme.cardShadow,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 22, gridColumn: activeLoanTab === "details" || activeLoanTab === "transactions" ? "1 / -1" : undefined }}>
              {activeLoanTab === "details"
                ? accountType === "credit-card" ? "Credit Card Details" : "Loan Details"
                : activeLoanTab === "transactions"
                  ? "Transactions"
                : activeLoanTab === "history"
                   ? "Payoff Schedule"
                  : "What If"}
            </h2>
            {activeLoanTab === "details" ? (
              <>
                <FormSection title="Loan basics">
                  <Field label={accountType === "credit-card" ? "Credit card name" : "Loan name"} id="loan-name" value={loanName} onChange={setLoanName} />
                  <CurrencyField label={accountType === "credit-card" ? "Current balance" : "Starting principal"} id="starting-principal" value={startingPrincipal} onChange={setStartingPrincipal} />
                  <Field label={accountType === "credit-card" ? "Standard APR (%)" : "APR (%)"} id="apr" value={aprPercent} onChange={setAprPercent} />
                  {accountType === "credit-card" ? <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12, padding: 14, borderRadius: 14, background: currentTheme.surfaceMuted, border: `1px solid ${currentTheme.cardBorder}` }}><strong>Credit card promotion</strong><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}><label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Promotion type</span><select value={promoType} onChange={(event) => setPromoType(event.target.value as "none" | "zero" | "deferred")} style={{ boxSizing: "border-box", width: "100%", border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, padding: "10px 12px", background: currentTheme.surface, color: currentTheme.text }}><option value="none">No promotion</option><option value="zero">0% APR until a date</option><option value="deferred">Deferred interest until a date</option></select></label>{promoType !== "none" ? <DateField label="Promotion end date" id="promo-end-date" value={promoEndDate} onChange={setPromoEndDate} /> : null}</div>{promoType === "zero" ? <span style={{ fontSize: 12, color: currentTheme.textMuted }}>No interest accrues during the promotional period; the standard APR applies after the end date.</span> : promoType === "deferred" ? <span style={{ fontSize: 12, color: currentTheme.textMuted }}>Deferred interest may be charged retroactively if the promotional balance is not paid by the end date.</span> : null}</div> : null}
                </FormSection>
                {accountType === "loan" ? <FormSection title="Timeline">
                  <DateField label="Starting principal date" id="starting-date" value={startingPrincipalDate} onChange={setStartingPrincipalDate} />
                  <DateField label="First scheduled payment date" id="first-payment-date" value={firstPaymentDate} minDate={startingPrincipalDate} onChange={setFirstPaymentDate} />
                  <DateField label="Calculate current balance through" id="target-date" value={targetDate} minDate={targetDateMinValue} onChange={setTargetDate} />
                </FormSection> : <FormSection title="Card account cycle" helper="The statement date starts the billing cycle; the due day is the deadline for that cycle's payment.">
                  <DateField label="Statement date" id="card-statement-date" value={cardStatementDate} onChange={setCardStatementDate} />
                  <label style={{ display: "grid", gap: 6, width: 96 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Due day</span><input id="card-due-day" inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value.replace(/[^0-9]/g, "").slice(0, 2))} style={{ width: 96, boxSizing: "border-box", border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, padding: "10px 12px", background: currentTheme.surface, color: currentTheme.text }} /></label>
                </FormSection>}
                <FormSection title="Recurring payment rules">
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, minWidth: 0 }}>
                  {accountType === "credit-card" ? <><label style={{ display: "grid", gap: 6, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Minimum payment rule</span><select value={cardMinimumMode} onChange={(event) => setCardMinimumMode(event.target.value as "percent" | "fixed")} style={{ boxSizing: "border-box", width: "100%", minWidth: 0, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, padding: "10px 12px", background: currentTheme.surface, color: currentTheme.text }}><option value="percent">Percentage of balance</option><option value="fixed">Fixed minimum</option></select></label>{cardMinimumMode === "percent" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, minWidth: 0, width: "100%" }}><div style={{ minWidth: 0, width: "100%" }}><Field label="Percent of balance" id="card-minimum-percent" value={cardMinimumPercent} onChange={setCardMinimumPercent} /></div><div style={{ minWidth: 0, width: "100%" }}><CurrencyField label="Minimum floor" id="card-minimum-floor" value={cardMinimumFloor} onChange={setCardMinimumFloor} /></div></div> : <CurrencyField label="Fixed minimum payment" id="minimum-payment" value={minimumPayment} onChange={setMinimumPayment} />}</> : <CurrencyField label="Minimum payment" id="minimum-payment" value={minimumPayment} onChange={setMinimumPayment} />}
                  <CurrencyField label="Monthly extra payment" id="additional-monthly-payment" value={additionalMonthlyPayment} onChange={setAdditionalMonthlyPayment} />
                  {accountType === "loan" ? <Field label="Recurring due day" id="due-day" value={dueDay} onChange={setDueDay} /> : <div style={{ fontSize: 12, color: currentTheme.textMuted }}>The projected minimum is recalculated from the balance each month.</div>}
                  </div>
                  {accountType === "credit-card" && promoType !== "none" ? <div style={{ display: "grid", gap: 10, padding: 12, borderRadius: 10, background: currentTheme.surfaceMuted, border: `1px solid ${currentTheme.cardBorder}` }}><strong style={{ fontSize: 13 }}>Payment rule after promotion ends</strong><span style={{ fontSize: 12, color: currentTheme.textMuted }}>Set the recurring minimum that begins after the 0% or deferred-interest period. This is separate from the promotional minimum above.</span><label style={{ display: "grid", gap: 6, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Post-promotion minimum</span><select value={postPromoMinimumMode} onChange={(event) => setPostPromoMinimumMode(event.target.value as "percent" | "fixed")} style={{ boxSizing: "border-box", width: "100%", minWidth: 0, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, padding: "10px 12px", background: currentTheme.surface, color: currentTheme.text }}><option value="percent">Percentage of balance</option><option value="fixed">Fixed amount</option></select></label>{postPromoMinimumMode === "percent" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, minWidth: 0 }}><Field label="Percent after promotion" id="post-promo-percent" value={postPromoMinimumPercent} onChange={setPostPromoMinimumPercent} /><CurrencyField label="Minimum floor after promotion" id="post-promo-floor" value={postPromoMinimumFloor} onChange={setPostPromoMinimumFloor} /></div> : <CurrencyField label="Fixed minimum after promotion" id="post-promo-fixed" value={postPromoFixedMinimum} onChange={setPostPromoFixedMinimum} />}</div> : null}
                </FormSection>
                {accountType === "loan" ? <FormSection title="Accrual / calendar behavior" helper="These rules control how scheduled dates and daily interest are calculated.">
                  <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                    <input type="checkbox" checked={moveWeekend} onChange={(event) => setMoveWeekend(event.target.checked)} />
                    Move scheduled due dates that fall on weekends to next weekday
                  </label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                    <input type="checkbox" checked={roundDailyInterest} onChange={(event) => setRoundDailyInterest(event.target.checked)} />
                    Round daily interest before summing
                  </label>
                  <div style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Daily interest basis</span>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                        <input type="radio" name="day-count-basis" checked={dayCountBasis === "365"} onChange={() => setDayCountBasis("365")} />
                        Always divide APR by 365
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                        <input type="radio" name="day-count-basis" checked={dayCountBasis === "actual-year"} onChange={() => setDayCountBasis("actual-year")} />
                        Use 366 during leap years
                      </label>
                    </div>
                    <span style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4 }}>
                      Your July 3, 2024 first-payment example strongly suggests your lender may be using 366 for 2024.
                    </span>
                  </div>
                </FormSection> : null}
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}><button type="button" onClick={saveCurrentLoan} style={{ border: `1px solid ${currentTheme.accent}`, background: currentTheme.accent, color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{currentLoanId ? "Save changes" : accountType === "credit-card" ? "Create credit card" : "Create loan"}</button></div>
              </>
            ) : activeLoanTab === "transactions" ? (
              <CreditCardActivityEditor theme={currentTheme} transactions={creditCardTransactions} onChange={setCreditCardTransactions} />
            ) : activeLoanTab === "history" ? (
              <>
                <div
                  style={{
                    background: currentTheme.surfaceMuted,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 12,
                    padding: 14,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Add one-time payment</div>
                    <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4, marginTop: 4 }}>
                      Insert a payment by date and amount. The payoff schedule will place it in the
                      correct order and recalculate from there.
                    </div>
                  </div>
                  <DateField
                    id="new-one-off-date"
                    label="Payment date"
                    maxDate={todayValue}
                    value={newOneOffDate}
                    onChange={setNewOneOffDate}
                  />
                  <CurrencyField
                    id="new-one-off-amount"
                    label="Payment amount"
                    value={newOneOffAmount}
                    onChange={setNewOneOffAmount}
                  />
                  <Field
                    id="new-one-off-label"
                    label="Memo"
                    value={newOneOffLabel}
                    onChange={setNewOneOffLabel}
                  />
                  <button
                    type="button"
                    onClick={addOneOffPayment}
                    style={{
                      border: `1px solid ${currentTheme.accent}`,
                      background: currentTheme.accent,
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Add one-time payment
                  </button>
                </div>

                <div
                  style={{
                    background: currentTheme.surfaceMuted,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 12,
                    padding: 14,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Bulk adjust schedule</div>
                    <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4, marginTop: 4 }}>
                      Apply a month-range change instead of editing several scheduled rows one at a time.
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="helper-bulk-mode"
                        checked={helperBulkMode === "pause"}
                        onChange={() => setHelperBulkMode("pause")}
                      />
                      Pause / stop payments
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="helper-bulk-mode"
                        checked={helperBulkMode === "monthly-extra"}
                        onChange={() => setHelperBulkMode("monthly-extra")}
                      />
                      Update monthly extra payment
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="helper-bulk-mode"
                        checked={helperBulkMode === "minimum"}
                        onChange={() => setHelperBulkMode("minimum")}
                      />
                      Update minimum payment
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="helper-bulk-mode"
                        checked={helperBulkMode === "due-day"}
                        onChange={() => setHelperBulkMode("due-day")}
                      />
                      Change payment due date
                    </label>
                  </div>
                  <MonthYearField
                    id="helper-pause-from"
                    label="From"
                    maxMonth={helperMaxMonthValue}
                    value={helperBulkMode === "pause" ? helperPauseFromMonth : helperAdjustmentFromMonth}
                    onChange={helperBulkMode === "pause" ? setHelperPauseFromMonth : setHelperAdjustmentFromMonth}
                  />
                  <MonthYearField
                    id="helper-pause-to"
                    label="To"
                    maxMonth={helperMaxMonthValue}
                    value={helperBulkMode === "pause" ? helperPauseToMonth : helperAdjustmentToMonth}
                    onChange={helperBulkMode === "pause" ? setHelperPauseToMonth : setHelperAdjustmentToMonth}
                  />
                  {helperBulkMode === "pause" ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Pause behavior</span>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                        <input
                          type="radio"
                          name="helper-pause-mode"
                          checked={helperPauseMode === "accrues"}
                          onChange={() => setHelperPauseMode("accrues")}
                        />
                        Interest continues to accrue
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                        <input
                          type="radio"
                          name="helper-pause-mode"
                          checked={helperPauseMode === "paused"}
                          onChange={() => setHelperPauseMode("paused")}
                        />
                        Interest is paused
                      </label>
                    </div>
                  ) : helperBulkMode === "due-day" ? (
                    <Field
                      id="helper-adjustment-due-day"
                      label="New due day"
                      value={helperAdjustmentDueDay}
                      onChange={setHelperAdjustmentDueDay}
                    />
                  ) : (
                    <CurrencyField
                      id="helper-adjustment-amount"
                      label={helperBulkMode === "minimum" ? "New minimum payment" : "New monthly extra payment"}
                      value={helperAdjustmentAmount}
                      onChange={setHelperAdjustmentAmount}
                    />
                  )}
                  <button
                    type="button"
                    onClick={addHelperBulkAdjustment}
                    style={{
                      border: `1px solid ${currentTheme.accent}`,
                      background: currentTheme.accent,
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {helperBulkMode === "pause" ? "Apply pause" : helperBulkMode === "due-day" ? "Apply due-date change" : "Apply adjustment"}
                  </button>
                  {helperActionError ? (
                    <div
                      style={{
                        border: "1px solid var(--app-danger-border, #fecaca)",
                        background: "var(--app-danger-bg, #fff1f2)",
                        color: "var(--app-danger-text, #991b1b)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontSize: 13,
                      }}
                    >
                      {helperActionError}
                    </div>
                  ) : null}
                  {helperPausePeriods.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {helperPausePeriods.map((pausePeriod) => (
                        <div
                          key={pausePeriod.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                            borderTop: `1px solid ${currentTheme.cardBorder}`,
                            paddingTop: 8,
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            Pause payments from {formatPauseRange(pausePeriod)} with{" "}
                            {pausePeriod.mode === "paused" ? "interest paused" : "interest accruing"}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteHelperPausePeriod(pausePeriod.id)}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {helperRecurringChanges.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {helperRecurringChanges.map((change) => (
                        <div
                          key={change.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                            borderTop: `1px solid ${currentTheme.cardBorder}`,
                            paddingTop: 8,
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            {change.kind === "minimum" ? "Minimum payment" : "Monthly extra payment"} becomes{" "}
                            {formatCurrency(change.amount)} from {formatPauseRange({
                              startMonth: change.effectiveDate,
                              endMonth: change.endDate ?? change.effectiveDate,
                              id: change.id,
                              mode: "accrues",
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteHelperRecurringChange(change.id)}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {helperDueDayChanges.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {helperDueDayChanges.map((change) => (
                        <div
                          key={change.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                            borderTop: `1px solid ${currentTheme.cardBorder}`,
                            paddingTop: 8,
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            Due day becomes {change.day} from {formatMonth(change.startMonth)}{change.endMonth ? ` through ${formatMonth(change.endMonth)}` : ""}
                          </div>
                          <button type="button" onClick={() => deleteHelperDueDayChange(change.id)} style={{ border: "1px solid #ef4444", background: currentTheme.surface, color: "#b91c1c", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>Delete</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={resetHelper}
                  style={{
                    border: `1px solid ${currentTheme.cardBorder}`,
                    background: currentTheme.surface,
                    color: currentTheme.text,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Reset all changes
                </button>
              </>
            ) : activeLoanTab === "whatif" ? (
              <>
                <div
                  style={{
                    background: currentTheme.surfaceMuted,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 12,
                    padding: 14,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Adjust projected payments</div>
                    <div style={{ fontSize: 12, color: currentTheme.textMuted, lineHeight: 1.4, marginTop: 4 }}>
                      This starts from the payment-history balance as of the selected date, then applies
                      future payment changes to project a new payoff path.
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="what-if-entry-mode"
                        checked={whatIfEntryMode === "one-time"}
                        onChange={() => setWhatIfEntryMode("one-time")}
                      />
                      Add one-time anticipated payment
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="what-if-entry-mode"
                        checked={whatIfEntryMode === "monthly-extra"}
                        onChange={() => setWhatIfEntryMode("monthly-extra")}
                      />
                      Update monthly extra payment
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="what-if-entry-mode"
                        checked={whatIfEntryMode === "minimum"}
                        onChange={() => setWhatIfEntryMode("minimum")}
                      />
                      Update minimum payment
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="what-if-entry-mode"
                        checked={whatIfEntryMode === "pause"}
                        onChange={() => setWhatIfEntryMode("pause")}
                      />
                      Pause / forbearance
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                      <input
                        type="radio"
                        name="what-if-entry-mode"
                        checked={whatIfEntryMode === "due-day"}
                        onChange={() => setWhatIfEntryMode("due-day")}
                      />
                      Change payment due date
                    </label>
                  </div>
                  {whatIfEntryMode === "one-time" ? (
                    <>
                      <DateField
                        id="new-what-if-date"
                        label="Future payment date"
                        minDate={whatIfMinDateValue}
                        value={newWhatIfDate}
                        onChange={setNewWhatIfDate}
                      />
                      <CurrencyField
                        id="new-what-if-amount"
                        label="Payment amount"
                        value={newWhatIfAmount}
                        onChange={setNewWhatIfAmount}
                      />
                      <Field
                        id="new-what-if-label"
                        label="Memo"
                        value={newWhatIfLabel}
                        onChange={setNewWhatIfLabel}
                      />
                    </>
                  ) : whatIfEntryMode === "pause" ? (
                    <>
                      <MonthYearField
                        id="what-if-pause-from"
                        label="From"
                        value={whatIfPauseFromMonth}
                        onChange={setWhatIfPauseFromMonth}
                      />
                      <MonthYearField
                        id="what-if-pause-to"
                        label="To"
                        value={whatIfPauseToMonth}
                        onChange={setWhatIfPauseToMonth}
                      />
                      <div style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Pause behavior</span>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                          <input
                            type="radio"
                            name="what-if-pause-mode"
                            checked={whatIfPauseMode === "accrues"}
                            onChange={() => setWhatIfPauseMode("accrues")}
                          />
                          Interest continues to accrue
                        </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: currentTheme.text }}>
                          <input
                            type="radio"
                            name="what-if-pause-mode"
                            checked={whatIfPauseMode === "paused"}
                            onChange={() => setWhatIfPauseMode("paused")}
                          />
                          Interest is paused
                        </label>
                      </div>
                    </>
                  ) : whatIfEntryMode === "due-day" ? (
                    <>
                      <MonthYearField id="what-if-adjustment-date" label="Beginning month" value={whatIfAdjustmentDate} onChange={setWhatIfAdjustmentDate} />
                      <MonthYearField id="what-if-adjustment-end-date" label="Ending month (optional)" value={whatIfAdjustmentEndDate} onChange={setWhatIfAdjustmentEndDate} />
                      <Field id="what-if-adjustment-due-day" label="New due day" value={whatIfAdjustmentDueDay} onChange={setWhatIfAdjustmentDueDay} />
                    </>
                  ) : (
                    <>
                      <MonthYearField
                        id="what-if-adjustment-date"
                        label="Month"
                        value={whatIfAdjustmentDate}
                        onChange={setWhatIfAdjustmentDate}
                      />
                      <MonthYearField
                        id="what-if-adjustment-end-date"
                        label="Ending month (optional)"
                        value={whatIfAdjustmentEndDate}
                        onChange={setWhatIfAdjustmentEndDate}
                      />
                      <Field
                        id="what-if-adjustment-amount"
                        label={whatIfEntryMode === "minimum" ? "New minimum payment" : "New monthly extra payment"}
                        value={whatIfAdjustmentAmount}
                        onChange={setWhatIfAdjustmentAmount}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={addWhatIfPayment}
                    style={{
                      border: `1px solid ${currentTheme.accent}`,
                      background: currentTheme.accent,
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {whatIfEntryMode === "one-time"
                      ? "Add anticipated payment"
                      : whatIfEntryMode === "pause"
                        ? "Apply pause"
                      : whatIfEntryMode === "due-day"
                        ? "Apply due-date change"
                      : whatIfEntryMode === "minimum"
                        ? "Update minimum payment"
                        : "Update monthly extra payment"}
                  </button>
                  {whatIfActionError ? (
                    <div
                      style={{
                        border: "1px solid var(--app-danger-border, #fecaca)",
                        background: "var(--app-danger-bg, #fff1f2)",
                        color: "var(--app-danger-text, #991b1b)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontSize: 13,
                      }}
                    >
                      {whatIfActionError}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={resetWhatIf}
                  style={{
                    border: `1px solid ${currentTheme.cardBorder}`,
                    background: currentTheme.surface,
                    color: currentTheme.text,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Reset all changes
                </button>
              </>
            ) : null}
          </section>

          <section style={{ display: activeLoanTab === "details" || activeLoanTab === "transactions" ? "none" : "grid", gap: 24, textAlign: "left", width: "100%", minWidth: 0 }}>
            <div
              style={{
                background: currentTheme.surface,
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: 18,
                padding: 20,
                display: "grid",
                gap: 20,
                boxShadow: currentTheme.cardShadow,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>{loanName || "Loan"} summary</h2>
                <div style={{ fontSize: 12, color: currentTheme.textMuted }}>Current state as of {targetDate || "-"}</div>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                }}
              >
                <SummaryValue label="APR" value={formatPercent(Number(aprPercent) || 0)} />
                <SummaryValue label="Starting balance" value={formatCurrency(parseCurrency(startingPrincipal))} />
                <SummaryValue label="Minimum payment" value={formatCurrency(parseCurrency(minimumPayment))} />
                <SummaryValue label="Monthly extra payment" value={formatCurrency(parseCurrency(additionalMonthlyPayment))} />
                <SummaryValue
                  label="Total scheduled payment"
                  value={formatCurrency(parseCurrency(totalMonthlyPayment))}
                  subtext="Minimum payment + monthly extra payment"
                />
                <SummaryValue label="Next scheduled payment date" value={nextPaymentDate} />
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <SummaryGroupLabel label="OUTSTANDING BALANCES" />
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  }}
                >
                  <SummaryValue
                    label="Principal"
                    value={formatCurrency(activeView === "assumed" ? assumedResult.currentPrincipal : historyResult.currentPrincipal)}
                  />
                  <SummaryValue
                    label="Interest"
                    value={formatCurrency(activeView === "assumed" ? assumedResult.currentInterest : historyResult.currentInterest)}
                  />
                  <SummaryValue
                    label="Total balance"
                    value={formatCurrency(activeView === "assumed" ? assumedResult.totalBalance : historyResult.totalBalance)}
                    emphasized
                    tone="benchmark"
                  />
                </div>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <SummaryGroupLabel label="PAYOFF OUTLOOK" />
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  }}
                >
                  <SummaryValue
                    label="Payoff progress"
                    value={formatPercent(activePayoffPercent)}
                    emphasized
                    subtext={
                      <div style={{ display: "grid", gap: 8 }}>
                        <div>{`You've paid off ${Math.round(activePayoffPercent)}% of your loan`}</div>
                        <div
                          style={{
                            width: "100%",
                            height: 8,
                            borderRadius: 999,
                            background: currentTheme.isDark ? "rgba(96, 165, 250, 0.18)" : "#dbeafe",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                            width: `${Math.max(0, Math.min(100, activePayoffPercent))}%`,
                            height: "100%",
                              background: `linear-gradient(90deg, ${currentTheme.accent}, ${currentTheme.isDark ? "#93c5fd" : "#38bdf8"})`,
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </div>
                    }
                  />
                  <SummaryValue
                    label="Projected payoff"
                    value={formatMonthYear(activeProjectedPayoffDate)}
                    emphasized
                    subtext={activePayoffDuration === "-" ? undefined : `~${activePayoffDuration} remaining`}
                  />
                  <SummaryValue
                    label={<LabelWithNotes text="Time difference vs minimum-only plan" notes={[1]} />}
                    value={activeTimeSavedLabel}
                    emphasized
                  />
                </div>
              </div>
              {negativeAmortizationWarning ? (
                <div
                  style={{
                    border: "1px solid #fbbf24",
                    background: currentTheme.isDark ? "rgba(146, 64, 14, 0.18)" : "#fffbeb",
                    color: "#92400e",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Negative amortization detected: at least one cycle has a payment that does not
                  reduce principal, so the balance can grow.
                </div>
              ) : null}
              {!negativeAmortizationWarning && softDangerMessage ? (
                <div
                  style={{
                    border: "1px solid #fde68a",
                    background: currentTheme.isDark ? "rgba(146, 64, 14, 0.18)" : "#fffbeb",
                    color: "#92400e",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {softDangerMessage}
                </div>
              ) : null}
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 14,
                  borderRadius: 14,
                  background: currentTheme.surfaceMuted,
                  border: `1px solid ${currentTheme.cardBorder}`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: currentTheme.text }}>Additional details</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setShowHistoricalDetails((value) => !value)} style={{ border: `1px solid ${showHistoricalDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showHistoricalDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Historical details</button>
                  <button type="button" onClick={() => setShowFutureDetails((value) => !value)} style={{ border: `1px solid ${showFutureDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showFutureDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Future projection details</button>
                  <button type="button" onClick={() => setShowLifetimeDetails((value) => !value)} style={{ border: `1px solid ${showLifetimeDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showLifetimeDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Lifetime details</button>
                  {activeView === "whatif" ? (
                    <button type="button" onClick={() => setShowComparisonDetails((value) => !value)} style={{ border: `1px solid ${showComparisonDetails ? currentTheme.accent : currentTheme.cardBorder}`, background: showComparisonDetails ? currentTheme.accentSoft : currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Comparison details</button>
                  ) : null}
                  <button type="button" onClick={() => { setShowHistoricalDetails(true); setShowFutureDetails(true); setShowLifetimeDetails(true); setShowComparisonDetails(activeView === "whatif"); }} style={{ border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Expand all</button>
                  <button type="button" onClick={() => { setShowHistoricalDetails(false); setShowFutureDetails(false); setShowLifetimeDetails(false); setShowComparisonDetails(false); }} style={{ border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Collapse all</button>
                </div>
              </div>
              {activeView === "assumed" && showHistoricalDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label={`PAID AS OF ${targetDate || "-"}`} />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Principal paid"
                        value={formatCurrency(assumedResult.totalPrincipalPaid)}
                      />
                      <SummaryValue
                        label="Interest paid"
                        value={formatCurrency(assumedResult.totalInterestPaid)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Interest difference vs minimum-only plan" notes={[1]} />}
                        value={formatCurrency(assumedInterestSavedAsOfToday)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "assumed" && showFutureDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="REMAINING INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label={<LabelWithNotes text="Interest" notes={assumedRemainingInterestNotes} />}
                        value={formatCurrency(assumedScenarioRemainingInterest)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Additional interest cost", positive: "Additional interest saved", value: assumedScenarioRemainingSaved })} notes={assumedRemainingSavedNotes} />}
                        value={formatCurrency(Math.abs(assumedScenarioRemainingSaved))}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "assumed" && showLifetimeDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="LIFETIME INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Minimum only payments"
                        value={formatCurrency(minimumOnlyLifetimeInterest)}
                        emphasized
                        tone="benchmark"
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Actual interest" notes={[3]} />}
                        value={formatCurrency(assumedScenarioLifetimeInterest)}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Daily interest cost" notes={[3]} />}
                        value={`${formatCurrency(activeDailyInterestCost)} / day`}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Extra interest vs minimum-only plan", positive: "Interest saved vs minimum-only plan", value: assumedScenarioLifetimeSaved })} notes={assumedLifetimeSavedNotes} />}
                        value={formatCurrency(Math.abs(assumedScenarioLifetimeSaved))}
                        emphasized
                        tone={assumedLifetimeSavedTone}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "history" && showHistoricalDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label={`PAID AS OF ${targetDate || "-"}`} />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Principal paid"
                        value={formatCurrency(historyResult.totalPrincipalPaid)}
                      />
                      <SummaryValue
                        label="Interest paid"
                        value={formatCurrency(historyResult.totalInterestPaid)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Interest difference vs minimum-only plan" notes={[1]} />}
                        value={formatCurrency(helperInterestSavedAsOfToday)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "history" && showFutureDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="REMAINING INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label={<LabelWithNotes text="Interest" notes={helperRemainingInterestNotes} />}
                        value={formatCurrency(helperScenarioRemainingInterest)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Additional interest cost", positive: "Additional interest saved", value: helperScenarioRemainingSaved })} notes={helperRemainingSavedNotes} />}
                        value={formatCurrency(Math.abs(helperScenarioRemainingSaved))}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "history" && showLifetimeDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="LIFETIME INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Minimum only payments"
                        value={formatCurrency(minimumOnlyLifetimeInterest)}
                        emphasized
                        tone="benchmark"
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Actual interest" notes={[3]} />}
                        value={formatCurrency(helperScenarioLifetimeInterest)}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Daily interest cost" notes={[3]} />}
                        value={`${formatCurrency(activeDailyInterestCost)} / day`}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Extra interest vs minimum-only plan", positive: "Interest saved vs minimum-only plan", value: helperScenarioLifetimeSaved })} notes={helperLifetimeSavedNotes} />}
                        value={formatCurrency(Math.abs(helperScenarioLifetimeSaved))}
                        emphasized
                        tone={helperLifetimeSavedTone}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "whatif" && showHistoricalDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label={`PAID AS OF ${targetDate || "-"}`} />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Principal paid"
                        value={formatCurrency(historyResult.totalPrincipalPaid)}
                      />
                      <SummaryValue
                        label="Interest paid"
                        value={formatCurrency(historyResult.totalInterestPaid)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Interest difference vs minimum-only plan" notes={[1]} />}
                        value={formatCurrency(helperInterestSavedAsOfToday)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "whatif" && showFutureDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="REMAINING INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label={<LabelWithNotes text="Interest" notes={whatIfRemainingInterestNotes} />}
                        value={formatCurrency(whatIfScenarioRemainingInterest)}
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Additional interest cost", positive: "Additional interest saved", value: whatIfProjectedExtrasSavedRemaining })} notes={whatIfAdditionalSavedNotes} />}
                        value={formatCurrency(Math.abs(whatIfProjectedExtrasSavedRemaining))}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "whatif" && showLifetimeDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <SummaryGroupLabel label="LIFETIME INTEREST" />
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label="Minimum only payments"
                        value={formatCurrency(minimumOnlyLifetimeInterest)}
                        emphasized
                        tone="benchmark"
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Actual interest" notes={[3]} />}
                        value={formatCurrency(whatIfScenarioLifetimeInterest)}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text="Daily interest cost" notes={[3]} />}
                        value={`${formatCurrency(activeDailyInterestCost)} / day`}
                        emphasized
                      />
                      <SummaryValue
                        label={<LabelWithNotes text={getDifferenceLabel({ negative: "Extra interest vs minimum-only plan", positive: "Interest saved vs minimum-only plan", value: whatIfScenarioSaved })} notes={whatIfLifetimeSavedNotes} />}
                        value={formatCurrency(Math.abs(whatIfScenarioSaved))}
                        emphasized
                        tone={whatIfLifetimeSavedTone}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === "whatif" && showComparisonDetails ? (
                <div style={{ display: "grid", gap: 22 }}>
                  <div
                  style={{
                      border: `1px solid ${currentTheme.isDark ? currentTheme.accent : "#dbeafe"}`,
                      background: currentTheme.isDark ? "rgba(30, 58, 95, 0.45)" : "#f8fbff",
                      borderRadius: 12,
                      padding: 14,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: currentTheme.isDark ? "#93c5fd" : "#1d4ed8" }}>
                      Current baseline plan vs what-if plan
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <SummaryValue
                        label={getDifferenceLabel({ negative: "Interest difference vs current baseline", positive: "Interest difference vs current baseline", value: whatIfDeltaInterest })}
                        value={formatCurrency(Math.abs(whatIfDeltaInterest))}
                        subtext={
                          whatIfDeltaInterest < 0
                            ? "Higher than the current baseline"
                            : whatIfDeltaInterest > 0
                              ? "Lower than the current baseline"
                              : undefined
                        }
                      />
                      <SummaryValue
                        label="Time difference vs current baseline"
                        value={whatIfTimeChangeLabel}
                      />
                      <SummaryValue
                        label="Payoff date vs current baseline"
                        value={formatMonthYear(whatIfProjection.payoffDate)}
                        subtext={`Current baseline: ${formatMonthYear(whatIfBaselinePayoffDate)}`}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              <div style={{ display: "grid", gap: 6, fontSize: 12, color: currentTheme.textMuted, marginTop: 4 }}>
                <div>1. Compared to minimum-only payments.</div>
                <div>{footnote2Text}</div>
              </div>
            </div>

            {activeLoanTab === "details" ? null : activeView === "assumed" ? (
              <>
                {assumedResult.errors.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {assumedResult.errors.map((error) => (
                      <div
                        key={error}
                        style={{
                          border: "1px solid var(--app-danger-border, #fecaca)",
                          background: "var(--app-danger-bg, #fff1f2)",
                          color: "var(--app-danger-text, #991b1b)",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div
                  style={{
                    background: currentTheme.surface,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 18,
                    padding: 20,
                    width: "100%",
                    minWidth: 0,
                    boxShadow: currentTheme.cardShadow,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 22 }}>Assumed payment schedule</h2>
                      <p style={{ margin: "8px 0 0", color: currentTheme.textMuted, fontSize: 14 }}>
                        This table is based only on the recurring minimum payment assumptions above.
                      </p>
                    </div>
                    <div style={{ display: "grid", gap: 8, justifyItems: "start", maxWidth: 320 }}>
                      <button
                        type="button"
                        onClick={() => setShowAmortization((value) => !value)}
                        style={{
                          border: `1px solid ${currentTheme.cardBorder}`,
                          background: currentTheme.surface,
                          color: currentTheme.text,
                          borderRadius: 999,
                          padding: "10px 16px",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {showAmortization ? "Hide future amortization" : "Show future amortization"}
                      </button>
                    </div>
                  </div>

                  {!canShowAssumedSchedule ? (
                    <div
                      style={{
                        border: `1px dashed ${currentTheme.cardBorder}`,
                        borderRadius: 12,
                        padding: 16,
                        color: currentTheme.textMuted,
                      }}
                    >
                      Enter both the starting principal date and first scheduled payment date to show
                      the assumed schedule.
                    </div>
                  ) : assumedResult.errors.length > 0 ? (
                    <div
                      style={{
                        border: `1px dashed ${currentTheme.cardBorder}`,
                        borderRadius: 12,
                        padding: 16,
                        color: currentTheme.textMuted,
                      }}
                    >
                      Enter the loan inputs to build the assumed schedule.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "14%" }} />
                        </colgroup>
                        <thead>
                          <tr style={{ background: currentTheme.surfaceMuted }}>
                            {["Date", "Payment", "Interest paid", "Principal paid", "% to principal", "Outstanding principal", "Outstanding interest", "Total outstanding balance"].map((heading) => (
                              <th
                                key={heading}
                                style={{
                                  padding: "10px 8px",
                                  borderBottom: `1px solid ${currentTheme.cardBorder}`,
                                  fontSize: 14,
                                  textAlign: "left",
                                  color: currentTheme.textMuted,
                                }}
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(showAmortization ? amortizationProjection.rows : assumedResult.rows).map((row) => (
                            <tr key={`${row.eventType}-${row.label}-${row.paymentDate.toISOString()}`} style={getTableRowStyle(row)}>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14, whiteSpace: "nowrap" }}>{toDateInputValue(row.paymentDate)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.paymentAmount)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>
                                <div>{formatCurrency(row.interestPaid)}</div>
                                {row.eventType === "paused" && row.accruedInterest > 0 ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>
                                    Accrued {formatCurrency(row.accruedInterest)}
                                  </div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.principalPaid)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>
                                <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                {row.negativeAmortization ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>Negative amortization</div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.endingPrincipal)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.endingInterest)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 14 }}>{formatCurrency(row.endingPrincipal + row.endingInterest)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : activeView === "history" ? (
              <>
                {historyErrors.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {historyErrors.map((error) => (
                      <div
                        key={error}
                        style={{
                          border: "1px solid var(--app-danger-border, #fecaca)",
                          background: "var(--app-danger-bg, #fff1f2)",
                          color: "var(--app-danger-text, #991b1b)",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                ) : null}
                {helperActionError ? (
                  <div
                    style={{
                      border: "1px solid var(--app-danger-border, #fecaca)",
                      background: "var(--app-danger-bg, #fff1f2)",
                      color: "var(--app-danger-text, #991b1b)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    {helperActionError}
                  </div>
                ) : null}

                <div
                  style={{
                    background: currentTheme.surface,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 18,
                    padding: 20,
                    width: "100%",
                    minWidth: 0,
                    boxShadow: currentTheme.cardShadow,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>Payment timeline</h2>
                    <div style={{ display: "grid", gap: 8, justifyItems: "start", maxWidth: 320 }}>
                      <button
                        type="button"
                        onClick={() => {
                          cancelEditingPayment();
                          setShowHelperAmortization((value) => !value);
                        }}
                        style={{
                          border: `1px solid ${currentTheme.cardBorder}`,
                          background: currentTheme.surface,
                          color: currentTheme.text,
                          borderRadius: 999,
                          padding: "10px 16px",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {showHelperAmortization ? "Hide future amortization" : "Show future amortization"}
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: "0 0 16px", color: currentTheme.textMuted, fontSize: 14 }}>
                    Edit payment dates and amounts directly here, add extra payments, or delete rows.
                    The payoff schedule recalculates through the `As of target date` row.
                  </p>
                  {(showHelperAmortization ? helperProjection.rows : historyResult.rows).length === 0 ? (
                    <div
                      style={{
                        border: `1px dashed ${currentTheme.cardBorder}`,
                        borderRadius: 12,
                        padding: 16,
                        color: currentTheme.textMuted,
                      }}
                    >
                      Add loan inputs and payment history to see the replay.
                    </div>
                  ) : (
                    <div style={{ width: "100%", minWidth: 0 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "4%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "9%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "9%" }} />
                          <col style={{ width: "9%" }} />
                          <col style={{ width: "7%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "10%" }} />
                        </colgroup>
                        <thead>
                          <tr style={{ background: currentTheme.surfaceMuted }}>
                            {["Type", "Memo", "Date", "Payment", "Interest paid", "Principal paid", "% to principal", "Outstanding principal", "Outstanding interest", "Total outstanding balance", "Actions"].map((heading) => (
                              <th
                                key={heading}
                                style={{
                                  padding: "9px 5px",
                                  borderBottom: `1px solid ${currentTheme.cardBorder}`,
                                  fontSize: 12,
                                  textAlign: "left",
                                  color: currentTheme.textMuted,
                                }}
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(showHelperAmortization ? helperProjection.rows : historyResult.rows).map((row) => (
                            <tr key={row.rowId} style={getTableRowStyle(row)}>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }} title={getEventTypeTitle(row.eventType)}>{getEventTypeCode(row.eventType)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                {editingPaymentId === row.rowId ? (
                                  <input
                                    type="text"
                                    value={editingPaymentLabel}
                                    onChange={(event) => setEditingPaymentLabel(event.target.value)}
                                    style={{
                                      border: "1px solid #cbd5e1",
                                      borderRadius: 8,
                                      padding: "6px 8px",
                                      fontSize: 12,
                                      width: "100%",
                                      minWidth: 0,
                                    }}
                                  />
                                ) : (
                                  row.label
                                )}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }}>
                                {editingPaymentId === row.rowId ? (
                                  <div style={{ width: "100%", minWidth: 0 }}>
                                    <DatePickerInput
                                      compact
                                      maxDate={todayValue}
                                      value={editingPaymentDate}
                                      onChange={setEditingPaymentDate}
                                    />
                                  </div>
                                ) : (
                                  toDateInputValue(row.paymentDate)
                                )}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                {editingPaymentId === row.rowId ? (
                                  <CurrencyInput compact value={editingPaymentAmount} onChange={setEditingPaymentAmount} />
                                ) : (
                                  formatCurrency(row.paymentAmount)
                                )}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                <div>{formatCurrency(row.interestPaid)}</div>
                                {row.eventType === "paused" && row.accruedInterest > 0 ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>
                                    Accrued {formatCurrency(row.accruedInterest)}
                                  </div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.principalPaid)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                {row.negativeAmortization ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>Negative amortization</div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingInterest)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal + row.endingInterest)}</td>
                              <td style={{ padding: "8px 5px", borderBottom: `1px solid ${currentTheme.cardBorder}`, fontSize: 12 }}>
                                {row.eventType === "snapshot" || row.eventType === "paused" || showHelperAmortization ? (
                                  <span style={{ color: currentTheme.textMuted, fontSize: 12 }}>Auto</span>
                                ) : editingPaymentId === row.rowId ? (
                                  <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                                    <button
                                      type="button"
                                      aria-label="Edit payment"
                                      title="Edit payment"
                                      onClick={saveEditedPayment}
                                      style={{
                                        border: `1px solid ${currentTheme.accent}`,
                                        background: currentTheme.accent,
                                        color: "#ffffff",
                                        borderRadius: 8,
                                        padding: 6,
                                        fontSize: 12,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditingPayment}
                                      style={{
                                        border: `1px solid ${currentTheme.cardBorder}`,
                                        background: currentTheme.surface,
                                        color: currentTheme.text,
                                        borderRadius: 8,
                                        padding: "6px 10px",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: "grid", gap: 5 }}>
                                    <button
                                      type="button"
                                      onClick={() => startEditingReplayRow(row)}
                                      style={{
                                        border: `1px solid ${currentTheme.cardBorder}`,
                                        background: currentTheme.surface,
                                        color: currentTheme.text,
                                        borderRadius: 8,
                                        padding: "6px 10px",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm10-12 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Delete payment"
                                      title="Delete payment"
                                      onClick={() => deleteHelperRow(row.rowId)}
                                      style={{
                                        border: "1px solid #ef4444",
                                        background: "var(--app-danger-bg, #fff1f2)",
                                        color: "var(--app-danger-text, #b91c1c)",
                                        borderRadius: 8,
                                        padding: 6,
                                        fontSize: 12,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {loanInputsReady && (historyErrors.length > 0 || whatIfProjection.errors.length > 0) ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {[...historyErrors, ...whatIfProjection.errors].map((error, index) => (
                      <div
                        key={`${error}-${index}`}
                        style={{
                          border: "1px solid var(--app-danger-border, #fecaca)",
                          background: "var(--app-danger-bg, #fff1f2)",
                          color: "var(--app-danger-text, #991b1b)",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div
                  style={{
                    background: currentTheme.surface,
                    border: `1px solid ${currentTheme.cardBorder}`,
                    borderRadius: 18,
                    padding: 20,
                    width: "100%",
                    minWidth: 0,
                    boxShadow: currentTheme.cardShadow,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 22 }}>What If Projection</h2>
                      <p style={{ margin: "8px 0 0", color: currentTheme.textMuted, fontSize: 14 }}>
                        This starts from the payment-history balance as of {targetDate || "today"} and
                        then applies your future payment adjustments to project a new payoff path.
                      </p>
                    </div>
                    <div />
                  </div>
                  {whatIfPayments.length > 0 || whatIfRecurringChanges.length > 0 || whatIfPausePeriods.length > 0 || whatIfDueDayChanges.length > 0 ? (
                    <div
                      style={{
                        background: currentTheme.surfaceMuted,
                        border: `1px solid ${currentTheme.cardBorder}`,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 16,
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Projected payment changes</div>
                      {whatIfPausePeriods.map((pausePeriod) => (
                        <div
                          key={pausePeriod.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            Pause payments from {formatPauseRange(pausePeriod)} with{" "}
                            {pausePeriod.mode === "paused" ? "interest paused" : "interest accruing"}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteWhatIfPausePeriod(pausePeriod.id)}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      {whatIfRecurringChanges.map((change) => (
                        <div
                          key={change.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            {change.kind === "minimum" ? "Minimum payment" : "Monthly extra"} becomes{" "}
                            {formatCurrency(change.amount)} starting in {formatMonth(change.effectiveDate)}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteWhatIfRecurringChange(change.id)}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      {whatIfDueDayChanges.map((change) => (
                        <div
                          key={change.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            Due day becomes {change.day} starting in {formatMonth(change.startMonth)}{change.endMonth ? ` through ${formatMonth(change.endMonth)}` : ""}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteWhatIfDueDayChange(change.id)}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      {whatIfPayments.map((payment) => (
                        <div
                          key={payment.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            {payment.label} on {toDateInputValue(payment.date)} for {formatCurrency(payment.amount)}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteWhatIfPayment(payment.id ?? "")}
                            style={{
                              border: "1px solid #ef4444",
                              background: currentTheme.surface,
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {whatIfProjection.rows.length === 0 ? (
                    <div
                      style={{
                        border: `1px dashed ${currentTheme.cardBorder}`,
                        borderRadius: 12,
                        padding: 16,
                        color: currentTheme.textMuted,
                      }}
                    >
                      Add loan inputs first, then add payments in Payoff Schedule if needed. This tab will project
                      forward from the current balance date.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "5%" }} />
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "13%" }} />
                        </colgroup>
                        <thead>
                          <tr style={{ background: currentTheme.surfaceMuted }}>
                            {["Type", "Memo", "Date", "Payment", "Interest paid", "Principal paid", "% to principal", "Outstanding principal", "Outstanding interest", "Total outstanding balance"].map((heading) => (
                              <th
                                key={heading}
                                style={{
                                  padding: "10px 8px",
                                  borderBottom: `1px solid ${currentTheme.cardBorder}`,
                                  fontSize: 14,
                                  textAlign: "left",
                                  color: currentTheme.textMuted,
                                }}
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {whatIfProjection.rows.map((row) => (
                            <tr key={row.rowId} style={getTableRowStyle(row)}>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }} title={getEventTypeTitle(row.eventType)}>{getEventTypeCode(row.eventType)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{row.label}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14, whiteSpace: "nowrap" }}>{toDateInputValue(row.paymentDate)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.paymentAmount)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                <div>{formatCurrency(row.interestPaid)}</div>
                                {row.eventType === "paused" && row.accruedInterest > 0 ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>
                                    Accrued {formatCurrency(row.accruedInterest)}
                                  </div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.principalPaid)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>
                                <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                {row.negativeAmortization ? (
                                  <div style={{ fontSize: 12, color: "#b45309" }}>Negative amortization</div>
                                ) : null}
                              </td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingInterest)}</td>
                              <td style={{ padding: "12px 10px", borderBottom: "1px solid #eef2f7", fontSize: 14 }}>{formatCurrency(row.endingPrincipal + row.endingInterest)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
            </div>
        </main>
        )}
        {deleteAccountConfirmOpen ? (
          <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteAccountConfirmOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(15, 23, 42, 0.58)" }}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" style={{ width: "min(460px, 100%)", display: "grid", gap: 18, padding: 24, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 18, background: currentTheme.surface, boxShadow: "0 28px 70px rgba(15, 23, 42, 0.3)" }}>
              <div style={{ display: "grid", gap: 8 }}>
                <h2 id="delete-account-title" style={{ margin: 0, fontSize: 22 }}>Delete your account?</h2>
                <p style={{ margin: 0, color: currentTheme.textMuted, lineHeight: 1.6 }}>This permanently deletes your profile, saved loans, and paycheck plans. This action is irreversible.</p>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setDeleteAccountConfirmOpen(false)} style={{ border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button type="button" onClick={() => void deleteCurrentUserProfile()} style={{ border: "1px solid #dc2626", background: "#dc2626", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Delete account</button>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}




