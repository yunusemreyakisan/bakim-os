import { FaultPriority, MembershipRole, SyncResultStatus } from '@bakimos/api-contracts';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { TRUNCATE_SQL } from './truncate';

const PASSWORD = 'Password1234';

describe('Sync push API', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      TRUNCATE_SQL,
    );
  });

  it('yetkili kullanıcı geçerli offline arıza işlemini push eder', async () => {
    const tenant = await provision('sync-ok', 'sync-ok@example.com');
    const auth = await login('sync-ok@example.com');
    const equipment = await createEquipment(auth, tenant);
    const operationId = randomUUID();

    const response = await request(server)
      .post('/api/v1/sync/push')
      .set(authHeaders(auth, tenant.tenant.id))
      .send({
        deviceId: 'device-sync-01',
        operations: [
          {
            operationId,
            type: 'FAULT_CREATE',
            clientCreatedAt: new Date().toISOString(),
            payload: {
              equipmentId: equipment.id,
              description: 'Offline ariza bildirimi',
              priority: FaultPriority.HIGH,
            },
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.results).toHaveLength(1);
    expect(response.body.data.results[0].status).toBe(SyncResultStatus.APPLIED);
    expect(response.body.data.results[0].entityId).toBeTruthy();

    const faults = await prisma.fault.findMany({ where: { tenantId: tenant.tenant.id } });
    expect(faults).toHaveLength(1);
    expect(faults[0]?.reporterId).toBe(tenant.admin.id);
    expect(faults[0]?.description).toBe('Offline ariza bildirimi');
  });

  it('baska tenant ekipmani icin islemi reddeder', async () => {
    const first = await provision('sync-a', 'sync-a@example.com');
    const second = await provision('sync-b', 'sync-b@example.com');
    const authA = await login('sync-a@example.com');
    const authB = await login('sync-b@example.com');
    const equipmentA = await createEquipment(authA, first);

    const response = await request(server)
      .post('/api/v1/sync/push')
      .set(authHeaders(authB, second.tenant.id))
      .send({
        deviceId: 'device-sync-02',
        operations: [
          {
            operationId: randomUUID(),
            type: 'FAULT_CREATE',
            clientCreatedAt: new Date().toISOString(),
            payload: {
              equipmentId: equipmentA.id,
              description: 'Yabanci ekipman',
              priority: FaultPriority.MEDIUM,
            },
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.results[0].status).toBe(SyncResultStatus.REJECTED);
    expect(response.body.data.results[0].code).toBe('EQUIPMENT_NOT_FOUND');
    const count = await prisma.fault.count();
    expect(count).toBe(0);
  });

  it('gecersiz veya eksik payload reddeder', async () => {
    const tenant = await provision('sync-bad', 'sync-bad@example.com');
    const auth = await login('sync-bad@example.com');
    const equipment = await createEquipment(auth, tenant);

    const response = await request(server)
      .post('/api/v1/sync/push')
      .set(authHeaders(auth, tenant.tenant.id))
      .send({
        deviceId: 'device-sync-03',
        operations: [
          {
            operationId: randomUUID(),
            type: 'FAULT_CREATE',
            clientCreatedAt: new Date().toISOString(),
            payload: {
              equipmentId: equipment.id,
              description: 'x',
              priority: FaultPriority.LOW,
            },
          },
        ],
      });

    expect(response.status).toBe(400);
  });

  it('ayni operationId ikinci ariza olusturmaz', async () => {
    const tenant = await provision('sync-dup', 'sync-dup@example.com');
    const auth = await login('sync-dup@example.com');
    const equipment = await createEquipment(auth, tenant);
    const operationId = randomUUID();
    const body = {
      deviceId: 'device-sync-04',
      operations: [
        {
          operationId,
          type: 'FAULT_CREATE',
          clientCreatedAt: new Date().toISOString(),
          payload: {
            equipmentId: equipment.id,
            description: 'Tekrar gonderim',
            priority: FaultPriority.MEDIUM,
          },
        },
      ],
    };

    const first = await request(server)
      .post('/api/v1/sync/push')
      .set(authHeaders(auth, tenant.tenant.id))
      .send(body);
    const second = await request(server)
      .post('/api/v1/sync/push')
      .set(authHeaders(auth, tenant.tenant.id))
      .send(body);

    expect(first.body.data.results[0].status).toBe(SyncResultStatus.APPLIED);
    expect(second.body.data.results[0].status).toBe(SyncResultStatus.DUPLICATE);
    expect(second.body.data.results[0].entityId).toBe(first.body.data.results[0].entityId);
    expect(await prisma.fault.count()).toBe(1);
  });

  it('ayni operationId farkli payload ile cakisma dondurur', async () => {
    const tenant = await provision('sync-conflict', 'sync-conflict@example.com');
    const auth = await login('sync-conflict@example.com');
    const equipment = await createEquipment(auth, tenant);
    const operationId = randomUUID();

    await request(server)
      .post('/api/v1/sync/push')
      .set(authHeaders(auth, tenant.tenant.id))
      .send({
        deviceId: 'device-sync-05',
        operations: [
          {
            operationId,
            type: 'FAULT_CREATE',
            clientCreatedAt: new Date().toISOString(),
            payload: {
              equipmentId: equipment.id,
              description: 'Ilk aciklama metni',
              priority: FaultPriority.LOW,
            },
          },
        ],
      })
      .expect(200);

    const conflict = await request(server)
      .post('/api/v1/sync/push')
      .set(authHeaders(auth, tenant.tenant.id))
      .send({
        deviceId: 'device-sync-05',
        operations: [
          {
            operationId,
            type: 'FAULT_CREATE',
            clientCreatedAt: new Date().toISOString(),
            payload: {
              equipmentId: equipment.id,
              description: 'Farkli aciklama metni',
              priority: FaultPriority.CRITICAL,
            },
          },
        ],
      });

    expect(conflict.body.data.results[0].status).toBe(SyncResultStatus.CONFLICT);
    expect(conflict.body.data.results[0].code).toBe('PAYLOAD_CONFLICT');
    expect(await prisma.fault.count()).toBe(1);
  });

  it('eszamanli yinelenen istekler cogaltmaz', async () => {
    const tenant = await provision('sync-race', 'sync-race@example.com');
    const auth = await login('sync-race@example.com');
    const equipment = await createEquipment(auth, tenant);
    const operationId = randomUUID();
    const body = {
      deviceId: 'device-sync-06',
      operations: [
        {
          operationId,
          type: 'FAULT_CREATE',
          clientCreatedAt: new Date().toISOString(),
          payload: {
            equipmentId: equipment.id,
            description: 'Yaris durumu arizasi',
            priority: FaultPriority.HIGH,
          },
        },
      ],
    };

    const [a, b] = await Promise.all([
      request(server).post('/api/v1/sync/push').set(authHeaders(auth, tenant.tenant.id)).send(body),
      request(server).post('/api/v1/sync/push').set(authHeaders(auth, tenant.tenant.id)).send(body),
    ]);

    const statuses = [a.body.data.results[0].status, b.body.data.results[0].status].sort();
    expect(statuses).toEqual([SyncResultStatus.APPLIED, SyncResultStatus.DUPLICATE].sort());
    expect(await prisma.fault.count()).toBe(1);
  });

  it('istekteki sahte kullanici/tenant bilgileri yetkiyi degistirmez', async () => {
    const first = await provision('sync-fake', 'sync-fake@example.com');
    const second = await provision('sync-fake-b', 'sync-fake-b@example.com');
    const auth = await login('sync-fake@example.com');
    const equipment = await createEquipment(auth, first);

    const response = await request(server)
      .post('/api/v1/sync/push')
      .set(authHeaders(auth, first.tenant.id))
      .send({
        deviceId: 'device-sync-07',
        tenantId: second.tenant.id,
        userId: second.admin.id,
        reporterId: second.admin.id,
        operations: [
          {
            operationId: randomUUID(),
            type: 'FAULT_CREATE',
            clientCreatedAt: new Date().toISOString(),
            payload: {
              equipmentId: equipment.id,
              description: 'Sahte alanlar yok sayilmali',
              priority: FaultPriority.MEDIUM,
            },
          },
        ],
      });

    expect(response.status).toBe(400);
  });

  it('uyeligi iptal edilmis kullanici senkronize edemez', async () => {
    const tenant = await provision('sync-revoked', 'sync-revoked@example.com');
    await addMember(tenant, 'sync-op@example.com', MembershipRole.OPERATOR);
    const auth = await login('sync-op@example.com');
    const equipment = await createEquipment(await login('sync-revoked@example.com'), tenant);

    await prisma.membership.deleteMany({
      where: { tenantId: tenant.tenant.id, user: { email: 'sync-op@example.com' } },
    });

    const response = await request(server)
      .post('/api/v1/sync/push')
      .set(authHeaders(auth, tenant.tenant.id))
      .send({
        deviceId: 'device-sync-08',
        operations: [
          {
            operationId: randomUUID(),
            type: 'FAULT_CREATE',
            clientCreatedAt: new Date().toISOString(),
            payload: {
              equipmentId: equipment.id,
              description: 'Yetkisiz senkron',
              priority: FaultPriority.LOW,
            },
          },
        ],
      });

    expect(response.status).toBe(403);
  });

  async function login(email: string) {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    expect(response.status).toBe(200);
    return response;
  }

  async function provision(slug: string, email: string) {
    const response = await request(server)
      .post('/api/v1/tenants')
      .set('X-Bootstrap-Token', process.env.TENANT_BOOTSTRAP_TOKEN ?? '')
      .send({
        name: slug,
        slug,
        admin: { email, name: 'Yonetici', password: PASSWORD },
        site: { name: 'Ana Tesis', timezone: 'Europe/Istanbul' },
      });
    expect(response.status).toBe(201);
    return response.body.data as {
      tenant: { id: string };
      site: { id: string };
      admin: { id: string; email: string };
    };
  }

  async function addMember(
    tenant: { tenant: { id: string } },
    email: string,
    role: MembershipRole,
  ) {
    const adminEmail = (
      await prisma.membership.findFirst({
        where: { tenantId: tenant.tenant.id, role: 'SUPER_ADMIN' },
        include: { user: true },
      })
    )?.user.email;
    if (!adminEmail) throw new Error('admin missing');
    const admin = await login(adminEmail);
    const response = await request(server)
      .post('/api/v1/memberships')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ email, name: email, role, password: PASSWORD });
    expect(response.status).toBe(201);
  }

  async function createEquipment(
    auth: request.Response,
    tenant: { tenant: { id: string }; site: { id: string } },
  ) {
    const response = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(auth, tenant.tenant.id))
      .send({
        siteId: tenant.site.id,
        code: `EQ-${randomUUID().slice(0, 8)}`,
        name: 'Senkron makine',
      });
    expect(response.status).toBe(201);
    return response.body.data as { id: string };
  }
});

function bearer(response: request.Response): string {
  return `Bearer ${response.body.data.accessToken as string}`;
}

function authHeaders(response: request.Response, tenantId: string) {
  return { Authorization: bearer(response), 'X-Tenant-Id': tenantId };
}
