import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema";

export async function setUserContext(tx: NodePgDatabase<typeof schema>, userId: string): Promise<void> {
  await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
}
