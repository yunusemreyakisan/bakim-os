import { FaultStatus, WorkOrderStatus } from '@bakimos/api-contracts';
import { HttpStatus } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';

const FAULT_TRANSITIONS: Record<FaultStatus, readonly FaultStatus[]> = {
  [FaultStatus.OPEN]: [FaultStatus.ACKNOWLEDGED, FaultStatus.CANCELLED],
  [FaultStatus.ACKNOWLEDGED]: [FaultStatus.IN_PROGRESS, FaultStatus.CANCELLED],
  [FaultStatus.IN_PROGRESS]: [
    FaultStatus.RESOLVED,
    FaultStatus.CANCELLED,
    FaultStatus.ACKNOWLEDGED,
  ],
  [FaultStatus.RESOLVED]: [FaultStatus.CLOSED, FaultStatus.IN_PROGRESS, FaultStatus.ACKNOWLEDGED],
  [FaultStatus.CLOSED]: [],
  [FaultStatus.CANCELLED]: [],
};

const ACTIVE_WORK_ORDER: ReadonlySet<WorkOrderStatus> = new Set([
  WorkOrderStatus.OPEN,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
]);

export function allowedFaultTransitions(from: FaultStatus): FaultStatus[] {
  return [...FAULT_TRANSITIONS[from]];
}

export function assertFaultTransition(from: FaultStatus, to: FaultStatus): void {
  if (!FAULT_TRANSITIONS[from].includes(to)) {
    throw new AppException(
      HttpStatus.CONFLICT,
      'INVALID_FAULT_TRANSITION',
      'Bu arıza durumu geçişi geçerli değil.',
    );
  }
}

export function canOpenWorkOrder(faultStatus: FaultStatus): boolean {
  return (
    faultStatus === FaultStatus.OPEN ||
    faultStatus === FaultStatus.ACKNOWLEDGED ||
    faultStatus === FaultStatus.IN_PROGRESS ||
    faultStatus === FaultStatus.RESOLVED
  );
}

export function hasActiveWorkOrder(statuses: readonly WorkOrderStatus[]): boolean {
  return statuses.some((status) => ACTIVE_WORK_ORDER.has(status));
}

export function deriveFaultStatus(
  current: FaultStatus,
  workOrderStatuses: readonly WorkOrderStatus[],
): FaultStatus {
  if (current === FaultStatus.CLOSED || current === FaultStatus.CANCELLED) {
    return current;
  }
  const inFlight = workOrderStatuses.some(
    (status) => status === WorkOrderStatus.IN_PROGRESS || status === WorkOrderStatus.ON_HOLD,
  );
  if (inFlight) return FaultStatus.IN_PROGRESS;
  const completed = workOrderStatuses.some((status) => status === WorkOrderStatus.COMPLETED);
  const active = hasActiveWorkOrder(workOrderStatuses);
  if (completed && !active) return FaultStatus.RESOLVED;
  if (workOrderStatuses.some((status) => status === WorkOrderStatus.OPEN)) {
    return FaultStatus.ACKNOWLEDGED;
  }
  if (
    (current === FaultStatus.IN_PROGRESS || current === FaultStatus.RESOLVED) &&
    workOrderStatuses.length > 0 &&
    workOrderStatuses.every((status) => status === WorkOrderStatus.CANCELLED)
  ) {
    return FaultStatus.ACKNOWLEDGED;
  }
  return current;
}
