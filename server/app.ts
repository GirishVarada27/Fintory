import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { requireAuth } from "./middleware/requireAuth";
import { withUserContext } from "./middleware/withUserContext";
import { categoriesRouter } from "./routes/categories";
import { expensesRouter } from "./routes/expenses";
import { loansRouter } from "./routes/loans";
import { savingsAccountsRouter } from "./routes/savingsAccounts";
import { assetsRouter } from "./routes/assets";
import { dashboardRouter } from "./routes/dashboard";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // Mounted before express.json(): Better Auth parses its own request body.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json());

  const api = express.Router();
  api.use(requireAuth, withUserContext);
  api.use("/categories", categoriesRouter);
  api.use("/expenses", expensesRouter);
  api.use("/loans", loansRouter);
  api.use("/savings-accounts", savingsAccountsRouter);
  api.use("/assets", assetsRouter);
  api.use("/dashboard", dashboardRouter);
  app.use("/api/v1", api);

  if (process.env.NODE_ENV === "production") {
    // No separate frontend process in production: Express serves the Vite
    // build output directly, falling through to index.html so client-side
    // routing works for any non-API path.
    const publicDir = path.join(__dirname, "public");
    app.use(express.static(publicDir));
    app.get("/*splat", (_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
    }
  });

  return app;
}
