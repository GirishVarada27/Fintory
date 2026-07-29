const DB_NAME = "fintory-offline";
const STORE_NAME = "pendingWrites";

export interface QueuedWrite {
  id: number;
  path: string;
  method: "POST" | "PATCH" | "DELETE";
  body: unknown;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const req = fn(tx.objectStore(STORE_NAME));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

type Listener = (size: number) => void;
const listeners = new Set<Listener>();

export function onQueueSizeChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function notifyListeners() {
  const size = await getQueueSize();
  listeners.forEach((l) => l(size));
}

export async function enqueueWrite(path: string, method: "POST" | "PATCH" | "DELETE", body: unknown): Promise<void> {
  await withStore("readwrite", (store) =>
    store.add({ path, method, body, createdAt: new Date().toISOString() } as Omit<QueuedWrite, "id">),
  );
  await notifyListeners();
}

export async function getQueue(): Promise<QueuedWrite[]> {
  return withStore("readonly", (store) => store.getAll());
}

export async function getQueueSize(): Promise<number> {
  return withStore("readonly", (store) => store.count());
}

async function removeFromQueue(id: number): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  await notifyListeners();
}

// Replays queued writes in the order they were made. Stops at the first
// failure so a later write can never land before an earlier one it might
// depend on (e.g. create-then-edit of the same row).
export async function replayQueue(send: (path: string, method: "POST" | "PATCH" | "DELETE", body: unknown) => Promise<unknown>) {
  const queue = await getQueue();
  for (const item of queue.sort((a, b) => a.id - b.id)) {
    try {
      await send(item.path, item.method, item.body);
      await removeFromQueue(item.id);
    } catch {
      break;
    }
  }
}
