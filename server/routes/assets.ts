import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { assets } from "../db/schema";
import {
  createAssetSchema,
  updateAssetSchema,
  listAssetsQuerySchema,
} from "../../shared/schemas/assets";
import type { PaginationQuery } from "../../shared/schemas/common";
import { validateBody, validateQuery } from "../middleware/validate";
import { notFound } from "../lib/errors";
import { cursorCondition, decodeCursor, encodeCursor } from "../lib/pagination";

export const assetsRouter = Router();

const MONEY_FIELDS = ["currentValue", "purchasePrice"] as const;

function stringifyMoney<T extends Record<string, unknown>>(body: T): T {
  const out = { ...body };
  for (const field of MONEY_FIELDS) {
    const value = out[field as keyof T];
    if (typeof value === "number") {
      (out as Record<string, unknown>)[field] = String(value);
    }
  }
  return out;
}

assetsRouter.get("/", validateQuery(listAssetsQuerySchema), async (req, res) => {
  const query = req.validatedQuery as PaginationQuery;
  const cursor = decodeCursor(query.cursor);

  const conditions = [eq(assets.userId, req.user!.id)];
  const cursorClause = cursorCondition(assets.createdAt, assets.id, cursor);
  if (cursorClause) conditions.push(cursorClause);

  const rows = await req.db
    .select()
    .from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt), desc(assets.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  const last = data.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  res.json({ data, pagination: { nextCursor, limit: query.limit } });
});

assetsRouter.get("/:id", async (req, res) => {
  const [row] = await req.db
    .select()
    .from(assets)
    .where(and(eq(assets.id, req.params.id as string), eq(assets.userId, req.user!.id)));
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});

assetsRouter.post("/", validateBody(createAssetSchema), async (req, res) => {
  const [row] = await req.db
    .insert(assets)
    .values({ ...stringifyMoney(req.body), userId: req.user!.id })
    .returning();
  res.status(201).json({ data: row });
});

assetsRouter.patch("/:id", validateBody(updateAssetSchema), async (req, res) => {
  const updates = { ...stringifyMoney(req.body), updatedAt: new Date() };
  const [row] = await req.db
    .update(assets)
    .set(updates)
    .where(and(eq(assets.id, req.params.id as string), eq(assets.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});

assetsRouter.delete("/:id", async (req, res) => {
  const [row] = await req.db
    .delete(assets)
    .where(and(eq(assets.id, req.params.id as string), eq(assets.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.status(204).send();
});
