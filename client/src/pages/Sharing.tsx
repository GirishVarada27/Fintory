import { useEffect, useState, type FormEvent } from "react";
import {
  listShares,
  inviteShare,
  acceptShare,
  updateSharePermission,
  revokeShare,
  type Share,
} from "../api/shares";
import { useViewingAs } from "../lib/ViewingAsContext";
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  dangerTextClass,
} from "../lib/ui";

export default function Sharing() {
  const { ownerId: viewingOwnerId, startViewingAs, stopViewingAs } = useViewingAs();
  const [sent, setSent] = useState<Share[]>([]);
  const [received, setReceived] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await listShares();
    setSent(res.data.sent);
    setReceived(res.data.received);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await inviteShare(email, permission);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite");
    }
  }

  async function handleAccept(share: Share) {
    await acceptShare(share.id);
    await load();
  }

  async function handlePermissionChange(share: Share, newPermission: "view" | "edit") {
    await updateSharePermission(share.id, newPermission);
    await load();
  }

  async function handleRevoke(share: Share) {
    if (viewingOwnerId === share.ownerUserId) stopViewingAs();
    await revokeShare(share.id);
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sharing</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Invite someone to see (or help manage) your budget. They'll need an existing Fintory account.
      </p>

      <form onSubmit={handleInvite} className={`grid grid-cols-1 gap-3 sm:grid-cols-4 ${cardClass}`}>
        <div className="sm:col-span-2">
          <label htmlFor="share-email" className={labelClass}>Email</label>
          <input
            id="share-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="share-permission" className={labelClass}>Permission</label>
          <select
            id="share-permission"
            value={permission}
            onChange={(e) => setPermission(e.target.value as "view" | "edit")}
            className={inputClass}
          >
            <option value="view">View only</option>
            <option value="edit">Can edit</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className={primaryButtonClass}>
            Send invite
          </button>
        </div>
        {error && <p className={`sm:col-span-4 ${dangerTextClass}`}>{error}</p>}
      </form>

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Loading…</p>
      ) : (
        <>
          <div className={cardClass}>
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Shared with me</h2>
            {received.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Nobody has shared their account with you yet.</p>
            ) : (
              <ul className="space-y-3">
                {received.map((share) => (
                  <li key={share.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="text-slate-800 dark:text-slate-200">{share.ownerName}</p>
                      <p className="text-xs text-slate-500">
                        {share.ownerEmail} · {share.permission} ·{" "}
                        {share.status === "pending" ? "invite pending" : "accepted"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {share.status === "pending" && (
                        <button onClick={() => handleAccept(share)} className={primaryButtonClass}>
                          Accept
                        </button>
                      )}
                      {share.status === "accepted" && viewingOwnerId !== share.ownerUserId && (
                        <button
                          onClick={() => startViewingAs(share.ownerUserId, share.ownerName)}
                          className={secondaryButtonClass}
                        >
                          View this account
                        </button>
                      )}
                      {share.status === "accepted" && viewingOwnerId === share.ownerUserId && (
                        <button onClick={stopViewingAs} className={secondaryButtonClass}>
                          Stop viewing
                        </button>
                      )}
                      <button onClick={() => handleRevoke(share)} className="text-rose-600 dark:text-rose-400 hover:underline">
                        {share.status === "pending" ? "Decline" : "Leave"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cardClass}>
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">People you've invited</h2>
            {sent.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">You haven't invited anyone yet.</p>
            ) : (
              <ul className="space-y-3">
                {sent.map((share) => (
                  <li key={share.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="text-slate-800 dark:text-slate-200">{share.shareeName}</p>
                      <p className="text-xs text-slate-500">
                        {share.shareeEmail} · {share.status === "pending" ? "invite pending" : "accepted"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Permission for ${share.shareeName}`}
                        value={share.permission}
                        onChange={(e) => handlePermissionChange(share, e.target.value as "view" | "edit")}
                        className={`${inputClass} w-auto`}
                      >
                        <option value="view">View only</option>
                        <option value="edit">Can edit</option>
                      </select>
                      <button onClick={() => handleRevoke(share)} className="text-rose-600 dark:text-rose-400 hover:underline">
                        Revoke
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
