import { useEffect, useState, type FormEvent } from "react";
import { listLoans, createLoan, updateLoan, deleteLoan, type Loan } from "../api/loans";
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  dangerTextClass,
} from "../lib/ui";

const emptyForm = {
  lender: "",
  type: "",
  principal: "",
  currency: "USD",
  apr: "",
  termMonths: "",
  monthlyPayment: "",
  startDate: new Date().toISOString().slice(0, 10),
};

export default function Loans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await listLoans();
    setLoans(res.data);
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
        lender: form.lender,
        type: form.type || undefined,
        principal: Number(form.principal),
        currency: form.currency,
        apr: Number(form.apr),
        termMonths: Number(form.termMonths),
        monthlyPayment: Number(form.monthlyPayment),
        startDate: form.startDate,
      };
      if (editingId) {
        await updateLoan(editingId, payload);
      } else {
        await createLoan(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function startEdit(loan: Loan) {
    setEditingId(loan.id);
    setForm({
      lender: loan.lender,
      type: loan.type ?? "",
      principal: loan.principal,
      currency: loan.currency,
      apr: loan.apr,
      termMonths: String(loan.termMonths),
      monthlyPayment: loan.monthlyPayment,
      startDate: loan.startDate,
    });
  }

  async function handleDelete(id: string) {
    await deleteLoan(id);
    if (editingId === id) resetForm();
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Loans</h1>

      <form onSubmit={handleSubmit} className={`grid grid-cols-1 gap-3 sm:grid-cols-4 ${cardClass}`}>
        <div>
          <label className={labelClass}>Lender</label>
          <input
            type="text"
            required
            value={form.lender}
            onChange={(e) => setForm({ ...form, lender: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <input
            type="text"
            placeholder="mortgage, auto, ..."
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Principal</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.principal}
            onChange={(e) => setForm({ ...form, principal: e.target.value })}
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
        <div>
          <label className={labelClass}>APR %</label>
          <input
            type="number"
            step="0.001"
            min="0"
            max="100"
            required
            value={form.apr}
            onChange={(e) => setForm({ ...form, apr: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Term (months)</label>
          <input
            type="number"
            step="1"
            min="1"
            required
            value={form.termMonths}
            onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Monthly payment</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.monthlyPayment}
            onChange={(e) => setForm({ ...form, monthlyPayment: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Start date</label>
          <input
            type="date"
            required
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className={inputClass}
          />
        </div>
        {error && <p className={`sm:col-span-4 ${dangerTextClass}`}>{error}</p>}
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className={primaryButtonClass}>
            {editingId ? "Save changes" : "Add loan"}
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
      ) : loans.length === 0 ? (
        <p className="text-slate-400">No loans yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {loans.map((loan) => (
            <div key={loan.id} className={cardClass}>
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-white">{loan.lender}</h2>
                  {loan.type && <p className="text-xs uppercase tracking-wide text-slate-400">{loan.type}</p>}
                </div>
                {loan.isPaidOff && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                    Paid off
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-y-1 text-sm text-slate-300">
                <dt className="text-slate-500">Outstanding</dt>
                <dd className="text-right font-medium text-white">
                  {loan.outstandingPrincipal.toFixed(2)} {loan.currency}
                </dd>
                <dt className="text-slate-500">Months remaining</dt>
                <dd className="text-right">{loan.monthsRemaining}</dd>
                <dt className="text-slate-500">Principal</dt>
                <dd className="text-right">
                  {loan.principal} {loan.currency}
                </dd>
                <dt className="text-slate-500">APR</dt>
                <dd className="text-right">{loan.apr}%</dd>
              </dl>
              {loan.isNonAmortizing && (
                <p className="mt-2 text-xs text-amber-400">
                  Payment doesn't cover accruing interest — balance won't reach zero at this rate.
                </p>
              )}
              <div className="mt-3 flex gap-3 text-sm">
                <button onClick={() => startEdit(loan)} className="text-fuchsia-400 hover:underline">
                  Edit
                </button>
                <button onClick={() => handleDelete(loan.id)} className="text-rose-400 hover:underline">
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
