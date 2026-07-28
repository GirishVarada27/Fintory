import { pool } from "../db/index";

export function uniqueTestEmail(label: string): string {
  return `test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@fintory.test`;
}

export async function getUserIdByEmail(email: string): Promise<string> {
  const result = await pool.query('select id from "user" where email = $1', [email]);
  if (result.rows.length === 0) {
    throw new Error(`No test user found for email ${email}`);
  }
  return result.rows[0].id as string;
}

// Sets app.current_user_id before deleting so FORCE-RLS-protected owned rows
// (expenses, loans, etc.) are visible to the cascade delete triggered by
// removing the user row — without it, the cascade would see nothing and the
// delete would fail on the foreign key constraint instead.
export async function deleteTestUser(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select set_config('app.current_user_id', $1, true)", [userId]);
    await client.query('delete from "user" where id = $1', [userId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
