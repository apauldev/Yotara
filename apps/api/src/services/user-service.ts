import { and, eq, sql } from 'drizzle-orm';
import { verifyPassword as betterAuthVerifyPassword } from 'better-auth/crypto';
import { db } from '../db/client.js';
import { accounts, labels, projects, sessions, tasks, users, verifications } from '../db/schema.js';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_password' }
  | { ok: false; reason: 'user_not_found' };

/**
 * Permanently delete a user account and all associated data.
 *
 * Requires the user's password for confirmation. All deletions run inside a
 * single SQLite transaction so partial failures roll back atomically. Deletion
 * order respects FK constraints:
 *
 *   1. tasks        (cascades task_labels via FK)
 *   2. labels       (cascades remaining task_labels)
 *   3. projects     (ON DELETE NO ACTION → must precede user)
 *   4. sessions     (ON DELETE NO ACTION)
 *   5. accounts     (ON DELETE NO ACTION)
 *   6. email-keyed records (no FK)
 *   7. user         (deleted last)
 */
export async function deleteAccountForUser(
  userId: string,
  password: string,
  verify: (hash: string, password: string) => Promise<boolean> = (hash, password) =>
    betterAuthVerifyPassword({ hash, password }),
): Promise<DeleteAccountResult> {
  // 1. Fetch the credential account row to get the password hash.
  const [account] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
    .limit(1);

  if (!account?.password) {
    return { ok: false, reason: 'user_not_found' };
  }

  // 2. Verify the password against the stored hash.
  const valid = await verify(account.password, password);
  if (!valid) {
    return { ok: false, reason: 'invalid_password' };
  }

  // 3. Re-read the hash in the immediate transaction. verifyPassword is async,
  // while better-sqlite3 transactions are synchronous, so this guards against
  // a password change between verification and deletion.
  return db.transaction(
    (tx) => {
      const [currentAccount] = tx
        .select({ password: accounts.password })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
        .limit(1)
        .all();
      if (!currentAccount || currentAccount.password !== account.password) {
        return { ok: false, reason: 'invalid_password' } as const;
      }

      const [user] = tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .all();
      if (!user) return { ok: false, reason: 'user_not_found' } as const;

      tx.delete(tasks).where(eq(tasks.userId, userId)).run();
      tx.delete(labels).where(eq(labels.userId, userId)).run();
      tx.delete(projects).where(eq(projects.ownerId, userId)).run();
      tx.delete(sessions).where(eq(sessions.userId, userId)).run();
      tx.delete(accounts).where(eq(accounts.userId, userId)).run();
      tx.delete(verifications).where(eq(verifications.identifier, user.email)).run();
      tx.run(sql`DELETE FROM login_attempts WHERE email = ${user.email}`);
      tx.run(sql`DELETE FROM email_sends WHERE email = ${user.email}`);
      tx.delete(users).where(eq(users.id, userId)).run();
      return { ok: true } as const;
    },
    { behavior: 'immediate' },
  );
}
