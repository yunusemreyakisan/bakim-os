import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, StockReason } from '@prisma/client';
import type { PartDto, StockMovementDto, WorkOrderPartUseDto } from '@bakimos/api-contracts';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { normalizeEquipmentCode } from '../common/normalize';
import { pageArgs, pageMeta } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePartDto,
  CreateStockMovementDto,
  IssueWorkOrderPartDto,
  ListMovementsQuery,
  ListPartsQuery,
} from './dto/inventory.dto';
import { toMovementDto, toPartDto, toPartUseDto } from './inventory.presenter';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listParts(tenantId: string, query: ListPartsQuery) {
    const args = pageArgs(query.page, query.pageSize);
    const where: Prisma.PartWhereInput = {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search.trim().toUpperCase(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.part.count({ where }),
      this.prisma.part.findMany({
        where,
        include: { balance: true },
        orderBy: { code: 'asc' },
        skip: args.skip,
        take: args.take,
      }),
    ]);
    let data = rows.map((row) => toPartDto(row, row.balance));
    if (query.belowMin) data = data.filter((row) => row.belowMin);
    return { data, meta: pageMeta(args.page, args.pageSize, query.belowMin ? data.length : total) };
  }

  async getPart(tenantId: string, id: string): Promise<PartDto> {
    const row = await this.prisma.part.findFirst({
      where: { id, tenantId },
      include: { balance: true },
    });
    if (!row) throw new AppException(HttpStatus.NOT_FOUND, 'PART_NOT_FOUND', 'Parça bulunamadı.');
    return toPartDto(row, row.balance);
  }

  async createPart(tenantId: string, actorId: string, dto: CreatePartDto): Promise<PartDto> {
    const code = normalizeEquipmentCode(dto.code);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const part = await tx.part.create({
          data: {
            tenantId,
            code,
            name: dto.name.trim(),
            unit: dto.unit?.trim() || 'adet',
            minQuantity: dto.minQuantity ?? 0,
            balance: { create: { tenantId, quantity: 0 } },
          },
          include: { balance: true },
        });
        await this.audit.write(tx, {
          tenantId,
          actorId,
          action: 'part.created',
          entityType: 'part',
          entityId: part.id,
          metadata: { code },
        });
        return part;
      });
      return toPartDto(created, created.balance);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(HttpStatus.CONFLICT, 'PART_CODE_TAKEN', 'Bu parça kodu kullanılıyor.');
      }
      throw error;
    }
  }

  async listMovements(tenantId: string, query: ListMovementsQuery) {
    const args = pageArgs(query.page, query.pageSize);
    const where: Prisma.StockMovementWhereInput = {
      tenantId,
      ...(query.partId ? { partId: query.partId } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: args.skip,
        take: args.take,
      }),
    ]);
    return {
      data: rows.map(toMovementDto),
      meta: pageMeta(args.page, args.pageSize, total),
    };
  }

  async move(
    tenantId: string,
    actorId: string,
    dto: CreateStockMovementDto,
  ): Promise<StockMovementDto> {
    const delta =
      dto.reason === 'ISSUE' ? -Math.abs(dto.quantity) : Math.abs(dto.quantity);
    return this.applyMovement(tenantId, actorId, {
      partId: dto.partId,
      reason: dto.reason,
      delta,
      operationId: dto.operationId ?? null,
      note: dto.note ?? null,
      workOrderId: null,
    });
  }

  async issueForWorkOrder(
    tenantId: string,
    actorId: string,
    workOrderId: string,
    dto: IssueWorkOrderPartDto,
  ): Promise<WorkOrderPartUseDto> {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
    });
    if (!workOrder)
      throw new AppException(HttpStatus.NOT_FOUND, 'WORK_ORDER_NOT_FOUND', 'İş emri bulunamadı.');
    const movement = await this.applyMovement(tenantId, actorId, {
      partId: dto.partId,
      reason: 'WORK_ORDER',
      delta: -Math.abs(dto.quantity),
      operationId: dto.operationId ?? null,
      note: `İş emri ${workOrder.number}`,
      workOrderId,
    });
    const use = await this.prisma.workOrderPartUse.findUnique({
      where: { movementId: movement.id },
      include: { part: { select: { code: true, name: true } } },
    });
    if (!use)
      throw new AppException(HttpStatus.CONFLICT, 'STOCK_IDEMPOTENT', 'Hareket kaydı eşleşmedi.');
    return toPartUseDto(use);
  }

  async listWorkOrderParts(tenantId: string, workOrderId: string): Promise<WorkOrderPartUseDto[]> {
    const rows = await this.prisma.workOrderPartUse.findMany({
      where: { tenantId, workOrderId },
      include: { part: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toPartUseDto);
  }

  private async applyMovement(
    tenantId: string,
    actorId: string,
    input: {
      partId: string;
      reason: StockReason;
      delta: number;
      operationId: string | null;
      note: string | null;
      workOrderId: string | null;
    },
  ): Promise<StockMovementDto> {
    if (input.operationId) {
      const existing = await this.prisma.stockMovement.findUnique({
        where: { tenantId_operationId: { tenantId, operationId: input.operationId } },
        include: { actor: { select: { id: true, name: true, email: true } } },
      });
      if (existing) return toMovementDto(existing);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const part = await tx.part.findFirst({ where: { id: input.partId, tenantId } });
        if (!part)
          throw new AppException(HttpStatus.NOT_FOUND, 'PART_NOT_FOUND', 'Parça bulunamadı.');
        let balance = await tx.stockBalance.findUnique({ where: { partId: part.id } });
        if (!balance) {
          balance = await tx.stockBalance.create({
            data: { tenantId, partId: part.id, quantity: 0 },
          });
        }
        await tx.$queryRaw`SELECT id FROM stock_balances WHERE id = ${balance.id} FOR UPDATE`;
        const locked = await tx.stockBalance.findUniqueOrThrow({ where: { id: balance.id } });
        const next = locked.quantity + input.delta;
        if (next < 0) {
          throw new AppException(
            HttpStatus.CONFLICT,
            'INSUFFICIENT_STOCK',
            'Stok miktarı yetersiz.',
          );
        }
        await tx.stockBalance.update({
          where: { id: locked.id },
          data: { quantity: next, version: { increment: 1 } },
        });
        const movement = await tx.stockMovement.create({
          data: {
            tenantId,
            partId: part.id,
            actorId,
            reason: input.reason,
            delta: input.delta,
            quantityAfter: next,
            workOrderId: input.workOrderId,
            operationId: input.operationId,
            note: input.note,
          },
          include: { actor: { select: { id: true, name: true, email: true } } },
        });
        if (input.workOrderId) {
          await tx.workOrderPartUse.create({
            data: {
              tenantId,
              workOrderId: input.workOrderId,
              partId: part.id,
              movementId: movement.id,
              quantity: Math.abs(input.delta),
            },
          });
        }
        await this.audit.write(tx, {
          tenantId,
          actorId,
          action: 'stock.moved',
          entityType: 'part',
          entityId: part.id,
          metadata: {
            reason: input.reason,
            delta: input.delta,
            quantityAfter: next,
            operationId: input.operationId,
          },
        });
        return toMovementDto(movement);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        if (input.operationId) {
          const existing = await this.prisma.stockMovement.findUnique({
            where: { tenantId_operationId: { tenantId, operationId: input.operationId } },
            include: { actor: { select: { id: true, name: true, email: true } } },
          });
          if (existing) return toMovementDto(existing);
        }
      }
      throw error;
    }
  }
}
