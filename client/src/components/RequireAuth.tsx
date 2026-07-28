import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../lib/authClient";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div className="p-8 text-center text-slate-400">Loading…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
