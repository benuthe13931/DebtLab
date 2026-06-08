import { ConflictException, Injectable, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import Database from 'better-sqlite3';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { PDFParse } from 'pdf-parse';
import type {
  AuthSession,
  BalancePresentationMethod,
  DebtMonthResult,
  DebtRecord,
  DebtType,
  ModelAdvice,
  MonthResult,
  ParsedStatementDocument,
  ParsedStatementEntry,
  PlannerResponse,
  PlannerSettings,
  PlannerState,
  PaymentRecord,
  ReconciliationItem,
  SnapshotRecord,
  SimulationResult,
  Strategy,
  UserProfile,
} from './planner.types';

const MICROS_PER_CENT = 10_000n;
const MAX_MONTHS = 480;

interface RuntimeDebt extends DebtRecord {
  balanceMicros: bigint;
}

interface MonthPlan {
  paymentsMicros: Map<string, bigint>;
  focusDebtId?: string;
  warnings: string[];
}

@Injectable()
export class PlannerService implements OnModuleDestroy {
  private readonly db: Database.Database;

  constructor() {
    const dbPath = resolve(process.env.DEBTLAB_DB_PATH ?? join(process.cwd(), 'data', 'debt-snowball.db'));
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.initialize();
  }

  onModuleDestroy() {
    this.db.close();
  }

  registerUser(input: { email?: string; password?: string; displayName?: string }): AuthSession {
    const email = String(input.email ?? '').trim().toLowerCase();
    const password = String(input.password ?? '');
    const displayName = String(input.displayName ?? '').trim() || email.split('@')[0] || 'DebtLab User';

    if (!email || !password) {
      throw new ConflictException('Email and password are required.');
    }

    const existing = this.db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    if (existing) {
      throw new ConflictException('An account with that email already exists.');
    }

    const userId = this.makeId();
    const createdAt = new Date().toISOString();
    const passwordHash = this.hashPassword(password);

    this.db
      .prepare(
        `INSERT INTO users (id, email, display_name, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(userId, email, displayName, passwordHash, createdAt);

    this.ensureUserPlanner(userId);
    return this.createSession(userId);
  }

  loginUser(input: { email?: string; password?: string }): AuthSession {
    const email = String(input.email ?? '').trim().toLowerCase();
    const password = String(input.password ?? '');
    const row = this.db
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .get(email) as { id: string; password_hash: string } | undefined;

    if (!row || !this.verifyPassword(password, row.password_hash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    this.ensureUserPlanner(row.id);
    return this.createSession(row.id);
  }

  getSession(token: string): AuthSession {
    const user = this.getUserBySessionToken(token);
    return {
      token,
      user,
    };
  }

  logoutSession(token: string) {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return { ok: true };
  }

  getPlanner(userId: string): PlannerResponse {
    const state = this.getState(userId);
    const snapshots = this.getSnapshots(userId);
    const payments = this.getPayments(userId);
    const simulation = this.simulatePayoff(state.debts, state.settings);

    return {
      ...state,
      simulation,
      snapshots,
      reconciliation: this.buildReconciliation(state.debts, simulation, snapshots),
      payments,
      modelAdvice: this.buildModelAdvice(state.debts, snapshots),
    };
  }

  requireUserIdBySession(token?: string | null) {
    if (!token) {
      throw new UnauthorizedException('Sign in first.');
    }

    const row = this.db
      .prepare('SELECT user_id FROM sessions WHERE token = ?')
      .get(token) as { user_id: string } | undefined;

    if (!row?.user_id) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    return row.user_id;
  }

  updateSettings(userId: string, input: Partial<PlannerSettings>): PlannerResponse {
    this.ensureUserPlanner(userId);
    const current = this.getSettings(userId);
    const next: PlannerSettings = {
      monthlyBudgetCents: input.monthlyBudgetCents ?? current.monthlyBudgetCents,
      strategy: input.strategy ?? current.strategy,
      startDate: input.startDate ?? current.startDate,
      theme: input.theme ?? current.theme,
    };

    this.db
      .prepare(
        `UPDATE planner_settings
         SET monthly_budget_cents = ?, strategy = ?, start_date = ?, theme = ?
         WHERE user_id = ?`,
      )
      .run(next.monthlyBudgetCents, next.strategy, next.startDate, next.theme, userId);

    return this.getPlanner(userId);
  }

  createDebt(userId: string, input: Partial<DebtRecord>): PlannerResponse {
      this.ensureUserPlanner(userId);
      const debt = this.normalizeDebt({
      id: input.id ?? this.makeId(),
      name: input.name ?? 'New Debt',
      groupName: input.groupName ?? null,
      debtType: input.debtType ?? 'other',
      startingBalanceCents: input.startingBalanceCents ?? input.balanceCents ?? 0,
      balanceCents: input.balanceCents ?? 0,
      minimumPaymentCents: input.minimumPaymentCents ?? 0,
      aprBps: input.aprBps ?? 1999,
      dueDay: input.dueDay ?? 15,
      interestMethod: input.interestMethod ?? 'daily',
      balancePresentation: input.balancePresentation ?? 'capitalized_balance',
      promoAprBps: input.promoAprBps ?? 0,
      promoEndDate: input.promoEndDate ?? null,
      deferredInterest: input.deferredInterest ?? false,
      notes: input.notes ?? '',
    });

    this.db
      .prepare(
        `INSERT INTO debts
         (id, user_id, name, group_name, debt_type, starting_balance_cents, balance_cents, minimum_payment_cents, apr_bps, due_day, interest_method, balance_presentation, promo_apr_bps, promo_end_date, deferred_interest, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        debt.id,
        userId,
        debt.name,
        debt.groupName,
        debt.debtType,
        debt.startingBalanceCents,
        debt.balanceCents,
        debt.minimumPaymentCents,
        debt.aprBps,
        debt.dueDay,
        debt.interestMethod,
        debt.balancePresentation,
        debt.promoAprBps,
        debt.promoEndDate,
        debt.deferredInterest ? 1 : 0,
        debt.notes,
      );

    return this.getPlanner(userId);
  }

  resetPlanner(userId: string): PlannerResponse {
    const currentTheme = this.getSettings(userId).theme;
    this.db.prepare('DELETE FROM debts WHERE user_id = ?').run(userId);
    this.db.prepare('DELETE FROM planner_settings WHERE user_id = ?').run(userId);
    this.db.prepare('DELETE FROM snapshots WHERE user_id = ?').run(userId);
    this.db.prepare('DELETE FROM payments WHERE user_id = ?').run(userId);
    this.ensureUserPlanner(userId, true);
    this.db.prepare('UPDATE planner_settings SET theme = ? WHERE user_id = ?').run(currentTheme, userId);
    return this.getPlanner(userId);
  }

  resetAllDevelopmentData() {
    this.db.prepare('DELETE FROM sessions').run();
    this.db.prepare('DELETE FROM snapshots').run();
    this.db.prepare('DELETE FROM payments').run();
    this.db.prepare('DELETE FROM debts').run();
    this.db.prepare('DELETE FROM planner_settings').run();
    this.db.prepare('DELETE FROM users').run();
    return { ok: true };
  }

  createPayments(userId: string, input: Array<Partial<PaymentRecord>>): PlannerResponse {
    const insert = this.db.prepare(
      `INSERT INTO payments (id, user_id, debt_id, payment_date, amount_cents, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    for (const candidate of input) {
      const payment = this.normalizePayment({
        id: candidate.id ?? this.makeId(),
        debtId: candidate.debtId ?? '',
        paymentDate: candidate.paymentDate ?? new Date().toISOString().slice(0, 10),
        amountCents: candidate.amountCents ?? 0,
        note: candidate.note ?? '',
      });

      if (!payment.debtId || payment.amountCents <= 0) {
        continue;
      }

      insert.run(payment.id, userId, payment.debtId, payment.paymentDate, payment.amountCents, payment.note);
      this.applyPaymentToDebtBalance(userId, payment.debtId, payment.amountCents);
    }

    return this.getPlanner(userId);
  }

  updatePayment(userId: string, id: string, input: Partial<PaymentRecord>): PlannerResponse {
    const current = this.getPayment(userId, id);
    const next = this.normalizePayment({
      ...current,
      ...input,
      id,
    });

    this.applyPaymentToDebtBalance(userId, current.debtId, -current.amountCents);

    this.db
      .prepare(
        `UPDATE payments
         SET debt_id = ?, payment_date = ?, amount_cents = ?, note = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(next.debtId, next.paymentDate, next.amountCents, next.note, id, userId);

    this.applyPaymentToDebtBalance(userId, next.debtId, next.amountCents);

    return this.getPlanner(userId);
  }

  deletePayment(userId: string, id: string): PlannerResponse {
    const current = this.getPayment(userId, id);
    this.applyPaymentToDebtBalance(userId, current.debtId, -current.amountCents);
    this.db.prepare('DELETE FROM payments WHERE id = ? AND user_id = ?').run(id, userId);
    return this.getPlanner(userId);
  }

  importSnapshots(userId: string, csvText: string): PlannerResponse {
    const rows = this.parseSnapshotCsv(csvText);
    const insert = this.db.prepare(
      `INSERT INTO snapshots
       (id, user_id, debt_id, snapshot_date, balance_cents, principal_balance_cents, accrued_interest_cents, interest_charged_cents, minimum_due_cents, source_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const row of rows) {
      insert.run(
        row.id,
        userId,
        row.debtId,
        row.snapshotDate,
        row.balanceCents,
        row.principalBalanceCents,
        row.accruedInterestCents,
        row.interestChargedCents,
        row.minimumDueCents,
        row.sourceNote,
      );
    }

    return this.getPlanner(userId);
  }

  async parseStatementFile(userId: string, file?: Express.Multer.File): Promise<ParsedStatementDocument> {
    if (!file) {
      throw new Error('No statement file was uploaded.');
    }

    const text = await this.extractStatementText(file);
    return this.parseStatementText(file.originalname, text, this.getDebts(userId));
  }

  updateDebt(userId: string, id: string, input: Partial<DebtRecord>): PlannerResponse {
    const current = this.getDebt(userId, id);
    const next = this.normalizeDebt({
      ...current,
      ...input,
      id,
    });

    this.db
      .prepare(
        `UPDATE debts
         SET name = ?, group_name = ?, debt_type = ?, starting_balance_cents = ?, balance_cents = ?, minimum_payment_cents = ?, apr_bps = ?, due_day = ?, interest_method = ?, balance_presentation = ?, promo_apr_bps = ?, promo_end_date = ?, deferred_interest = ?, notes = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(
        next.name,
        next.groupName,
        next.debtType,
        next.startingBalanceCents,
        next.balanceCents,
        next.minimumPaymentCents,
        next.aprBps,
        next.dueDay,
        next.interestMethod,
        next.balancePresentation,
        next.promoAprBps,
        next.promoEndDate,
        next.deferredInterest ? 1 : 0,
        next.notes,
        id,
        userId,
      );

    return this.getPlanner(userId);
  }

  deleteDebt(userId: string, id: string): PlannerResponse {
    this.db.prepare('DELETE FROM debts WHERE id = ? AND user_id = ?').run(id, userId);
    return this.getPlanner(userId);
  }

  private initialize() {
    const hasLegacyPlannerSettings = this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM pragma_table_info('planner_settings')
         WHERE name = 'user_id'`,
      )
      .get() as { count: number };

    if (hasLegacyPlannerSettings.count === 0) {
      this.db.prepare('DROP TABLE IF EXISTS planner_settings').run();
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS planner_settings (
        user_id TEXT PRIMARY KEY,
        monthly_budget_cents INTEGER NOT NULL,
        strategy TEXT NOT NULL,
        start_date TEXT NOT NULL,
        theme TEXT NOT NULL DEFAULT 'ocean',
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        group_name TEXT,
        debt_type TEXT NOT NULL DEFAULT 'other',
        balance_cents INTEGER NOT NULL,
        starting_balance_cents INTEGER NOT NULL DEFAULT 0,
        minimum_payment_cents INTEGER NOT NULL,
        apr_bps INTEGER NOT NULL,
        due_day INTEGER NOT NULL,
        interest_method TEXT NOT NULL,
        balance_presentation TEXT NOT NULL DEFAULT 'capitalized_balance',
        promo_apr_bps INTEGER,
        promo_end_date TEXT,
        deferred_interest INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        debt_id TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        balance_cents INTEGER NOT NULL,
        principal_balance_cents INTEGER,
        accrued_interest_cents INTEGER,
        interest_charged_cents INTEGER,
        minimum_due_cents INTEGER,
        source_note TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (debt_id) REFERENCES debts(id)
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        debt_id TEXT NOT NULL,
        payment_date TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (debt_id) REFERENCES debts(id)
      );
    `);

    this.ensureColumn('debts', 'balance_presentation', "TEXT NOT NULL DEFAULT 'capitalized_balance'");
    this.ensureColumn('debts', 'user_id', 'TEXT');
    this.ensureColumn('debts', 'group_name', 'TEXT');
    this.ensureColumn('debts', 'debt_type', "TEXT NOT NULL DEFAULT 'other'");
    this.ensureColumn('debts', 'starting_balance_cents', 'INTEGER NOT NULL DEFAULT 0');
    this.db.prepare('UPDATE debts SET starting_balance_cents = balance_cents WHERE starting_balance_cents = 0 AND balance_cents > 0').run();
    this.ensureColumn('snapshots', 'user_id', 'TEXT');
    this.ensureColumn('snapshots', 'principal_balance_cents', 'INTEGER');
    this.ensureColumn('snapshots', 'accrued_interest_cents', 'INTEGER');
    this.ensureColumn('payments', 'user_id', 'TEXT');
    this.ensureColumn('planner_settings', 'theme', "TEXT NOT NULL DEFAULT 'ocean'");
  }

  private getState(userId: string): PlannerState {
    return {
      debts: this.getDebts(userId),
      settings: this.getSettings(userId),
    };
  }

  private getSnapshots(userId: string): SnapshotRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, debt_id, snapshot_date, balance_cents, principal_balance_cents, accrued_interest_cents, interest_charged_cents, minimum_due_cents, source_note
         FROM snapshots
         WHERE user_id = ?
         ORDER BY snapshot_date DESC, debt_id ASC`,
      )
      .all(userId) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id),
      debtId: String(row.debt_id),
      snapshotDate: String(row.snapshot_date),
      balanceCents: Number(row.balance_cents),
      principalBalanceCents: row.principal_balance_cents === null ? null : Number(row.principal_balance_cents),
      accruedInterestCents: row.accrued_interest_cents === null ? null : Number(row.accrued_interest_cents),
      interestChargedCents: row.interest_charged_cents === null ? null : Number(row.interest_charged_cents),
      minimumDueCents: row.minimum_due_cents === null ? null : Number(row.minimum_due_cents),
      sourceNote: String(row.source_note ?? ''),
    }));
  }

  private getPayments(userId: string): PaymentRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, debt_id, payment_date, amount_cents, note
         FROM payments
         WHERE user_id = ?
         ORDER BY payment_date DESC, debt_id ASC`,
      )
      .all(userId) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id),
      debtId: String(row.debt_id),
      paymentDate: String(row.payment_date),
      amountCents: Number(row.amount_cents),
      note: String(row.note ?? ''),
    }));
  }

  private getSettings(userId: string): PlannerSettings {
    this.ensureUserPlanner(userId);
    const row = this.db
      .prepare('SELECT monthly_budget_cents, strategy, start_date, theme FROM planner_settings WHERE user_id = ?')
      .get(userId) as {
      monthly_budget_cents: number;
      strategy: Strategy;
      start_date: string;
      theme?: string;
    };

    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const startDate = row.start_date < currentMonthStart ? currentMonthStart : row.start_date;

    if (startDate !== row.start_date) {
      this.db
        .prepare('UPDATE planner_settings SET start_date = ? WHERE user_id = ?')
        .run(startDate, userId);
    }

    return {
      monthlyBudgetCents: row.monthly_budget_cents,
      strategy: row.strategy,
      startDate,
      theme: row.theme || 'ocean',
    };
  }

  private getDebts(userId: string): DebtRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, group_name, debt_type, starting_balance_cents, balance_cents, minimum_payment_cents, apr_bps, due_day, interest_method, balance_presentation, promo_apr_bps, promo_end_date, deferred_interest, notes
         FROM debts
         WHERE user_id = ?
         ORDER BY name`,
      )
      .all(userId) as Array<Record<string, unknown>>;

    return rows.map((row) => this.mapDebtRow(row));
  }

  private getDebt(userId: string, id: string): DebtRecord {
    const row = this.db
      .prepare(
        `SELECT id, name, group_name, debt_type, starting_balance_cents, balance_cents, minimum_payment_cents, apr_bps, due_day, interest_method, balance_presentation, promo_apr_bps, promo_end_date, deferred_interest, notes
         FROM debts
         WHERE id = ? AND user_id = ?`,
      )
      .get(id, userId) as Record<string, unknown> | undefined;

    if (!row) {
      throw new Error(`Debt ${id} not found`);
    }

    return this.mapDebtRow(row);
  }

  private getPayment(userId: string, id: string): PaymentRecord {
    const row = this.db
      .prepare(
        `SELECT id, debt_id, payment_date, amount_cents, note
         FROM payments
         WHERE id = ? AND user_id = ?`,
      )
      .get(id, userId) as Record<string, unknown> | undefined;

    if (!row) {
      throw new Error(`Payment ${id} not found`);
    }

    return {
      id: String(row.id),
      debtId: String(row.debt_id),
      paymentDate: String(row.payment_date),
      amountCents: Number(row.amount_cents),
      note: String(row.note ?? ''),
    };
  }

  private applyPaymentToDebtBalance(userId: string, debtId: string, amountCents: number) {
    const row = this.db
      .prepare('SELECT balance_cents, starting_balance_cents FROM debts WHERE id = ? AND user_id = ?')
      .get(debtId, userId) as { balance_cents: number } | undefined;

    if (!row) {
      return;
    }

    const nextBalance = Math.max(0, row.balance_cents - amountCents);
    this.db
      .prepare('UPDATE debts SET balance_cents = ? WHERE id = ? AND user_id = ?')
      .run(nextBalance, debtId, userId);
  }

  private mapDebtRow(row: Record<string, unknown>): DebtRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      groupName: row.group_name ? String(row.group_name) : null,
      debtType: this.normalizeDebtType(row.debt_type),
      startingBalanceCents: Number(row.starting_balance_cents ?? row.balance_cents),
      balanceCents: Number(row.balance_cents),
      minimumPaymentCents: Number(row.minimum_payment_cents),
      aprBps: Number(row.apr_bps),
      dueDay: Number(row.due_day),
      interestMethod: row.interest_method === 'monthly' ? 'monthly' : 'daily',
      balancePresentation:
        row.balance_presentation === 'principal_plus_accrued_interest'
          ? 'principal_plus_accrued_interest'
          : 'capitalized_balance',
      promoAprBps: row.promo_apr_bps === null ? null : Number(row.promo_apr_bps),
      promoEndDate: row.promo_end_date ? String(row.promo_end_date) : null,
      deferredInterest: Number(row.deferred_interest) === 1,
      notes: String(row.notes ?? ''),
    };
  }

  private normalizeDebt(input: DebtRecord): DebtRecord {
    return {
      ...input,
      name: String(input.name || 'New Debt').trim() || 'New Debt',
      groupName: input.groupName ? String(input.groupName).trim() || null : null,
      debtType: this.normalizeDebtType(input.debtType),
      startingBalanceCents: Math.max(Math.round(input.balanceCents), Math.round(input.startingBalanceCents ?? input.balanceCents), 0),
      balanceCents: Math.max(0, Math.round(input.balanceCents)),
      minimumPaymentCents: Math.max(0, Math.round(input.minimumPaymentCents)),
      aprBps: Math.max(0, Math.round(input.aprBps)),
      dueDay: Math.max(1, Math.min(31, Math.round(input.dueDay))),
      interestMethod: input.interestMethod === 'monthly' ? 'monthly' : 'daily',
      balancePresentation:
        input.balancePresentation === 'principal_plus_accrued_interest'
          ? 'principal_plus_accrued_interest'
          : 'capitalized_balance',
      promoAprBps: input.promoAprBps === null || input.promoAprBps === undefined ? null : Math.max(0, Math.round(input.promoAprBps)),
      promoEndDate: input.promoEndDate ? String(input.promoEndDate) : null,
      deferredInterest: Boolean(input.deferredInterest),
      notes: String(input.notes ?? ''),
    };
  }

  private normalizePayment(input: PaymentRecord): PaymentRecord {
    return {
      id: input.id,
      debtId: String(input.debtId ?? ''),
      paymentDate: String(input.paymentDate ?? new Date().toISOString().slice(0, 10)),
      amountCents: Math.max(0, Math.round(input.amountCents)),
      note: String(input.note ?? ''),
    };
  }

  private makeId() {
    return Math.random().toString(36).slice(2, 10);
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }

  private verifyPassword(password: string, storedHash: string) {
    const [salt, expectedHash] = storedHash.split(':');
    if (!salt || !expectedHash) {
      return false;
    }

    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private createSession(userId: string): AuthSession {
    const token = randomBytes(24).toString('hex');
    this.db
      .prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
      .run(token, userId, new Date().toISOString());

    return {
      token,
      user: this.getUserById(userId),
    };
  }

  private getUserById(userId: string): UserProfile {
    const row = this.db
      .prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?')
      .get(userId) as Record<string, unknown> | undefined;

    if (!row) {
      throw new UnauthorizedException('Account not found.');
    }

    return {
      id: String(row.id),
      email: String(row.email),
      displayName: String(row.display_name),
      createdAt: String(row.created_at),
    };
  }

  private getUserBySessionToken(token: string): UserProfile {
    const row = this.db
      .prepare(
        `SELECT users.id, users.email, users.display_name, users.created_at
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token = ?`,
      )
      .get(token) as Record<string, unknown> | undefined;

    if (!row) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }

    return {
      id: String(row.id),
      email: String(row.email),
      displayName: String(row.display_name),
      createdAt: String(row.created_at),
    };
  }

  private ensureUserPlanner(userId: string, withSampleData = false) {
    const settingsCount = this.db
      .prepare('SELECT COUNT(*) as count FROM planner_settings WHERE user_id = ?')
      .get(userId) as { count: number };

    if (settingsCount.count === 0) {
      const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10);

      this.db
        .prepare(
          'INSERT INTO planner_settings (user_id, monthly_budget_cents, strategy, start_date, theme) VALUES (?, ?, ?, ?, ?)',
        )
        .run(userId, 195000, 'avalanche', startDate, 'ocean');
    }

    const debtCount = this.db
      .prepare('SELECT COUNT(*) as count FROM debts WHERE user_id = ?')
      .get(userId) as { count: number };

    if (!withSampleData && debtCount.count > 0) {
      return;
    }

    if (withSampleData && debtCount.count > 0) {
      this.db.prepare('DELETE FROM debts WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM snapshots WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM payments WHERE user_id = ?').run(userId);
    }

    if (withSampleData) {
      const today = new Date();
      const monthsFromNow = (months: number) =>
        new Date(today.getFullYear(), today.getMonth() + months, 15).toISOString().slice(0, 10);

      const sampleDebts: DebtRecord[] = [
        {
          id: `chase-freedom-${this.makeId()}`,
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
          promoAprBps: null,
          promoEndDate: null,
          deferredInterest: false,
          notes: 'High APR revolving debt.',
        },
        {
          id: `best-buy-${this.makeId()}`,
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
          promoAprBps: null,
          promoEndDate: null,
          deferredInterest: false,
          notes: 'Store card with painful APR.',
        },
        {
          id: `chase-ink-${this.makeId()}`,
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
          deferredInterest: false,
          notes: '0% promo that should not crowd out high-interest debt too early.',
        },
        {
          id: `care-credit-${this.makeId()}`,
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
          id: `student-loan-${this.makeId()}`,
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
          promoAprBps: null,
          promoEndDate: null,
          deferredInterest: false,
          notes: 'Lower APR installment debt.',
        },
      ];

      const insert = this.db.prepare(
        `INSERT INTO debts
         (id, user_id, name, group_name, debt_type, starting_balance_cents, balance_cents, minimum_payment_cents, apr_bps, due_day, interest_method, balance_presentation, promo_apr_bps, promo_end_date, deferred_interest, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      for (const debt of sampleDebts) {
        insert.run(
          debt.id,
          userId,
          debt.name,
          debt.groupName,
          debt.debtType,
          debt.startingBalanceCents,
          debt.balanceCents,
          debt.minimumPaymentCents,
          debt.aprBps,
          debt.dueDay,
          debt.interestMethod,
          debt.balancePresentation,
          debt.promoAprBps,
          debt.promoEndDate,
          debt.deferredInterest ? 1 : 0,
          debt.notes,
        );
      }
    }
  }

  private async extractStatementText(file: Express.Multer.File) {
    const lowerName = file.originalname.toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    if (lowerName.endsWith('.pdf') || mimeType.includes('pdf')) {
      const parser = new PDFParse({ data: file.buffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }

    return file.buffer.toString('utf8');
  }

  private parseStatementText(
    documentName: string,
    rawText: string,
    debts: DebtRecord[],
  ): ParsedStatementDocument {
    const normalizedText = rawText.replace(/\r/g, '');
    const statementDate = this.findDateValue(normalizedText, [
      /statement\s+date[:\s]+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
      /statement\s+date[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /billing\s+date[:\s]+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
      /billing\s+date[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    ]);
    const issuerHint = this.detectIssuer(normalizedText);
    if (issuerHint === 'Aidvantage' && normalizedText.includes('Loan Information as of')) {
      return this.parseAidvantageStatement(documentName, normalizedText, debts, issuerHint, statementDate);
    }
    if (normalizedText.includes('Prepared For') && normalizedText.includes('Open accounts')) {
      return this.parseExperianOverview(documentName, normalizedText, debts, statementDate);
    }

    const segments = this.segmentStatement(normalizedText);
    const entries = segments
      .map((segment, index) =>
        this.buildParsedStatementEntry(documentName, segment, index, statementDate, debts),
      )
      .filter(
        (entry) =>
          entry.balanceCents !== null ||
          entry.principalBalanceCents !== null ||
          entry.interestChargedCents !== null ||
          entry.minimumDueCents !== null,
      );

    const warnings: string[] = [];
    if (entries.length === 0) {
      warnings.push(
        'The parser could not confidently find account sections. You can still paste CSV manually for now.',
      );
    } else if (entries.length > 1) {
      warnings.push(
        `Parsed ${entries.length} account sections from one document. Review the debt mapping before importing.`,
      );
    }

    if (!statementDate) {
      warnings.push('Statement date was not found confidently, so some rows may need a manual date check.');
    }

    return {
      documentName,
      issuerHint,
      statementDate,
      entries,
      warnings,
    };
  }

  private parseAidvantageStatement(
    documentName: string,
    text: string,
    debts: DebtRecord[],
    issuerHint: string,
    statementDate: string | null,
  ): ParsedStatementDocument {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^--\s+\d+\s+of\s+\d+\s+--$/.test(line));

    const loanIds = this.extractAidvantageLoanIds(lines);
    const entriesByLoanId = new Map<string, ParsedStatementEntry>();

    for (const loanId of loanIds) {
      entriesByLoanId.set(loanId, {
        entryId: `${this.makeId()}-${loanId}`,
        sourceDocumentName: documentName,
        accountLabel: `Loan ${loanId}`,
        debtType: 'education',
        accountNumberHint: loanId,
        snapshotDate: statementDate,
        balanceCents: null,
        principalBalanceCents: null,
        accruedInterestCents: null,
        interestChargedCents: null,
        minimumDueCents: null,
        aprBps: null,
        confidence: 'low',
        matchedDebtId: this.matchDebtId(`loan ${loanId}`, loanId, debts),
        sourceExcerpt: '',
      });
    }

    const loanInfo = this.extractAidvantageTable(lines, 'Loan Information as of', loanIds, [
      'Current Balance',
      'Unpaid Interest',
      'Unpaid Principal',
      'Original Principal',
      'Capitalized Interest',
      'Principal Reduction',
      'Life of Loan Payments',
      'Total Principal Paid',
      'Total Interest Paid',
    ]);
    const billingSummary = this.extractAidvantageTable(lines, 'Billing Period Summary', loanIds, [
      'Payments Received',
      'Last Payment Effective Date',
      'Applied to Interest',
      'Applied to Principal',
    ]);
    const loanDetails = this.extractAidvantageTable(lines, 'Loan Details', loanIds, [
      'Loan Date',
      'Loan Program',
      'Interest Rate',
      'Total Payment Due',
      'Past Due Amount',
      'Current Amount Due',
    ]);

    for (const loanId of loanIds) {
      const entry = entriesByLoanId.get(loanId);
      if (!entry) {
        continue;
      }

      entry.balanceCents = this.parseAidvantageMoney(loanInfo['Current Balance']?.get(loanId));
      entry.accruedInterestCents = this.parseAidvantageMoney(loanInfo['Unpaid Interest']?.get(loanId));
      entry.principalBalanceCents = this.parseAidvantageMoney(loanInfo['Unpaid Principal']?.get(loanId));
      entry.interestChargedCents = this.parseAidvantageMoney(billingSummary['Applied to Interest']?.get(loanId));
      entry.minimumDueCents = this.parseAidvantageMoney(loanDetails['Current Amount Due']?.get(loanId));
      entry.aprBps = this.parseAidvantageApr(loanDetails['Interest Rate']?.get(loanId));
      const program = loanDetails['Loan Program']?.get(loanId);
      entry.accountLabel = program ? `Loan ${loanId} (${program})` : `Loan ${loanId}`;
      entry.sourceExcerpt = [
        `Current Balance ${loanInfo['Current Balance']?.get(loanId) ?? 'n/a'}`,
        `Unpaid Interest ${loanInfo['Unpaid Interest']?.get(loanId) ?? 'n/a'}`,
        `Unpaid Principal ${loanInfo['Unpaid Principal']?.get(loanId) ?? 'n/a'}`,
        `Applied to Interest ${billingSummary['Applied to Interest']?.get(loanId) ?? 'n/a'}`,
        `APR ${loanDetails['Interest Rate']?.get(loanId) ?? 'n/a'}`,
      ].join(' · ');

      const signals = [
        entry.snapshotDate,
        entry.balanceCents,
        entry.principalBalanceCents,
        entry.accruedInterestCents,
        entry.interestChargedCents,
        entry.minimumDueCents,
        entry.aprBps,
      ].filter((value) => value !== null && value !== undefined).length;
      entry.confidence = signals >= 6 ? 'high' : signals >= 4 ? 'medium' : 'low';
    }

    const entries = [...entriesByLoanId.values()].filter(
      (entry) => entry.balanceCents !== null || entry.principalBalanceCents !== null,
    );

    return {
      documentName,
      issuerHint,
      statementDate,
      entries,
      warnings: entries.length === loanIds.length
        ? [`Parsed ${entries.length} loan columns from the Aidvantage statement.`]
        : ['Some loan columns could not be parsed cleanly. Review the imported rows before saving.'],
    };
  }

  private segmentStatement(text: string) {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const segments: Array<{ heading: string; text: string }> = [];
    let currentHeading = 'Statement Summary';
    let currentLines: string[] = [];

    const flush = () => {
      if (currentLines.length === 0) {
        return;
      }

      segments.push({
        heading: currentHeading,
        text: currentLines.join('\n'),
      });
      currentLines = [];
    };

    for (const line of lines) {
      if (this.isSegmentHeading(line) && currentLines.length > 0) {
        flush();
        currentHeading = line;
        currentLines.push(line);
        continue;
      }

      if (this.isSegmentHeading(line) && currentLines.length === 0) {
        currentHeading = line;
      }

      currentLines.push(line);
    }

    flush();
    return segments.length === 0 ? [{ heading: 'Statement Summary', text }] : segments;
  }

  private isSegmentHeading(line: string) {
    return (
      /^(loan|account)\s*(number|no\.?|#)?[\s:-]*[a-z0-9*.-]{1,}$/i.test(line) ||
      /^(loan|account)\s+\d+$/i.test(line) ||
      /^(subsidized|unsubsidized|parent plus|plus loan|credit card)/i.test(line)
    );
  }

  private buildParsedStatementEntry(
    documentName: string,
    segment: { heading: string; text: string },
    index: number,
    fallbackDate: string | null,
    debts: DebtRecord[],
  ): ParsedStatementEntry {
    const text = segment.text;
    const accountLabel = this.cleanLabel(
      this.findTextValue(text, [
        /^(loan\s*(?:number|no\.?|#)?[\s:-]*[a-z0-9*.-]{1,})/im,
        /^(account\s*(?:number|no\.?|#)?[\s:-]*[a-z0-9*.-]{1,})/im,
        /^(loan\s+\d+)/im,
        /^(subsidized.*)$/im,
        /^(unsubsidized.*)$/im,
      ]) ?? segment.heading,
    );
    const accountNumberHint =
      this.findTextValue(text, [
        /ending\s+in\s+([0-9*]{2,8})/i,
        /account\s*(?:number|no\.?|#)[:\s]+([a-z0-9*.-]+)/i,
        /loan\s*(?:number|no\.?|#)[:\s]+([a-z0-9*.-]+)/i,
      ]) ?? null;
    const snapshotDate =
      this.findDateValue(text, [
        /statement\s+date[:\s]+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
        /statement\s+date[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      ]) ?? fallbackDate;
    const balanceCents = this.findCurrencyValue(text, [
      /current\s+balance[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
      /ending\s+balance[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
      /balance[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
    ]);
    const principalBalanceCents = this.findCurrencyValue(text, [
      /unpaid\s+principal[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
      /principal\s+balance[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
      /principal[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
    ]);
    const accruedInterestCents = this.findCurrencyValue(text, [
      /unpaid\s+interest[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
      /accrued\s+interest[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
      /accrued\s+unpaid\s+interest[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
    ]);
    const interestChargedCents = this.findCurrencyValue(text, [
      /interest\s+charged[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
      /finance\s+charge[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
      /applied\s+to\s+interest[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
    ]);
    const minimumDueCents = this.findCurrencyValue(text, [
      /minimum\s+(?:amount\s+)?due[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
      /payment\s+due[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
      /monthly\s+payment[:\s]+\$?\s*([0-9,]+\.\d{2})/i,
    ]);
    const aprText = this.findTextValue(text, [
      /interest\s+rate[:\s]+([0-9]+\.[0-9]{1,3})\s*%/i,
      /apr[:\s]+([0-9]+\.[0-9]{1,3})\s*%/i,
      /rate[:\s]+([0-9]+\.[0-9]{1,3})\s*%/i,
    ]);
    const aprBps = aprText ? Math.round(Number(aprText) * 100) : null;
    const matchedDebtId = this.matchDebtId(accountLabel, accountNumberHint, debts);
    const signals = [
      snapshotDate,
      balanceCents,
      principalBalanceCents,
      accruedInterestCents,
      interestChargedCents,
      minimumDueCents,
      aprBps,
    ].filter((value) => value !== null && value !== undefined).length;

    return {
      entryId: `${this.makeId()}-${index}`,
      sourceDocumentName: documentName,
      accountLabel,
      debtType: this.inferDebtTypeFromAccountLabel(accountLabel),
      accountNumberHint,
      snapshotDate,
      balanceCents,
      principalBalanceCents,
      accruedInterestCents,
      interestChargedCents,
      minimumDueCents,
      aprBps,
      confidence: signals >= 5 ? 'high' : signals >= 3 ? 'medium' : 'low',
      matchedDebtId,
      sourceExcerpt: text.slice(0, 400),
    };
  }

  private extractAidvantageLoanIds(lines: string[]) {
    const header = lines.find((line) => /^Loan ID\s+/.test(line));
    if (!header) {
      return [];
    }

    return header
      .replace(/^Loan ID\s+/, '')
      .split(/\s+/)
      .filter((token) => /^\d+-\d+$/.test(token));
  }

  private extractAidvantageTable(
    lines: string[],
    sectionTitle: string,
    loanIds: string[],
    rowLabels: string[],
  ) {
    const startIndex = lines.findIndex((line) => line.startsWith(sectionTitle));
    const rows: Record<string, Map<string, string>> = {};
    if (startIndex === -1) {
      return rows;
    }

    let index = startIndex + 1;
    while (index < lines.length && !/^Loan ID\s+/.test(lines[index])) {
      index += 1;
    }
    if (index >= lines.length) {
      return rows;
    }

    index += 1;
    while (index < lines.length) {
      const line = lines[index];
      if (/^(Loan Information as of|Billing Period Summary|Loan Details|PAYMENTS|IMPORTANT DISCLOSURES|Account number:)/.test(line)) {
        break;
      }

      const matchedLabel = rowLabels.find((label) => line.startsWith(label));
      if (matchedLabel) {
        const remainder = line.slice(matchedLabel.length).trim();
        let values = remainder ? remainder.split(/\s+/) : [];

        if (values.length < loanIds.length && index + 1 < lines.length) {
          const nextLineValues = lines[index + 1].split(/\s+/);
          if (values.length + nextLineValues.length >= loanIds.length) {
            values = [...values, ...nextLineValues];
            index += 1;
          }
        }

        rows[matchedLabel] = new Map(
          loanIds.map((loanId, loanIndex) => [loanId, values[loanIndex] ?? '']),
        );
      }

      index += 1;
    }

    return rows;
  }

  private parseAidvantageMoney(value?: string) {
    if (!value) {
      return null;
    }

    return this.parseCurrencyToCents(value);
  }

  private parseAidvantageApr(value?: string) {
    if (!value) {
      return null;
    }

    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  }

  private parseExperianOverview(
    documentName: string,
    text: string,
    debts: DebtRecord[],
    statementDate: string | null,
  ): ParsedStatementDocument {
    const pages = text.split(/--\s+\d+\s+of\s+\d+\s+--/).map((page) => page.trim()).filter(Boolean);
    const entries: ParsedStatementEntry[] = [];

    for (const page of pages) {
      if (!page.includes('Open/closed') || !page.includes('Account info')) {
        continue;
      }

      if (!/Open\/closed\s+Open/i.test(page)) {
        continue;
      }

      const accountLabel =
        this.findTextValue(page, [/Account name\s+(.+)/i]) ??
        page.split('\n').map((line) => line.trim()).filter(Boolean)[0] ??
        'Imported account';
      const accountTypeText = this.findTextValue(page, [/Account type\s+(.+)/i]) ?? '';
      const debtType = this.inferDebtTypeFromAccountType(accountTypeText, accountLabel);
      const status = this.findTextValue(page, [/Status\s+(.+)/i]) ?? '';

      if (/closed/i.test(status) || /collection/i.test(accountTypeText)) {
        continue;
      }

      entries.push({
        entryId: `${this.makeId()}-experian`,
        sourceDocumentName: documentName,
        accountLabel: this.cleanLabel(accountLabel),
        debtType,
        accountNumberHint:
          this.findTextValue(page, [/Account number\s+([0-9Xx*]+)/i]) ?? null,
        snapshotDate:
          this.findDateValue(page, [/Balance updated\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i]) ??
          statementDate,
        balanceCents: this.findCurrencyValue(page, [/Balance\s+\$([0-9,]+\.\d{2}|[0-9,]+)/i]),
        principalBalanceCents: null,
        accruedInterestCents: null,
        interestChargedCents: null,
        minimumDueCents: this.findCurrencyValue(page, [/Monthly payment\s+\$([0-9,]+\.\d{2}|[0-9,]+)/i]),
        aprBps: null,
        confidence: 'medium',
        matchedDebtId: this.matchDebtId(accountLabel, null, debts),
        sourceExcerpt: [
          `Type ${accountTypeText || 'unknown'}`,
          `Balance ${this.findTextValue(page, [/Balance\s+\$([0-9,]+\.\d{2}|[0-9,]+)/i]) ?? 'n/a'}`,
          `Monthly payment ${this.findTextValue(page, [/Monthly payment\s+\$([0-9,]+\.\d{2}|[0-9,]+)/i]) ?? 'n/a'}`,
        ].join(' | '),
      });
    }

    return {
      documentName,
      issuerHint: 'Experian',
      statementDate,
      entries,
      warnings: [
        'Personal information pages are ignored and not imported.',
        'Credit report import is intended as a bulk starting point. APRs and statement-level interest still need statement imports or manual edits.',
      ],
    };
  }

  private findTextValue(text: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private findDateValue(text: string, patterns: RegExp[]) {
    const raw = this.findTextValue(text, patterns);
    if (!raw) {
      return null;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString().slice(0, 10);
  }

  private findCurrencyValue(text: string, patterns: RegExp[]) {
    const raw = this.findTextValue(text, patterns);
    return raw ? this.parseCurrencyToCents(raw) : null;
  }

  private cleanLabel(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  private normalizeDebtType(value: unknown): DebtType {
    switch (value) {
      case 'credit_card':
      case 'education':
      case 'auto':
      case 'mortgage':
      case 'personal_loan':
      case 'medical':
      case 'collection':
      case 'other':
        return value;
      default:
        return 'other';
    }
  }

  private inferDebtTypeFromAccountType(accountType: string, accountLabel = ''): DebtType {
    const combined = `${accountType} ${accountLabel}`.toLowerCase();
    if (combined.includes('education') || combined.includes('student') || combined.includes('aidvantage') || combined.includes('dept of ed')) {
      return 'education';
    }
    if (combined.includes('credit card') || combined.includes('credit line') || combined.includes('cbna') || combined.includes('barclays') || combined.includes('synchrony') || combined.includes('carecredit')) {
      return 'credit_card';
    }
    if (combined.includes('mortgage')) {
      return 'mortgage';
    }
    if (combined.includes('auto')) {
      return 'auto';
    }
    if (combined.includes('medical')) {
      return 'medical';
    }
    if (combined.includes('collection')) {
      return 'collection';
    }
    if (combined.includes('loan')) {
      return 'personal_loan';
    }
    return 'other';
  }

  private inferDebtTypeFromAccountLabel(accountLabel: string): DebtType {
    return this.inferDebtTypeFromAccountType('', accountLabel);
  }

  private detectIssuer(text: string) {
    const issuerMatchers: Array<[string, RegExp]> = [
      ['Aidvantage', /aidvantage/i],
      ['Chase', /chase/i],
      ['CareCredit', /carecredit/i],
      ['Best Buy', /best\s+buy/i],
      ['Discover', /discover/i],
      ['Capital One', /capital\s+one/i],
    ];

    for (const [issuer, pattern] of issuerMatchers) {
      if (pattern.test(text)) {
        return issuer;
      }
    }

    return null;
  }

  private matchDebtId(accountLabel: string, accountNumberHint: string | null, debts: DebtRecord[]) {
    const normalizedLabel = accountLabel.toLowerCase();
    const trailingDigits = accountNumberHint?.replace(/\D/g, '').slice(-4) ?? '';

    const direct = debts.find((debt) => {
      const normalizedName = debt.name.toLowerCase();
      return (
        normalizedName.includes(normalizedLabel) ||
        normalizedLabel.includes(normalizedName) ||
        (trailingDigits.length >= 2 && normalizedName.includes(trailingDigits))
      );
    });

    if (direct) {
      return direct.id;
    }

    const sharedToken = debts.find((debt) => {
      const nameTokens = debt.name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 4);
      return nameTokens.some((token) => normalizedLabel.includes(token));
    });

    return sharedToken?.id ?? null;
  }

  private buildReconciliation(
    debts: DebtRecord[],
    simulation: SimulationResult,
    snapshots: SnapshotRecord[],
  ): ReconciliationItem[] {
    const debtNameById = new Map(debts.map((debt) => [debt.id, debt.name]));
    const monthByKey = new Map(simulation.months.map((month) => [month.monthKey, month]));

    return snapshots.map((snapshot) => {
      const monthKey = snapshot.snapshotDate.slice(0, 7);
      const month = monthByKey.get(monthKey);
      const item = month?.items.find((candidate) => candidate.debtId === snapshot.debtId);
      const simulatedBalanceCents = item?.endingBalanceCents ?? null;
      const simulatedInterestCents = item?.interestCents ?? null;
      const balanceDriftCents =
        simulatedBalanceCents === null ? null : snapshot.balanceCents - simulatedBalanceCents;
      const interestDriftCents =
        snapshot.interestChargedCents === null || simulatedInterestCents === null
          ? null
          : snapshot.interestChargedCents - simulatedInterestCents;
      const status =
        simulatedBalanceCents === null
          ? 'missing-simulation'
          : Math.abs(balanceDriftCents ?? 0) <= 100
            ? 'aligned'
            : 'drift';

      return {
        snapshotId: snapshot.id,
        debtId: snapshot.debtId,
        debtName: debtNameById.get(snapshot.debtId) ?? snapshot.debtId,
        snapshotDate: snapshot.snapshotDate,
        monthKey,
        observedBalanceCents: snapshot.balanceCents,
        simulatedBalanceCents,
        balanceDriftCents,
        observedInterestCents: snapshot.interestChargedCents,
        simulatedInterestCents,
        interestDriftCents,
        status,
        sourceNote: snapshot.sourceNote,
      };
    });
  }

  private buildModelAdvice(debts: DebtRecord[], snapshots: SnapshotRecord[]): ModelAdvice[] {
    return debts.map((debt) => {
      const debtSnapshots = snapshots
        .filter((snapshot) => snapshot.debtId === debt.id)
        .sort((left, right) => left.snapshotDate.localeCompare(right.snapshotDate));

      const comparable = debtSnapshots.filter((snapshot) => snapshot.interestChargedCents !== null);
      if (comparable.length < 3) {
        return {
          debtId: debt.id,
          debtName: debt.name,
          recommendationReady: false,
          confidence: 'low',
          message: 'Need at least 3 statement snapshots with interest charged to recommend an accrual model.',
        };
      }

      let dailyError = 0;
      let monthlyError = 0;
      let comparisons = 0;

      for (let index = 1; index < comparable.length; index += 1) {
        const previous = comparable[index - 1];
        const current = comparable[index];
        const days = Math.max(
          1,
          Math.round(
            (new Date(current.snapshotDate).getTime() - new Date(previous.snapshotDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );
        const observedInterest = current.interestChargedCents ?? 0;
        const dailyEstimate = Math.round(previous.balanceCents * (debt.aprBps / 10000) * (days / 365));
        const monthlyEstimate = Math.round(previous.balanceCents * (debt.aprBps / 10000 / 12));

        dailyError += Math.abs(observedInterest - dailyEstimate);
        monthlyError += Math.abs(observedInterest - monthlyEstimate);
        comparisons += 1;
      }

      const recommendedInterestMethod = dailyError <= monthlyError ? 'daily' : 'monthly';
      const errorGap = Math.abs(dailyError - monthlyError);
      const confidence = errorGap > 250 ? 'high' : errorGap > 100 ? 'medium' : 'low';

      let recommendedBalancePresentation: BalancePresentationMethod | undefined;
      const presentationSnapshots = debtSnapshots.filter(
        (snapshot) => snapshot.principalBalanceCents !== null && snapshot.accruedInterestCents !== null,
      );
      if (presentationSnapshots.length >= 2) {
        const mostlySplit = presentationSnapshots.every((snapshot) => {
          const principal = snapshot.principalBalanceCents ?? 0;
          const accrued = snapshot.accruedInterestCents ?? 0;
          return Math.abs(snapshot.balanceCents - (principal + accrued)) <= 2;
        });

        recommendedBalancePresentation = mostlySplit
          ? 'principal_plus_accrued_interest'
          : 'capitalized_balance';
      }

      return {
        debtId: debt.id,
        debtName: debt.name,
        recommendationReady: true,
        recommendedInterestMethod,
        recommendedBalancePresentation,
        confidence,
        message:
          recommendedInterestMethod === 'daily'
            ? `Daily accrual fits ${comparisons} statement intervals better than monthly accrual.`
            : `Monthly accrual fits ${comparisons} statement intervals better than daily accrual.`,
      };
    });
  }

  private parseSnapshotCsv(csvText: string): SnapshotRecord[] {
    const trimmed = csvText.trim();
    if (!trimmed) {
      return [];
    }

    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      return [];
    }

    const headers = this.parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
    const headerIndex = (name: string) => headers.indexOf(name);

    const debtIdIndex = headerIndex('debtid');
    const snapshotDateIndex = headerIndex('snapshotdate');
    const balanceIndex = headerIndex('balance');
    const interestIndex = headerIndex('interestcharged');
    const minimumIndex = headerIndex('minimumdue');
    const noteIndex = headerIndex('sourcenote');

    if (debtIdIndex === -1 || snapshotDateIndex === -1 || balanceIndex === -1) {
      throw new Error('CSV must include debtId, snapshotDate, and balance columns.');
    }

    return lines.slice(1).map((line) => {
      const columns = this.parseCsvLine(line);
      const read = (index: number) => (index >= 0 ? columns[index]?.trim() ?? '' : '');

      return {
        id: this.makeId(),
        debtId: read(debtIdIndex),
        snapshotDate: read(snapshotDateIndex),
        balanceCents: this.parseCurrencyToCents(read(balanceIndex)),
        principalBalanceCents: read(headerIndex('principalbalance'))
          ? this.parseCurrencyToCents(read(headerIndex('principalbalance')))
          : null,
        accruedInterestCents: read(headerIndex('accruedinterest'))
          ? this.parseCurrencyToCents(read(headerIndex('accruedinterest')))
          : null,
        interestChargedCents: read(interestIndex) ? this.parseCurrencyToCents(read(interestIndex)) : null,
        minimumDueCents: read(minimumIndex) ? this.parseCurrencyToCents(read(minimumIndex)) : null,
        sourceNote: read(noteIndex),
      };
    });
  }

  private ensureColumn(tableName: string, columnName: string, definition: string) {
    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === columnName)) {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '"') {
        const next = line[index + 1];
        if (inQuotes && next === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }

  private parseCurrencyToCents(value: string) {
    const normalized = value.replace(/[$,\s]/g, '');
    return Math.round(Number(normalized) * 100);
  }

  private simulatePayoff(debts: DebtRecord[], settings: PlannerSettings): SimulationResult {
    const eligibleDebts = debts.filter((debt) => debt.aprBps > 0);
    const skippedDebts = debts.filter((debt) => debt.balanceCents > 0 && debt.aprBps <= 0);

    const runtimeDebts: RuntimeDebt[] = eligibleDebts.map((debt) => ({
      ...debt,
      balanceMicros: this.toMicrosFromCents(debt.balanceCents),
    }));

    const warnings: string[] = skippedDebts.map(
      (debt) => `${debt.name} is excluded from projections until you add its APR.`,
    );
    const months: MonthResult[] = [];
    const focusSequence: string[] = [];
    let totalInterestMicros = 0n;
    let totalPaidMicros = 0n;
    let completed = false;

    const startDate = this.startOfMonth(this.parseStoredDate(settings.startDate));

    if (runtimeDebts.length === 0) {
      return {
        months,
        warnings,
        totalInterestCents: 0,
        totalPaidCents: 0,
        debtFreeDate: undefined,
        monthsToPayoff: 0,
        focusSequence,
        completed: false,
      };
    }

    for (let monthOffset = 0; monthOffset < MAX_MONTHS; monthOffset += 1) {
      const monthDate = this.addMonths(startDate, monthOffset);
      if (runtimeDebts.every((debt) => debt.balanceMicros <= 0n)) {
        completed = true;
        break;
      }

      const plan = this.buildMonthPlan(runtimeDebts, settings, monthDate);
      warnings.push(...plan.warnings);

      if (plan.paymentsMicros.size === 0) {
        break;
      }

      if (plan.focusDebtId) {
        const currentFocus = runtimeDebts.find((debt) => debt.id === plan.focusDebtId)?.name;
        if (currentFocus && focusSequence[focusSequence.length - 1] !== currentFocus) {
          focusSequence.push(currentFocus);
        }
      }

      const items: DebtMonthResult[] = [];
      let monthInterestMicros = 0n;
      let monthPaymentMicros = 0n;

      for (const debt of runtimeDebts) {
        if (debt.balanceMicros <= 0n) {
          continue;
        }

        const paymentMicros = plan.paymentsMicros.get(debt.id) ?? 0n;
        const { result, endingBalanceMicros } = this.simulateDebtMonth(debt, paymentMicros, monthDate);
        debt.balanceMicros = endingBalanceMicros;
        items.push(result);
        monthInterestMicros += this.toMicrosFromCents(result.interestCents);
        monthPaymentMicros += this.toMicrosFromCents(result.paymentCents);
      }

      const totalBalanceCents = runtimeDebts.reduce((sum, debt) => sum + this.microsToCents(debt.balanceMicros), 0);
      totalInterestMicros += monthInterestMicros;
      totalPaidMicros += monthPaymentMicros;

      months.push({
        monthKey: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
        label: this.formatMonth(monthDate),
        totalPaymentCents: this.microsToCents(monthPaymentMicros),
        totalInterestCents: this.microsToCents(monthInterestMicros),
        totalBalanceCents,
        focusDebtId: plan.focusDebtId,
        focusDebtName: runtimeDebts.find((debt) => debt.id === plan.focusDebtId)?.name,
        items: items.sort((left, right) => right.startingBalanceCents - left.startingBalanceCents),
      });
    }

    if (runtimeDebts.every((debt) => debt.balanceMicros <= 0n)) {
      completed = true;
    }

    const debtFreeMonth = completed && months.length > 0 ? months[months.length - 1].monthKey : undefined;
    const debtFreeDate = debtFreeMonth
      ? new Date(`${debtFreeMonth}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : undefined;

    return {
      months,
      warnings: [...new Set(warnings)],
      totalInterestCents: this.microsToCents(totalInterestMicros),
      totalPaidCents: this.microsToCents(totalPaidMicros),
      debtFreeDate,
      monthsToPayoff: months.length,
      focusSequence,
      completed,
    };
  }

  private buildMonthPlan(debts: RuntimeDebt[], settings: PlannerSettings, monthDate: Date): MonthPlan {
    const warnings: string[] = [];
    const paymentsMicros = new Map<string, bigint>();
    const activeDebts = debts.filter((debt) => debt.balanceMicros > 0n);
    const monthlyBudgetMicros = this.toMicrosFromCents(settings.monthlyBudgetCents);

    const minimumTotal = activeDebts.reduce(
      (sum, debt) => {
        const minimumMicros = this.toMicrosFromCents(debt.minimumPaymentCents);
        const payoffMicros = this.estimatePayoffAmountAtDueDay(debt, monthDate);
        return sum + this.minMicros(minimumMicros, payoffMicros);
      },
      0n,
    );

    if (minimumTotal > monthlyBudgetMicros) {
      warnings.push(
        `Monthly budget does not cover minimum payments in ${this.formatMonth(monthDate)}. Increase the budget or reduce required minimums.`,
      );

      return { paymentsMicros, warnings };
    }

    let remainingBudget = monthlyBudgetMicros;

    for (const debt of activeDebts) {
      const basePayment = this.minMicros(
        this.toMicrosFromCents(debt.minimumPaymentCents),
        this.estimatePayoffAmountAtDueDay(debt, monthDate),
      );
      paymentsMicros.set(debt.id, basePayment);
      remainingBudget -= basePayment;
    }

    let exclusiveGuardDebtId: string | undefined;

    if (settings.strategy === 'hybrid' || activeDebts.some((debt) => debt.deferredInterest && debt.promoEndDate)) {
      const guardDebts = activeDebts
        .map((debt) => ({
          debt,
          guardPayment:
            settings.strategy === 'hybrid'
              ? this.computeGuardPayment(debt, monthDate)
              : 0n,
        }))
        .filter(({ debt, guardPayment }) => {
          if (settings.strategy !== 'hybrid') {
            return Boolean(debt.deferredInterest && debt.promoEndDate);
          }
          if (guardPayment <= 0n) {
            return false;
          }
          return true;
        })
        .sort((left, right) => {
          const leftDate = left.debt.promoEndDate ? new Date(left.debt.promoEndDate).getTime() : Number.MAX_SAFE_INTEGER;
          const rightDate = right.debt.promoEndDate ? new Date(right.debt.promoEndDate).getTime() : Number.MAX_SAFE_INTEGER;
          return leftDate - rightDate;
        });

      for (const item of guardDebts) {
        const current = paymentsMicros.get(item.debt.id) ?? 0n;
        const payoffAmountMicros = this.estimatePayoffAmountAtDueDay(item.debt, monthDate);
        let needed = item.guardPayment > current ? item.guardPayment - current : 0n;
        const windows = item.debt.promoEndDate
          ? this.paymentWindowsRemaining(monthDate, item.debt.promoEndDate, item.debt.deferredInterest)
          : 1;

        if (item.debt.deferredInterest && item.debt.promoEndDate) {
          const maxWindowPayment = current + remainingBudget;
          const requiredWindows = this.ceilDiv(payoffAmountMicros, maxWindowPayment);

          if (BigInt(windows) <= requiredWindows) {
            const minimumNeededNow =
              payoffAmountMicros - BigInt(Math.max(0, windows - 1)) * maxWindowPayment;
            needed = minimumNeededNow > current ? minimumNeededNow - current : 0n;
          } else {
            needed = 0n;
          }

          if ((needed > 0n || BigInt(windows) <= requiredWindows) && !exclusiveGuardDebtId) {
            exclusiveGuardDebtId = item.debt.id;
          }
        } else if (settings.strategy !== 'hybrid') {
          needed = 0n;
        }

        const addition = remainingBudget >= needed ? needed : remainingBudget;

        if (addition > 0n) {
          paymentsMicros.set(item.debt.id, current + addition);
          remainingBudget -= addition;
        }

        if (addition < needed) {
          const debtType = item.debt.deferredInterest ? 'deferred-interest' : 'promo';
          warnings.push(
            `${item.debt.name} may miss its ${debtType} deadline of ${this.formatDeadline(item.debt.promoEndDate!)} with the current budget.`,
          );
        }
      }
    }

    const ranked = this.getStrategySort(settings.strategy, activeDebts, monthDate);
    let focusDebtId: string | undefined;

    while (remainingBudget > 0n) {
      const target = ranked.find((debt) => {
        if (exclusiveGuardDebtId && debt.id === exclusiveGuardDebtId) {
          return false;
        }
        const scheduled = paymentsMicros.get(debt.id) ?? 0n;
        return this.estimatePayoffAmountAtDueDay(debt, monthDate) - scheduled > 0n;
      });

      if (!target) {
        break;
      }

      const current = paymentsMicros.get(target.id) ?? 0n;
      const capacity = this.estimatePayoffAmountAtDueDay(target, monthDate) - current;
      const extra = remainingBudget > capacity ? capacity : remainingBudget;
      paymentsMicros.set(target.id, current + extra);
      remainingBudget -= extra;
    }

    if (exclusiveGuardDebtId) {
      const focusPayment = paymentsMicros.get(exclusiveGuardDebtId) ?? 0n;
      if (focusPayment > 0n) {
        focusDebtId = exclusiveGuardDebtId;
      }
    }

    const focusCandidate = activeDebts
      .map((debt) => {
        const scheduled = paymentsMicros.get(debt.id) ?? 0n;
        const minimumMicros = this.minMicros(
          this.toMicrosFromCents(debt.minimumPaymentCents),
          this.estimatePayoffAmountAtDueDay(debt, monthDate),
        );
        const extraMicros = scheduled > minimumMicros ? scheduled - minimumMicros : 0n;
        return {
          debtId: debt.id,
          extraMicros,
          scheduledMicros: scheduled,
        };
      })
      .sort((left, right) => {
        if (left.extraMicros === right.extraMicros) {
          if (left.scheduledMicros === right.scheduledMicros) {
            return 0;
          }
          return left.scheduledMicros > right.scheduledMicros ? -1 : 1;
        }
        return left.extraMicros > right.extraMicros ? -1 : 1;
      })[0];

    if (focusCandidate && focusCandidate.scheduledMicros > 0n) {
      focusDebtId = focusCandidate.debtId;
    }

    return { paymentsMicros, focusDebtId, warnings };
  }

  private estimatePayoffAmountAtDueDay(debt: RuntimeDebt, monthDate: Date) {
    if (debt.balanceMicros <= 0n || debt.interestMethod !== 'daily') {
      return debt.balanceMicros;
    }

    const monthDays = this.daysInMonth(monthDate);
    const dueDay = this.clampDay(debt.dueDay, monthDays);
    let projectedBalance = debt.balanceMicros;

    for (let day = 1; day <= dueDay; day += 1) {
      const currentDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const aprBps = this.aprForDate(debt, currentDate);

      if (aprBps > 0) {
        projectedBalance += this.divRound(projectedBalance * BigInt(aprBps), 10_000n * 365n);
      }
    }

    return projectedBalance;
  }

  private simulateDebtMonth(
    debt: RuntimeDebt,
    paymentMicros: bigint,
    monthDate: Date,
  ): { result: DebtMonthResult; endingBalanceMicros: bigint } {
    const startingBalanceMicros = debt.balanceMicros;
    const monthDays = this.daysInMonth(monthDate);
    const dueDay = this.clampDay(debt.dueDay, monthDays);
    let balance = debt.balanceMicros;
    let interestAccruedMicros = 0n;
    let paymentAppliedMicros = 0n;

    for (let day = 1; day <= monthDays; day += 1) {
      const currentDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const aprBps = this.aprForDate(debt, currentDate);

      if (debt.interestMethod === 'daily' && balance > 0n && aprBps > 0) {
        const dailyInterest = this.divRound(balance * BigInt(aprBps), 10_000n * 365n);
        balance += dailyInterest;
        interestAccruedMicros += dailyInterest;
      }

      if (day === dueDay && paymentMicros > 0n && balance > 0n) {
        const applied = paymentMicros > balance ? balance : paymentMicros;
        balance -= applied;
        paymentAppliedMicros += applied;
      }
    }

    if (debt.interestMethod === 'monthly' && balance > 0n) {
      const aprBps = this.aprForDate(debt, this.endOfMonth(monthDate));
      const monthlyInterest = this.divRound(balance * BigInt(aprBps), 10_000n * 12n);
      balance += monthlyInterest;
      interestAccruedMicros += monthlyInterest;
    }

    const noteParts: string[] = [];
    if (debt.promoEndDate && this.isPromoActiveOn(debt, this.endOfMonth(monthDate))) {
      noteParts.push(
        debt.deferredInterest
          ? `Deferred-interest window active until ${this.formatDeadline(debt.promoEndDate)}`
          : `Promo APR active until ${this.formatDeadline(debt.promoEndDate)}`,
      );
    }

    return {
      endingBalanceMicros: balance,
      result: {
        debtId: debt.id,
        name: debt.name,
        startingBalanceCents: this.microsToCents(startingBalanceMicros),
        paymentCents: this.microsToCents(paymentAppliedMicros),
        interestCents: this.microsToCents(interestAccruedMicros),
        endingBalanceCents: this.microsToCents(balance),
        aprLabel: `${(this.aprForDate(debt, monthDate) / 100).toFixed(2)}% ${debt.interestMethod}`,
        note: noteParts.join(' '),
      },
    };
  }

  private getStrategySort(strategy: Strategy, debts: RuntimeDebt[], monthDate: Date) {
    const scoreById = new Map<string, number>();

    for (const debt of debts) {
      const currentApr = this.aprForDate(debt, monthDate);
      const balanceCents = this.microsToCents(debt.balanceMicros);
      const promoWindows = debt.promoEndDate ? this.paymentWindowsRemaining(monthDate, debt.promoEndDate, debt.deferredInterest) : 999;
      const urgencyBoost =
        debt.promoEndDate && (debt.deferredInterest || promoWindows <= 2) ? 10_000 - promoWindows : 0;

      if (strategy === 'snowball') {
        scoreById.set(debt.id, -balanceCents + currentApr / 10_000);
        continue;
      }

      if (strategy === 'avalanche') {
        scoreById.set(debt.id, currentApr * 1_000_000 - balanceCents);
        continue;
      }

      scoreById.set(debt.id, currentApr * 1_000_000 + urgencyBoost * 100_000 - balanceCents);
    }

    return [...debts].sort((left, right) => (scoreById.get(right.id) ?? 0) - (scoreById.get(left.id) ?? 0));
  }

  private computeGuardPayment(debt: RuntimeDebt, monthDate: Date) {
    if (!debt.promoEndDate) {
      return 0n;
    }

    const promoEnds = this.parseStoredDate(debt.promoEndDate);
    if (promoEnds < this.startOfMonth(monthDate)) {
      return 0n;
    }

    const windows = this.paymentWindowsRemaining(monthDate, debt.promoEndDate, debt.deferredInterest);
    return this.divRound(debt.balanceMicros, BigInt(windows));
  }

  private paymentWindowsRemaining(monthDate: Date, promoEndDate: string, settleBeforePromoMonth = false) {
    const promoDate = this.parseStoredDate(promoEndDate);
    const monthIndex =
      (promoDate.getFullYear() - monthDate.getFullYear()) * 12 + (promoDate.getMonth() - monthDate.getMonth());
    const inclusiveWindows = monthIndex + 1;
    return Math.max(1, inclusiveWindows - (settleBeforePromoMonth ? 1 : 0));
  }

  private isPromoActiveOn(debt: DebtRecord, date: Date) {
    return debt.promoEndDate ? this.parseStoredDate(debt.promoEndDate) >= date : false;
  }

  private aprForDate(debt: DebtRecord, date: Date) {
    if (this.isPromoActiveOn(debt, date)) {
      return debt.promoAprBps ?? debt.aprBps;
    }

    return debt.aprBps;
  }

  private toMicrosFromCents(value: number) {
    return BigInt(Math.round(value)) * MICROS_PER_CENT;
  }

  private microsToCents(value: bigint) {
    return Number((value + MICROS_PER_CENT / 2n) / MICROS_PER_CENT);
  }

  private divRound(numerator: bigint, denominator: bigint) {
    return (numerator + denominator / 2n) / denominator;
  }

  private ceilDiv(numerator: bigint, denominator: bigint) {
    return (numerator + denominator - 1n) / denominator;
  }

  private minMicros(left: bigint, right: bigint) {
    return left < right ? left : right;
  }

  private clampDay(day: number, monthDays: number) {
    return Math.max(1, Math.min(monthDays, Math.round(day)));
  }

  private daysInMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  private addMonths(date: Date, months: number) {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  private startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private endOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  private formatMonth(date: Date) {
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }

  private formatDeadline(date: string) {
    return this.parseStoredDate(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private parseStoredDate(value: string) {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      return new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
    }

    return new Date(value);
  }
}
