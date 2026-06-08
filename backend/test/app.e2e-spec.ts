import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('DebtLab API (e2e)', () => {
  let app: INestApplication<App>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'debtlab-e2e-'));
    process.env.DEBTLAB_DB_PATH = join(tempDir, 'test.db');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.DEBTLAB_DB_PATH;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('registers, loads an empty planner, and resets sample data', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'demo@example.com',
        password: 'correct horse battery staple',
        displayName: 'Demo User',
      })
      .expect(201);

    const token = registerResponse.body.token as string;

    await request(app.getHttpServer())
      .get('/api/planner')
      .set('x-session-token', token)
      .expect(200)
      .expect(({ body }) => {
        expect(body.debts).toHaveLength(0);
      });

    await request(app.getHttpServer())
      .post('/api/planner/reset')
      .set('x-session-token', token)
      .expect(201)
      .expect(({ body }) => {
        expect(body.debts).toHaveLength(5);
      });
  });
});
