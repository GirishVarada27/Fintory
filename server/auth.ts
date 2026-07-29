import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/index";
import * as schema from "./db/schema";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is not set");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  // In dev, the browser talks to Vite's origin (5173), which proxies /api/*
  // to Express (3000) — but the browser's Origin header is still 5173, so
  // Better Auth's origin check needs it trusted explicitly. Production has
  // no separate Vite process; the browser's origin always matches baseURL.
  trustedOrigins: process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173"],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      defaultDisplayCurrency: {
        type: "string",
        required: false,
        defaultValue: "USD",
        input: true,
      },
    },
  },
  advanced: {
    // Every other table uses uuid PKs; this keeps user.id (and every FK that
    // references it) consistent instead of Better Auth's default cuid2 string.
    database: {
      generateId: "uuid",
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
});
