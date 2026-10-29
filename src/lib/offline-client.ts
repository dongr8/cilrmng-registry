"use client";

import type { MemberRecord } from "@/lib/member-schema";
import { runImport } from "@/lib/import-client";

const DB_NAME = "meridian-offline";
const DB_VERSION = 1;
const QUEUE_STORE = "queue";
const CACHE_STORE = "cache";

export type QueuedOperation =
  | { id?: number; kind: "create"; record: MemberRecord; queuedAt: string }
  | { id?: number; kind: "update"; recordId: number; record: MemberRecord; queuedAt: string }
  | { id?: number; kind: "delete"; recordId: number; queuedAt: string }
  | {
      id?: number;
      kind: "import";
      fileName: string;
      fileType: string;
      source: string;
      rows: MemberRecord[];
      queuedAt: string;
    };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline storage is not available in this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        database.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        database.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open offline storage"));
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
      }),
  );
}

/** Ask the browser to make this device's storage permanent (not evictable). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number; persisted: boolean }> {
  try {
    const estimate = (await navigator.storage?.estimate?.()) ?? {};
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persisted };
  } catch {
    return { usage: 0, quota: 0, persisted: false };
  }
}

function notifyQueueChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("meridian:queue-changed"));
}

export async function queueOperation(operation: QueuedOperation): Promise<void> {
  try {
    await tx(QUEUE_STORE, "readwrite", (store) => store.add(operation));
    notifyQueueChanged();
  } catch {
    /* storage unavailable (private mode) — caller still shows an error toast */
  }
}

export async function readQueue(): Promise<QueuedOperation[]> {
  try {
    return await tx<QueuedOperation[]>(QUEUE_STORE, "readonly", (store) => store.getAll() as IDBRequest<QueuedOperation[]>);
  } catch {
    return [];
  }
}

export async function queueSize(): Promise<number> {
  try {
    return await tx<number>(QUEUE_STORE, "readonly", (store) => store.count());
  } catch {
    return 0;
  }
}

async function removeOperation(id: number): Promise<void> {
  await tx(QUEUE_STORE, "readwrite", (store) => store.delete(id));
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    await tx(CACHE_STORE, "readwrite", (store) => store.put({ key, value, savedAt: new Date().toISOString() }));
  } catch {
    /* ignore unavailable storage */
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const row = await tx<{ key: string; value: T } | undefined>(CACHE_STORE, "readonly", (store) => store.get(key));
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export type FlushResult = { synced: number; remaining: number; failed: number };

export async function flushQueue(): Promise<FlushResult> {
  const operations = await readQueue();
  let synced = 0;
  let failed = 0;
  let blocked = false;

  for (const operation of operations) {
    if (blocked) break;
    try {
      if (operation.kind === "create") {
        const response = await fetch("/api/admin/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record: operation.record }),
        });
        if (!response.ok && response.status >= 500) throw new Error("server unavailable");
        synced += 1;
      } else if (operation.kind === "update") {
        const response = await fetch(`/api/admin/records/${operation.recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record: operation.record }),
        });
        if (!response.ok && response.status >= 500) throw new Error("server unavailable");
        synced += 1;
      } else if (operation.kind === "delete") {
        const response = await fetch(`/api/admin/records/${operation.recordId}`, { method: "DELETE" });
        if (!response.ok && response.status >= 500) throw new Error("server unavailable");
        synced += 1;
      } else {
        await runImport({
          rows: operation.rows,
          fileName: operation.fileName,
          fileType: operation.fileType,
          source: operation.source,
        });
        synced += 1;
      }
      if (operation.id !== undefined) await removeOperation(operation.id);
    } catch {
      failed += 1;
      blocked = true;
    }
  }

  notifyQueueChanged();
  return { synced, remaining: await queueSize(), failed };
}
