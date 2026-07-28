import { Link, useNavigate } from "react-router-dom";
import { signOut, useSession } from "../lib/authClient";
import NotificationBell from "./NotificationBell";

const NAV_LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/expenses", label: "Expenses" },
  { to: "/loans", label: "Loans" },
  { to: "/savings", label: "Savings" },
  { to: "/assets", label: "Assets" },
  { to: "/budgets", label: "Budgets" },
  { to: "/recurring", label: "Recurring" },
];

export default function NavBar() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-bold tracking-tight">
          <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Fintory
          </span>
        </Link>
        {session && (
          <nav className="flex items-center gap-1 text-sm text-slate-300">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-full px-3 py-1.5 transition hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="ml-2 rounded-full bg-white/10 px-3 py-1.5 transition hover:bg-white/20"
            >
              Sign out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
