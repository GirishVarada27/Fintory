import "dotenv/config";

export default async function setup() {
  const { runMigrations } = await import("../db/migrate");
  const { seedDefaultCategories } = await import("../db/seed");
  const { pool } = await import("../db/index");

  await runMigrations();
  await seedDefaultCategories();
  await pool.end();
}
