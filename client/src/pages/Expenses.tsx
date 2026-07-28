import { useEffect, useState, type FormEvent } from "react";
import { listExpenses, getExpense, createExpense, updateExpense, deleteExpense, type Expense } from "../api/expenses";
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
  tagsInput: "",
  splitMode: false,
  splits: [] as { categoryId: string; amount: string }[],
};

const emptyFilters = {
  vendor: "",
  categoryId: "",
  currency: "",
  minAmount: "",
  maxAmount: "",
  from: "",
  to: "",
  sortBy: "createdAt" as "createdAt" | "date" | "amount" | "vendor",
  sortDir: "desc" as "asc" | "desc",
};

export default function Expenses() {
  const { data: session } = useSession();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
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

  function activeFilterParams() {
    return {
      vendor: filters.vendor || undefined,
      categoryId: filters.categoryId || undefined,
      currency: filters.currency || undefined,
      minAmount: filters.minAmount ? Number(filters.minAmount) : undefined,
      maxAmount: filters.maxAmount ? Number(filters.maxAmount) : undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      limit: 100,
    };
  }

  async function load() {
    setLoading(true);
    const [expensesRes, categoriesRes] = await Promise.all([
      listExpenses(activeFilterParams()),
      listCategories(),
    ]);
    setExpenses(expensesRes.data);
    setCategories(categoriesRes.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [filters]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function addSplitRow() {
    setForm((f) => ({ ...f, splits: [...f.splits, { categoryId: "", amount: "" }] }));
  }

  function removeSplitRow(index: number) {
    setForm((f) => ({ ...f, splits: f.splits.filter((_, i) => i !== index) }));
  }

  function updateSplitRow(index: number, field: "categoryId" | "amount", value: string) {
    setForm((f) => ({
      ...f,
      splits: f.splits.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  }

  function toggleSplitMode() {
    setForm((f) => ({
      ...f,
      splitMode: !f.splitMode,
      splits: !f.splitMode && f.splits.length < 2 ? [{ categoryId: "", amount: "" }, { categoryId: "", amount: "" }] : f.splits,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const tags = form.tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const splits =
        form.splitMode && form.splits.length >= 2
          ? form.splits.map((s) => ({ categoryId: s.categoryId || null, amount: Number(s.amount) }))
          : form.splitMode
            ? undefined
            : null;

      const payload = {
        amount: Number(form.amount),
        currency: form.currency,
        categoryId: form.splitMode ? undefined : form.categoryId || undefined,
        vendor: form.vendor,
        date: form.date,
        source: "manual" as const,
        notes: form.notes || undefined,
        tags: tags.length > 0 ? tags : undefined,
        splits,
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

  async function startEdit(expenseRow: Expense) {
    // The list endpoint doesn't include splits (avoids an N+1 join for every
    // row); fetch the full detail so editing shows existing splits correctly.
    const { data: expense } = await getExpense(expenseRow.id);
    setEditingId(expense.id);
    const hasSplits = !!expense.splits && expense.splits.length > 0;
    setForm({
      amount: expense.amount,
      currency: expense.currency,
      categoryId: expense.categoryId ?? "",
      vendor: expense.vendor,
      date: expense.date,
      notes: expense.notes ?? "",
      tagsInput: expense.tags.join(", "),
      splitMode: hasSplits,
      splits: hasSplits
        ? expense.splits!.map((s) => ({ categoryId: s.categoryId ?? "", amount: s.amount }))
        : [],
    });
  }

  async function handleDelete(id: string) {
    await deleteExpense(id);
    if (editingId === id) resetForm();
    await load();
  }

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  const csvHref = (() => {
    const qs = new URLSearchParams();
    if (filters.from) qs.set("from", filters.from);
    if (filters.to) qs.set("to", filters.to);
    if (filters.categoryId) qs.set("categoryId", filters.categoryId);
    if (filters.currency) qs.set("currency", filters.currency);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return `/api/v1/export/expenses.csv${suffix}`;
  })();

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
          <label className={labelClass}>Date</label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.splitMode} onChange={toggleSplitMode} />
            Split across categories
          </label>
        </div>

        {!form.splitMode && (
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
        )}

        {form.splitMode && (
          <div className="space-y-2 sm:col-span-6">
            <label className={labelClass}>Splits (must add up to the total amount)</label>
            {form.splits.map((split, index) => (
              <div key={index} className="flex gap-2">
                <select
                  value={split.categoryId}
                  onChange={(e) => updateSplitRow(index, "categoryId", e.target.value)}
                  className={`${inputClass} flex-1`}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={split.amount}
                  onChange={(e) => updateSplitRow(index, "amount", e.target.value)}
                  className={`${inputClass} w-32`}
                />
                {form.splits.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeSplitRow(index)}
                    className="text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addSplitRow} className={secondaryButtonClass}>
              Add split
            </button>
          </div>
        )}

        <div className="sm:col-span-3">
          <label className={labelClass}>Tags (comma separated)</label>
          <input
            type="text"
            placeholder="work, reimbursable"
            value={form.tagsInput}
            onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-3">
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

      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8 ${cardClass}`}>
        <input
          type="text"
          placeholder="Vendor"
          value={filters.vendor}
          onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}
          className={inputClass}
        />
        <select
          value={filters.categoryId}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
          className={inputClass}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Currency"
          maxLength={3}
          value={filters.currency}
          onChange={(e) => setFilters({ ...filters, currency: e.target.value.toUpperCase() })}
          className={inputClass}
        />
        <input
          type="number"
          placeholder="Min amount"
          value={filters.minAmount}
          onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
          className={inputClass}
        />
        <input
          type="number"
          placeholder="Max amount"
          value={filters.maxAmount}
          onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
          className={inputClass}
        />
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          className={inputClass}
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          className={inputClass}
        />
        <select
          value={`${filters.sortBy}:${filters.sortDir}`}
          onChange={(e) => {
            const [sortBy, sortDir] = e.target.value.split(":") as [typeof filters.sortBy, typeof filters.sortDir];
            setFilters({ ...filters, sortBy, sortDir });
          }}
          className={inputClass}
        >
          <option value="createdAt:desc">Newest added</option>
          <option value="date:desc">Date (newest)</option>
          <option value="date:asc">Date (oldest)</option>
          <option value="amount:desc">Amount (high-low)</option>
          <option value="amount:asc">Amount (low-high)</option>
          <option value="vendor:asc">Vendor (A-Z)</option>
        </select>
        <div className="col-span-2 flex items-center gap-2 sm:col-span-4 lg:col-span-8">
          <button type="button" onClick={() => setFilters(emptyFilters)} className={secondaryButtonClass}>
            Clear filters
          </button>
          <a href={csvHref} className={secondaryButtonClass}>
            Export CSV
          </a>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="text-slate-400">No expenses match these filters.</p>
      ) : (
        <div className={`overflow-x-auto ${cardClass}`}>
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-2 pr-2">Date</th>
                <th className="pb-2 pr-2">Vendor</th>
                <th className="pb-2 pr-2">Category</th>
                <th className="pb-2 pr-2">Tags</th>
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
                  <td className="py-2 pr-2 text-xs text-slate-400">{expense.tags.join(", ")}</td>
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
