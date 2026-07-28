import { useEffect, useState, type FormEvent } from "react";
import { listExpenses, createExpense, updateExpense, deleteExpense, type Expense } from "../api/expenses";
import { listCategories, type Category } from "../api/categories";
import { useSession } from "../lib/authClient";
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
  categoryId: "",
  vendor: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function Expenses() {
  const { data: session } = useSession();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const defaultCurrency = (session?.user as { defaultDisplayCurrency?: string } | undefined)
      ?.defaultDisplayCurrency;
    if (defaultCurrency) {
      setForm((f) => ({ ...f, currency: defaultCurrency }));
    }
  }, [session]);

  async function load() {
    setLoading(true);
    const [expensesRes, categoriesRes] = await Promise.all([listExpenses(), listCategories()]);
    setExpenses(expensesRes.data);
    setCategories(categoriesRes.data);
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
        categoryId: form.categoryId || undefined,
        vendor: form.vendor,
        date: form.date,
        source: "manual" as const,
        notes: form.notes || undefined,
      };
      if (editingId) {
        await updateExpense(editingId, payload);
      } else {
        await createExpense(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      amount: expense.amount,
      currency: expense.currency,
      categoryId: expense.categoryId ?? "",
      vendor: expense.vendor,
      date: expense.date,
      notes: expense.notes ?? "",
    });
  }

  async function handleDelete(id: string) {
    await deleteExpense(id);
    if (editingId === id) resetForm();
    await load();
  }

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Expenses</h1>

      <form onSubmit={handleSubmit} className={`grid grid-cols-1 gap-3 sm:grid-cols-6 ${cardClass}`}>
        <div>
          <label className={labelClass}>Amount</label>
          <input
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
          <label className={labelClass}>Currency</label>
          <input
            type="text"
            required
            maxLength={3}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Vendor</label>
          <input
            type="text"
            required
            value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className={inputClass}
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-6">
          <label className={labelClass}>Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputClass}
          />
        </div>
        {error && <p className={`sm:col-span-6 ${dangerTextClass}`}>{error}</p>}
        <div className="flex gap-2 sm:col-span-6">
          <button type="submit" className={primaryButtonClass}>
            {editingId ? "Save changes" : "Add expense"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className={secondaryButtonClass}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="text-slate-400">No expenses yet.</p>
      ) : (
        <div className={`overflow-x-auto ${cardClass}`}>
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-2 pr-2">Date</th>
                <th className="pb-2 pr-2">Vendor</th>
                <th className="pb-2 pr-2">Category</th>
                <th className="pb-2 pr-2 text-right">Amount</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="py-2 pr-2">{expense.date}</td>
                  <td className="py-2 pr-2">{expense.vendor}</td>
                  <td className="py-2 pr-2">{categoryName(expense.categoryId)}</td>
                  <td className="py-2 pr-2 text-right">
                    {expense.amount} {expense.currency}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(expense)} className="mr-3 text-fuchsia-400 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(expense.id)} className="text-rose-400 hover:underline">
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
