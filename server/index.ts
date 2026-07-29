import "dotenv/config";
import { createApp } from "./app";
import { runMigrations } from "./db/migrate";
import { seedDefaultCategories } from "./db/seed";
import { startScheduledJobs } from "./jobs/scheduler";

// pg-pool only keeps its own 'error' listener on a client while that client
// is idle in the pool — it's detached for the whole time a client is
// checked out for a transaction (see pg-pool's _acquireClient), which is
// exactly when Neon's pooler can drop an underused connection. When that
// happens the client emits an unhandled 'error' event that would otherwise
// crash the whole process for every in-flight request, not just the one
// that hit the dropped connection. This is specifically scoped to that
// known, external, transient failure mode — not a general error-swallower.
process.on("uncaughtException", (err) => {
  if (err instanceof Error && err.message === "Connection terminated unexpectedly") {
    console.error("[db] connection dropped mid-transaction (Neon pooler) — request likely failed, server continuing", err);
    return;
  }
  console.error("[fatal] uncaught exception", err);
  process.exit(1);
});

async function main() {
  await runMigrations();
  await seedDefaultCategories();

  const app = createApp();
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`Fintory server listening on port ${port}`);
  });

  startScheduledJobs();
}

main().catch((err: unknown) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
