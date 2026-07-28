import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { categories } from "../db/schema";
import { createCategorySchema, updateCategorySchema } from "../../shared/schemas/categories";
import { validateBody } from "../middleware/validate";
import { notFound } from "../lib/errors";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (req, res) => {
  const rows = await req.db
    .select()
    .from(categories)
    .orderBy(asc(categories.isDefault), asc(categories.name));
  res.json({ data: rows });
});

categoriesRouter.post("/", validateBody(createCategorySchema), async (req, res) => {
  const [row] = await req.db
    .insert(categories)
    .values({ ...req.body, userId: req.user!.id })
    .returning();
  res.status(201).json({ data: row });
});

categoriesRouter.patch("/:id", validateBody(updateCategorySchema), async (req, res) => {
  const [row] = await req.db
    .update(categories)
    .set(req.body)
    .where(and(eq(categories.id, req.params.id as string), eq(categories.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});

categoriesRouter.delete("/:id", async (req, res) => {
  const [row] = await req.db
    .delete(categories)
    .where(and(eq(categories.id, req.params.id as string), eq(categories.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.status(204).send();
});
