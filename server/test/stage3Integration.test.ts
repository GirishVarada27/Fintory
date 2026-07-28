import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

describe("audit log", () => {
  let agent: ReturnType<typeof request.agent>;
  let email: string;

  beforeAll(async () => {
    const result = await signUpAndLogin("audit-log");
    agent = result.agent;
    email = result.email;
  });

  afterAll(async () => {
    const userId = await getUserIdByEmail(email);
    await deleteTestUser(userId);
  });

  it("writes create, update, and delete entries for an expense", async () => {
    const createRes = await agent.post("/api/v1/expenses").send({
      amount: 20,
      currency: "USD",
      vendor: "Audit Test Vendor",
      date: "2026-07-01",
      source: "manual",
    });
    const expenseId = createRes.body.data.id;

    await agent.patch(`/api/v1/expenses/${expenseId}`).send({ vendor: "Audit Test Vendor Updated" });
    await agent.delete(`/api/v1/expenses/${expenseId}`);

    // No dedicated audit-log-listing endpoint exists yet, so verify directly
    // against the DB (still scoped through the same RLS the app uses).
    const { runAsUser } = await import("../lib/runAsUser");
    const { auditLog } = await import("../db/schema");
    const { eq, and } = await import("drizzle-orm");
    const userId = await getUserIdByEmail(email);

    const rows = await runAsUser(userId, (tx) =>
      tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.userId, userId), eq(auditLog.entityId, expenseId))),
    );

    const actions = rows.map((r) => r.action).sort();
    expect(actions).toEqual(["create", "delete", "update"]);

    const createEntry = rows.find((r) => r.action === "create");
    expect(createEntry).toBeDefined();
    expect(createEntry!.diff.before).toBeNull();
    expect((createEntry!.diff.after as { vendor: string }).vendor).toBe("Audit Test Vendor");

    const updateEntry = rows.find((r) => r.action === "update");
    expect(updateEntry).toBeDefined();
    expect((updateEntry!.diff.before as { vendor: string }).vendor).toBe("Audit Test Vendor");
    expect((updateEntry!.diff.after as { vendor: string }).vendor).toBe("Audit Test Vendor Updated");

    const deleteEntry = rows.find((r) => r.action === "delete");
    expect(deleteEntry).toBeDefined();
    expect(deleteEntry!.diff.after).toBeNull();
  });
});

describe("receipt scan review-and-confirm flow", () => {
  let agent: ReturnType<typeof request.agent>;
  let email: string;

  beforeAll(async () => {
    const result = await signUpAndLogin("receipt-scan");
    agent = result.agent;
    email = result.email;
  });

  afterAll(async () => {
    const userId = await getUserIdByEmail(email);
    await deleteTestUser(userId);
  });

  it("returns an editable extraction without saving anything, then saves only on explicit confirm", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    vendor: "Test Cafe",
                    amount: 9.5,
                    currency: "USD",
                    date: "2026-07-15",
                    categorySuggestion: "Dining",
                  }),
                },
              ],
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );

    const scanRes = await agent.post("/api/v1/receipts/scan").attach("receipt", tinyPng, "receipt.png");
    vi.unstubAllGlobals();

    expect(scanRes.status).toBe(200);
    expect(scanRes.body.data.extracted.vendor).toBe("Test Cafe");
    expect(scanRes.body.data.extracted.amount).toBe(9.5);
    expect(scanRes.body.data.receiptUrl).toMatch(/^data:image\/png;base64,/);

    // Nothing should exist yet — the scan only returns a proposal.
    const listBefore = await agent.get("/api/v1/expenses?vendor=Test Cafe");
    expect(listBefore.body.data.length).toBe(0);

    // The user reviews/edits, then explicitly confirms via the normal create flow.
    const { receiptUrl, extracted } = scanRes.body.data;
    const createRes = await agent.post("/api/v1/expenses").send({
      amount: extracted.amount,
      currency: extracted.currency,
      vendor: extracted.vendor,
      date: extracted.date,
      source: "scanned",
      receiptUrl,
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.source).toBe("scanned");
    expect(createRes.body.data.receiptUrl).toBe(receiptUrl);
  });

  it("rejects non-image uploads", async () => {
    const res = await agent
      .post("/api/v1/receipts/scan")
      .attach("receipt", Buffer.from("not an image"), { filename: "notes.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });
});

describe("account deletion", () => {
  it("rejects the wrong confirmation phrase", async () => {
    const { agent, email } = await signUpAndLogin("delete-wrong-phrase");
    const res = await agent.delete("/api/v1/account").send({ confirmation: "nope" });
    expect(res.status).toBe(400);

    const userId = await getUserIdByEmail(email);
    await deleteTestUser(userId);
  });

  it("immediately invalidates the session — regression test for cookieCache outliving account deletion", async () => {
    const { agent } = await signUpAndLogin("delete-invalidate");

    const beforeDelete = await agent.get("/api/v1/categories");
    expect(beforeDelete.status).toBe(200);

    const deleteRes = await agent.delete("/api/v1/account").send({ confirmation: "DELETE MY ACCOUNT" });
    expect(deleteRes.status).toBe(204);

    // Without explicitly signing out (clearing the session/cache cookies) as
    // part of the delete handler, this would still return 200 for up to
    // cookieCache's maxAge, purely from the signed cookie — even though the
    // user row (and everything cascaded from it) is already gone.
    const afterDelete = await agent.get("/api/v1/categories");
    expect(afterDelete.status).toBe(401);

    // No deleteTestUser cleanup needed — the account no longer exists.
  });
});
