import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// A real stateful connection (not Neon's HTTP/fetch driver) is required so
// `set_config(..., true)` (transaction-local) can carry app.current_user_id
// for RLS across the statements of a single request. Points at Neon's
// pooled (-pooler) host, which is safe for this because SET LOCAL / the
// `true` (local) form of set_config is transaction-scoped, not session-scoped
// — it survives PgBouncer transaction-mode pooling.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
