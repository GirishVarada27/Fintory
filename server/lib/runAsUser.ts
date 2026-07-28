import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "../db/index";
import { setUserContext } from "../db/setUserContext";
import type * as schema from "../db/schema";

// The background-job equivalent of withUserContext middleware: opens one
// transaction scoped to a single user's RLS context, for code that isn't
// running inside an HTTP request (scheduled jobs, admin scripts).
export async function runAsUser<T>(
  userId: string,
  fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setUserContext(tx, userId);
    return fn(tx);
  });
}
