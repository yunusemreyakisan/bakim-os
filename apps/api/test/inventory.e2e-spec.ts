import { MembershipRole, StockReason } from '@bakimos/api-contracts';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Server } from 'http';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { TRUNCATE_SQL } from './truncate';

const PASSWORD = 'Password1234';

describe('Stok ve ekler', () => {
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
    await prisma.$executeRawUnsafe(TRUNCATE_SQL);
  });

  it('stok hareketini actor/neden/zaman ile kaydeder ve ayni operationId cogaltmaz', async () => {
    const tenant = await provision('stk', 'stk@example.com');
    const admin = await login('stk@example.com');
    const part = await request(server)
      .post('/api/v1/parts')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ code: 'BRG-1', name: 'Rulman', minQuantity: 2 })
      .expect(201);

    const operationId = randomUUID();
    const first = await request(server)
      .post('/api/v1/stock/movements')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({
        partId: part.body.data.id,
        reason: StockReason.RECEIPT,
        quantity: 5,
        operationId,
        note: 'Irsaliye 12',
      })
      .expect(201);
    const second = await request(server)
      .post('/api/v1/stock/movements')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({
        partId: part.body.data.id,
        reason: StockReason.RECEIPT,
        quantity: 5,
        operationId,
      })
      .expect(201);
    expect(second.body.data.id).toBe(first.body.data.id);

    const listed = await request(server)
      .get(`/api/v1/stock/movements?partId=${part.body.data.id}`)
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].actor.email).toBe('stk@example.com');
    expect(listed.body.data[0].reason).toBe(StockReason.RECEIPT);
    expect(listed.body.data[0].note).toBe('Irsaliye 12');

    const after = await request(server)
      .get(`/api/v1/parts/${part.body.data.id}`)
      .set(authHeaders(admin, tenant.tenant.id));
    expect(after.body.data.quantity).toBe(5);
  });

  it('eszamanli cikis bakiyeyi bozmaz', async () => {
    const tenant = await provision('stk-race', 'stk-race@example.com');
    const admin = await login('stk-race@example.com');
    const part = await request(server)
      .post('/api/v1/parts')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ code: 'FLT-1', name: 'Filtre' })
      .expect(201);
    await request(server)
      .post('/api/v1/stock/movements')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ partId: part.body.data.id, reason: StockReason.RECEIPT, quantity: 1 })
      .expect(201);

    const [a, b] = await Promise.all([
      request(server)
        .post('/api/v1/stock/movements')
        .set(authHeaders(admin, tenant.tenant.id))
        .send({ partId: part.body.data.id, reason: StockReason.ISSUE, quantity: 1 }),
      request(server)
        .post('/api/v1/stock/movements')
        .set(authHeaders(admin, tenant.tenant.id))
        .send({ partId: part.body.data.id, reason: StockReason.ISSUE, quantity: 1 }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const final = await request(server)
      .get(`/api/v1/parts/${part.body.data.id}`)
      .set(authHeaders(admin, tenant.tenant.id));
    expect(final.body.data.quantity).toBe(0);
  });

  it('operator stok dusemez, depo is emrine parca baglar', async () => {
    const tenant = await provision('stk-role', 'stk-role@example.com');
    const admin = await login('stk-role@example.com');
    await addMember(tenant, 'op-s@example.com', MembershipRole.OPERATOR);
    await addMember(tenant, 'wh-s@example.com', MembershipRole.WAREHOUSE);
    const operator = await login('op-s@example.com');
    const warehouse = await login('wh-s@example.com');
    const equipment = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ siteId: tenant.site.id, code: 'EQ-S', name: 'Hat' })
      .expect(201);
    const fault = await request(server)
      .post('/api/v1/faults')
      .set(authHeaders(operator, tenant.tenant.id))
      .send({ equipmentId: equipment.body.data.id, description: 'Ses geliyor', priority: 'MEDIUM' })
      .expect(201);
    const workOrder = await request(server)
      .post('/api/v1/work-orders')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ faultId: fault.body.data.id })
      .expect(201);
    const part = await request(server)
      .post('/api/v1/parts')
      .set(authHeaders(warehouse, tenant.tenant.id))
      .send({ code: 'BLT-1', name: 'Kayis' })
      .expect(201);
    await request(server)
      .post('/api/v1/stock/movements')
      .set(authHeaders(warehouse, tenant.tenant.id))
      .send({ partId: part.body.data.id, reason: StockReason.RECEIPT, quantity: 3 })
      .expect(201);

    await request(server)
      .post('/api/v1/stock/movements')
      .set(authHeaders(operator, tenant.tenant.id))
      .send({ partId: part.body.data.id, reason: StockReason.ISSUE, quantity: 1 })
      .expect(403);

    await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/parts`)
      .set(authHeaders(warehouse, tenant.tenant.id))
      .send({ partId: part.body.data.id, quantity: 1 })
      .expect(201);

    const uses = await request(server)
      .get(`/api/v1/work-orders/${workOrder.body.data.id}/parts`)
      .set(authHeaders(warehouse, tenant.tenant.id))
      .expect(200);
    expect(uses.body.data).toHaveLength(1);

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const upload = await request(server)
      .post('/api/v1/attachments')
      .set(authHeaders(operator, tenant.tenant.id))
      .field('entityType', 'fault')
      .field('entityId', fault.body.data.id)
      .attach('file', png, { filename: 'photo.png', contentType: 'image/png' })
      .expect(201);
    expect(upload.body.data.fileName).toBe('photo.png');
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
    const admin = await login(adminEmail ?? '');
    await request(server)
      .post('/api/v1/memberships')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ email, name: email, role, password: PASSWORD })
      .expect(201);
  }
});

function bearer(response: request.Response): string {
  return `Bearer ${response.body.data.accessToken as string}`;
}

function authHeaders(response: request.Response, tenantId: string) {
  return { Authorization: bearer(response), 'X-Tenant-Id': tenantId };
}
