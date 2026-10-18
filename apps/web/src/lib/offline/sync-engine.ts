import {
  SyncOperationType,
  SyncResultStatus,
  type SyncPushResponse,
} from '@bakimos/api-contracts';
import { api } from '@/lib/api';
import { getOrCreateDeviceId } from './device-id';
import { getMeta, setMeta } from './offline-db';
import {
  listPendingOperations,
  markSyncing,
  updateOperation,
} from './pending-operations';
import type { PendingOperation } from './types';

const MAX_RETRIES = 5;
let inFlight: Promise<SyncEngineResult> | null = null;

export type SyncEngineResult = {
  pushed: number;
  synced: number;
  failed: number;
  conflicts: number;
  skipped: boolean;
  message?: string;
};

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export async function getLastSyncAt(userId: string, tenantId: string): Promise<string | null> {
  return getMeta(`lastSync:${userId}:${tenantId}`);
}

export async function runSync(userId: string, tenantId: string): Promise<SyncEngineResult> {
  if (inFlight) return inFlight;
  inFlight = doSync(userId, tenantId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(userId: string, tenantId: string): Promise<SyncEngineResult> {
  if (!isOnline()) {
    return { pushed: 0, synced: 0, failed: 0, conflicts: 0, skipped: true, message: 'Çevrimdışı.' };
  }

  const pending = (await listPendingOperations(userId, tenantId)).filter(
    (row) =>
      (row.status === 'pending' || row.status === 'failed') && row.retryCount < MAX_RETRIES,
  );
  if (pending.length === 0) {
    return { pushed: 0, synced: 0, failed: 0, conflicts: 0, skipped: false };
  }

  await markSyncing(pending.map((row) => row.operationId));
  const deviceId = await getOrCreateDeviceId();

  try {
    const response = await api<{ data: SyncPushResponse }>(
      '/api/v1/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({
          deviceId,
          operations: pending.map((row) => ({
            operationId: row.operationId,
            type: SyncOperationType.FAULT_CREATE,
            clientCreatedAt: row.clientCreatedAt,
            payload: row.payload,
          })),
        }),
      },
      tenantId,
    );

    let synced = 0;
    let failed = 0;
    let conflicts = 0;
    const seen = new Set<string>();
    for (const result of response.data.results) {
      seen.add(result.operationId);
      if (result.status === SyncResultStatus.APPLIED || result.status === SyncResultStatus.DUPLICATE) {
        await updateOperation(result.operationId, {
          status: 'synced',
          serverEntityId: result.entityId ?? null,
          lastError: null,
        });
        synced += 1;
      } else if (result.status === SyncResultStatus.CONFLICT) {
        await updateOperation(result.operationId, {
          status: 'conflict',
          lastError: result.message ?? 'Çakışma',
        });
        conflicts += 1;
      } else if (result.status === SyncResultStatus.REJECTED) {
        await updateOperation(result.operationId, {
          status: 'failed',
          retryCount: MAX_RETRIES,
          lastError: result.message ?? 'Reddedildi',
        });
        failed += 1;
      } else {
        const current = pending.find((row) => row.operationId === result.operationId);
        await bumpRetry(current, result.message ?? 'Geçici hata');
        failed += 1;
      }
    }
    for (const row of pending) {
      if (!seen.has(row.operationId)) {
        await bumpRetry(row, 'Sunucu sonucu eksik');
        failed += 1;
      }
    }
    await setMeta(`lastSync:${userId}:${tenantId}`, new Date().toISOString());
    return { pushed: pending.length, synced, failed, conflicts, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Senkronizasyon başarısız';
    for (const row of pending) {
      await bumpRetry(row, message);
    }
    return {
      pushed: pending.length,
      synced: 0,
      failed: pending.length,
      conflicts: 0,
      skipped: false,
      message,
    };
  }
}

async function bumpRetry(row: PendingOperation | undefined, message: string): Promise<void> {
  if (!row) return;
  const retryCount = row.retryCount + 1;
  await updateOperation(row.operationId, {
    status: retryCount >= MAX_RETRIES ? 'failed' : 'pending',
    retryCount,
    lastError: message,
  });
}
