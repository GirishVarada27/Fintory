import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { notifications } from "../db/schema";
import { notFound } from "../lib/errors";

export const notificationsRouter = Router();

notificationsRouter.get("/", async (req, res) => {
  const rows = await req.db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, req.user!.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  res.json({ data: rows });
});

notificationsRouter.patch("/:id/read", async (req, res) => {
  const [row] = await req.db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, req.params.id as string), eq(notifications.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});
