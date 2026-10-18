import {
  FaultPriority,
  MembershipRole,
  WorkActivityKind,
  WorkOrderStatus,
} from '@bakimos/api-contracts';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { TRUNCATE_SQL } from './truncate';

const PASSWORD = 'Password1234';

describe('İş emri ve arıza yaşam döngüsü', () => {
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

  it('arıza → iş emri → atama → işlem → tamamlama yolunu ve denetimi tutar', async () => {
    const tenant = await provision('wo-happy', 'admin-wo@example.com');
    const admin = await login('admin-wo@example.com');
    await addMember(tenant, 'operator-wo@example.com', MembershipRole.OPERATOR);
    await addMember(tenant, 'tech-wo@example.com', MembershipRole.TECHNICIAN);
    const operator = await login('operator-wo@example.com');
    const technician = await login('tech-wo@example.com');
    const techUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'tech-wo@example.com' },
    });

    const equipment = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ siteId: tenant.site.id, code: 'HAT-WO', name: 'Hat' })
      .expect(201);

    const fault = await request(server)
      .post('/api/v1/faults')
      .set(authHeaders(operator, tenant.tenant.id))
      .send({
        equipmentId: equipment.body.data.id,
        description: 'Motor asiri isiniyor',
        priority: FaultPriority.HIGH,
      })
      .expect(201);

    await request(server)
      .post(`/api/v1/faults/${fault.body.data.id}/acknowledge`)
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(201)
      .then((response) => expect(response.body.data.status).toBe('ACKNOWLEDGED'));

    const created = await request(server)
      .post('/api/v1/work-orders')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ faultId: fault.body.data.id, tenantId: tenant.tenant.id })
      .expect(400);

    expect(created.body.code).toBe('VALIDATION_ERROR');

    const workOrder = await request(server)
      .post('/api/v1/work-orders')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ faultId: fault.body.data.id })
      .expect(201);
    expect(workOrder.body.data.number).toBe('WO-00001');
    expect(workOrder.body.data.status).toBe(WorkOrderStatus.OPEN);
    expect(workOrder.body.data.equipmentId).toBe(equipment.body.data.id);

    const afterCreate = await request(server)
      .get(`/api/v1/faults/${fault.body.data.id}`)
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(200);
    expect(afterCreate.body.data.status).toBe('ACKNOWLEDGED');
    expect(afterCreate.body.data.workOrders).toHaveLength(1);

    const assigned = await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/assign`)
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ assigneeId: techUser.id, version: workOrder.body.data.version })
      .expect(201);
    expect(assigned.body.data.assignee.email).toBe('tech-wo@example.com');

    const started = await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/transition`)
      .set(authHeaders(technician, tenant.tenant.id))
      .send({ status: WorkOrderStatus.IN_PROGRESS, version: assigned.body.data.version })
      .expect(201);
    expect(started.body.data.status).toBe(WorkOrderStatus.IN_PROGRESS);

    const earlyComplete = await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/transition`)
      .set(authHeaders(technician, tenant.tenant.id))
      .send({ status: WorkOrderStatus.COMPLETED, version: started.body.data.version });
    expect(earlyComplete.status).toBe(409);
    expect(earlyComplete.body.code).toBe('ACTIVITY_REQUIRED');

    await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/activities`)
      .set(authHeaders(technician, tenant.tenant.id))
      .send({
        kind: WorkActivityKind.ACTION,
        description: 'Fan temizlendi ve rulman kontrol edildi',
      })
      .expect(201);

    const completed = await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/transition`)
      .set(authHeaders(technician, tenant.tenant.id))
      .send({ status: WorkOrderStatus.COMPLETED, version: started.body.data.version })
      .expect(201);
    expect(completed.body.data.status).toBe(WorkOrderStatus.COMPLETED);

    const resolved = await request(server)
      .get(`/api/v1/faults/${fault.body.data.id}`)
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(200);
    expect(resolved.body.data.status).toBe('RESOLVED');

    const closed = await request(server)
      .post(`/api/v1/faults/${fault.body.data.id}/close`)
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(201);
    expect(closed.body.data.status).toBe('CLOSED');

    const logs = await prisma.auditLog.findMany({
      where: { tenantId: tenant.tenant.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        'fault.created',
        'fault.acknowledged',
        'work_order.created',
        'work_order.assigned',
        'work_order.transitioned',
        'work_order.activity_added',
        'fault.status_changed',
        'fault.closed',
      ]),
    );
    expect(JSON.stringify(logs)).not.toContain(PASSWORD);
  });

  it('geçersiz geçişleri, rol ve kiracı sınırlarını reddeder', async () => {
    const tenant = await provision('wo-sec', 'admin-sec@example.com');
    const other = await provision('wo-other', 'admin-other@example.com');
    const admin = await login('admin-sec@example.com');
    const otherAdmin = await login('admin-other@example.com');
    await addMember(tenant, 'op-sec@example.com', MembershipRole.OPERATOR);
    await addMember(tenant, 'wh-sec@example.com', MembershipRole.WAREHOUSE);
    await addMember(tenant, 'tech-sec@example.com', MembershipRole.TECHNICIAN);
    const operator = await login('op-sec@example.com');
    const warehouse = await login('wh-sec@example.com');
    const technician = await login('tech-sec@example.com');
    const techUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'tech-sec@example.com' },
    });
    const otherTech = await addMember(other, 'tech-other@example.com', MembershipRole.TECHNICIAN);
    const otherTechUser = await prisma.user.findUniqueOrThrow({
      where: { email: otherTech.email },
    });

    const equipment = await request(server)
      .post('/api/v1/equipment')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ siteId: tenant.site.id, code: 'SEC-1', name: 'Sek' })
      .expect(201);
    const fault = await request(server)
      .post('/api/v1/faults')
      .set(authHeaders(operator, tenant.tenant.id))
      .send({
        equipmentId: equipment.body.data.id,
        description: 'Kayis koptu',
        priority: FaultPriority.MEDIUM,
      })
      .expect(201);

    const operatorCreate = await request(server)
      .post('/api/v1/work-orders')
      .set(authHeaders(operator, tenant.tenant.id))
      .send({ faultId: fault.body.data.id });
    expect(operatorCreate.status).toBe(403);

    const workOrder = await request(server)
      .post('/api/v1/work-orders')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ faultId: fault.body.data.id })
      .expect(201);

    const startBare = await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/transition`)
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ status: WorkOrderStatus.IN_PROGRESS, version: workOrder.body.data.version });
    expect(startBare.status).toBe(409);
    expect(startBare.body.code).toBe('ASSIGNEE_REQUIRED');

    const jump = await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/transition`)
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ status: WorkOrderStatus.COMPLETED, version: workOrder.body.data.version });
    expect(jump.status).toBe(409);
    expect(jump.body.code).toBe('INVALID_WORK_ORDER_TRANSITION');

    const techAssign = await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/assign`)
      .set(authHeaders(technician, tenant.tenant.id))
      .send({ assigneeId: techUser.id, version: workOrder.body.data.version });
    expect(techAssign.status).toBe(403);

    const foreignAssignee = await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/assign`)
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ assigneeId: otherTechUser.id, version: workOrder.body.data.version });
    expect(foreignAssignee.status).toBe(400);
    expect(foreignAssignee.body.code).toBe('ASSIGNEE_INVALID');

    const claimed = await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/claim`)
      .set(authHeaders(technician, tenant.tenant.id))
      .send({ version: workOrder.body.data.version })
      .expect(201);
    expect(claimed.body.data.assignee.email).toBe('tech-sec@example.com');

    const techCancel = await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/transition`)
      .set(authHeaders(technician, tenant.tenant.id))
      .send({ status: WorkOrderStatus.CANCELLED, version: claimed.body.data.version });
    expect(techCancel.status).toBe(403);

    const activeCancel = await request(server)
      .post(`/api/v1/faults/${fault.body.data.id}/cancel`)
      .set(authHeaders(admin, tenant.tenant.id));
    expect(activeCancel.status).toBe(409);
    expect(activeCancel.body.code).toBe('FAULT_HAS_ACTIVE_WORK_ORDER');

    const warehouseList = await request(server)
      .get('/api/v1/work-orders')
      .set(authHeaders(warehouse, tenant.tenant.id));
    expect(warehouseList.status).toBe(403);

    const hidden = await request(server)
      .get(`/api/v1/work-orders/${workOrder.body.data.id}`)
      .set(authHeaders(otherAdmin, other.tenant.id));
    expect(hidden.status).toBe(404);

    await request(server)
      .post(`/api/v1/work-orders/${workOrder.body.data.id}/transition`)
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ status: WorkOrderStatus.CANCELLED, version: claimed.body.data.version })
      .expect(201);

    const cancelledFault = await request(server)
      .post(`/api/v1/faults/${fault.body.data.id}/cancel`)
      .set(authHeaders(admin, tenant.tenant.id))
      .expect(201);
    expect(cancelledFault.body.data.status).toBe('CANCELLED');

    const reopen = await request(server)
      .post('/api/v1/work-orders')
      .set(authHeaders(admin, tenant.tenant.id))
      .send({ faultId: fault.body.data.id });
    expect(reopen.status).toBe(409);
    expect(reopen.body.code).toBe('FAULT_NOT_OPENABLE');
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
