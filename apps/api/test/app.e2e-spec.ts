import { MembershipRole, FaultPriority } from '@bakimos/api-contracts';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { INVALID_CREDENTIALS_MESSAGE } from '../src/auth/auth.constants';
import { createApp } from '../src/bootstrap';
import { REFRESH_COOKIE } from '../src/common/cookies';
import { PrismaService } from '../src/prisma/prisma.service';
import { TRUNCATE_SQL } from './truncate';

const PASSWORD = 'Password1234';

describe('BakımOS API', () => {
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

  it('sağlık ucu veritabanını doğrular', async () => {
    const response = await request(server).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.data.database).toBe('up');
  });

  it('hatalı ve bilinmeyen girişte aynı mesajı döner', async () => {
    await provision('giris-a', 'admin-a@example.com');
    const unknown = await request(server).post('/api/v1/auth/login').send({
      email: 'yok@example.com',
      password: PASSWORD,
    });
    const wrong = await request(server).post('/api/v1/auth/login').send({
      email: 'admin-a@example.com',
      password: 'WrongPassword1',
    });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.message).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(wrong.body.message).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it('oturumsuz me çağrısını reddeder, refresh döndürür ve çıkışta oturumu düşürür', async () => {
    await provision('oturum', 'admin-session@example.com');
    const unauthenticated = await request(server).get('/api/v1/me');
    expect(unauthenticated.status).toBe(401);

    const login = await request(server).post('/api/v1/auth/login').send({
      email: 'admin-session@example.com',
      password: PASSWORD,
    });
    expect(login.status).toBe(200);
    const cookie = cookieOf(login);
    expect(cookie.startsWith(`${REFRESH_COOKIE}=`)).toBe(true);
    const setCookie = login.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie ?? '');
    expect(cookieHeader).toContain('HttpOnly');
    const access = login.body.data.accessToken as string;

    const me = await request(server).get('/api/v1/me').set('Authorization', `Bearer ${access}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('admin-session@example.com');
    expect(me.body.data.memberships).toHaveLength(1);

    const refreshed = await request(server).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshed.status).toBe(200);
    const rotated = cookieOf(refreshed);
    const reused = await request(server).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(reused.status).toBe(401);
    const afterReuse = await request(server).post('/api/v1/auth/refresh').set('Cookie', rotated);
    expect(afterReuse.status).toBe(401);

    const again = await request(server).post('/api/v1/auth/login').send({
      email: 'admin-session@example.com',
      password: PASSWORD,
    });
    const activeCookie = cookieOf(again);
    const logout = await request(server).post('/api/v1/auth/logout').set('Cookie', activeCookie);
    expect(logout.status).toBe(204);
    const afterLogout = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', activeCookie);
    expect(afterLogout.status).toBe(401);
  });

  it('kurulum jetonu olmadan şirket oluşturmayı reddeder', async () => {
    const response = await request(server)
      .post('/api/v1/tenants')
      .send({
        name: 'Gizli',
        slug: 'gizli',
        admin: { email: 'x@example.com', name: 'X', password: PASSWORD },
      });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('BOOTSTRAP_UNAUTHORIZED');
  });

  it('kiracı verisini ayırır ve gövdedeki tenant kimliğini kabul etmez', async () => {
    const first = await provision('fabrika-a', 'admin-a2@example.com');
    const second = await provision('fabrika-b', 'admin-b2@example.com');
    const loginA = await login('admin-a2@example.com');
    const loginB = await login('admin-b2@example.com');

    const created = await request(server)
      .post('/api/v1/equipment')
      .set('Authorization', bearer(loginA))
      .set('X-Tenant-Id', first.tenant.id)
      .send({ siteId: first.site.id, code: 'PRES-1', name: 'Pres', description: 'Hat' });
    expect(created.status).toBe(201);
    const equipmentId = created.body.data.id as string;
    const qrPublicId = created.body.data.qrPublicId as string;
    expect(created.body.data.qrUrl).toContain(`/q/${qrPublicId}`);

    const injected = await request(server)
      .post('/api/v1/equipment')
      .set('Authorization', bearer(loginB))
      .set('X-Tenant-Id', second.tenant.id)
      .send({ siteId: second.site.id, code: 'OK-1', name: 'Makine', tenantId: first.tenant.id });
    expect(injected.status).toBe(400);

    const foreignHeader = await request(server)
      .get('/api/v1/equipment')
      .set('Authorization', bearer(loginB))
      .set('X-Tenant-Id', first.tenant.id);
    expect(foreignHeader.status).toBe(403);

    const hidden = await request(server)
      .get(`/api/v1/equipment/${equipmentId}`)
      .set('Authorization', bearer(loginB))
      .set('X-Tenant-Id', second.tenant.id);
    expect(hidden.status).toBe(404);

    const listB = await request(server)
      .get('/api/v1/equipment')
      .set('Authorization', bearer(loginB))
      .set('X-Tenant-Id', second.tenant.id);
    expect(listB.status).toBe(200);
    expect(listB.body.data).toEqual([]);

    const qrDenied = await request(server)
      .get(`/api/v1/equipment/by-qr/${qrPublicId}`)
      .set('Authorization', bearer(loginB));
    expect(qrDenied.status).toBe(404);

    const qrAllowed = await request(server)
      .get(`/api/v1/equipment/by-qr/${qrPublicId}`)
      .set('Authorization', bearer(loginA));
    expect(qrAllowed.status).toBe(200);
    expect(qrAllowed.body.data.id).toBe(equipmentId);
  });

  it('aynı kullanıcının iki şirket listesini karıştırmaz', async () => {
    const first = await provision('coklu-a', 'shared@example.com');
    const second = await provision('coklu-b', 'owner-b@example.com');
    const owner = await login('owner-b@example.com');
    await request(server)
      .post('/api/v1/memberships')
      .set('Authorization', bearer(owner))
      .set('X-Tenant-Id', second.tenant.id)
      .send({ email: 'shared@example.com', name: 'Paylasilan', role: MembershipRole.TECHNICIAN })
      .expect(201);

    const shared = await login('shared@example.com');
    await request(server)
      .post('/api/v1/equipment')
      .set('Authorization', bearer(shared))
      .set('X-Tenant-Id', first.tenant.id)
      .send({ siteId: first.site.id, code: 'A-1', name: 'Makine A' })
      .expect(201);

    const inSecond = await request(server)
      .get('/api/v1/equipment')
      .set('Authorization', bearer(shared))
      .set('X-Tenant-Id', second.tenant.id);
    expect(inSecond.body.data).toEqual([]);
  });

  it('kod benzersizliğini, QR kararlılığını ve sürüm çakışmasını korur', async () => {
    const tenant = await provision('ekipman', 'maint@example.com');
    const manager = await addMember(
      tenant,
      'maint-user@example.com',
      MembershipRole.MAINTENANCE_MANAGER,
    );
    const auth = await login('maint-user@example.com');
    const created = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(auth, tenant.tenant.id))
      .send({ siteId: tenant.site.id, code: 'cnc-9', name: 'Torna' })
      .expect(201);
    expect(created.body.data.code).toBe('CNC-9');
    const duplicate = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(auth, tenant.tenant.id))
      .send({ siteId: tenant.site.id, code: 'CNC-9', name: 'Diger' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('EQUIPMENT_CODE_TAKEN');

    const updated = await request(server)
      .patch(`/api/v1/equipment/${created.body.data.id}`)
      .set(authHeaders(auth, tenant.tenant.id))
      .send({ version: created.body.data.version, name: 'Torna Yeni' })
      .expect(200);
    expect(updated.body.data.qrPublicId).toBe(created.body.data.qrPublicId);
    expect(updated.body.data.name).toBe('Torna Yeni');
    expect(updated.body.data.version).toBe(created.body.data.version + 1);

    const conflict = await request(server)
      .patch(`/api/v1/equipment/${created.body.data.id}`)
      .set(authHeaders(auth, tenant.tenant.id))
      .send({ version: created.body.data.version, name: 'Eski' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('VERSION_CONFLICT');
    expect(manager.email).toBe('maint-user@example.com');
  });

  it('rol sınırlarını ve arıza kaydını sunucu tarafında tutar', async () => {
    const tenant = await provision('ariza', 'admin-fault@example.com');
    const admin = await login('admin-fault@example.com');
    const equipment = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ siteId: tenant.site.id, code: 'HAT-1', name: 'Hat' })
      .expect(201);

    await addMember(tenant, 'operator@example.com', MembershipRole.OPERATOR);
    await addMember(tenant, 'warehouse@example.com', MembershipRole.WAREHOUSE);
    const operator = await login('operator@example.com');
    const warehouse = await login('warehouse@example.com');

    const deniedEquipment = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(operator, tenant.tenant.id))
      .send({ siteId: tenant.site.id, code: 'YETKISIZ', name: 'Hayir' });
    expect(deniedEquipment.status).toBe(403);

    const forgedReporter = await request(server)
      .post('/api/v1/faults')
      .set(authHeaders(operator, tenant.tenant.id))
      .send({
        equipmentId: equipment.body.data.id,
        description: 'Hidrolik kacak',
        priority: FaultPriority.HIGH,
        reporterId: tenant.admin.id,
      });
    expect(forgedReporter.status).toBe(400);

    const fault = await request(server)
      .post('/api/v1/faults')
      .set(authHeaders(operator, tenant.tenant.id))
      .send({
        equipmentId: equipment.body.data.id,
        description: 'Hidrolik kacak',
        priority: FaultPriority.HIGH,
      })
      .expect(201);
    expect(fault.body.data.reporterId).toBe(operator.body.data.user.id);
    expect(fault.body.data.status).toBe('OPEN');

    const warehouseFault = await request(server)
      .post('/api/v1/faults')
      .set(authHeaders(warehouse, tenant.tenant.id))
      .send({
        equipmentId: equipment.body.data.id,
        description: 'Depo goremez',
        priority: FaultPriority.LOW,
      });
    expect(warehouseFault.status).toBe(403);

    const other = await provision('ariza-b', 'other-admin@example.com');
    const otherLogin = await login('other-admin@example.com');
    const cross = await request(server)
      .post('/api/v1/faults')
      .set(authHeaders(otherLogin, other.tenant.id))
      .send({
        equipmentId: equipment.body.data.id,
        description: 'Baska sirket',
        priority: FaultPriority.LOW,
      });
    expect(cross.status).toBe(404);

    const logs = await prisma.auditLog.findMany({ where: { entityId: fault.body.data.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe('fault.created');
    expect(JSON.stringify(logs[0]?.metadata)).not.toContain(PASSWORD);

    const foreignSite = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ siteId: other.site.id, code: 'YABANCI', name: 'Yabanci' });
    expect(foreignSite.status).toBe(400);
    expect(foreignSite.body.code).toBe('SITE_NOT_IN_TENANT');
  });

  it('devre dışı kullanıcıya giriş vermez', async () => {
    await provision('kapali', 'disabled@example.com');
    await prisma.user.update({
      where: { email: 'disabled@example.com' },
      data: { status: 'DISABLED' },
    });
    const response = await request(server).post('/api/v1/auth/login').send({
      email: 'disabled@example.com',
      password: PASSWORD,
    });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe(INVALID_CREDENTIALS_MESSAGE);
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
    return response.body.data as { email: string };
  }
});

function bearer(response: request.Response): string {
  return `Bearer ${response.body.data.accessToken as string}`;
}

function authHeaders(response: request.Response, tenantId: string) {
  return { Authorization: bearer(response), 'X-Tenant-Id': tenantId };
}

function cookieOf(response: request.Response): string {
  const header = response.headers['set-cookie'];
  const list = Array.isArray(header) ? header : header ? [header] : [];
  const found = list.find((item) => item.startsWith(`${REFRESH_COOKIE}=`));
  if (!found) throw new Error('Refresh cookie yok.');
  return found.split(';')[0] ?? found;
}
