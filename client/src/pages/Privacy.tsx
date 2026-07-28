import { cardClass } from "../lib/ui";

export default function Privacy() {
  return (
    <div className={`prose prose-invert max-w-none space-y-4 ${cardClass}`}>
      <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
      <p className="text-xs uppercase tracking-wide text-amber-400">
        Draft placeholder — replace with reviewed copy before real users rely on this app.
      </p>

      <p className="text-slate-300">
        Fintory stores the financial information you enter or connect: expenses, loans, savings accounts,
        assets, budgets, and (if you choose to link one) read-only bank/card account data via Plaid.
      </p>

      <h2 className="text-lg font-semibold text-white">What we store</h2>
      <ul className="list-disc space-y-1 pl-6 text-slate-300">
        <li>Account details: name, email, and authentication data.</li>
        <li>Financial records you create or that sync from a linked account.</li>
        <li>Receipt photos you upload for AI-assisted expense extraction.</li>
        <li>An audit trail of changes to your expenses, loans, savings, and assets.</li>
      </ul>

      <h2 className="text-lg font-semibold text-white">How we protect it</h2>
      <ul className="list-disc space-y-1 pl-6 text-slate-300">
        <li>Every table holding your financial data enforces row-level security in Postgres, scoped to your account.</li>
        <li>Bank-linking credentials (Plaid access tokens) are encrypted at rest, separately from the database's own encryption.</li>
        <li>Receipt photos are processed server-side only — your browser never talks to the AI vision provider directly.</li>
      </ul>

      <h2 className="text-lg font-semibold text-white">Your rights</h2>
      <p className="text-slate-300">
        You can download a full export of your data or permanently delete your account at any time from{" "}
        <a href="/account" className="text-fuchsia-400 hover:underline">
          Account Settings
        </a>
        .
      </p>

      <h2 className="text-lg font-semibold text-white">Third parties</h2>
      <p className="text-slate-300">
        We use Fixer for currency exchange rates, Google Gemini for receipt photo extraction, and Plaid for
        bank/card linking. None of these providers receive your login credentials.
      </p>
    </div>
  );
}
