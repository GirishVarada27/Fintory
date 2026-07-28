import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { deleteTestUser, getUserIdByEmail, uniqueTestEmail } from "./testDb";

const app = createApp();
const PASSWORD = "correct horse battery staple";
const createdEmails: string[] = [];

describe("auth flow", () => {
  afterAll(async () => {
    for (const email of createdEmails) {
      const userId = await getUserIdByEmail(email);
      await deleteTestUser(userId);
    }
  });

  it("rejects unauthenticated requests to protected routes", async () => {
    const res = await request(app).get("/api/v1/categories");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("lets a newly signed-up user reach a protected route and see the seeded global categories", async () => {
    const email = uniqueTestEmail("signup");
    createdEmails.push(email);
    const agent = request.agent(app);

    const signUpRes = await agent
      .post("/api/auth/sign-up/email")
      .send({ name: "Test User", email, password: PASSWORD });
    expect(signUpRes.status).toBe(200);

    const categoriesRes = await agent.get("/api/v1/categories");
    expect(categoriesRes.status).toBe(200);
    expect(categoriesRes.body.data.length).toBeGreaterThanOrEqual(8);
    expect(
      categoriesRes.body.data.every((c: { userId: string | null }) => c.userId === null),
    ).toBe(true);
  });

  it("lets an existing user sign in and reach a protected route", async () => {
    const email = uniqueTestEmail("signin");
    createdEmails.push(email);

    // Create the account first (separate, unauthenticated agent).
    await request(app).post("/api/auth/sign-up/email").send({ name: "Test User 2", email, password: PASSWORD });

    const agent = request.agent(app);
    const signInRes = await agent.post("/api/auth/sign-in/email").send({ email, password: PASSWORD });
    expect(signInRes.status).toBe(200);

    const res = await agent.get("/api/v1/categories");
    expect(res.status).toBe(200);
  });

  it("rejects sign-in with the wrong password", async () => {
    const email = uniqueTestEmail("wrongpw");
    createdEmails.push(email);
    await request(app).post("/api/auth/sign-up/email").send({ name: "Test User 3", email, password: PASSWORD });

    const res = await request(app).post("/api/auth/sign-in/email").send({ email, password: "not the right password" });
    expect(res.status).toBe(401);
  });
});
