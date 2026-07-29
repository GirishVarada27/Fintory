import { cardClass } from "../lib/ui";

export default function Terms() {
  return (
    <div className={`max-w-none space-y-4 ${cardClass}`}>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Terms of Service</h1>
      <p className="text-xs uppercase tracking-wide text-amber-600 dark:text-amber-400">
        Draft placeholder — replace with reviewed copy before real users rely on this app.
      </p>

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">What Fintory is</h2>
      <p className="text-slate-700 dark:text-slate-300">
        Fintory is a personal finance tracker. It is not a bank, does not move money, and does not provide
        financial, tax, or investment advice. Figures it computes (amortization, budgets, converted totals)
        are estimates for your own reference.
      </p>

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your responsibilities</h2>
      <ul className="list-disc space-y-1 pl-6 text-slate-700 dark:text-slate-300">
        <li>Keep your login credentials confidential.</li>
        <li>Only link bank/card accounts you're authorized to access.</li>
        <li>Verify any extracted receipt data before saving it — AI extraction can make mistakes.</li>
      </ul>

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Account deletion</h2>
      <p className="text-slate-700 dark:text-slate-300">
        Deleting your account permanently removes your data — this cannot be undone. See{" "}
        <a href="/account" className="text-fuchsia-600 dark:text-fuchsia-400 hover:underline">
          Account Settings
        </a>
        .
      </p>

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">No warranty</h2>
      <p className="text-slate-700 dark:text-slate-300">
        Fintory is provided as-is, without warranty of any kind, express or implied.
      </p>
    </div>
  );
}
