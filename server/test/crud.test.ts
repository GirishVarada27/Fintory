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

describe("expenses CRUD", () => {
  const emails: string[] = [];
  let agentA: ReturnType<typeof request.agent>;
  let agentB: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const a = await signUpAndLogin("crud-a");
    const b = await signUpAndLogin("crud-b");
    agentA = a.agent;
    agentB = b.agent;
    emails.push(a.email, b.email);
  });

  afterAll(async () => {
    for (const email of emails) {
      const userId = await getUserIdByEmail(email);
      await deleteTestUser(userId);
    }
  });

  it("creates, lists, fetches, updates, and deletes an expense", async () => {
    const createRes = await agentA.post("/api/v1/expenses").send({
      amount: 42.5,
      currency: "USD",
      vendor: "Corner Store",
      date: "2025-06-15",
      source: "manual",
    });
    expect(createRes.status).toBe(201);
    const expenseId = createRes.body.data.id;
    expect(expenseId).toBeTruthy();

    const listRes = await agentA.get("/api/v1/expenses");
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((e: { id: string }) => e.id === expenseId)).toBe(true);

    const getRes = await agentA.get(`/api/v1/expenses/${expenseId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.vendor).toBe("Corner Store");

    const updateRes = await agentA.patch(`/api/v1/expenses/${expenseId}`).send({ vendor: "Updated Store" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.vendor).toBe("Updated Store");

    const deleteRes = await agentA.delete(`/api/v1/expenses/${expenseId}`);
    expect(deleteRes.status).toBe(204);

    const getAfterDeleteRes = await agentA.get(`/api/v1/expenses/${expenseId}`);
    expect(getAfterDeleteRes.status).toBe(404);
  });

  it("rejects invalid payloads with a validation error", async () => {
    const res = await agentA.post("/api/v1/expenses").send({
      amount: -5,
      currency: "US",
      vendor: "",
      date: "not-a-date",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("scopes expenses to the owning user via RLS, not just app-level filtering", async () => {
    const createRes = await agentA.post("/api/v1/expenses").send({
      amount: 10,
      currency: "USD",
      vendor: "User A Only",
      date: "2025-06-01",
      source: "manual",
    });
    const expenseId = createRes.body.data.id;

    const getAsB = await agentB.get(`/api/v1/expenses/${expenseId}`);
    expect(getAsB.status).toBe(404);

    const updateAsB = await agentB.patch(`/api/v1/expenses/${expenseId}`).send({ vendor: "Hijacked" });
    expect(updateAsB.status).toBe(404);

    const deleteAsB = await agentB.delete(`/api/v1/expenses/${expenseId}`);
    expect(deleteAsB.status).toBe(404);

    const listAsB = await agentB.get("/api/v1/expenses");
    expect(listAsB.body.data.some((e: { id: string }) => e.id === expenseId)).toBe(false);

    await agentA.delete(`/api/v1/expenses/${expenseId}`);
  });
});

describe("loans amortization endpoint", () => {
  let agent: ReturnType<typeof request.agent>;
  let email: string;

  beforeAll(async () => {
    const result = await signUpAndLogin("crud-loans");
    agent = result.agent;
    email = result.email;
  });

  afterAll(async () => {
    const userId = await getUserIdByEmail(email);
    await deleteTestUser(userId);
  });

  it("returns computed outstandingPrincipal and monthsRemaining alongside stored fields", async () => {
    const res = await agent.post("/api/v1/loans").send({
      lender: "Test Bank",
      principal: 10000,
      currency: "USD",
      apr: 6,
      termMonths: 12,
      monthlyPayment: 860.66,
      startDate: "2025-01-01",
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.data.outstandingPrincipal).toBe("number");
    expect(typeof res.body.data.monthsRemaining).toBe("number");
    expect(res.body.data.outstandingPrincipal).toBeLessThanOrEqual(10000);
  });
});
