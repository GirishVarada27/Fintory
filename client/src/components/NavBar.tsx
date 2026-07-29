import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { signOut, useSession } from "../lib/authClient";
import { useViewingAs } from "../lib/ViewingAsContext";
import { useTheme } from "../lib/ThemeContext";
import NotificationBell from "./NotificationBell";
import OfflineIndicator from "./OfflineIndicator";

export default function NavBar() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { ownerId: viewingOwnerId, ownerName: viewingOwnerName, stopViewingAs } = useViewingAs();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const navLinks = [
    { to: "/", label: t("nav.dashboard") },
    { to: "/income", label: t("nav.income") },
    { to: "/expenses", label: t("nav.expenses") },
    { to: "/loans", label: t("nav.loans") },
    { to: "/savings", label: t("nav.savings") },
    { to: "/assets", label: t("nav.assets") },
    { to: "/budgets", label: t("nav.budgets") },
    { to: "/recurring", label: t("nav.recurring") },
    { to: "/linked-accounts", label: t("nav.linked") },
    { to: "/sharing", label: t("nav.sharing") },
    { to: "/assistant", label: t("nav.assistant") },
    { to: "/account", label: t("nav.account") },
  ];

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-bold tracking-tight">
          <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Fintory
          </span>
        </Link>
        {session && (
          <nav className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-full px-3 py-1.5 transition hover:bg-black/5 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <OfflineIndicator />
            <NotificationBell />
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? t("nav.switchToLightMode") : t("nav.switchToDarkMode")}
              title={theme === "dark" ? t("nav.switchToLightMode") : t("nav.switchToDarkMode")}
              className="ml-1 rounded-full bg-black/5 px-3 py-1.5 transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
            >
              <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="ml-1 rounded-full bg-black/5 px-3 py-1.5 transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
            >
              {t("nav.signOut")}
            </button>
          </nav>
        )}
      </div>
      {session && viewingOwnerId && (
        <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-700 dark:text-amber-300">
          {t("nav.viewingAs", { name: viewingOwnerName ?? t("nav.viewingAsFallback") })} —{" "}
          <button onClick={stopViewingAs} className="font-semibold underline">
            {t("nav.switchBack")}
          </button>
        </div>
      )}
    </header>
  );
}
