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
  // Neon's pooler drops idle connections on its own schedule; closing them
  // proactively on our side first turns that into a clean disconnect
  // instead of a surprise mid-idle drop that pg surfaces as a client
  // 'error' event (crashy even with the pool-level handler below, since it
  // can fire on a client that's between queries in an active transaction).
  idleTimeoutMillis: 20_000,
});

// node-postgres's own docs call this out: an idle pooled client can have its
// connection dropped by the backend (Neon does this) and emits an 'error'
// event with no listener attached to the pool — Node's default behavior for
// an unhandled 'error' event is to crash the process. The pool already
// removes the broken client and opens a fresh one on next checkout; this
// handler only stops that from taking the whole server down with it.
pool.on("error", (err) => {
  console.error("[db] unexpected error on idle client", err);
});

export const db = drizzle(pool, { schema });
