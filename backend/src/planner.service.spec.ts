import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlannerService } from './planner.service';

describe('PlannerService', () => {
  let tempDir: string;
  let service: PlannerService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'debtlab-'));
    process.env.DEBTLAB_DB_PATH = join(tempDir, 'test.db');
    service = new PlannerService();
  });

  afterEach(() => {
    service.onModuleDestroy();
    delete process.env.DEBTLAB_DB_PATH;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('registers a user and creates an empty planner', () => {
    const session = service.registerUser({
      email: 'demo@example.com',
      password: 'correct horse battery staple',
      displayName: 'Demo User',
    });

    const planner = service.getPlanner(service.requireUserIdBySession(session.token));

    expect(session.user.email).toBe('demo@example.com');
    expect(planner.debts).toEqual([]);
    expect(planner.settings.strategy).toBe('avalanche');
  });

  it('can reset an account to sample debts', () => {
    const session = service.registerUser({
      email: 'sample@example.com',
      password: 'correct horse battery staple',
    });

    const planner = service.resetPlanner(service.requireUserIdBySession(session.token));

    expect(planner.debts).toHaveLength(5);
    expect(planner.debts.map((debt) => debt.name)).toEqual(
      expect.arrayContaining(['Chase Freedom Unlimited', 'Student Loan']),
    );
  });
});
