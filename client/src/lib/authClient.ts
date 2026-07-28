import { createAuthClient } from "better-auth/react";

// No baseURL: this is one unified app, so the browser's current origin is
// always correct (relative /api/auth/* requests), both in dev (Vite proxy)
// and production (same Express process serves everything).
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
