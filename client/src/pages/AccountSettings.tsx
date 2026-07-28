import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, useSession } from "../lib/authClient";
import { deleteAccount } from "../api/account";
import { cardClass, inputClass, labelClass, primaryButtonClass, dangerTextClass } from "../lib/ui";

const CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

export default function AccountSettings() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [confirmationInput, setConfirmationInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount(confirmationInput);
      await signOut();
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete your account");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Account Settings</h1>

      <div className={cardClass}>
        <h2 className="mb-2 font-semibold text-white">Your data</h2>
        <p className="mb-3 text-sm text-slate-400">
          Signed in as {session?.user?.email}. Download everything Fintory has stored for your account as
          JSON.
        </p>
        <a href="/api/v1/account/export" className={primaryButtonClass}>
          Download my data
        </a>
      </div>

      <div className={cardClass}>
        <h2 className="mb-2 font-semibold text-rose-400">Delete account</h2>
        <p className="mb-3 text-sm text-slate-400">
          This permanently deletes your account and everything in it — expenses, loans, savings, assets,
          budgets, linked accounts, receipts, and history. This cannot be undone.
        </p>
        <label className={labelClass}>
          Type <span className="font-mono text-slate-200">{CONFIRMATION_PHRASE}</span> to confirm
        </label>
        <input
          type="text"
          value={confirmationInput}
          onChange={(e) => setConfirmationInput(e.target.value)}
          className={inputClass}
        />
        {error && <p className={`mt-2 ${dangerTextClass}`}>{error}</p>}
        <button
          onClick={handleDelete}
          disabled={confirmationInput !== CONFIRMATION_PHRASE || deleting}
          className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Permanently delete my account"}
        </button>
      </div>
    </div>
  );
}
