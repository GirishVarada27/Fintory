import { Router } from "express";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { categories } from "../db/schema";
import { createCategorySchema, updateCategorySchema } from "../../shared/schemas/categories";
import { validateBody } from "../middleware/validate";
import { notFound, sendError } from "../lib/errors";
import { resolveViewContext } from "../lib/viewContext";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (req, res) => {
  const view = await resolveViewContext(req, res);
  if (!view) return;

  const rows = await req.db
    .select()
    .from(categories)
    .where(or(isNull(categories.userId), eq(categories.userId, view.ownerId)))
    .orderBy(asc(categories.isDefault), asc(categories.name));
  res.json({ data: rows });
});

categoriesRouter.post("/", validateBody(createCategorySchema), async (req, res) => {
  const view = await resolveViewContext(req, res);
  if (!view) return;
  if (!view.canEdit) {
    sendError(res, 403, "FORBIDDEN", "You only have view access to this account");
    return;
  }

  const [row] = await req.db
    .insert(categories)
    .values({ ...req.body, userId: view.ownerId })
    .returning();
  res.status(201).json({ data: row });
});

categoriesRouter.patch("/:id", validateBody(updateCategorySchema), async (req, res) => {
  const view = await resolveViewContext(req, res);
  if (!view) return;
  if (!view.canEdit) {
    sendError(res, 403, "FORBIDDEN", "You only have view access to this account");
    return;
  }

  const [row] = await req.db
    .update(categories)
    .set(req.body)
    .where(and(eq(categories.id, req.params.id as string), eq(categories.userId, view.ownerId)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});

categoriesRouter.delete("/:id", async (req, res) => {
  const view = await resolveViewContext(req, res);
  if (!view) return;
  if (!view.canEdit) {
    sendError(res, 403, "FORBIDDEN", "You only have view access to this account");
    return;
  }

  const [row] = await req.db
    .delete(categories)
    .where(and(eq(categories.id, req.params.id as string), eq(categories.userId, view.ownerId)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.status(204).send();
});
