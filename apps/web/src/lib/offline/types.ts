import type { FaultPriority } from '@bakimos/api-contracts';

export type PendingStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export type OfflineEquipment = {
  /** IndexedDB anahtarı: tenantId:userId:serverEquipmentId */
  cacheKey: string;
  id: string;
  tenantId: string;
  userId: string;
  siteId: string;
  siteName: string;
  siteTimezone: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  qrPublicId: string;
  cachedAt: string;
  updatedAt: string;
};

export type FaultCreatePayload = {
  equipmentId: string;
  description: string;
  priority: FaultPriority;
};

export type PendingOperation = {
  operationId: string;
  deviceId: string;
  userId: string;
  tenantId: string;
  type: 'FAULT_CREATE';
  localEntityId: string;
  payload: FaultCreatePayload;
  clientCreatedAt: string;
  status: PendingStatus;
  retryCount: number;
  lastError: string | null;
  serverEntityId: string | null;
  updatedAt: string;
};

export type OfflineMeta = {
  key: string;
  value: string;
};
