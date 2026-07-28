import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

  if (!session) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } });
    return;
  }

  req.user = {
    id: session.user.id,
    email: session.user.email,
    defaultDisplayCurrency:
      (session.user as { defaultDisplayCurrency?: string }).defaultDisplayCurrency ?? "USD",
  };
  next();
}
