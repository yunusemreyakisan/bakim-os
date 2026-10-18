import type {
  MembershipRole,
  WorkOrderDetailDto,
  WorkOrderDto,
  WorkOrderStatus,
} from '@bakimos/api-contracts';
import type { Equipment, Fault, User, WorkOrder, WorkOrderActivity } from '@prisma/client';
import { isManagerRole, Permission } from '../common/auth/permissions';
import {
  allowedWorkOrderTransitions,
  assertWorkOrderTransition,
  canAddActivity,
  canAssignInStatus,
} from './work-order-status';
import { WorkActivityKind } from '@bakimos/api-contracts';

type UserPick = Pick<User, 'id' | 'name' | 'email'>;

export type WorkOrderRow = WorkOrder & {
  equipment: Pick<Equipment, 'id' | 'code' | 'name'>;
  fault: Pick<Fault, 'id' | 'status' | 'priority' | 'description'>;
  assignee: UserPick | null;
  createdBy: UserPick;
  activities?: Array<WorkOrderActivity & { actor: UserPick }>;
};

function toUser(user: UserPick) {
  return { id: user.id, name: user.name, email: user.email };
}

export function toWorkOrderDto(row: WorkOrderRow): WorkOrderDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    number: row.number,
    faultId: row.faultId,
    equipmentId: row.equipmentId,
    title: row.title,
    description: row.description,
    status: row.status,
    version: row.version,
    assignee: row.assignee ? toUser(row.assignee) : null,
    createdBy: toUser(row.createdBy),
    openedAt: row.openedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    equipment: { id: row.equipment.id, code: row.equipment.code, name: row.equipment.name },
    fault: {
      id: row.fault.id,
      status: row.fault.status,
      priority: row.fault.priority,
      description: row.fault.description,
    },
  };
}

export function toWorkOrderDetailDto(
  row: WorkOrderRow,
  actor: { id: string; role: MembershipRole },
): WorkOrderDetailDto {
  const hasAction = (row.activities ?? []).some((item) => item.kind === WorkActivityKind.ACTION);
  const manager = isManagerRole(actor.role);
  const assignedToActor = row.assigneeId === actor.id;
  const canExecute = manager || assignedToActor;
  const allowedTransitions = allowedWorkOrderTransitions(row.status as WorkOrderStatus).filter(
    (to) => {
      if (!canExecute) return false;
      try {
        assertWorkOrderTransition({
          from: row.status,
          to,
          hasAssignee: Boolean(row.assigneeId),
          hasAction,
          actorRole: actor.role,
        });
        return true;
      } catch {
        return false;
      }
    },
  );
  return {
    ...toWorkOrderDto(row),
    activities: (row.activities ?? []).map((item) => ({
      id: item.id,
      workOrderId: item.workOrderId,
      actor: toUser(item.actor),
      kind: item.kind,
      description: item.description,
      createdAt: item.createdAt.toISOString(),
    })),
    allowedTransitions,
    canAssign: manager && canAssignInStatus(row.status),
    canClaim:
      row.status === 'OPEN' &&
      row.assigneeId === null &&
      (Permission.WORK_ORDER_EXECUTE as readonly MembershipRole[]).includes(actor.role),
    canAddActivity: canExecute && canAddActivity(row.status, WorkActivityKind.NOTE),
  };
}
