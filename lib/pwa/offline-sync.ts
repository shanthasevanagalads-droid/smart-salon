// ========================================================================
// SMART SALON LK - OFFLINE RESILIENCE & INDEXEDDB SYNC ENGINE
// Ensures Zero-Downtime Operation on Spotty 3G/4G Sri Lankan Mobile Networks
// ========================================================================

export interface OfflineAction {
  actionId: string;
  type: 'quick_walk_in' | 'update_queue_status' | 'save_invoice' | 'record_payment' | 'generic';
  branchId: string;
  clientTimestamp: string;
  payload: any;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed';
  error?: string;
}

const DB_NAME = 'smart_salon_offline_db';
const DB_VERSION = 1;
const STORE_OUTBOX = 'outbox_actions';
const STORE_CACHE = 'cached_snapshots';

type SyncListener = (pendingCount: number, isSyncing: boolean) => void;
const syncListeners: Set<SyncListener> = new Set();
let isCurrentlySyncing = false;

// ------------------------------------------------------------------------
// 1. INDEXEDDB INITIALIZATION
// ------------------------------------------------------------------------
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB is not supported on this platform'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const outboxStore = db.createObjectStore(STORE_OUTBOX, { keyPath: 'actionId' });
        outboxStore.createIndex('clientTimestamp', 'clientTimestamp', { unique: false });
        outboxStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ------------------------------------------------------------------------
// 2. OUTBOX MANAGEMENT (QUEUE & RETRIEVE)
// ------------------------------------------------------------------------

/**
 * Enqueue an action into the local outbox
 */
export async function queueOfflineAction(
  type: OfflineAction['type'],
  payload: any,
  branchId: string = 'b0000000-0000-0000-0000-000000000001'
): Promise<OfflineAction> {
  const action: OfflineAction = {
    actionId: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    branchId,
    clientTimestamp: new Date().toISOString(),
    payload,
    retryCount: 0,
    status: 'pending',
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.put(action);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    notifyListeners();

    // Request Service Worker Background Sync if available
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('sync-offline-actions');
      } catch (e) {
        // Fallback to direct flush if online
      }
    }

    // If browser is already online, trigger sync immediately
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setTimeout(() => flushOfflineActions(), 100);
    }

    return action;
  } catch (err) {
    console.error('[OfflineSync] Failed to queue offline action:', err);
    throw err;
  }
}

/**
 * Fetch all pending actions in outbox
 */
export async function getPendingActions(): Promise<OfflineAction[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readonly');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return [];
  }
}

// ------------------------------------------------------------------------
// 3. FLUSH & RECONCILIATION ENGINE
// ------------------------------------------------------------------------

/**
 * Flush all pending outbox actions to the server
 */
export async function flushOfflineActions(): Promise<{
  success: boolean;
  syncedCount: number;
  failedCount: number;
}> {
  if (isCurrentlySyncing) {
    return { success: true, syncedCount: 0, failedCount: 0 };
  }

  const actions = await getPendingActions();
  if (actions.length === 0) {
    return { success: true, syncedCount: 0, failedCount: 0 };
  }

  isCurrentlySyncing = true;
  notifyListeners();

  try {
    const response = await fetch('/api/pwa/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions }),
    });

    if (!response.ok) {
      throw new Error(`Sync HTTP error ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      // Clear synced actions from outbox
      const db = await openDatabase();
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);

      for (const item of actions) {
        store.delete(item.actionId);
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      console.log(`[OfflineSync] Successfully flushed ${actions.length} offline actions.`);
      return { success: true, syncedCount: actions.length, failedCount: 0 };
    } else {
      throw new Error(data.error || 'Server rejected batch sync');
    }
  } catch (err) {
    console.warn('[OfflineSync] Sync failed, will retry on next connection:', err);
    return { success: false, syncedCount: 0, failedCount: actions.length };
  } finally {
    isCurrentlySyncing = false;
    notifyListeners();
  }
}

/**
 * Reset outbox in case of manual purge
 */
export async function clearOfflineOutbox(): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    tx.objectStore(STORE_OUTBOX).clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    notifyListeners();
  } catch (e) {
    console.error('[OfflineSync] Error clearing outbox:', e);
  }
}

// ------------------------------------------------------------------------
// 4. OFFLINE SNAPSHOT CACHE (Key-Value State)
// ------------------------------------------------------------------------

export async function setOfflineSnapshot(key: string, data: any): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    tx.objectStore(STORE_CACHE).put({
      key,
      data,
      savedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[OfflineSync] Could not cache snapshot:', key, e);
  }
}

export async function getOfflineSnapshot<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_CACHE, 'readonly');
      const req = tx.objectStore(STORE_CACHE).get(key);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

// ------------------------------------------------------------------------
// 5. EVENT LISTENERS & SYNCHRONIZATION SIGNALS
// ------------------------------------------------------------------------

export function subscribeToSync(listener: SyncListener): () => void {
  syncListeners.add(listener);
  // Send initial state immediately
  getPendingActions().then((actions) => {
    listener(actions.length, isCurrentlySyncing);
  });
  return () => {
    syncListeners.delete(listener);
  };
}

async function notifyListeners() {
  const actions = await getPendingActions();
  syncListeners.forEach((listener) => {
    try {
      listener(actions.length, isCurrentlySyncing);
    } catch (e) {
      // ignore
    }
  });
}

// Listen to browser network changes & service worker background sync broadcasts
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Network restored, attempting auto-flush...');
    flushOfflineActions();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'TRIGGER_BACKGROUND_SYNC') {
        flushOfflineActions();
      }
    });
  }
}

