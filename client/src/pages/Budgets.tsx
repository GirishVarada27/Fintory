import { useEffect, useState, type FormEvent } from "react";
import { listBudgets, createBudget, updateBudget, deleteBudget, type Budget } from "../api/budgets";
import { listCategories, type Category } from "../api/categories";
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  dangerTextClass,
} from "../lib/ui";

const emptyForm = { categoryId: "", monthlyLimit: "", currency: "USD", alertThresholdPct: "80" };

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [budgetsRes, categoriesRes] = await Promise.all([listBudgets(), listCategories()]);
    setBudgets(budgetsRes.data);
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
        categoryId: form.categoryId,
        monthlyLimit: Number(form.monthlyLimit),
        currency: form.currency,
        alertThresholdPct: Number(form.alertThresholdPct),
      };
      if (editingId) {
        await updateBudget(editingId, payload);
      } else {
        await createBudget(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function startEdit(budget: Budget) {
    setEditingId(budget.id);
    setForm({
      categoryId: budget.categoryId,
      monthlyLimit: budget.monthlyLimit,
      currency: budget.currency,
      alertThresholdPct: budget.alertThresholdPct,
    });
  }

  async function handleDelete(id: string) {
    await deleteBudget(id);
    if (editingId === id) resetForm();
    await load();
  }

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Unknown";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Budgets</h1>

      <form onSubmit={handleSubmit} className={`grid grid-cols-1 gap-3 sm:grid-cols-4 ${cardClass}`}>
        <div>
          <label htmlFor="budget-category" className={labelClass}>Category</label>
          <select
            id="budget-category"
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className={inputClass}
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="budget-limit" className={labelClass}>Monthly limit</label>
          <input
            id="budget-limit"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.monthlyLimit}
            onChange={(e) => setForm({ ...form, monthlyLimit: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="budget-currency" className={labelClass}>Currency</label>
          <input
            id="budget-currency"
            type="text"
            required
            maxLength={3}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="budget-threshold" className={labelClass}>Alert threshold %</label>
          <input
            id="budget-threshold"
            type="number"
            step="1"
            min="1"
            max="100"
            required
            value={form.alertThresholdPct}
            onChange={(e) => setForm({ ...form, alertThresholdPct: e.target.value })}
            className={inputClass}
          />
        </div>
        {error && <p className={`sm:col-span-4 ${dangerTextClass}`}>{error}</p>}
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className={primaryButtonClass}>
            {editingId ? "Save changes" : "Add budget"}
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
      ) : budgets.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">No budgets yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {budgets.map((budget) => {
            const pct = Math.min(100, Math.round(budget.percentUsed));
            const over = budget.percentUsed >= 100;
            const nearLimit = budget.percentUsed >= Number(budget.alertThresholdPct);
            const barColor = over
              ? "bg-rose-500"
              : nearLimit
                ? "bg-amber-500"
                : "bg-gradient-to-r from-fuchsia-500 to-cyan-500";
            return (
              <div key={budget.id} className={cardClass}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900 dark:text-white">{categoryName(budget.categoryId)}</h2>
                  <span className="text-xs text-slate-600 dark:text-slate-400">{Math.round(budget.percentUsed)}% used</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${categoryName(budget.categoryId)} budget usage`}
                  className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
                >
                  <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  {budget.spentToDate.toFixed(2)} / {budget.monthlyLimit} {budget.currency} this month
                </p>
                <div className="mt-3 flex gap-3 text-sm">
                  <button
                    onClick={() => startEdit(budget)}
                    aria-label={`Edit ${categoryName(budget.categoryId)} budget`}
                    className="text-fuchsia-600 dark:text-fuchsia-400 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    aria-label={`Delete ${categoryName(budget.categoryId)} budget`}
                    className="text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
