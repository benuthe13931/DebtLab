import type { DebtInput, ModelAdvice, UserProfile } from './types';
import type { ThemeChoice } from './modules/types';

export const formatCurrency = (cents: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(cents / 100);

export const formatPercent = (bps: number) => `${(bps / 100).toFixed(2)}%`;
export const formatPercentValue = (value: number) => `${value.toFixed(0)}%`;
export const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export const getFirstName = (user: UserProfile | null) => {
  const raw = user?.displayName?.trim() || user?.email?.trim() || 'there';
  return raw.split(/\s+/)[0] || 'there';
};

export const themeOptions: Array<{ value: ThemeChoice; label: string }> = [
  { value: 'ocean', label: 'Ocean dark' },
  { value: 'stone', label: 'Stone gray' },
  { value: 'meadow', label: 'Meadow green' },
  { value: 'sunrise', label: 'Sunrise gold' },
  { value: 'light', label: 'Soft light' },
];

export const formatOrdinal = (value: number) => {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
};

export const debtTypeOptions: Array<{ value: DebtInput['debtType']; label: string }> = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'education', label: 'Education' },
  { value: 'auto', label: 'Auto' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'personal_loan', label: 'Personal loan' },
  { value: 'medical', label: 'Medical' },
  { value: 'collection', label: 'Collection' },
  { value: 'other', label: 'Other' },
];

export const formatConfidence = (confidence: ModelAdvice['confidence']) =>
  confidence.charAt(0).toUpperCase() + confidence.slice(1);

export const escapeAttribute = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export const needsMoreInfo = (debt: DebtInput) => debt.aprBps <= 0;

export const momentumQuotes = [
  'Progress is still progress, even when it looks quiet.',
  'Every dollar with a job is one more step toward breathing room.',
  'Consistency beats intensity when you are building freedom.',
  'You are not behind. You are in motion.',
  'Small wins compound faster than shame ever will.',
  'A clear plan turns stress into traction.',
  'Momentum is built in ordinary months, not perfect ones.',
  'Every payment is proof that the story is changing.',
  'Relief often starts as a spreadsheet before it feels real.',
  'Steady beats dramatic when the goal is peace.',
  'You are building options, not just lowering balances.',
  'The boring months count. They are doing real work.',
  'Each line item you face is one less thing hiding in the dark.',
  'This gets lighter one intentional month at a time.',
  'You do not need perfect. You need repeatable.',
  'Financial clarity is a confidence skill.',
  'Each line item you face is one less thing hiding in the dark.',
  'You are building options, not just lowering balances.',
  'The boring months count. They are doing real work.',
  'Each line item you face is one less thing hiding in the dark.',
];

export const paidOffQuotes = [
  'That balance is gone. Keep the feeling.',
  'One less bill. One more breath.',
  'Closed chapter. Stronger footing.',
  'You earned this quiet little win.',
  'Another weight off the list.',
  'You turned a burden into a milestone.',
  'Freedom rarely arrives all at once. It stacks.',
  'A paid-off account is a confidence receipt.',
  'Another weight off the list.',
  'You made this account part of your history.',
  'That balance had a last day, and you reached it.',
  'Proof that the hard months were worth it.',
  'Paid off is not small. Paid off is done.',
  'This one is done. Let that land.',
  'This is what traction looks like.',
  'That account is no longer in charge.',
  'A paid-off account is a confidence receipt.',
  'Another weight off the list.',
  'You made this account part of your history.',
  'That balance had a last day, and you reached it.',
];

export const slug = () => Math.random().toString(36).slice(2, 10);

let deletedDebtTimer: number | null = null;

export const clearDeletedDebtBanner = () => {
  if (deletedDebtTimer !== null) {
    window.clearTimeout(deletedDebtTimer);
    deletedDebtTimer = null;
  }
};

export const queueDeletedDebtBannerClear = (callback: () => void) => {
  if (deletedDebtTimer !== null) {
    window.clearTimeout(deletedDebtTimer);
  }
  deletedDebtTimer = window.setTimeout(() => {
    deletedDebtTimer = null;
    callback();
  }, 10_000);
};
