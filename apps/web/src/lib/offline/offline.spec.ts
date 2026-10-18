import { FaultPriority, SyncResultStatus, type EquipmentDto } from '@bakimos/api-contracts';
import { cacheEquipmentList, listCachedEquipment } from './equipment-cache';
import { closeOfflineDbConnection, resetOfflineDbForTests } from './offline-db';
import {
  enqueueFaultCreate,
  listPendingOperations,
  updateOperation,
} from './pending-operations';
import { runSync } from './sync-engine';

jest.mock('@/lib/api', () => ({
  api: jest.fn(),
}));

import { api } from '@/lib/api';

const mockedApi = api as jest.MockedFunction<typeof api>;

function sampleEquipment(id: string, code: string): EquipmentDto {
  return {
    id,
    tenantId: 'tenant-a',
    siteId: 'site-1',
    code,
    name: `Makine ${code}`,
    description: null,
    status: 'ACTIVE',
    version: 1,
    qrPublicId: `qr-${id}`,
    qrPath: `/q/qr-${id}`,
    qrUrl: `http://localhost/q/qr-${id}`,
    site: { id: 'site-1', name: 'Ana Tesis', timezone: 'Europe/Istanbul' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('offline IndexedDB katmani', () => {
  beforeEach(async () => {
    await resetOfflineDbForTests();
    mockedApi.mockReset();
    Object.defineProperty(globalThis.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });

  it('ekipman verisini yazar ve tekrar okur', async () => {
    await cacheEquipmentList('user-1', 'tenant-a', [
      sampleEquipment('eq-1', 'CNC-1'),
      sampleEquipment('eq-2', 'CNC-2'),
    ]);
    const rows = await listCachedEquipment('user-1', 'tenant-a');
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.code)).toEqual(['CNC-1', 'CNC-2']);
  });

  it('offline ariza kaydini kuyruga ekler', async () => {
    const created = await enqueueFaultCreate({
      userId: 'user-1',
      tenantId: 'tenant-a',
      payload: {
        equipmentId: 'eq-1',
        description: 'Motor asiri isindi',
        priority: FaultPriority.HIGH,
      },
    });
    expect(created.status).toBe('pending');
    expect(created.operationId).toBeTruthy();
    const listed = await listPendingOperations('user-1', 'tenant-a');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.payload.description).toBe('Motor asiri isindi');
  });

  it('sayfa yeniden acildiginda bekleyen islem korunur', async () => {
    const op = await enqueueFaultCreate({
      userId: 'user-1',
      tenantId: 'tenant-a',
      payload: {
        equipmentId: 'eq-1',
        description: 'Kalici kuyruk',
        priority: FaultPriority.LOW,
      },
    });
    await closeOfflineDbConnection();
    const reopened = await listPendingOperations('user-1', 'tenant-a');
    expect(reopened).toHaveLength(1);
    expect(reopened[0]?.operationId).toBe(op.operationId);
  });

  it('gecici hata sonrasi retry calisir', async () => {
    const op = await enqueueFaultCreate({
      userId: 'user-1',
      tenantId: 'tenant-a',
      payload: {
        equipmentId: 'eq-1',
        description: 'Retry denemesi',
        priority: FaultPriority.MEDIUM,
      },
    });

    mockedApi.mockRejectedValueOnce(new Error('network down'));
    const failed = await runSync('user-1', 'tenant-a');
    expect(failed.failed).toBe(1);
    const afterFail = await listPendingOperations('user-1', 'tenant-a');
    expect(afterFail[0]?.status).toBe('pending');
    expect(afterFail[0]?.retryCount).toBe(1);

    mockedApi.mockResolvedValueOnce({
      data: {
        results: [
          {
            operationId: op.operationId,
            status: SyncResultStatus.APPLIED,
            entityType: 'fault',
            entityId: 'fault-1',
          },
        ],
      },
    });
    const ok = await runSync('user-1', 'tenant-a');
    expect(ok.synced).toBe(1);
    const afterOk = await listPendingOperations('user-1', 'tenant-a');
    expect(afterOk[0]?.status).toBe('synced');
    expect(afterOk[0]?.serverEntityId).toBe('fault-1');
  });

  it('basarili cevap sonrasi yerel kayit sunucu kaydiyla eslesir', async () => {
    const op = await enqueueFaultCreate({
      userId: 'user-1',
      tenantId: 'tenant-a',
      payload: {
        equipmentId: 'eq-1',
        description: 'Eslesme',
        priority: FaultPriority.HIGH,
      },
    });
    mockedApi.mockResolvedValueOnce({
      data: {
        results: [
          {
            operationId: op.operationId,
            status: SyncResultStatus.APPLIED,
            entityId: 'server-fault-9',
          },
        ],
      },
    });
    await runSync('user-1', 'tenant-a');
    const rows = await listPendingOperations('user-1', 'tenant-a');
    expect(rows[0]?.serverEntityId).toBe('server-fault-9');
    expect(rows[0]?.status).toBe('synced');
  });

  it('tekrar gonderim ikinci kayda yol acmaz (DUPLICATE)', async () => {
    const op = await enqueueFaultCreate({
      userId: 'user-1',
      tenantId: 'tenant-a',
      payload: {
        equipmentId: 'eq-1',
        description: 'Duplicate guvenli',
        priority: FaultPriority.MEDIUM,
      },
    });
    mockedApi.mockResolvedValueOnce({
      data: {
        results: [
          {
            operationId: op.operationId,
            status: SyncResultStatus.DUPLICATE,
            entityId: 'fault-existing',
          },
        ],
      },
    });
    const result = await runSync('user-1', 'tenant-a');
    expect(result.synced).toBe(1);
    const rows = await listPendingOperations('user-1', 'tenant-a');
    expect(rows[0]?.status).toBe('synced');
    expect(rows[0]?.serverEntityId).toBe('fault-existing');
  });

  it('tenant/kullanici degisiminde eski tenant verisi gorunmez', async () => {
    await cacheEquipmentList('user-1', 'tenant-a', [sampleEquipment('eq-a', 'A-1')]);
    await cacheEquipmentList('user-1', 'tenant-b', [sampleEquipment('eq-b', 'B-1')]);
    await enqueueFaultCreate({
      userId: 'user-1',
      tenantId: 'tenant-a',
      payload: {
        equipmentId: 'eq-a',
        description: 'Tenant A arizasi',
        priority: FaultPriority.LOW,
      },
    });

    const equipmentB = await listCachedEquipment('user-1', 'tenant-b');
    const opsB = await listPendingOperations('user-1', 'tenant-b');
    expect(equipmentB.map((row) => row.code)).toEqual(['B-1']);
    expect(opsB).toHaveLength(0);

    const equipmentOtherUser = await listCachedEquipment('user-2', 'tenant-a');
    expect(equipmentOtherUser).toHaveLength(0);
  });

  it('synced islem tekrar sync edilmez', async () => {
    const op = await enqueueFaultCreate({
      userId: 'user-1',
      tenantId: 'tenant-a',
      payload: {
        equipmentId: 'eq-1',
        description: 'Zaten synced',
        priority: FaultPriority.LOW,
      },
    });
    await updateOperation(op.operationId, { status: 'synced', serverEntityId: 'f-1' });
    const result = await runSync('user-1', 'tenant-a');
    expect(result.pushed).toBe(0);
    expect(mockedApi).not.toHaveBeenCalled();
  });
});
