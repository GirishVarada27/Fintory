import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signIn } from "../lib/authClient";
import { cardClass, inputClass, labelClass, primaryButtonClass, dangerTextClass } from "../lib/ui";

export default function Login() {
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
      setError(signInError.message ?? "Sign in failed");
      return;
    }
    navigate("/");
  }

  return (
    <div className={`mx-auto mt-16 max-w-sm ${cardClass}`}>
      <h1 className="mb-6 text-2xl font-bold text-white">Welcome back</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <input
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
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        No account?{" "}
        <Link to="/signup" className="text-fuchsia-400 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
