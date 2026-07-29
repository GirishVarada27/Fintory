import { useEffect, useState, type FormEvent } from "react";
import {
  listSavingsAccounts,
  createSavingsAccount,
  updateSavingsAccount,
  deleteSavingsAccount,
  type SavingsAccount,
} from "../api/savingsAccounts";
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  dangerTextClass,
} from "../lib/ui";

const emptyForm = {
  name: "",
  institution: "",
  type: "",
  currency: "USD",
  balance: "",
  targetAmount: "",
  apy: "",
  monthlyContribution: "",
};

export default function SavingsAccounts() {
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await listSavingsAccounts();
    setAccounts(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: form.name,
        institution: form.institution || undefined,
        type: form.type || undefined,
        currency: form.currency,
        balance: Number(form.balance || 0),
        targetAmount: form.targetAmount ? Number(form.targetAmount) : undefined,
        apy: form.apy ? Number(form.apy) : undefined,
        monthlyContribution: form.monthlyContribution ? Number(form.monthlyContribution) : undefined,
      };
      if (editingId) {
        await updateSavingsAccount(editingId, payload);
      } else {
        await createSavingsAccount(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function startEdit(account: SavingsAccount) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      institution: account.institution ?? "",
      type: account.type ?? "",
      currency: account.currency,
      balance: account.balance,
      targetAmount: account.targetAmount ?? "",
      apy: account.apy ?? "",
      monthlyContribution: account.monthlyContribution ?? "",
    });
  }

  async function handleDelete(id: string) {
    await deleteSavingsAccount(id);
    if (editingId === id) resetForm();
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Savings</h1>

      <form onSubmit={handleSubmit} className={`grid grid-cols-1 gap-3 sm:grid-cols-4 ${cardClass}`}>
        <div>
          <label htmlFor="savings-name" className={labelClass}>Name</label>
          <input
            id="savings-name"
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="savings-institution" className={labelClass}>Institution</label>
          <input
            id="savings-institution"
            type="text"
            value={form.institution}
            onChange={(e) => setForm({ ...form, institution: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="savings-type" className={labelClass}>Type</label>
          <input
            id="savings-type"
            type="text"
            placeholder="high-yield, checking, ..."
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="savings-currency" className={labelClass}>Currency</label>
          <input
            id="savings-currency"
            type="text"
            required
            maxLength={3}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="savings-balance" className={labelClass}>Balance</label>
          <input
            id="savings-balance"
            type="number"
            step="0.01"
            min="0"
            required
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="savings-target" className={labelClass}>Target amount</label>
          <input
            id="savings-target"
            type="number"
            step="0.01"
            min="0"
            value={form.targetAmount}
            onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="savings-apy" className={labelClass}>APY %</label>
          <input
            id="savings-apy"
            type="number"
            step="0.001"
            min="0"
            max="100"
            value={form.apy}
            onChange={(e) => setForm({ ...form, apy: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="savings-contribution" className={labelClass}>Monthly contribution</label>
          <input
            id="savings-contribution"
            type="number"
            step="0.01"
            min="0"
            value={form.monthlyContribution}
            onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })}
            className={inputClass}
          />
        </div>
        {error && <p className={`sm:col-span-4 ${dangerTextClass}`}>{error}</p>}
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className={primaryButtonClass}>
            {editingId ? "Save changes" : "Add account"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className={secondaryButtonClass}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">No savings accounts yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <div key={account.id} className={cardClass}>
              <h2 className="font-semibold text-slate-900 dark:text-white">{account.name}</h2>
              {account.institution && <p className="text-xs text-slate-600 dark:text-slate-400">{account.institution}</p>}
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
                <dt className="text-slate-500">Balance</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">
                  {account.balance} {account.currency}
                </dd>
                {account.targetAmount && (
                  <>
                    <dt className="text-slate-500">Target</dt>
                    <dd className="text-right">
                      {account.targetAmount} {account.currency}
                    </dd>
                  </>
                )}
                {account.apy && (
                  <>
                    <dt className="text-slate-500">APY</dt>
                    <dd className="text-right">{account.apy}%</dd>
                  </>
                )}
              </dl>
              <div className="mt-3 flex gap-3 text-sm">
                <button
                  onClick={() => startEdit(account)}
                  aria-label={`Edit ${account.name}`}
                  className="text-fuchsia-600 dark:text-fuchsia-400 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(account.id)}
                  aria-label={`Delete ${account.name}`}
                  className="text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
