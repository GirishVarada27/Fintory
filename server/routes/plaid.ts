import { Router, type Response } from "express";
import { z } from "zod";
import { CountryCode, Products } from "plaid";
import { and, eq } from "drizzle-orm";
import { getPlaidClient, isPlaidConfigured } from "../lib/plaidClient";
import { linkedAccounts } from "../db/schema";
import { encrypt } from "../lib/encryption";
import { notFound, sendError } from "../lib/errors";
import { validateBody } from "../middleware/validate";

export const plaidRouter = Router();

function requireConfigured(res: Response): boolean {
  if (!isPlaidConfigured()) {
    sendError(res, 501, "NOT_CONFIGURED", "Bank linking isn't configured yet (Plaid credentials missing).");
    return false;
  }
  return true;
}

const PUBLIC_COLUMNS = {
  id: linkedAccounts.id,
  institutionName: linkedAccounts.institutionName,
  accountName: linkedAccounts.accountName,
  accountType: linkedAccounts.accountType,
  mask: linkedAccounts.mask,
  createdAt: linkedAccounts.createdAt,
};

plaidRouter.post("/link-token", async (req, res) => {
  if (!requireConfigured(res)) return;
  try {
    const client = getPlaidClient();
    const response = await client.linkTokenCreate({
      client_name: "Fintory",
      language: "en",
      country_codes: [CountryCode.Us],
      user: { client_user_id: req.user!.id },
      products: [Products.Transactions],
    });
    res.json({ data: { linkToken: response.data.link_token } });
  } catch (err) {
    console.error("[plaid] link-token failed", err);
    res.status(502).json({ error: { code: "PLAID_ERROR", message: "Could not create a Plaid Link token" } });
  }
});

const exchangeSchema = z.object({
  publicToken: z.string().min(1),
  institutionName: z.string().min(1),
});

plaidRouter.post("/exchange-token", validateBody(exchangeSchema), async (req, res) => {
  if (!requireConfigured(res)) return;
  try {
    const client = getPlaidClient();
    const exchangeResponse = await client.itemPublicTokenExchange({ public_token: req.body.publicToken });
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    const accountsResponse = await client.accountsGet({ access_token: accessToken });

    const rows = await req.db
      .insert(linkedAccounts)
      .values(
        accountsResponse.data.accounts.map((account) => ({
          userId: req.user!.id,
          plaidItemId: itemId,
          encryptedAccessToken: encrypt(accessToken),
          institutionName: req.body.institutionName,
          accountName: account.name,
          accountType: account.subtype ?? account.type,
          mask: account.mask ?? null,
        })),
      )
      .returning(PUBLIC_COLUMNS);

    res.status(201).json({ data: rows });
  } catch (err) {
    console.error("[plaid] exchange-token failed", err);
    res.status(502).json({ error: { code: "PLAID_ERROR", message: "Could not link the account" } });
  }
});

plaidRouter.get("/accounts", async (req, res) => {
  const rows = await req.db.select(PUBLIC_COLUMNS).from(linkedAccounts).where(eq(linkedAccounts.userId, req.user!.id));
  res.json({ data: rows, configured: isPlaidConfigured() });
});

plaidRouter.delete("/accounts/:id", async (req, res) => {
  const [row] = await req.db
    .delete(linkedAccounts)
    .where(and(eq(linkedAccounts.id, req.params.id as string), eq(linkedAccounts.userId, req.user!.id)))
    .returning({ id: linkedAccounts.id });
  if (!row) {
    notFound(res);
    return;
  }
  res.status(204).send();
});
