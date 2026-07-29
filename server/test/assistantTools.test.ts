import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { deleteTestUser, getUserIdByEmail, uniqueTestEmail } from "./testDb";
import { runAsUser } from "../lib/runAsUser";
import { executeAssistantTool } from "../lib/assistantTools";
import { computeLoanAmortization } from "../../shared/amortization";

const app = createApp();
const PASSWORD = "correct horse battery staple";

describe("assistant tools", () => {
  let email: string;
  let userId: string;

  beforeAll(async () => {
    email = uniqueTestEmail("assistant-tools");
    const agent = request.agent(app);
    await agent.post("/api/auth/sign-up/email").send({ name: "Assistant Tools Test", email, password: PASSWORD });
    userId = await getUserIdByEmail(email);

    const categoriesRes = await agent.get("/api/v1/categories");
    const groceriesId = categoriesRes.body.data.find((c: { name: string }) => c.name === "Groceries").id;

    await agent
      .post("/api/v1/expenses")
      .send({ amount: 50, currency: "USD", vendor: "Store A", categoryId: groceriesId, date: "2025-12-25", source: "manual" });
    await agent
      .post("/api/v1/expenses")
      .send({ amount: 30, currency: "USD", vendor: "Store B", categoryId: groceriesId, date: "2025-12-25", source: "manual" });
    await agent
      .post("/api/v1/expenses")
      .send({ amount: 100, currency: "AED", vendor: "Store C", categoryId: groceriesId, date: "2024-12-25", source: "manual" });
    await agent.post("/api/v1/income").send({ amount: 5000, currency: "USD", source: "Salary", date: "2025-12-01" });

    await agent.post("/api/v1/assets").send({ name: "Car", type: "vehicle", currency: "USD", currentValue: 20000 });
    await agent.post("/api/v1/savings-accounts").send({ name: "Emergency Fund", currency: "USD", balance: 10000 });
    await agent.post("/api/v1/loans").send({
      lender: "Bank",
      type: "auto",
      principal: 15000,
      currency: "USD",
      apr: 5,
      termMonths: 60,
      monthlyPayment: 283,
      startDate: "2024-01-01",
    });
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("get_expenses returns exact totals for a date, and nothing for a date with no data", async () => {
    const withData = await runAsUser(userId, (tx) =>
      executeAssistantTool(tx, userId, "get_expenses", { from: "2025-12-25", to: "2025-12-25" }),
    );
    expect((withData as { totalsByCurrency: Record<string, string> }).totalsByCurrency).toEqual({ USD: "80.00" });
    expect((withData as { count: number }).count).toBe(2);

    const noData = await runAsUser(userId, (tx) =>
      executeAssistantTool(tx, userId, "get_expenses", { from: "2025-01-01", to: "2025-01-01" }),
    );
    expect((noData as { count: number }).count).toBe(0);
    expect((noData as { totalsByCurrency: Record<string, string> }).totalsByCurrency).toEqual({});
  });

  it("get_expenses defaults to all-time when from/to are omitted", async () => {
    const result = await runAsUser(userId, (tx) => executeAssistantTool(tx, userId, "get_expenses", {}));
    const totals = (result as { totalsByCurrency: Record<string, string> }).totalsByCurrency;
    expect(totals.USD).toBe("80.00");
    expect(totals.AED).toBe("100.00");
  });

  it("get_income returns exact totals", async () => {
    const result = await runAsUser(userId, (tx) =>
      executeAssistantTool(tx, userId, "get_income", { from: "2025-12-01", to: "2025-12-01" }),
    );
    expect((result as { totalsByCurrency: Record<string, string> }).totalsByCurrency).toEqual({ USD: "5000.00" });
  });

  it("get_category_breakdown groups by category and currency, and reports the range it used", async () => {
    const result = await runAsUser(userId, (tx) =>
      executeAssistantTool(tx, userId, "get_category_breakdown", { from: "2025-12-01", to: "2025-12-31" }),
    );
    const { rangeUsed, breakdown } = result as {
      rangeUsed: { from: string; to: string };
      breakdown: { categoryName: string; currency: string; total: string }[];
    };
    expect(rangeUsed).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(breakdown).toContainEqual({ categoryName: "Groceries", currency: "USD", total: "80.00" });
  });

  it("get_net_worth computes assets + savings - outstanding loan balance per currency, not left for the caller to add up", async () => {
    const result = await runAsUser(userId, (tx) => executeAssistantTool(tx, userId, "get_net_worth", {}));
    const { netWorthByCurrency } = result as { netWorthByCurrency: Record<string, string> };
    const outstanding = computeLoanAmortization({
      principal: 15000,
      apr: 5,
      termMonths: 60,
      monthlyPayment: 283,
      startDate: "2024-01-01",
    }).outstandingPrincipal;
    const expected = (20000 + 10000 - outstanding).toFixed(2);
    expect(netWorthByCurrency.USD).toBe(expected);
  });

  it("get_historical_period_spending groups matching dates by year regardless of currency", async () => {
    const result = await runAsUser(userId, (tx) =>
      executeAssistantTool(tx, userId, "get_historical_period_spending", {
        monthDayStart: "12-20",
        monthDayEnd: "12-31",
      }),
    );
    const { yearsOfDataFound, byYear } = result as {
      yearsOfDataFound: number;
      byYear: { year: number; totalsByCurrency: Record<string, string> }[];
    };
    expect(yearsOfDataFound).toBe(2);
    const y2025 = byYear.find((y) => y.year === 2025);
    const y2024 = byYear.find((y) => y.year === 2024);
    expect(y2025?.totalsByCurrency).toEqual({ USD: "80.00" });
    expect(y2024?.totalsByCurrency).toEqual({ AED: "100.00" });
  });

  it("rejects an unknown tool name", async () => {
    await expect(
      runAsUser(userId, (tx) => executeAssistantTool(tx, userId, "not_a_real_tool", {})),
    ).rejects.toThrow("Unknown tool");
  });
});
