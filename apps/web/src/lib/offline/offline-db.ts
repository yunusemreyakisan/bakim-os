import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { OfflineEquipment, OfflineMeta, PendingOperation } from './types';

interface BakimosDb extends DBSchema {
  equipment: {
    key: string;
    value: OfflineEquipment;
    indexes: { 'by-tenant-user': [string, string]; 'by-server-id': string };
  };
  pendingOperations: {
    key: string;
    value: PendingOperation;
    indexes: {
      'by-tenant-user': [string, string];
      'by-status': string;
    };
  };
  meta: {
    key: string;
    value: OfflineMeta;
  };
}

const DB_NAME = 'bakimos-offline';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<BakimosDb>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<BakimosDb>> {
  if (!dbPromise) {
    dbPromise = openDB<BakimosDb>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 2 && db.objectStoreNames.contains('equipment')) {
          db.deleteObjectStore('equipment');
        }
        if (!db.objectStoreNames.contains('equipment')) {
          const equipment = db.createObjectStore('equipment', { keyPath: 'cacheKey' });
          equipment.createIndex('by-tenant-user', ['tenantId', 'userId']);
          equipment.createIndex('by-server-id', 'id');
        }
        if (!db.objectStoreNames.contains('pendingOperations')) {
          const ops = db.createObjectStore('pendingOperations', { keyPath: 'operationId' });
          ops.createIndex('by-tenant-user', ['tenantId', 'userId']);
          ops.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/** Bağlantıyı kapatır; veri kalır (sayfa yeniden açılışı simülasyonu). */
export async function closeOfflineDbConnection(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

export async function resetOfflineDbForTests(): Promise<void> {
  await closeOfflineDbConnection();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => resolve();
  });
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getOfflineDb();
  const row = await db.get('meta', key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getOfflineDb();
  await db.put('meta', { key, value });
}
