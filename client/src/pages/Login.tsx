import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { signIn, useSession } from "../lib/authClient";
import { cardClass, inputClass, labelClass, primaryButtonClass, dangerTextClass } from "../lib/ui";

export default function Login() {
  const { t } = useTranslation();
  const { refetch: refetchSession } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn.email({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? t("auth.login.genericError"));
      return;
    }
    // better-auth's session store updates ~10ms after signIn resolves (its
    // own internal race-avoidance delay) — navigating immediately would beat
    // it, making RequireAuth see a stale signed-out session and bounce back
    // to /login. Refetching here blocks until the store actually reflects
    // the new session before we leave this page.
    await refetchSession();
    navigate("/");
  }

  return (
    <div className={`mx-auto mt-16 max-w-sm ${cardClass}`}>
      <h1 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">{t("auth.login.title")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className={labelClass}>{t("auth.login.email")}</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="login-password" className={labelClass}>{t("auth.login.password")}</label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && <p className={dangerTextClass}>{error}</p>}
        <button type="submit" disabled={loading} className={`w-full ${primaryButtonClass}`}>
          {loading ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
        {t("auth.login.noAccount")}{" "}
        <Link to="/signup" className="text-fuchsia-600 dark:text-fuchsia-400 hover:underline">
          {t("auth.login.signUp")}
        </Link>
      </p>
    </div>
  );
}
