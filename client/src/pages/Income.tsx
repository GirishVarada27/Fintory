import { useEffect, useState, type FormEvent } from "react";
import { listIncome, createIncome, updateIncome, deleteIncome, type Income } from "../api/income";
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  dangerTextClass,
} from "../lib/ui";

const emptyForm = {
  amount: "",
  currency: "USD",
  source: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function IncomePage() {
  const [items, setItems] = useState<Income[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await listIncome();
    setItems(res.data);
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
        amount: Number(form.amount),
        currency: form.currency,
        source: form.source,
        date: form.date,
        notes: form.notes || undefined,
      };
      if (editingId) {
        await updateIncome(editingId, payload);
      } else {
        await createIncome(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function startEdit(item: Income) {
    setEditingId(item.id);
    setForm({
      amount: item.amount,
      currency: item.currency,
      source: item.source,
      date: item.date,
      notes: item.notes ?? "",
    });
  }

  async function handleDelete(id: string) {
    await deleteIncome(id);
    if (editingId === id) resetForm();
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Income</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Log paychecks and other income so the dashboard can show cash flow, not just spending.
      </p>

      <form onSubmit={handleSubmit} className={`grid grid-cols-1 gap-3 sm:grid-cols-4 ${cardClass}`}>
        <div>
          <label htmlFor="income-amount" className={labelClass}>Amount</label>
          <input
            id="income-amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="income-currency" className={labelClass}>Currency</label>
          <input
            id="income-currency"
            type="text"
            required
            maxLength={3}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="income-source" className={labelClass}>Source</label>
          <input
            id="income-source"
            type="text"
            required
            placeholder="Salary, Freelance, Interest, ..."
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="income-date" className={labelClass}>Date</label>
          <input
            id="income-date"
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="income-notes" className={labelClass}>Notes</label>
          <input
            id="income-notes"
            type="text"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputClass}
          />
        </div>
        {error && <p className={`sm:col-span-4 ${dangerTextClass}`}>{error}</p>}
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className={primaryButtonClass}>
            {editingId ? "Save changes" : "Add income"}
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
      ) : items.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">No income logged yet.</p>
      ) : (
        <div className={`overflow-x-auto ${cardClass}`}>
          <table className="w-full text-left text-sm">
            <thead className="text-slate-600 dark:text-slate-400">
              <tr>
                <th className="pb-2 pr-2">Date</th>
                <th className="pb-2 pr-2">Source</th>
                <th className="pb-2 pr-2 text-right">Amount</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-800 dark:text-slate-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-2">{item.date}</td>
                  <td className="py-2 pr-2">{item.source}</td>
                  <td className="py-2 pr-2 text-right">
                    {item.amount} {item.currency}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(item)}
                      aria-label={`Edit ${item.source} income`}
                      className="mr-3 text-fuchsia-600 dark:text-fuchsia-400 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      aria-label={`Delete ${item.source} income`}
                      className="text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
