import { Router } from "express";
import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { accountShares, user as userTable } from "../db/schema";
import { validateBody } from "../middleware/validate";
import { notFound, sendError, validationError } from "../lib/errors";

export const sharesRouter = Router();

const inviteSchema = z.object({
  email: z.string().email(),
  permission: z.enum(["view", "edit"]).default("view"),
});

sharesRouter.post("/", validateBody(inviteSchema), async (req, res) => {
  const [invitee] = await req.db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, req.body.email));

  if (!invitee) {
    validationError(res, "No account found with that email");
    return;
  }
  if (invitee.id === req.user!.id) {
    validationError(res, "You can't share your account with yourself");
    return;
  }

  try {
    const [share] = await req.db
      .insert(accountShares)
      .values({ ownerUserId: req.user!.id, sharedWithUserId: invitee.id, permission: req.body.permission })
      .returning();
    res.status(201).json({ data: share });
  } catch (err) {
    if (err instanceof Error && err.message.includes("account_shares_owner_sharee_unique")) {
      sendError(res, 409, "CONFLICT", "You've already shared your account with this person");
      return;
    }
    throw err;
  }
});

sharesRouter.get("/", async (req, res) => {
  const owner = alias(userTable, "owner");
  const sharee = alias(userTable, "sharee");

  const rows = await req.db
    .select({
      id: accountShares.id,
      ownerUserId: accountShares.ownerUserId,
      sharedWithUserId: accountShares.sharedWithUserId,
      permission: accountShares.permission,
      status: accountShares.status,
      createdAt: accountShares.createdAt,
      ownerName: owner.name,
      ownerEmail: owner.email,
      shareeName: sharee.name,
      shareeEmail: sharee.email,
    })
    .from(accountShares)
    .innerJoin(owner, eq(owner.id, accountShares.ownerUserId))
    .innerJoin(sharee, eq(sharee.id, accountShares.sharedWithUserId))
    .where(or(eq(accountShares.ownerUserId, req.user!.id), eq(accountShares.sharedWithUserId, req.user!.id)));

  const sent = rows.filter((r) => r.ownerUserId === req.user!.id);
  const received = rows.filter((r) => r.sharedWithUserId === req.user!.id);

  res.json({ data: { sent, received } });
});

sharesRouter.patch("/:id/accept", async (req, res) => {
  const [row] = await req.db
    .update(accountShares)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(
      and(
        eq(accountShares.id, req.params.id as string),
        eq(accountShares.sharedWithUserId, req.user!.id),
        eq(accountShares.status, "pending"),
      ),
    )
    .returning();
  if (!row) {
    notFound(res, "No pending invite found");
    return;
  }
  res.json({ data: row });
});

const updatePermissionSchema = z.object({ permission: z.enum(["view", "edit"]) });

sharesRouter.patch("/:id", validateBody(updatePermissionSchema), async (req, res) => {
  const [row] = await req.db
    .update(accountShares)
    .set({ permission: req.body.permission, updatedAt: new Date() })
    .where(and(eq(accountShares.id, req.params.id as string), eq(accountShares.ownerUserId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});

sharesRouter.delete("/:id", async (req, res) => {
  const [row] = await req.db
    .delete(accountShares)
    .where(
      and(
        eq(accountShares.id, req.params.id as string),
        or(eq(accountShares.ownerUserId, req.user!.id), eq(accountShares.sharedWithUserId, req.user!.id)),
      ),
    )
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.status(204).send();
});
