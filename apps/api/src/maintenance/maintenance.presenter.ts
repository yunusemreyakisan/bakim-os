import type { MaintenancePlanDto, MaintenanceTaskDto } from '@bakimos/api-contracts';
import type {
  Equipment,
  MaintenanceCheckItem,
  MaintenancePlan,
  MaintenancePlanItem,
  MaintenanceTask,
  User,
} from '@prisma/client';

type PlanRow = MaintenancePlan & {
  equipment: Pick<Equipment, 'id' | 'code' | 'name'>;
  assignee: Pick<User, 'id' | 'name' | 'email'> | null;
  items: MaintenancePlanItem[];
};

type TaskRow = MaintenanceTask & {
  equipment: Pick<Equipment, 'id' | 'code' | 'name'>;
  assignee: Pick<User, 'id' | 'name' | 'email'> | null;
  completedBy: Pick<User, 'id' | 'name' | 'email'> | null;
  items: MaintenanceCheckItem[];
};

export function toMaintenancePlanDto(row: PlanRow): MaintenancePlanDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    equipmentId: row.equipmentId,
    title: row.title,
    description: row.description,
    cadence: row.cadence,
    interval: row.interval,
    nextDueAt: row.nextDueAt.toISOString(),
    active: row.active,
    assignee: row.assignee,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    equipment: { id: row.equipment.id, code: row.equipment.code, name: row.equipment.name },
    items: row.items
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        sortOrder: item.sortOrder,
        label: item.label,
        required: item.required,
      })),
  };
}

export function toMaintenanceTaskDto(row: TaskRow, now = new Date()): MaintenanceTaskDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    planId: row.planId,
    equipmentId: row.equipmentId,
    title: row.title,
    dueAt: row.dueAt.toISOString(),
    status: row.status,
    version: row.version,
    overdue: row.status === 'OPEN' && row.dueAt.getTime() < now.getTime(),
    assignee: row.assignee,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedBy: row.completedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    equipment: { id: row.equipment.id, code: row.equipment.code, name: row.equipment.name },
    items: row.items
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        sortOrder: item.sortOrder,
        label: item.label,
        required: item.required,
        checked: item.checked,
        note: item.note,
      })),
  };
}
