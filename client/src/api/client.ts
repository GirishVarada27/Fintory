import { enqueueWrite, replayQueue } from "../lib/offlineQueue";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class OfflineQueuedError extends Error {
  constructor() {
    super("You're offline — this will be saved automatically once you're back online.");
  }
}

export interface ListResponse<T> {
  data: T[];
  pagination: { nextCursor: string | null; limit: number };
}

export interface ItemResponse<T> {
  data: T;
}

const VIEWING_AS_STORAGE_KEY = "fintory.viewingAsOwnerId";
let viewingAsOwnerId: string | null =
  typeof localStorage !== "undefined" ? localStorage.getItem(VIEWING_AS_STORAGE_KEY) : null;

// Every request automatically scopes to this owner (via `?ownerId=`) once
// set — lets the whole app (dashboard, expenses, budgets, etc.) work
// unmodified whether you're looking at your own data or an account someone
// shared with you. Harmless no-op for endpoints that don't check ownerId
// (auth, shares management, account export/delete, receipts, Plaid).
export function setViewingAsOwnerId(id: string | null) {
  viewingAsOwnerId = id;
  if (typeof localStorage !== "undefined") {
    if (id) localStorage.setItem(VIEWING_AS_STORAGE_KEY, id);
    else localStorage.removeItem(VIEWING_AS_STORAGE_KEY);
  }
}

export function getViewingAsOwnerId(): string | null {
  return viewingAsOwnerId;
}

async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let scopedPath = path;
  if (viewingAsOwnerId) {
    const separator = path.includes("?") ? "&" : "?";
    scopedPath = `${path}${separator}ownerId=${encodeURIComponent(viewingAsOwnerId)}`;
  }

  const res = await fetch(`/api/v1${scopedPath}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body as { error?: { code: string; message: string } } | null)?.error ?? {
      code: "UNKNOWN",
      message: res.statusText,
    };
    throw new ApiError(res.status, err.code, err.message);
  }

  return body as T;
}

// POST/PATCH/DELETE that fail because the browser is offline (fetch throws
// a TypeError, not an HTTP error status) are queued in IndexedDB instead of
// surfacing a raw network error — syncOfflineQueue() replays them in order
// once connectivity returns (wired to the `online` event in main.tsx).
async function mutatingRequest<T>(path: string, method: "POST" | "PATCH" | "DELETE", data?: unknown): Promise<T> {
  const options: RequestInit = { method, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) };
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    if (err instanceof TypeError) {
      await enqueueWrite(path, method, data);
      throw new OfflineQueuedError();
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => rawRequest<T>(path),
  post: <T>(path: string, data: unknown) => mutatingRequest<T>(path, "POST", data),
  patch: <T>(path: string, data: unknown) => mutatingRequest<T>(path, "PATCH", data),
  del: <T>(path: string, data?: unknown) => mutatingRequest<T>(path, "DELETE", data),
};

export async function syncOfflineQueue(): Promise<void> {
  await replayQueue((path, method, body) => {
    const options: RequestInit = { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) };
    return rawRequest(path, options);
  });
}
