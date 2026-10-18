import { HttpStatus, Injectable } from '@nestjs/common';
import { EquipmentStatus, Prisma, UserStatus } from '@prisma/client';
import type { MaintenancePlanDto, MaintenanceTaskDto } from '@bakimos/api-contracts';
import { AuditService } from '../audit/audit.service';
import { isAssignableRole } from '../common/auth/permissions';
import { AppException } from '../common/errors/app.exception';
import { pageArgs, pageMeta } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AssignMaintenanceTaskDto,
  CheckMaintenanceItemDto,
  CompleteMaintenanceTaskDto,
  CreateMaintenancePlanDto,
  ListMaintenancePlansQuery,
  ListMaintenanceTasksQuery,
  UpdateMaintenancePlanDto,
} from './dto/maintenance.dto';
import { catchUpNextDue } from './maintenance-schedule';
import { toMaintenancePlanDto, toMaintenanceTaskDto } from './maintenance.presenter';

const planInclude = {
  equipment: { select: { id: true, code: true, name: true } },
  assignee: { select: { id: true, name: true, email: true } },
  items: true,
} satisfies Prisma.MaintenancePlanInclude;

const taskInclude = {
  equipment: { select: { id: true, code: true, name: true } },
  assignee: { select: { id: true, name: true, email: true } },
  completedBy: { select: { id: true, name: true, email: true } },
  items: true,
} satisfies Prisma.MaintenanceTaskInclude;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPlans(tenantId: string, query: ListMaintenancePlansQuery) {
    const args = pageArgs(query.page, query.pageSize);
    const where: Prisma.MaintenancePlanWhereInput = {
      tenantId,
      ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.maintenancePlan.count({ where }),
      this.prisma.maintenancePlan.findMany({
        where,
        include: planInclude,
        orderBy: { nextDueAt: 'asc' },
        skip: args.skip,
        take: args.take,
      }),
    ]);
    return {
      data: rows.map(toMaintenancePlanDto),
      meta: pageMeta(args.page, args.pageSize, total),
    };
  }

  async getPlan(tenantId: string, id: string): Promise<MaintenancePlanDto> {
    const row = await this.prisma.maintenancePlan.findFirst({
      where: { id, tenantId },
      include: planInclude,
    });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, 'MAINTENANCE_PLAN_NOT_FOUND', 'Plan bulunamadı.');
    return toMaintenancePlanDto(row);
  }

  async createPlan(
    tenantId: string,
    actorId: string,
    dto: CreateMaintenancePlanDto,
  ): Promise<MaintenancePlanDto> {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: dto.equipmentId, tenantId, status: { not: EquipmentStatus.ARCHIVED } },
    });
    if (!equipment)
      throw new AppException(HttpStatus.NOT_FOUND, 'EQUIPMENT_NOT_FOUND', 'Ekipman bulunamadı.');
    if (dto.assigneeId) await this.assertAssignee(tenantId, dto.assigneeId);

    const created = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.maintenancePlan.create({
        data: {
          tenantId,
          equipmentId: equipment.id,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          cadence: dto.cadence,
          interval: dto.interval ?? 1,
          nextDueAt: new Date(dto.nextDueAt),
          assigneeId: dto.assigneeId ?? null,
          items: {
            create: dto.items.map((item, index) => ({
              tenantId,
              sortOrder: index,
              label: item.label.trim(),
              required: item.required ?? true,
            })),
          },
        },
        include: planInclude,
      });
      await this.audit.write(tx, {
        tenantId,
        actorId,
        action: 'maintenance_plan.created',
        entityType: 'maintenance_plan',
        entityId: plan.id,
        metadata: { equipmentId: equipment.id, cadence: dto.cadence },
      });
      return plan;
    });
    return toMaintenancePlanDto(created);
  }

  async updatePlan(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateMaintenancePlanDto,
  ): Promise<MaintenancePlanDto> {
    await this.getPlan(tenantId, id);
    if (dto.assigneeId) await this.assertAssignee(tenantId, dto.assigneeId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.maintenancePlan.update({
        where: { id },
        data: {
          ...(dto.title ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.nextDueAt ? { nextDueAt: new Date(dto.nextDueAt) } : {}),
          ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        },
        include: planInclude,
      });
      await this.audit.write(tx, {
        tenantId,
        actorId,
        action: 'maintenance_plan.updated',
        entityType: 'maintenance_plan',
        entityId: plan.id,
      });
      return plan;
    });
    return toMaintenancePlanDto(updated);
  }

  async listTasks(tenantId: string, query: ListMaintenanceTasksQuery) {
    const args = pageArgs(query.page, query.pageSize);
    const now = new Date();
    const where: Prisma.MaintenanceTaskWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
      ...(query.overdue ? { status: 'OPEN', dueAt: { lt: now } } : {}),
      ...(query.upcomingDays && !query.overdue
        ? {
            status: 'OPEN',
            dueAt: {
              gte: now,
              lte: new Date(now.getTime() + query.upcomingDays * 86_400_000),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { equipment: { code: { contains: query.search.trim().toUpperCase(), mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.maintenanceTask.count({ where }),
      this.prisma.maintenanceTask.findMany({
        where,
        include: taskInclude,
        orderBy: { dueAt: 'asc' },
        skip: args.skip,
        take: args.take,
      }),
    ]);
    return {
      data: rows.map((row) => toMaintenanceTaskDto(row, now)),
      meta: pageMeta(args.page, args.pageSize, total),
    };
  }

  async getTask(tenantId: string, id: string): Promise<MaintenanceTaskDto> {
    const row = await this.prisma.maintenanceTask.findFirst({
      where: { id, tenantId },
      include: taskInclude,
    });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, 'MAINTENANCE_TASK_NOT_FOUND', 'Görev bulunamadı.');
    return toMaintenanceTaskDto(row);
  }

  async generateDueTasks(
    tenantId: string,
    actorId: string,
  ): Promise<{ created: number; tasks: MaintenanceTaskDto[] }> {
    const now = new Date();
    const plans = await this.prisma.maintenancePlan.findMany({
      where: { tenantId, active: true, nextDueAt: { lte: now } },
      include: { items: true },
    });
    const created: MaintenanceTaskDto[] = [];
    for (const plan of plans) {
      const open = await this.prisma.maintenanceTask.findFirst({
        where: { tenantId, planId: plan.id, status: 'OPEN' },
      });
      if (open) continue;
      const task = await this.prisma.$transaction(async (tx) => {
        const row = await tx.maintenanceTask.create({
          data: {
            tenantId,
            planId: plan.id,
            equipmentId: plan.equipmentId,
            title: plan.title,
            dueAt: plan.nextDueAt,
            assigneeId: plan.assigneeId,
            items: {
              create: plan.items.map((item) => ({
                tenantId,
                sortOrder: item.sortOrder,
                label: item.label,
                required: item.required,
              })),
            },
          },
          include: taskInclude,
        });
        await tx.maintenancePlan.update({
          where: { id: plan.id },
          data: {
            nextDueAt: catchUpNextDue(plan.nextDueAt, plan.cadence, plan.interval, now),
          },
        });
        await this.audit.write(tx, {
          tenantId,
          actorId,
          action: 'maintenance_task.generated',
          entityType: 'maintenance_task',
          entityId: row.id,
          metadata: { planId: plan.id },
        });
        return row;
      });
      created.push(toMaintenanceTaskDto(task, now));
    }
    return { created: created.length, tasks: created };
  }

  async assignTask(
    tenantId: string,
    actorId: string,
    id: string,
    dto: AssignMaintenanceTaskDto,
  ): Promise<MaintenanceTaskDto> {
    await this.assertAssignee(tenantId, dto.assigneeId);
    const count = await this.prisma.$transaction(async (tx) => {
      const result = await tx.maintenanceTask.updateMany({
        where: { id, tenantId, version: dto.version, status: 'OPEN' },
        data: { assigneeId: dto.assigneeId, version: { increment: 1 } },
      });
      if (result.count === 1) {
        await this.audit.write(tx, {
          tenantId,
          actorId,
          action: 'maintenance_task.assigned',
          entityType: 'maintenance_task',
          entityId: id,
          metadata: { assigneeId: dto.assigneeId },
        });
      }
      return result.count;
    });
    if (count !== 1) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'VERSION_CONFLICT',
        'Görev başka bir işlemle güncellendi veya kapalı.',
      );
    }
    return this.getTask(tenantId, id);
  }

  async checkItem(
    tenantId: string,
    actorId: string,
    taskId: string,
    itemId: string,
    dto: CheckMaintenanceItemDto,
  ): Promise<MaintenanceTaskDto> {
    const task = await this.prisma.maintenanceTask.findFirst({
      where: { id: taskId, tenantId },
    });
    if (!task)
      throw new AppException(HttpStatus.NOT_FOUND, 'MAINTENANCE_TASK_NOT_FOUND', 'Görev bulunamadı.');
    if (task.status !== 'OPEN') {
      throw new AppException(HttpStatus.CONFLICT, 'TASK_NOT_OPEN', 'Kapalı göreve madde işlenemez.');
    }
    const item = await this.prisma.maintenanceCheckItem.findFirst({
      where: { id: itemId, taskId, tenantId },
    });
    if (!item)
      throw new AppException(HttpStatus.NOT_FOUND, 'CHECK_ITEM_NOT_FOUND', 'Kontrol maddesi yok.');
    await this.prisma.maintenanceCheckItem.update({
      where: { id: item.id },
      data: { checked: dto.checked, note: dto.note?.trim() || null },
    });
    await this.audit.write(this.prisma, {
      tenantId,
      actorId,
      action: 'maintenance_check.updated',
      entityType: 'maintenance_task',
      entityId: taskId,
      metadata: { itemId, checked: dto.checked },
    });
    return this.getTask(tenantId, taskId);
  }

  async completeTask(
    tenantId: string,
    actorId: string,
    id: string,
    dto: CompleteMaintenanceTaskDto,
  ): Promise<MaintenanceTaskDto> {
    const task = await this.prisma.maintenanceTask.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!task)
      throw new AppException(HttpStatus.NOT_FOUND, 'MAINTENANCE_TASK_NOT_FOUND', 'Görev bulunamadı.');
    if (task.status !== 'OPEN') {
      throw new AppException(HttpStatus.CONFLICT, 'TASK_NOT_OPEN', 'Görev zaten kapalı.');
    }
    const missing = task.items.filter((item) => item.required && !item.checked);
    if (missing.length > 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CHECKLIST_INCOMPLETE',
        'Zorunlu kontrol maddeleri işaretlenmeden tamamlanamaz.',
      );
    }
    const count = await this.prisma.$transaction(async (tx) => {
      const result = await tx.maintenanceTask.updateMany({
        where: { id, tenantId, version: dto.version, status: 'OPEN' },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedById: actorId,
          version: { increment: 1 },
        },
      });
      if (result.count === 1) {
        await this.audit.write(tx, {
          tenantId,
          actorId,
          action: 'maintenance_task.completed',
          entityType: 'maintenance_task',
          entityId: id,
        });
      }
      return result.count;
    });
    if (count !== 1) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'VERSION_CONFLICT',
        'Görev başka bir işlemle güncellendi.',
      );
    }
    return this.getTask(tenantId, id);
  }

  private async assertAssignee(tenantId: string, userId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
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
        'ASSIGNEE_NOT_ELIGIBLE',
        'Atanan kişi bu şirkette atanabilir değil.',
      );
    }
  }
}
