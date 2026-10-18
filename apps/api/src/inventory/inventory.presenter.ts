import type { PartDto, StockMovementDto, WorkOrderPartUseDto } from '@bakimos/api-contracts';
import type { Part, StockBalance, StockMovement, User, WorkOrderPartUse } from '@prisma/client';

export function toPartDto(part: Part, balance: StockBalance | null): PartDto {
  const quantity = balance?.quantity ?? 0;
  return {
    id: part.id,
    tenantId: part.tenantId,
    code: part.code,
    name: part.name,
    unit: part.unit,
    minQuantity: part.minQuantity,
    quantity,
    belowMin: quantity < part.minQuantity,
    createdAt: part.createdAt.toISOString(),
    updatedAt: part.updatedAt.toISOString(),
  };
}

export function toMovementDto(
  row: StockMovement & { actor: Pick<User, 'id' | 'name' | 'email'> },
): StockMovementDto {
  return {
    id: row.id,
    partId: row.partId,
    actor: row.actor,
    reason: row.reason,
    delta: row.delta,
    quantityAfter: row.quantityAfter,
    workOrderId: row.workOrderId,
    operationId: row.operationId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPartUseDto(
  row: WorkOrderPartUse & { part: Pick<Part, 'code' | 'name'> },
): WorkOrderPartUseDto {
  return {
    id: row.id,
    workOrderId: row.workOrderId,
    partId: row.partId,
    partCode: row.part.code,
    partName: row.part.name,
    quantity: row.quantity,
    movementId: row.movementId,
    createdAt: row.createdAt.toISOString(),
  };
}
