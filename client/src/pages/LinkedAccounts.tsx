import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import {
  createLinkToken,
  exchangePublicToken,
  listLinkedAccounts,
  unlinkAccount,
  type LinkedAccount,
} from "../api/plaid";
import { cardClass, primaryButtonClass, dangerTextClass } from "../lib/ui";

export default function LinkedAccounts() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [configured, setConfigured] = useState(true);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await listLinkedAccounts();
    setAccounts(res.data);
    setConfigured(res.configured);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function startLink() {
    setError(null);
    try {
      const res = await createLinkToken();
      setLinkToken(res.data.linkToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start bank linking");
    }
  }

  const onSuccess = useCallback(async (publicToken: string | null, metadata: PlaidLinkOnSuccessMetadata) => {
    if (!publicToken) return;
    try {
      await exchangePublicToken(publicToken, metadata.institution?.name ?? "Linked bank");
      setLinkToken(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish linking that account");
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  async function handleUnlink(id: string) {
    await unlinkAccount(id);
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Linked Accounts</h1>
      <p className="text-sm text-slate-400">
        Connect a bank or card account to automatically pull in transactions. Read-only — Fintory can never
        move money.
      </p>

      {!configured ? (
        <div className={cardClass}>
          <p className="text-slate-400">Bank linking isn't configured yet.</p>
        </div>
      ) : (
        <button onClick={startLink} className={primaryButtonClass}>
          Connect a bank account
        </button>
      )}

      {error && <p className={dangerTextClass}>{error}</p>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-slate-400">No linked accounts yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <div key={account.id} className={cardClass}>
              <h2 className="font-semibold text-white">{account.institutionName}</h2>
              <p className="text-sm text-slate-300">
                {account.accountName}
                {account.mask && ` ••••${account.mask}`}
              </p>
              {account.accountType && (
                <p className="text-xs uppercase text-slate-500">{account.accountType}</p>
              )}
              <button
                onClick={() => handleUnlink(account.id)}
                className="mt-3 text-sm text-rose-400 hover:underline"
              >
                Unlink
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
