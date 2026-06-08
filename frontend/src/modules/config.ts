const defaultApiOrigin = import.meta.env.DEV ? 'http://localhost:8080' : '';

export const API_BASE = import.meta.env.VITE_API_BASE ?? `${defaultApiOrigin}/api/planner`;
export const AUTH_BASE = import.meta.env.VITE_AUTH_BASE ?? `${defaultApiOrigin}/api/auth`;
export const SESSION_STORAGE_KEY = 'debtlab-session-token';

export const tabMeta: Array<{ id: string; label: string; kicker: string }> = [
  { id: 'overview', label: 'Overview', kicker: 'Plan health' },
  { id: 'accounts', label: 'Accounts', kicker: 'Library' },
  { id: 'projections', label: 'Projections', kicker: 'What-if dates' },
  { id: 'payments', label: 'Payments', kicker: 'Batch entry' },
  { id: 'schedule', label: 'Schedule', kicker: 'Roadmap' },
  { id: 'reconciliation', label: 'Reconcile', kicker: 'Reality check' },
  { id: 'methodology', label: 'Methodology', kicker: 'Why this is different' },
  { id: 'resources', label: 'Resources', kicker: 'Learn and plan' },
];

export const workspaceTabMeta = tabMeta.filter((tab) => !['methodology', 'resources', 'account'].includes(tab.id));

export const accountAreaMeta: Array<{ id: string; label: string; kicker: string }> = [
  { id: 'info', label: 'User information', kicker: 'Profile details' },
  { id: 'settings', label: 'Settings', kicker: 'Theme and reset' },
];

export const themeOptions: Array<{ value: string; label: string }> = [
  { value: 'ocean', label: 'Ocean dark' },
  { value: 'stone', label: 'Stone gray' },
  { value: 'meadow', label: 'Meadow green' },
  { value: 'sunrise', label: 'Sunrise gold' },
  { value: 'light', label: 'Soft light' },
];

export const debtTypeOptions: Array<{ value: string; label: string }> = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'education', label: 'Education' },
  { value: 'auto', label: 'Auto' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'personal_loan', label: 'Personal loan' },
  { value: 'medical', label: 'Medical' },
  { value: 'collection', label: 'Collection' },
  { value: 'other', label: 'Other' },
];

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
  'A plan you trust is a form of self-respect.',
  'There is nothing small about staying with it.',
  'Financial clarity is a confidence skill.',
  'Each line item you face is one less thing hiding in the dark.',
  'This gets lighter one intentional month at a time.',
  'You do not need perfect. You need repeatable.',
  'Discipline feels better when you can see it working.',
  'Paying off debt is also practicing belief in your future.',
];

export const paidOffQuotes = [
  'That balance is gone. Keep the feeling.',
  'One less bill. One more breath.',
  'Closed chapter. Stronger footing.',
  'You earned this quiet little win.',
  'That account is no longer in charge.',
  'This is what traction looks like.',
  'Freedom rarely arrives all at once. It stacks.',
  'A paid-off account is a confidence receipt.',
  'This one is done. Let that land.',
  'The plan worked here. It can work again.',
  'Another weight off the list.',
  'You turned a burden into a milestone.',
  'That balance had a last day, and you reached it.',
  'Peace grows when debts stop asking for attention.',
  'One win like this changes the tone of everything else.',
  'You made this account part of your history.',
  'Proof that the hard months were worth it.',
  'Paid off is not small. Paid off is done.',
  'That is real progress, not just a nicer number.',
  'Let this win make the next one easier to believe in.',
];
