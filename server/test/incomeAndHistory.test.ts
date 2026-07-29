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

describe("income CRUD", () => {
  const emails: string[] = [];
  let agentA: ReturnType<typeof request.agent>;
  let agentB: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const a = await signUpAndLogin("income-a");
    const b = await signUpAndLogin("income-b");
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

  it("creates, lists, updates, and deletes an income entry", async () => {
    const createRes = await agentA.post("/api/v1/income").send({
      amount: 5000,
      currency: "USD",
      source: "Salary",
      date: "2026-06-15",
    });
    expect(createRes.status).toBe(201);
    const incomeId = createRes.body.data.id;
    expect(incomeId).toBeTruthy();

    const listRes = await agentA.get("/api/v1/income");
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((i: { id: string }) => i.id === incomeId)).toBe(true);

    const updateRes = await agentA.patch(`/api/v1/income/${incomeId}`).send({ source: "Salary (raise)" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.source).toBe("Salary (raise)");

    const deleteRes = await agentA.delete(`/api/v1/income/${incomeId}`);
    expect(deleteRes.status).toBe(204);

    const listAfterDelete = await agentA.get("/api/v1/income");
    expect(listAfterDelete.body.data.some((i: { id: string }) => i.id === incomeId)).toBe(false);
  });

  it("rejects invalid payloads with a validation error", async () => {
    const res = await agentA.post("/api/v1/income").send({ amount: -5, currency: "US", source: "", date: "bad" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("scopes income to the owning user via RLS", async () => {
    const createRes = await agentA.post("/api/v1/income").send({
      amount: 100,
      currency: "USD",
      source: "User A Only",
      date: "2026-06-01",
    });
    const incomeId = createRes.body.data.id;

    const updateAsB = await agentB.patch(`/api/v1/income/${incomeId}`).send({ source: "Hijacked" });
    expect(updateAsB.status).toBe(404);

    const deleteAsB = await agentB.delete(`/api/v1/income/${incomeId}`);
    expect(deleteAsB.status).toBe(404);

    const listAsB = await agentB.get("/api/v1/income");
    expect(listAsB.body.data.some((i: { id: string }) => i.id === incomeId)).toBe(false);

    await agentA.delete(`/api/v1/income/${incomeId}`);
  });
});

describe("dashboard history endpoint", () => {
  let agent: ReturnType<typeof request.agent>;
  let email: string;

  beforeAll(async () => {
    const result = await signUpAndLogin("history");
    agent = result.agent;
    email = result.email;

    await agent.post("/api/v1/income").send({ amount: 3000, currency: "USD", source: "Salary", date: "2026-02-10" });
    await agent.post("/api/v1/income").send({ amount: 3000, currency: "USD", source: "Salary", date: "2026-03-10" });
    await agent
      .post("/api/v1/expenses")
      .send({ amount: 500, currency: "USD", vendor: "Rent", date: "2026-02-01", source: "manual" });
    await agent
      .post("/api/v1/expenses")
      .send({ amount: 500, currency: "USD", vendor: "Rent", date: "2026-03-01", source: "manual" });
  });

  afterAll(async () => {
    const userId = await getUserIdByEmail(email);
    await deleteTestUser(userId);
  });

  it("returns per-month income, expenses, and cash flow for the requested year", async () => {
    const res = await agent.get("/api/v1/dashboard/history?year=2026");
    expect(res.status).toBe(200);
    expect(res.body.data.year).toBe(2026);
    expect(res.body.data.availableYears).toContain(2026);

    const feb = res.body.data.points.find((p: { month: string }) => p.month === "2026-02");
    const mar = res.body.data.points.find((p: { month: string }) => p.month === "2026-03");
    expect(feb.income).toBe("3000.00");
    expect(feb.expenses).toBe("500.00");
    expect(feb.cashFlow).toBe("2500.00");
    expect(mar.income).toBe("3000.00");
    expect(mar.expenses).toBe("500.00");

    // A month before any data existed should still be present, at zero.
    const jan = res.body.data.points.find((p: { month: string }) => p.month === "2026-01");
    expect(jan.income).toBe("0.00");
    expect(jan.expenses).toBe("0.00");
  });

  it("does not include months after the current one for the current year", async () => {
    const res = await agent.get("/api/v1/dashboard/history?year=2026");
    const currentMonthNum = new Date().getMonth() + 1;
    const months = res.body.data.points.map((p: { month: string }) => p.month);
    expect(months.length).toBe(currentMonthNum);
  });
});
