import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

let client: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured (PLAID_CLIENT_ID / PLAID_SECRET missing)");
  }
  if (!client) {
    const basePath = process.env.PLAID_ENV === "production" ? PlaidEnvironments.production : PlaidEnvironments.sandbox;
    const configuration = new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
          "PLAID-SECRET": process.env.PLAID_SECRET,
        },
      },
    });
    client = new PlaidApi(configuration);
  }
  return client;
}
