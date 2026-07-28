import { sql } from "drizzle-orm";
import { db } from "./index";
import { categories } from "./schema";

const DEFAULT_CATEGORIES = [
  { name: "Groceries", color: "#22c55e" },
  { name: "Dining", color: "#f97316" },
  { name: "Transport", color: "#3b82f6" },
  { name: "Utilities", color: "#eab308" },
  { name: "Entertainment", color: "#ec4899" },
  { name: "Shopping", color: "#a855f7" },
  { name: "Health", color: "#ef4444" },
  { name: "Other", color: "#64748b" },
];

// Runs with no app.current_user_id set, which the categories_insert/update
// policies specifically allow only for NULL-user_id (global) rows — see
// schema.ts. Never called from inside a per-request transaction.
export async function seedDefaultCategories() {
  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: null, isDefault: true })))
    .onConflictDoUpdate({
      target: categories.name,
      targetWhere: sql`${categories.userId} IS NULL`,
      set: { color: sql`excluded.color` },
    });
}
