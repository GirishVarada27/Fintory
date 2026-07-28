import { useEffect, useState } from "react";
import { listNotifications, markNotificationRead, type Notification } from "../api/notifications";

function describeNotification(n: Notification): string {
  const p = n.payload;
  switch (n.type) {
    case "budget_threshold":
      return `Budget alert: ${p.categoryName} is at ${p.percentUsed}% for ${p.month}`;
    case "recurring_detected":
      return `Possible subscription detected: ${p.vendor}`;
    case "loan_reminder":
      return `Payment due ${p.dueDate}: ${p.lender}`;
    default:
      return "Notification";
  }
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await listNotifications();
    setNotifications(res.data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-xl">
          {notifications.length === 0 ? (
            <p className="p-3 text-sm text-slate-400">No notifications yet.</p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-lg p-2 text-sm ${n.readAt ? "text-slate-400" : "bg-white/5 text-white"}`}
                >
                  <p>{describeNotification(n)}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                    {!n.readAt && (
                      <button onClick={() => handleMarkRead(n.id)} className="text-fuchsia-400 hover:underline">
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
