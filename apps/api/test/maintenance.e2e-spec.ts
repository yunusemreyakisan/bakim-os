import { MembershipRole } from '@bakimos/api-contracts';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { TRUNCATE_SQL } from './truncate';

const PASSWORD = 'Password1234';

describe('Periyodik bakım', () => {
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

  it('vadesi gelen plan için görev üretir, checklist olmadan tamamlamayı reddeder ve geçmişte görünür', async () => {
    const tenant = await provision('maint-ok', 'maint-ok@example.com');
    const admin = await login('maint-ok@example.com');
    await addMember(tenant, 'tech-m@example.com', MembershipRole.TECHNICIAN);
    const tech = await login('tech-m@example.com');
    const equipment = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ siteId: tenant.site.id, code: 'CNC-M', name: 'Pres' })
      .expect(201);

    const due = new Date(Date.now() - 60_000).toISOString();
    const plan = await request(server)
      .post('/api/v1/maintenance/plans')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({
        equipmentId: equipment.body.data.id,
        title: 'Haftalik yag',
        cadence: 'WEEKLY',
        interval: 1,
        nextDueAt: due,
        items: [{ label: 'Yag seviyesi', required: true }, { label: 'Not', required: false }],
      })
      .expect(201);

    const generated = await request(server)
      .post('/api/v1/maintenance/generate')
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(201);
    expect(generated.body.data.created).toBe(1);
    const taskId = generated.body.data.tasks[0].id as string;
    expect(generated.body.data.tasks[0].overdue).toBe(true);

    const overdue = await request(server)
      .get('/api/v1/maintenance/tasks?overdue=true')
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(200);
    expect(overdue.body.data).toHaveLength(1);

    await request(server)
      .post(`/api/v1/maintenance/tasks/${taskId}/complete`)
      .set(authHeaders(tech, tenant.tenant.id))
      .send({ version: 1 })
      .expect(400)
      .then((res) => expect(res.body.code).toBe('CHECKLIST_INCOMPLETE'));

    const itemId = generated.body.data.tasks[0].items[0].id as string;
    await request(server)
      .post(`/api/v1/maintenance/tasks/${taskId}/items/${itemId}`)
      .set(authHeaders(tech, tenant.tenant.id))
      .send({ checked: true })
      .expect(201);

    await request(server)
      .post(`/api/v1/maintenance/tasks/${taskId}/complete`)
      .set(authHeaders(tech, tenant.tenant.id))
      .send({ version: 1 })
      .expect(201);

    const history = await request(server)
      .get(`/api/v1/maintenance/tasks?equipmentId=${equipment.body.data.id}`)
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(200);
    expect(history.body.data[0].status).toBe('COMPLETED');
    expect(history.body.data[0].completedBy.email).toBe('tech-m@example.com');
    expect(plan.body.data.id).toBeTruthy();
  });

  it('baska tenant planini gizler ve depo plan yazamaz', async () => {
    const first = await provision('maint-a', 'maint-a@example.com');
    const second = await provision('maint-b', 'maint-b@example.com');
    const adminA = await login('maint-a@example.com');
    const adminB = await login('maint-b@example.com');
    await addMember(first, 'wh-m@example.com', MembershipRole.WAREHOUSE);
    const warehouse = await login('wh-m@example.com');
    const equipment = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(adminA, first.tenant.id))
      .send({ siteId: first.site.id, code: 'A-1', name: 'Makine A' })
      .expect(201);

    const plan = await request(server)
      .post('/api/v1/maintenance/plans')
      .set(authHeaders(adminA, first.tenant.id))
      .send({
        equipmentId: equipment.body.data.id,
        title: 'Plan A',
        cadence: 'DAILY',
        nextDueAt: new Date().toISOString(),
        items: [{ label: 'Kontrol' }],
      })
      .expect(201);

    await request(server)
      .get(`/api/v1/maintenance/plans/${plan.body.data.id}`)
      .set(authHeaders(adminB, second.tenant.id))
      .expect(404);

    await request(server)
      .post('/api/v1/maintenance/plans')
      .set(authHeaders(warehouse, first.tenant.id))
      .send({
        equipmentId: equipment.body.data.id,
        title: 'Depo plan',
        cadence: 'DAILY',
        nextDueAt: new Date().toISOString(),
        items: [{ label: 'X' }],
      })
      .expect(403);
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
    const admin = await login(
      (
        await prisma.membership.findFirst({
          where: { tenantId: tenant.tenant.id, role: 'SUPER_ADMIN' },
          include: { user: true },
        })
      )?.user.email ?? '',
    );
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
