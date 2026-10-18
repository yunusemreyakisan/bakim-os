import { getOfflineDb } from './offline-db';
import { getOrCreateDeviceId } from './device-id';
import type { FaultCreatePayload, PendingOperation, PendingStatus } from './types';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueFaultCreate(input: {
  userId: string;
  tenantId: string;
  payload: FaultCreatePayload;
}): Promise<PendingOperation> {
  const db = await getOfflineDb();
  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const operation: PendingOperation = {
    operationId: newId(),
    deviceId,
    userId: input.userId,
    tenantId: input.tenantId,
    type: 'FAULT_CREATE',
    localEntityId: newId(),
    payload: input.payload,
    clientCreatedAt: now,
    status: 'pending',
    retryCount: 0,
    lastError: null,
    serverEntityId: null,
    updatedAt: now,
  };
  await db.put('pendingOperations', operation);
  return operation;
}

export async function listPendingOperations(
  userId: string,
  tenantId: string,
): Promise<PendingOperation[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex('pendingOperations', 'by-tenant-user', [tenantId, userId]);
  return rows.sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));
}

export async function countOpenOperations(userId: string, tenantId: string): Promise<number> {
  const rows = await listPendingOperations(userId, tenantId);
  return rows.filter((row) => row.status === 'pending' || row.status === 'syncing' || row.status === 'failed')
    .length;
}

export async function updateOperation(
  operationId: string,
  patch: Partial<
    Pick<PendingOperation, 'status' | 'retryCount' | 'lastError' | 'serverEntityId' | 'updatedAt'>
  >,
): Promise<void> {
  const db = await getOfflineDb();
  const current = await db.get('pendingOperations', operationId);
  if (!current) return;
  await db.put('pendingOperations', {
    ...current,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  });
}

export async function markSyncing(operationIds: string[]): Promise<void> {
  for (const id of operationIds) {
    await updateOperation(id, { status: 'syncing' as PendingStatus });
  }
}

export async function countPendingForUser(userId: string): Promise<number> {
  const db = await getOfflineDb();
  const all = await db.getAll('pendingOperations');
  return all.filter(
    (row) =>
      row.userId === userId &&
      (row.status === 'pending' || row.status === 'syncing' || row.status === 'failed'),
  ).length;
}
