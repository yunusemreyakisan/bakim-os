import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserStatus, WorkActivityKind, WorkOrderStatus } from '@prisma/client';
import type { MembershipRole, WorkOrderDetailDto } from '@bakimos/api-contracts';
import { AuditService } from '../audit/audit.service';
import { isAssignableRole, isManagerRole } from '../common/auth/permissions';
import { AppException } from '../common/errors/app.exception';
import { pageArgs, pageMeta } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { assertFaultTransition, canOpenWorkOrder, deriveFaultStatus } from '../faults/fault-status';
import type {
  AssignWorkOrderDto,
  CreateWorkActivityDto,
  CreateWorkOrderDto,
  ListWorkOrdersQuery,
  TransitionWorkOrderDto,
} from './dto/work-order.dto';
import { toWorkOrderDetailDto, toWorkOrderDto, type WorkOrderRow } from './work-order.presenter';
import {
  assertWorkOrderTransition,
  canAddActivity,
  canAssignInStatus,
  transitionTimestamps,
} from './work-order-status';

const workOrderInclude = {
  equipment: true,
  fault: true,
  assignee: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.WorkOrderInclude;

const workOrderDetailInclude = {
  ...workOrderInclude,
  activities: {
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.WorkOrderInclude;

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, actorId: string, query: ListWorkOrdersQuery) {
    const args = pageArgs(query.page, query.pageSize);
    const where: Prisma.WorkOrderWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.faultId ? { faultId: query.faultId } : {}),
      ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.mine ? { assigneeId: actorId } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.workOrder.count({ where }),
      this.prisma.workOrder.findMany({
        where,
        include: workOrderInclude,
        orderBy: { createdAt: 'desc' },
        skip: args.skip,
        take: args.take,
      }),
    ]);
    return {
      data: rows.map((row) => toWorkOrderDto(row)),
      meta: pageMeta(args.page, args.pageSize, total),
    };
  }

  async getById(
    tenantId: string,
    id: string,
    actor: { id: string; role: MembershipRole },
  ): Promise<WorkOrderDetailDto> {
    const row = await this.prisma.workOrder.findFirst({
      where: { id, tenantId },
      include: workOrderDetailInclude,
    });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, 'WORK_ORDER_NOT_FOUND', 'İş emri bulunamadı.');
    return toWorkOrderDetailDto(row, actor);
  }

  async listAssignees(tenantId: string) {
    const rows = await this.prisma.membership.findMany({
      where: {
        tenantId,
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'MAINTENANCE_MANAGER', 'TECHNICIAN'] },
        user: { status: UserStatus.ACTIVE },
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.role,
    }));
  }

  async create(
    tenantId: string,
    actorId: string,
    actor: { id: string; role: MembershipRole },
    dto: CreateWorkOrderDto,
  ): Promise<WorkOrderDetailDto> {
    return this.prisma.$transaction(async (tx) => {
      const fault = await tx.fault.findFirst({
        where: { id: dto.faultId, tenantId },
        include: { equipment: true },
      });
      if (!fault)
        throw new AppException(HttpStatus.NOT_FOUND, 'FAULT_NOT_FOUND', 'Arıza bulunamadı.');
      if (!canOpenWorkOrder(fault.status)) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'FAULT_NOT_OPENABLE',
          'Bu arızadan iş emri açılamaz.',
        );
      }
      const number = await nextWorkOrderNumber(tx, tenantId);
      const title = dto.title?.trim() || `${fault.equipment.code} arıza`;
      const created = await tx.workOrder.create({
        data: {
          tenantId,
          faultId: fault.id,
          equipmentId: fault.equipmentId,
          number,
          title,
          description: emptyToNull(dto.description),
          createdById: actorId,
          status: WorkOrderStatus.OPEN,
        },
        include: workOrderDetailInclude,
      });
      await this.syncFault(tx, tenantId, fault.id, actorId);
      await this.audit.write(tx, {
        tenantId,
        actorId,
        action: 'work_order.created',
        entityType: 'work_order',
        entityId: created.id,
        metadata: { faultId: fault.id, number },
      });
      const row = await this.reload(tx, tenantId, created.id);
      return toWorkOrderDetailDto(row, actor);
    });
  }

  async assign(
    tenantId: string,
    actorId: string,
    actor: { id: string; role: MembershipRole },
    id: string,
    dto: AssignWorkOrderDto,
  ): Promise<WorkOrderDetailDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lock(tx, tenantId, id);
      if (current.version !== dto.version) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'VERSION_CONFLICT',
          'İş emri başka bir işlemle güncellendi.',
        );
      }
      if (!canAssignInStatus(current.status)) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'WORK_ORDER_CLOSED',
          'Kapalı iş emrine atama yapılamaz.',
        );
      }
      await this.assertAssignable(tx, tenantId, dto.assigneeId);
      const count = await tx.workOrder.updateMany({
        where: { id, tenantId, version: dto.version },
        data: { assigneeId: dto.assigneeId, version: { increment: 1 } },
      });
      if (count.count !== 1) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'VERSION_CONFLICT',
          'İş emri başka bir işlemle güncellendi.',
        );
      }
      await this.audit.write(tx, {
        tenantId,
        actorId,
        action: 'work_order.assigned',
        entityType: 'work_order',
        entityId: id,
        metadata: { assigneeId: dto.assigneeId },
      });
      return toWorkOrderDetailDto(await this.reload(tx, tenantId, id), actor);
    });
  }

  async claim(
    tenantId: string,
    actorId: string,
    actor: { id: string; role: MembershipRole },
    id: string,
    version: number,
  ): Promise<WorkOrderDetailDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lock(tx, tenantId, id);
      if (current.version !== version) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'VERSION_CONFLICT',
          'İş emri başka bir işlemle güncellendi.',
        );
      }
      if (current.status !== WorkOrderStatus.OPEN) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'INVALID_WORK_ORDER_TRANSITION',
          'Yalnızca açık iş emri alınabilir.',
        );
      }
      if (current.assigneeId && current.assigneeId !== actorId) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'ALREADY_ASSIGNED',
          'İş emri başka birine atanmış.',
        );
      }
      await this.assertAssignable(tx, tenantId, actorId);
      const count = await tx.workOrder.updateMany({
        where: { id, tenantId, version, status: WorkOrderStatus.OPEN },
        data: { assigneeId: actorId, version: { increment: 1 } },
      });
      if (count.count !== 1) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'VERSION_CONFLICT',
          'İş emri başka bir işlemle güncellendi.',
        );
      }
      await this.audit.write(tx, {
        tenantId,
        actorId,
        action: 'work_order.claimed',
        entityType: 'work_order',
        entityId: id,
        metadata: { assigneeId: actorId },
      });
      return toWorkOrderDetailDto(await this.reload(tx, tenantId, id), actor);
    });
  }

  async transition(
    tenantId: string,
    actorId: string,
    actor: { id: string; role: MembershipRole },
    id: string,
    dto: TransitionWorkOrderDto,
  ): Promise<WorkOrderDetailDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lock(tx, tenantId, id);
      if (current.version !== dto.version) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'VERSION_CONFLICT',
          'İş emri başka bir işlemle güncellendi.',
        );
      }
      this.assertCanExecute(actor, current.assigneeId);
      const hasAction = current.activities.some((item) => item.kind === WorkActivityKind.ACTION);
      assertWorkOrderTransition({
        from: current.status,
        to: dto.status,
        hasAssignee: Boolean(current.assigneeId),
        hasAction,
        actorRole: actor.role,
      });
      const count = await tx.workOrder.updateMany({
        where: { id, tenantId, version: dto.version },
        data: {
          status: dto.status,
          version: { increment: 1 },
          ...transitionTimestamps(dto.status),
        },
      });
      if (count.count !== 1) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'VERSION_CONFLICT',
          'İş emri başka bir işlemle güncellendi.',
        );
      }
      await this.syncFault(tx, tenantId, current.faultId, actorId);
      await this.audit.write(tx, {
        tenantId,
        actorId,
        action: 'work_order.transitioned',
        entityType: 'work_order',
        entityId: id,
        metadata: { from: current.status, to: dto.status },
      });
      return toWorkOrderDetailDto(await this.reload(tx, tenantId, id), actor);
    });
  }

  async addActivity(
    tenantId: string,
    actorId: string,
    actor: { id: string; role: MembershipRole },
    id: string,
    dto: CreateWorkActivityDto,
  ): Promise<WorkOrderDetailDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lock(tx, tenantId, id);
      this.assertCanExecute(actor, current.assigneeId);
      if (!canAddActivity(current.status, dto.kind)) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'ACTIVITY_NOT_ALLOWED',
          'Bu durumda bakım işlemi yazılamaz.',
        );
      }
      await tx.workOrderActivity.create({
        data: {
          tenantId,
          workOrderId: id,
          actorId,
          kind: dto.kind,
          description: dto.description.trim(),
        },
      });
      await this.audit.write(tx, {
        tenantId,
        actorId,
        action: 'work_order.activity_added',
        entityType: 'work_order',
        entityId: id,
        metadata: { kind: dto.kind },
      });
      return toWorkOrderDetailDto(await this.reload(tx, tenantId, id), actor);
    });
  }

  private async lock(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    const row = await tx.workOrder.findFirst({
      where: { id, tenantId },
      include: { activities: true },
    });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, 'WORK_ORDER_NOT_FOUND', 'İş emri bulunamadı.');
    return row;
  }

  private async reload(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ): Promise<WorkOrderRow> {
    const row = await tx.workOrder.findFirst({
      where: { id, tenantId },
      include: workOrderDetailInclude,
    });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, 'WORK_ORDER_NOT_FOUND', 'İş emri bulunamadı.');
    return row;
  }

  private async assertAssignable(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const membership = await tx.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: { user: true },
    });
    if (
      !membership ||
      membership.user.status !== UserStatus.ACTIVE ||
      !isAssignableRole(membership.role)
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'ASSIGNEE_INVALID',
        'Atanan kişi bu şirket için uygun değil.',
      );
    }
  }

  private assertCanExecute(
    actor: { id: string; role: MembershipRole },
    assigneeId: string | null,
  ): void {
    if (isManagerRole(actor.role) || assigneeId === actor.id) return;
    throw new AppException(
      HttpStatus.FORBIDDEN,
      'ROLE_FORBIDDEN',
      'Bu iş emrini yalnızca atanan kişi veya yönetici işleyebilir.',
    );
  }

  private async syncFault(
    tx: Prisma.TransactionClient,
    tenantId: string,
    faultId: string,
    actorId: string,
  ): Promise<void> {
    const fault = await tx.fault.findFirst({
      where: { id: faultId, tenantId },
      include: { workOrders: { select: { status: true } } },
    });
    if (!fault) return;
    const next = deriveFaultStatus(
      fault.status,
      fault.workOrders.map((item) => item.status),
    );
    if (next === fault.status) return;
    try {
      assertFaultTransition(fault.status, next);
    } catch {
      return;
    }
    await tx.fault.update({ where: { id: fault.id }, data: { status: next } });
    await this.audit.write(tx, {
      tenantId,
      actorId,
      action: 'fault.status_changed',
      entityType: 'fault',
      entityId: fault.id,
      metadata: { from: fault.status, to: next },
    });
  }
}

async function nextWorkOrderNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string> {
  const sequence = await tx.tenantSequence.upsert({
    where: { tenantId_name: { tenantId, name: 'work_order' } },
    create: { tenantId, name: 'work_order', value: 1 },
    update: { value: { increment: 1 } },
  });
  return `WO-${String(sequence.value).padStart(5, '0')}`;
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
