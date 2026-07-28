import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../lib/authClient";
import { cardClass, inputClass, labelClass, primaryButtonClass, dangerTextClass } from "../lib/ui";

export default function Signup() {
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
      setError(signUpError.message ?? "Sign up failed");
      return;
    }
    navigate("/");
  }

  return (
    <div className={`mx-auto mt-16 max-w-sm ${cardClass}`}>
      <h1 className="mb-6 text-2xl font-bold text-white">Create your account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && <p className={dangerTextClass}>{error}</p>}
        <button type="submit" disabled={loading} className={`w-full ${primaryButtonClass}`}>
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link to="/login" className="text-fuchsia-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
