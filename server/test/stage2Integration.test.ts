import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { deleteTestUser, getUserIdByEmail, uniqueTestEmail } from "./testDb";
import { runAsUser } from "../lib/runAsUser";
import { checkBudgetThresholdsForUser } from "../jobs/checkBudgets";

const app = createApp();
const PASSWORD = "correct horse battery staple";

async function signUpAndLogin(label: string) {
  const email = uniqueTestEmail(label);
  const agent = request.agent(app);
  await agent.post("/api/auth/sign-up/email").send({ name: `Test ${label}`, email, password: PASSWORD });
  return { agent, email };
}

describe("budget alert flow", () => {
  let agent: ReturnType<typeof request.agent>;
  let email: string;
  let userId: string;

  beforeAll(async () => {
    const result = await signUpAndLogin("budget-alert");
    agent = result.agent;
    email = result.email;
    userId = await getUserIdByEmail(email);
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("creates a notification once spend crosses the budget's alert threshold, and doesn't duplicate it on re-run", async () => {
    const categoriesRes = await agent.get("/api/v1/categories");
    const groceries = categoriesRes.body.data.find((c: { name: string }) => c.name === "Groceries");

    const budgetRes = await agent.post("/api/v1/budgets").send({
      categoryId: groceries.id,
      monthlyLimit: 100,
      currency: "USD",
      alertThresholdPct: 50,
    });
    expect(budgetRes.status).toBe(201);

    const today = new Date().toISOString().slice(0, 10);
    const expenseRes = await agent.post("/api/v1/expenses").send({
      amount: 60,
      currency: "USD",
      categoryId: groceries.id,
      vendor: "Big Mart",
      date: today,
      source: "manual",
    });
    expect(expenseRes.status).toBe(201);

    const budgetsListRes = await agent.get("/api/v1/budgets");
    const budget = budgetsListRes.body.data.find((b: { id: string }) => b.id === budgetRes.body.data.id);
    expect(budget.spentToDate).toBe(60);
    expect(budget.percentUsed).toBe(60);

    // The threshold check is cron-triggered in production, not HTTP-triggered.
    await runAsUser(userId, (tx) => checkBudgetThresholdsForUser(tx, userId));

    const notificationsRes = await agent.get("/api/v1/notifications");
    const alert = notificationsRes.body.data.find((n: { type: string }) => n.type === "budget_threshold");
    expect(alert).toBeTruthy();
    expect(alert.payload.percentUsed).toBe(60);

    await runAsUser(userId, (tx) => checkBudgetThresholdsForUser(tx, userId));
    const notificationsRes2 = await agent.get("/api/v1/notifications");
    const alerts = notificationsRes2.body.data.filter((n: { type: string }) => n.type === "budget_threshold");
    expect(alerts.length).toBe(1);
  });
});

describe("export", () => {
  let agent: ReturnType<typeof request.agent>;
  let email: string;

  beforeAll(async () => {
    const result = await signUpAndLogin("export");
    agent = result.agent;
    email = result.email;
    await agent.post("/api/v1/expenses").send({
      amount: 25,
      currency: "USD",
      vendor: "Export Test Vendor",
      date: new Date().toISOString().slice(0, 10),
      source: "manual",
    });
  });

  afterAll(async () => {
    const userId = await getUserIdByEmail(email);
    await deleteTestUser(userId);
  });

  it("exports expenses as CSV including the created vendor", async () => {
    const res = await agent.get("/api/v1/export/expenses.csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("Export Test Vendor");
    expect(res.text.split("\n")[0]).toBe("date,vendor,amount,currency,source,tags,notes");
  });

  it("exports a monthly PDF report", async () => {
    // superagent's runtime .parse() accepts (res, callback); the cast sidesteps
    // its type declaration only offering a single-arg (str) => any overload.
    const res = await agent
      .get("/api/v1/export/report.pdf")
      .buffer(true)
      .parse(bufferParser as unknown as (str: string) => unknown);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    const body = res.body as Buffer;
    expect(body.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});

function bufferParser(res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}
