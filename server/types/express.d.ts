import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../db/schema";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        defaultDisplayCurrency: string;
      };
      // Transaction-scoped Drizzle client with app.current_user_id already
      // set for this request — set by withUserContext. Route handlers must
      // query through this, never the raw pooled `db`, or RLS has nothing
      // to key off.
      db: NodePgDatabase<typeof schema>;
      // Populated by middleware/validate.ts's validateQuery; route handlers
      // cast this to the specific Zod-inferred query type for that route.
      validatedQuery?: unknown;
    }
  }
}

export {};
