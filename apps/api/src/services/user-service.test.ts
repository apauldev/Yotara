import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';

async function setupTestDb() {
  const dbFile = join(tmpdir(), `yotara-user-service-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  const { db, sqlite } = await import('../db/client.js');
  const userService = await import('./user-service.js');
  const { users, accounts, sessions, tasks, projects, labels, taskLabels, verifications } =
    await import('../db/schema.js');

  return {
    db,
    sqlite,
    userService,
    schema: { users, accounts, sessions, tasks, projects, labels, taskLabels, verifications },
    cleanup() {
      sqlite.close();
      rmSync(dbFile, { force: true });
      delete process.env['DATABASE_URL'];
    },
  };
}

async function seedUser(
  ctx: Awaited<ReturnType<typeof setupTestDb>>,
  email: string,
  password: string,
) {
  const userId = randomUUID();
  const s = ctx.schema;

  const hashed = await hashPassword(password);

  const now = new Date();
  await ctx.db.insert(s.users).values({
    id: userId,
    name: email.split('@')[0],
    email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert(s.accounts).values({
    id: randomUUID(),
    userId,
    accountId: userId,
    providerId: 'credential',
    password: hashed,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert(s.sessions).values({
    id: randomUUID(),
    userId,
    token: randomUUID(),
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: now,
    updatedAt: now,
  });

  return userId;
}

async function seedUserData(ctx: Awaited<ReturnType<typeof setupTestDb>>, userId: string) {
  const s = ctx.schema;
  const now = new Date().toISOString();

  // Create a project
  const projectId = randomUUID();
  await ctx.db.insert(s.projects).values({
    id: projectId,
    ownerId: userId,
    name: 'Test Project',
    createdAt: now,
    updatedAt: now,
  });

  // Create labels
  const labelAId = randomUUID();
  const labelBId = randomUUID();
  await ctx.db.insert(s.labels).values([
    {
      id: labelAId,
      userId,
      name: 'Label A',
      color: '#ff0000',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: labelBId,
      userId,
      name: 'Label B',
      color: '#0000ff',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // Create tasks with labels
  const task1Id = randomUUID();
  const task2Id = randomUUID();
  await ctx.db.insert(s.tasks).values([
    {
      id: task1Id,
      userId,
      title: 'Task 1',
      status: 'inbox',
      priority: 'medium',
      simpleMode: false,
      completed: false,
      archivedAt: null,
      permanentArchive: false,
      order: 0,
      deletedAt: null,
      projectId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: task2Id,
      userId,
      title: 'Task 2',
      status: 'today',
      priority: 'high',
      simpleMode: false,
      completed: false,
      archivedAt: null,
      permanentArchive: false,
      order: 1,
      deletedAt: null,
      projectId,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // Set up task-label associations
  await ctx.db.insert(s.taskLabels).values([
    { taskId: task1Id, labelId: labelAId },
    { taskId: task1Id, labelId: labelBId },
    { taskId: task2Id, labelId: labelAId },
  ]);

  // Create a verification row
  await ctx.db.insert(s.verifications).values({
    id: randomUUID(),
    identifier: `user-${userId}@test.com`,
    value: 'test-token',
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function countRows(ctx: Awaited<ReturnType<typeof setupTestDb>>, table: any) {
  const rows = await ctx.db.select().from(table);
  return rows.length;
}

test('User Service — deleteAccountForUser', async (t) => {
  const ctx = await setupTestDb();

  try {
    await t.test('deletes account and all data with correct password', async () => {
      const email = `${randomUUID()}@test.com`;
      const password = 'correct-password-123';
      const userId = await seedUser(ctx, email, password);
      await seedUserData(ctx, userId);

      // Seed a verification row keyed by email
      const now = new Date();
      await ctx.db.insert(ctx.schema.verifications).values({
        id: randomUUID(),
        identifier: email,
        value: 'verify-token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: now,
        updatedAt: now,
      });
      ctx.sqlite
        .prepare(
          'INSERT INTO login_attempts (ip, email, attempts, last_attempt_at) VALUES (?, ?, ?, ?)',
        )
        .run('127.0.0.1', email, 1, Date.now());
      ctx.sqlite
        .prepare('INSERT INTO email_sends (email, type, created_at) VALUES (?, ?, ?)')
        .run(email, 'signup', Date.now());

      const result = await ctx.userService.deleteAccountForUser(userId, password);

      assert.deepEqual(result, { ok: true });

      // Verify all tables are empty for this user
      assert.equal(
        (await ctx.db.select().from(ctx.schema.users).where(eq(ctx.schema.users.id, userId)))
          .length,
        0,
      );
      assert.equal(
        (
          await ctx.db
            .select()
            .from(ctx.schema.accounts)
            .where(eq(ctx.schema.accounts.userId, userId))
        ).length,
        0,
      );
      assert.equal(
        (
          ctx.sqlite
            .prepare('SELECT COUNT(*) AS count FROM login_attempts WHERE email = ?')
            .get(email) as { count: number }
        ).count,
        0,
      );
      assert.equal(
        (
          ctx.sqlite
            .prepare('SELECT COUNT(*) AS count FROM email_sends WHERE email = ?')
            .get(email) as { count: number }
        ).count,
        0,
      );
      assert.equal(
        (
          await ctx.db
            .select()
            .from(ctx.schema.sessions)
            .where(eq(ctx.schema.sessions.userId, userId))
        ).length,
        0,
      );
      assert.equal(
        (await ctx.db.select().from(ctx.schema.tasks).where(eq(ctx.schema.tasks.userId, userId)))
          .length,
        0,
      );
      assert.equal(
        (await ctx.db.select().from(ctx.schema.labels).where(eq(ctx.schema.labels.userId, userId)))
          .length,
        0,
      );
      assert.equal(
        (
          await ctx.db
            .select()
            .from(ctx.schema.projects)
            .where(eq(ctx.schema.projects.ownerId, userId))
        ).length,
        0,
      );
      // task_labels should be empty (no remaining rows at all)
      assert.equal(await countRows(ctx, ctx.schema.taskLabels), 0);
      // verification by email should be gone
      assert.equal(
        (
          await ctx.db
            .select()
            .from(ctx.schema.verifications)
            .where(eq(ctx.schema.verifications.identifier, email))
        ).length,
        0,
      );
    });

    await t.test('rejects wrong password without deleting data', async () => {
      const email = `${randomUUID()}@test.com`;
      const password = 'correct-password-456';
      const userId = await seedUser(ctx, email, password);
      await seedUserData(ctx, userId);

      const result = await ctx.userService.deleteAccountForUser(userId, 'wrong-password');

      assert.deepEqual(result, { ok: false, reason: 'invalid_password' });

      // User still exists
      assert.equal(
        (await ctx.db.select().from(ctx.schema.users).where(eq(ctx.schema.users.id, userId)))
          .length,
        1,
      );
      // Tasks still exist
      assert.equal(
        (await ctx.db.select().from(ctx.schema.tasks).where(eq(ctx.schema.tasks.userId, userId)))
          .length,
        2,
      );
    });

    await t.test('returns user_not_found for non-existent user', async () => {
      const result = await ctx.userService.deleteAccountForUser(randomUUID(), 'any-password');
      assert.deepEqual(result, { ok: false, reason: 'user_not_found' });
    });

    await t.test('other users are unaffected by deletion', async () => {
      const email1 = `${randomUUID()}@test.com`;
      const password1 = 'user1-password';
      const userId1 = await seedUser(ctx, email1, password1);
      await seedUserData(ctx, userId1);

      const email2 = `${randomUUID()}@test.com`;
      const password2 = 'user2-password';
      const userId2 = await seedUser(ctx, email2, password2);
      await seedUserData(ctx, userId2);

      // Delete user 1
      const result = await ctx.userService.deleteAccountForUser(userId1, password1);
      assert.deepEqual(result, { ok: true });

      // User 1 is gone
      assert.equal(
        (await ctx.db.select().from(ctx.schema.users).where(eq(ctx.schema.users.id, userId1)))
          .length,
        0,
      );

      // User 2 still exists with all data
      assert.equal(
        (await ctx.db.select().from(ctx.schema.users).where(eq(ctx.schema.users.id, userId2)))
          .length,
        1,
      );
      assert.equal(
        (await ctx.db.select().from(ctx.schema.tasks).where(eq(ctx.schema.tasks.userId, userId2)))
          .length,
        2,
      );
      assert.equal(
        (await ctx.db.select().from(ctx.schema.labels).where(eq(ctx.schema.labels.userId, userId2)))
          .length,
        2,
      );
      assert.equal(
        (
          await ctx.db
            .select()
            .from(ctx.schema.projects)
            .where(eq(ctx.schema.projects.ownerId, userId2))
        ).length,
        1,
      );
    });

    await t.test('rolls back the entire transaction if a delete fails mid-flight', async () => {
      const email = `${randomUUID()}@test.com`;
      const password = 'rollback-password';
      const userId = await seedUser(ctx, email, password);
      await seedUserData(ctx, userId);

      // Force a failure right before the final user delete, after every other
      // table has already been deleted inside the same transaction. If the
      // transaction is not atomic, those earlier deletes would leak.
      ctx.sqlite.exec(`
        CREATE TRIGGER fail_delete_user
        BEFORE DELETE ON user
        BEGIN
          SELECT RAISE(ABORT, 'forced rollback test');
        END;
      `);

      try {
        await assert.rejects(
          () => ctx.userService.deleteAccountForUser(userId, password),
          /forced rollback/,
        );
      } finally {
        ctx.sqlite.exec('DROP TRIGGER IF EXISTS fail_delete_user');
      }

      // Every row for the user must remain, proving atomicity.
      assert.equal(
        (await ctx.db.select().from(ctx.schema.users).where(eq(ctx.schema.users.id, userId)))
          .length,
        1,
      );
      assert.equal(
        (
          await ctx.db
            .select()
            .from(ctx.schema.accounts)
            .where(eq(ctx.schema.accounts.userId, userId))
        ).length,
        1,
      );
      assert.equal(
        (
          await ctx.db
            .select()
            .from(ctx.schema.sessions)
            .where(eq(ctx.schema.sessions.userId, userId))
        ).length,
        1,
      );
      assert.equal(
        (await ctx.db.select().from(ctx.schema.tasks).where(eq(ctx.schema.tasks.userId, userId)))
          .length,
        2,
      );
      assert.equal(
        (
          await ctx.db
            .select()
            .from(ctx.schema.projects)
            .where(eq(ctx.schema.projects.ownerId, userId))
        ).length,
        1,
      );
      assert.equal(
        (await ctx.db.select().from(ctx.schema.labels).where(eq(ctx.schema.labels.userId, userId)))
          .length,
        2,
      );
      // task_labels are scoped to this user's tasks (the shared DB across
      // subtests retains other users' rows, so a global count would be wrong).
      const thisUserTaskIds = (
        await ctx.db
          .select({ id: ctx.schema.tasks.id })
          .from(ctx.schema.tasks)
          .where(eq(ctx.schema.tasks.userId, userId))
      ).map((row) => row.id);
      const thisUserTaskLabels = await ctx.db
        .select()
        .from(ctx.schema.taskLabels)
        .where(inArray(ctx.schema.taskLabels.taskId, thisUserTaskIds));
      assert.equal(thisUserTaskLabels.length, 3);
    });

    await t.test(
      'rejects deletion when the credential hash changes after verification',
      async () => {
        const email = `${randomUUID()}@test.com`;
        const password = 'cred-change-password';
        const userId = await seedUser(ctx, email, password);
        await seedUserData(ctx, userId);

        // Simulate a password change landing between the outer password check and
        // the in-transaction re-read: the injected verifier mutates the stored
        // hash yet still reports success. The service must detect the mismatch
        // via its re-read and refuse to delete anything.
        const tamperedHash = await hashPassword('a-totally-different-password');
        const tamperingVerify = async (_hash: string, _pwd: string) => {
          await ctx.db
            .update(ctx.schema.accounts)
            .set({ password: tamperedHash })
            .where(eq(ctx.schema.accounts.userId, userId));
          return true;
        };

        const result = await ctx.userService.deleteAccountForUser(
          userId,
          password,
          tamperingVerify,
        );
        assert.deepEqual(result, { ok: false, reason: 'invalid_password' });

        // Nothing was deleted.
        assert.equal(
          (await ctx.db.select().from(ctx.schema.users).where(eq(ctx.schema.users.id, userId)))
            .length,
          1,
        );
        assert.equal(
          (await ctx.db.select().from(ctx.schema.tasks).where(eq(ctx.schema.tasks.userId, userId)))
            .length,
          2,
        );
        assert.equal(
          (
            await ctx.db
              .select()
              .from(ctx.schema.projects)
              .where(eq(ctx.schema.projects.ownerId, userId))
          ).length,
          1,
        );
        assert.equal(
          (
            await ctx.db
              .select()
              .from(ctx.schema.labels)
              .where(eq(ctx.schema.labels.userId, userId))
          ).length,
          2,
        );
      },
    );
  } finally {
    ctx.cleanup();
  }
});
