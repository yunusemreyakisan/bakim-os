import { FaultPriority } from '@bakimos/api-contracts';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { TRUNCATE_SQL } from './truncate';

const PASSWORD = 'Password1234';

describe('Aktarım, QR PDF ve rapor', () => {
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

  it('excel ile ekipman aktarir, cakismayi raporlar ve QR PDF uretir', async () => {
    const tenant = await provision('imp', 'imp@example.com');
    const admin = await login('imp@example.com');
    await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ siteId: tenant.site.id, code: 'CNC-1', name: 'Var olan' })
      .expect(201);

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      { Kod: 'CNC-1', Ad: 'Tekrar', Site: 'Ana Tesis', Aciklama: '' },
      { Kod: 'CNC-2', Ad: 'Yeni torna', Site: 'Ana Tesis', Aciklama: 'Hat 2' },
      { Kod: 'CNC-3', Ad: 'Yok tesis', Site: 'Olmayan', Aciklama: '' },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Ekipman');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const imported = await request(server)
      .post('/api/v1/equipment/import')
      .set(authHeaders(admin, tenant.tenant.id))
      .attach('file', buffer, { filename: 'ekipman.xlsx' });
    expect(imported.status).toBe(201);
    expect(imported.body.data.created).toBe(1);
    expect(imported.body.data.skipped).toBe(1);
    expect(imported.body.data.failed).toBe(1);

    const list = await request(server)
      .get('/api/v1/equipment?search=CNC')
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(200);
    const ids = (list.body.data as Array<{ id: string }>).map((row) => row.id);
    const pdf = await request(server)
      .post('/api/v1/equipment/qr-pdf')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ equipmentIds: ids });
    expect(pdf.status).toBe(201);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.length).toBeGreaterThan(100);
  });

  it('KPI raporunda tarih filtresi zorunludur ve ariza sayisini doner', async () => {
    const tenant = await provision('rep', 'rep@example.com');
    const admin = await login('rep@example.com');
    const equipment = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ siteId: tenant.site.id, code: 'R-1', name: 'Rapor' })
      .expect(201);
    await request(server)
      .post('/api/v1/faults')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({
        equipmentId: equipment.body.data.id,
        description: 'Ilk ariza kaydi',
        priority: FaultPriority.HIGH,
      })
      .expect(201);

    await request(server)
      .get('/api/v1/reports/maintenance')
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(400);

    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 86_400_000).toISOString();
    const report = await request(server)
      .get(`/api/v1/reports/maintenance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(200);
    expect(report.body.data.faultCount).toBe(1);
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
    return response.body.data as { tenant: { id: string }; site: { id: string } };
  }
});

function bearer(response: request.Response): string {
  return `Bearer ${response.body.data.accessToken as string}`;
}

function authHeaders(response: request.Response, tenantId: string) {
  return { Authorization: bearer(response), 'X-Tenant-Id': tenantId };
}
