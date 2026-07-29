import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getQueueSize, onQueueSizeChange } from "../lib/offlineQueue";

export default function OfflineIndicator() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    getQueueSize().then(setPending);
    const unsubscribe = onQueueSizeChange(setPending);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <span
      role="status"
      className="rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"
    >
      {!online ? t("nav.offline") : t("nav.pendingSync", { count: pending })}
    </span>
  );
}
