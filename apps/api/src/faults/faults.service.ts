import { HttpStatus, Injectable } from '@nestjs/common';
import { EquipmentStatus, FaultStatus, Prisma } from '@prisma/client';
import type { FaultDetailDto, FaultDto, MembershipRole } from '@bakimos/api-contracts';
import { AuditService } from '../audit/audit.service';
import { isManagerRole } from '../common/auth/permissions';
import { AppException } from '../common/errors/app.exception';
import { pageArgs, pageMeta } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { assertFaultTransition, hasActiveWorkOrder } from './fault-status';
import type { CreateFaultDto, ListFaultsQuery } from './dto/fault.dto';
import { toFaultDetailDto, toFaultDto } from './fault.presenter';

const faultListInclude = {
  equipment: true,
  _count: { select: { workOrders: true } },
} satisfies Prisma.FaultInclude;

const faultDetailInclude = {
  equipment: true,
  _count: { select: { workOrders: true } },
  workOrders: {
    orderBy: { createdAt: 'desc' },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.FaultInclude;

@Injectable()
export class FaultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: ListFaultsQuery) {
    const args = pageArgs(query.page, query.pageSize);
    const where: Prisma.FaultWhereInput = {
      tenantId,
      ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: 'insensitive' } },
              { equipment: { code: { contains: query.search.trim().toUpperCase(), mode: 'insensitive' } } },
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
      this.prisma.fault.count({ where }),
      this.prisma.fault.findMany({
        where,
        include: faultListInclude,
        orderBy: { createdAt: 'desc' },
        skip: args.skip,
        take: args.take,
      }),
    ]);
    return { data: rows.map(toFaultDto), meta: pageMeta(args.page, args.pageSize, total) };
  }

  async getById(tenantId: string, id: string): Promise<FaultDetailDto> {
    const row = await this.prisma.fault.findFirst({
      where: { id, tenantId },
      include: faultDetailInclude,
    });
    if (!row) throw new AppException(HttpStatus.NOT_FOUND, 'FAULT_NOT_FOUND', 'Arıza bulunamadı.');
    return toFaultDetailDto(row);
  }

  async create(tenantId: string, reporterId: string, dto: CreateFaultDto): Promise<FaultDto> {
    return this.prisma.$transaction(async (tx) => {
      const equipment = await tx.equipment.findFirst({
        where: { id: dto.equipmentId, tenantId, status: { not: EquipmentStatus.ARCHIVED } },
      });
      if (!equipment) {
        throw new AppException(HttpStatus.NOT_FOUND, 'EQUIPMENT_NOT_FOUND', 'Ekipman bulunamadı.');
      }
      const fault = await tx.fault.create({
        data: {
          tenantId,
          equipmentId: equipment.id,
          reporterId,
          description: dto.description.trim(),
          priority: dto.priority,
          status: FaultStatus.OPEN,
        },
        include: faultListInclude,
      });
      await this.audit.write(tx, {
        tenantId,
        actorId: reporterId,
        action: 'fault.created',
        entityType: 'fault',
        entityId: fault.id,
        metadata: { equipmentId: equipment.id, priority: fault.priority },
      });
      return toFaultDto(fault);
    });
  }

  async acknowledge(tenantId: string, actorId: string, id: string): Promise<FaultDetailDto> {
    return this.changeStatus(tenantId, actorId, id, FaultStatus.ACKNOWLEDGED, 'fault.acknowledged');
  }

  async close(
    tenantId: string,
    actorId: string,
    role: MembershipRole,
    id: string,
  ): Promise<FaultDetailDto> {
    this.assertManager(role);
    return this.changeStatus(tenantId, actorId, id, FaultStatus.CLOSED, 'fault.closed');
  }

  async cancel(
    tenantId: string,
    actorId: string,
    role: MembershipRole,
    id: string,
  ): Promise<FaultDetailDto> {
    this.assertManager(role);
    return this.prisma.$transaction(async (tx) => {
      const fault = await tx.fault.findFirst({
        where: { id, tenantId },
        include: { workOrders: { select: { status: true } } },
      });
      if (!fault)
        throw new AppException(HttpStatus.NOT_FOUND, 'FAULT_NOT_FOUND', 'Arıza bulunamadı.');
      if (hasActiveWorkOrder(fault.workOrders.map((item) => item.status))) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'FAULT_HAS_ACTIVE_WORK_ORDER',
          'Aktif iş emri varken arıza iptal edilemez.',
        );
      }
      assertFaultTransition(fault.status, FaultStatus.CANCELLED);
      await tx.fault.update({ where: { id: fault.id }, data: { status: FaultStatus.CANCELLED } });
      await this.audit.write(tx, {
        tenantId,
        actorId,
        action: 'fault.cancelled',
        entityType: 'fault',
        entityId: fault.id,
        metadata: { from: fault.status, to: FaultStatus.CANCELLED },
      });
      return this.reload(tx, tenantId, id);
    });
  }

  private async changeStatus(
    tenantId: string,
    actorId: string,
    id: string,
    to: FaultStatus,
    action: string,
  ): Promise<FaultDetailDto> {
    return this.prisma.$transaction(async (tx) => {
      const fault = await tx.fault.findFirst({ where: { id, tenantId } });
      if (!fault)
        throw new AppException(HttpStatus.NOT_FOUND, 'FAULT_NOT_FOUND', 'Arıza bulunamadı.');
      assertFaultTransition(fault.status, to);
      await tx.fault.update({
        where: { id: fault.id },
        data: {
          status: to,
          ...(to === FaultStatus.ACKNOWLEDGED ? { acknowledgedAt: new Date() } : {}),
          ...(to === FaultStatus.CLOSED ? { closedAt: new Date() } : {}),
        },
      });
      await this.audit.write(tx, {
        tenantId,
        actorId,
        action,
        entityType: 'fault',
        entityId: fault.id,
        metadata: { from: fault.status, to },
      });
      return this.reload(tx, tenantId, id);
    });
  }

  private async reload(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ): Promise<FaultDetailDto> {
    const row = await tx.fault.findFirst({ where: { id, tenantId }, include: faultDetailInclude });
    if (!row) throw new AppException(HttpStatus.NOT_FOUND, 'FAULT_NOT_FOUND', 'Arıza bulunamadı.');
    return toFaultDetailDto(row);
  }

  private assertManager(role: MembershipRole): void {
    if (!isManagerRole(role)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'ROLE_FORBIDDEN', 'Bu işlem için yetkiniz yok.');
    }
  }
}
