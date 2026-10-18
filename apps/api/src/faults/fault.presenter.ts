import type { FaultDetailDto, FaultDto, FaultStatus } from '@bakimos/api-contracts';
import type { Equipment, Fault, WorkOrder } from '@prisma/client';
import { allowedFaultTransitions } from './fault-status';

type FaultRow = Fault & {
  equipment: Pick<Equipment, 'id' | 'code' | 'name'>;
  _count?: { workOrders: number };
  workOrders?: Array<
    Pick<WorkOrder, 'id' | 'number' | 'title' | 'status'> & {
      assignee: { id: string; name: string; email: string } | null;
    }
  >;
};

export function toFaultDto(row: FaultRow): FaultDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    equipmentId: row.equipmentId,
    reporterId: row.reporterId,
    description: row.description,
    status: row.status,
    priority: row.priority,
    workOrderCount: row._count?.workOrders ?? row.workOrders?.length ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    equipment: { id: row.equipment.id, code: row.equipment.code, name: row.equipment.name },
  };
}

export function toFaultDetailDto(row: FaultRow): FaultDetailDto {
  return {
    ...toFaultDto(row),
    workOrders: (row.workOrders ?? []).map((workOrder) => ({
      id: workOrder.id,
      number: workOrder.number,
      title: workOrder.title,
      status: workOrder.status,
      assignee: workOrder.assignee,
    })),
    allowedTransitions: allowedFaultTransitions(row.status as FaultStatus),
  };
}
