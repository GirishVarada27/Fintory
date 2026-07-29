import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSession } from "../lib/authClient";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div className="p-8 text-center text-slate-600 dark:text-slate-400">{t("common.loading")}</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
