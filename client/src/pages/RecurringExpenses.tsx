import { useEffect, useState } from "react";
import {
  listRecurringExpenses,
  updateRecurringExpenseStatus,
  type RecurringExpense,
} from "../api/recurringExpenses";
import { listCategories, type Category } from "../api/categories";
import { cardClass, secondaryButtonClass, primaryButtonClass } from "../lib/ui";

export default function RecurringExpenses() {
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [recurringRes, categoriesRes] = await Promise.all([listRecurringExpenses(), listCategories()]);
    setItems(recurringRes.data);
    setCategories(categoriesRes.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStatus(id: string, status: "confirmed" | "dismissed") {
    await updateRecurringExpenseStatus(id, status);
    await load();
  }

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  const pending = items.filter((i) => i.status === "pending");
  const reviewed = items.filter((i) => i.status !== "pending");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Recurring Expenses</h1>
      <p className="text-sm text-slate-400">
        Vendors charging you on a regular cadence, detected from your expense history.
      </p>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : pending.length === 0 ? (
        <p className="text-slate-400">Nothing new to review.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pending.map((item) => (
            <div key={item.id} className={cardClass}>
              <h2 className="font-semibold text-white">{item.vendor}</h2>
              <p className="text-xs text-slate-400">{categoryName(item.categoryId)}</p>
              <p className="mt-2 text-sm text-slate-300">
                ~{item.averageAmount} {item.currency} every ~{item.cadenceDays} days
              </p>
              <p className="text-xs text-slate-500">Last seen {item.lastSeenDate}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => handleStatus(item.id, "confirmed")} className={primaryButtonClass}>
                  Confirm
                </button>
                <button onClick={() => handleStatus(item.id, "dismissed")} className={secondaryButtonClass}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-white">Reviewed</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {reviewed.map((item) => (
              <div key={item.id} className={`${cardClass} opacity-70`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">{item.vendor}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.status === "confirmed"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-white/10 text-slate-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  ~{item.averageAmount} {item.currency} every ~{item.cadenceDays} days
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
