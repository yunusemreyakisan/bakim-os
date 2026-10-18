import { MembershipRole, WorkActivityKind, WorkOrderStatus } from '@bakimos/api-contracts';
import { HttpStatus } from '@nestjs/common';
import { isManagerRole } from '../common/auth/permissions';
import { AppException } from '../common/errors/app.exception';

const WORK_ORDER_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  [WorkOrderStatus.OPEN]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.IN_PROGRESS]: [
    WorkOrderStatus.ON_HOLD,
    WorkOrderStatus.COMPLETED,
    WorkOrderStatus.CANCELLED,
  ],
  [WorkOrderStatus.ON_HOLD]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.COMPLETED]: [],
  [WorkOrderStatus.CANCELLED]: [],
};

export function allowedWorkOrderTransitions(from: WorkOrderStatus): WorkOrderStatus[] {
  return [...WORK_ORDER_TRANSITIONS[from]];
}

export function assertWorkOrderTransition(input: {
  from: WorkOrderStatus;
  to: WorkOrderStatus;
  hasAssignee: boolean;
  hasAction: boolean;
  actorRole: MembershipRole;
}): void {
  if (!WORK_ORDER_TRANSITIONS[input.from].includes(input.to)) {
    throw new AppException(
      HttpStatus.CONFLICT,
      'INVALID_WORK_ORDER_TRANSITION',
      'Bu iş emri durumu geçişi geçerli değil.',
    );
  }
  if (input.to === WorkOrderStatus.IN_PROGRESS && !input.hasAssignee) {
    throw new AppException(
      HttpStatus.CONFLICT,
      'ASSIGNEE_REQUIRED',
      'İş emri atamadan başlatılamaz.',
    );
  }
  if (input.to === WorkOrderStatus.COMPLETED && !input.hasAction) {
    throw new AppException(
      HttpStatus.CONFLICT,
      'ACTIVITY_REQUIRED',
      'Tamamlamak için en az bir bakım işlemi kaydı gerekli.',
    );
  }
  if (input.to === WorkOrderStatus.CANCELLED && !isManagerRole(input.actorRole)) {
    throw new AppException(
      HttpStatus.FORBIDDEN,
      'ROLE_FORBIDDEN',
      'İş emrini yalnızca yönetici iptal edebilir.',
    );
  }
}

export function canAddActivity(status: WorkOrderStatus, kind: WorkActivityKind): boolean {
  if (status === WorkOrderStatus.COMPLETED || status === WorkOrderStatus.CANCELLED) return false;
  if (kind === WorkActivityKind.ACTION) {
    return status === WorkOrderStatus.IN_PROGRESS || status === WorkOrderStatus.ON_HOLD;
  }
  return true;
}

export function canAssignInStatus(status: WorkOrderStatus): boolean {
  return (
    status === WorkOrderStatus.OPEN ||
    status === WorkOrderStatus.IN_PROGRESS ||
    status === WorkOrderStatus.ON_HOLD
  );
}

export function transitionTimestamps(
  to: WorkOrderStatus,
): Partial<{ startedAt: Date; completedAt: Date; cancelledAt: Date }> {
  const now = new Date();
  if (to === WorkOrderStatus.IN_PROGRESS) return { startedAt: now };
  if (to === WorkOrderStatus.COMPLETED) return { completedAt: now };
  if (to === WorkOrderStatus.CANCELLED) return { cancelledAt: now };
  return {};
}
