import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { signUp, useSession } from "../lib/authClient";
import { cardClass, inputClass, labelClass, primaryButtonClass, dangerTextClass } from "../lib/ui";

export default function Signup() {
  const { t } = useTranslation();
  const { refetch: refetchSession } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signUpError } = await signUp.email({ name, email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message ?? t("auth.signup.genericError"));
      return;
    }
    // better-auth's session store updates ~10ms after signUp resolves (its
    // own internal race-avoidance delay) — navigating immediately would beat
    // it, making RequireAuth see a stale signed-out session and bounce back
    // to /login. Refetching here blocks until the store actually reflects
    // the new session before we leave this page.
    await refetchSession();
    navigate("/");
  }

  return (
    <div className={`mx-auto mt-16 max-w-sm ${cardClass}`}>
      <h1 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">{t("auth.signup.title")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-name" className={labelClass}>{t("auth.signup.name")}</label>
          <input
            id="signup-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="signup-email" className={labelClass}>{t("auth.signup.email")}</label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="signup-password" className={labelClass}>{t("auth.signup.password")}</label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && <p className={dangerTextClass}>{error}</p>}
        <button type="submit" disabled={loading} className={`w-full ${primaryButtonClass}`}>
          {loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
        {t("auth.signup.haveAccount")}{" "}
        <Link to="/login" className="text-fuchsia-600 dark:text-fuchsia-400 hover:underline">
          {t("auth.signup.signIn")}
        </Link>
      </p>
    </div>
  );
}
