import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { deleteTestUser, getUserIdByEmail, uniqueTestEmail } from "./testDb";

const app = createApp();
const PASSWORD = "correct horse battery staple";

async function signUpAndLogin(label: string) {
  const email = uniqueTestEmail(label);
  const agent = request.agent(app);
  await agent.post("/api/auth/sign-up/email").send({ name: `Test ${label}`, email, password: PASSWORD });
  return { agent, email };
}

describe("account sharing permission enforcement", () => {
  let owner: { agent: ReturnType<typeof request.agent>; email: string };
  let sharee: { agent: ReturnType<typeof request.agent>; email: string };
  let stranger: { agent: ReturnType<typeof request.agent>; email: string };
  let ownerId: string;
  let shareId: string;

  beforeAll(async () => {
    owner = await signUpAndLogin("share-owner");
    sharee = await signUpAndLogin("share-sharee");
    stranger = await signUpAndLogin("share-stranger");
    ownerId = await getUserIdByEmail(owner.email);
  });

  afterAll(async () => {
    for (const { email } of [owner, sharee, stranger]) {
      const userId = await getUserIdByEmail(email);
      await deleteTestUser(userId);
    }
  });

  it("lets the owner invite the sharee with view permission, in pending status", async () => {
    const res = await owner.agent.post("/api/v1/shares").send({ email: sharee.email, permission: "view" });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.permission).toBe("view");
    shareId = res.body.data.id;
  });

  it("blocks access to the owner's data before the invite is accepted", async () => {
    const res = await sharee.agent.get(`/api/v1/expenses?ownerId=${ownerId}`);
    expect(res.status).toBe(403);
  });

  it("blocks a stranger with no share from ever accessing the owner's data", async () => {
    const res = await stranger.agent.get(`/api/v1/expenses?ownerId=${ownerId}`);
    expect(res.status).toBe(403);
  });

  it("lets the sharee accept the invite", async () => {
    const res = await sharee.agent.patch(`/api/v1/shares/${shareId}/accept`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("accepted");
  });

  it("lets a view-only sharee read the owner's data but not write to it", async () => {
    const readRes = await sharee.agent.get(`/api/v1/expenses?ownerId=${ownerId}`);
    expect(readRes.status).toBe(200);

    const writeRes = await sharee.agent
      .post(`/api/v1/expenses?ownerId=${ownerId}`)
      .send({ amount: 10, currency: "USD", vendor: "Should be blocked", date: "2026-07-01", source: "manual" });
    expect(writeRes.status).toBe(403);
    expect(writeRes.body.error.code).toBe("FORBIDDEN");
  });

  it("still blocks the stranger after the share is accepted for someone else", async () => {
    const res = await stranger.agent.get(`/api/v1/expenses?ownerId=${ownerId}`);
    expect(res.status).toBe(403);
  });

  let createdExpenseId: string;

  it("lets the owner upgrade the sharee to edit permission", async () => {
    const res = await owner.agent.patch(`/api/v1/shares/${shareId}`).send({ permission: "edit" });
    expect(res.status).toBe(200);
    expect(res.body.data.permission).toBe("edit");
  });

  it("lets an edit-permission sharee create, update, and delete in the owner's account", async () => {
    const createRes = await sharee.agent
      .post(`/api/v1/expenses?ownerId=${ownerId}`)
      .send({ amount: 15, currency: "USD", vendor: "Shared Edit Vendor", date: "2026-07-02", source: "manual" });
    expect(createRes.status).toBe(201);
    createdExpenseId = createRes.body.data.id;

    // The row belongs to the owner, not the acting sharee.
    expect(createRes.body.data.userId).toBe(ownerId);

    const updateRes = await sharee.agent
      .patch(`/api/v1/expenses/${createdExpenseId}?ownerId=${ownerId}`)
      .send({ vendor: "Shared Edit Vendor Updated" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.vendor).toBe("Shared Edit Vendor Updated");

    // The owner sees it too — it's their account being edited, not the sharee's.
    const ownerReadRes = await owner.agent.get("/api/v1/expenses?vendor=Shared Edit Vendor Updated");
    expect(ownerReadRes.body.data.some((e: { id: string }) => e.id === createdExpenseId)).toBe(true);

    const deleteRes = await sharee.agent.delete(`/api/v1/expenses/${createdExpenseId}?ownerId=${ownerId}`);
    expect(deleteRes.status).toBe(204);
  });

  it("attributes audit log entries from an editing sharee to the owner's account, not the sharee's", async () => {
    const { runAsUser } = await import("../lib/runAsUser");
    const { auditLog } = await import("../db/schema");
    const { eq, and } = await import("drizzle-orm");

    const rows = await runAsUser(ownerId, (tx) =>
      tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.userId, ownerId), eq(auditLog.entityId, createdExpenseId))),
    );

    const actions = rows.map((r) => r.action).sort();
    expect(actions).toEqual(["create", "delete", "update"]);
  });

  it("revokes access once the share is deleted", async () => {
    const revokeRes = await owner.agent.delete(`/api/v1/shares/${shareId}`);
    expect(revokeRes.status).toBe(204);

    const res = await sharee.agent.get(`/api/v1/expenses?ownerId=${ownerId}`);
    expect(res.status).toBe(403);
  });
});
