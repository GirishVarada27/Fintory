import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index";

// Must run after requireAuth. Opens one transaction per request and sets
// app.current_user_id (transaction-local, via set_config's third arg) so the
// RLS policies in server/db/schema.ts can key off it. Route handlers must
// query through req.db — never the raw pooled `db` — or RLS has no context
// to check against.
export function withUserContext(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } });
    return;
  }

  db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    req.db = tx;

    await new Promise<void>((resolve, reject) => {
      res.once("finish", () => {
        if (res.statusCode >= 500) {
          reject(new Error("Request failed with a server error; rolling back transaction"));
        } else {
          resolve();
        }
      });
      res.once("close", resolve);
      next();
    });
  }).catch((err: unknown) => {
    if (!res.headersSent) {
      next(err);
    }
  });
}
