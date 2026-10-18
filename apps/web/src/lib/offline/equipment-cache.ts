import type { EquipmentDto } from '@bakimos/api-contracts';
import { getOfflineDb } from './offline-db';
import type { OfflineEquipment } from './types';

export function equipmentCacheKey(tenantId: string, userId: string, equipmentId: string): string {
  return `${tenantId}:${userId}:${equipmentId}`;
}

export async function cacheEquipmentList(
  userId: string,
  tenantId: string,
  rows: EquipmentDto[],
): Promise<void> {
  const db = await getOfflineDb();
  const cachedAt = new Date().toISOString();
  const tx = db.transaction('equipment', 'readwrite');
  const existing = await tx.store.index('by-tenant-user').getAll([tenantId, userId]);
  await Promise.all(existing.map((row) => tx.store.delete(row.cacheKey)));
  await Promise.all(
    rows.map((row) =>
      tx.store.put({
        cacheKey: equipmentCacheKey(tenantId, userId, row.id),
        id: row.id,
        tenantId,
        userId,
        siteId: row.siteId,
        siteName: row.site.name,
        siteTimezone: row.site.timezone,
        code: row.code,
        name: row.name,
        description: row.description,
        status: row.status,
        version: row.version,
        qrPublicId: row.qrPublicId,
        cachedAt,
        updatedAt: row.updatedAt,
      } satisfies OfflineEquipment),
    ),
  );
  await tx.done;
}

export async function listCachedEquipment(
  userId: string,
  tenantId: string,
): Promise<OfflineEquipment[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex('equipment', 'by-tenant-user', [tenantId, userId]);
  return rows.sort((a, b) => a.code.localeCompare(b.code));
}

export async function getCachedEquipment(
  userId: string,
  tenantId: string,
  equipmentId: string,
): Promise<OfflineEquipment | null> {
  const db = await getOfflineDb();
  const row = await db.get('equipment', equipmentCacheKey(tenantId, userId, equipmentId));
  if (!row || row.userId !== userId || row.tenantId !== tenantId) return null;
  return row;
}

export async function clearEquipmentCacheForUser(userId: string): Promise<void> {
  const db = await getOfflineDb();
  const all = await db.getAll('equipment');
  const tx = db.transaction('equipment', 'readwrite');
  await Promise.all(
    all.filter((row) => row.userId === userId).map((row) => tx.store.delete(row.cacheKey)),
  );
  await tx.done;
}
