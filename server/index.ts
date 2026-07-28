import "dotenv/config";
import { createApp } from "./app";
import { runMigrations } from "./db/migrate";
import { seedDefaultCategories } from "./db/seed";
import { startScheduledJobs } from "./jobs/scheduler";

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
