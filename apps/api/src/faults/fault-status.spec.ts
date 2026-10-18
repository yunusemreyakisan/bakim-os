import { FaultStatus, WorkOrderStatus } from '@bakimos/api-contracts';
import { AppException } from '../common/errors/app.exception';
import { assertFaultTransition, deriveFaultStatus, hasActiveWorkOrder } from './fault-status';

describe('fault status', () => {
  it('kapalı arızadan ilerlemeyi reddeder', () => {
    expect(() => assertFaultTransition(FaultStatus.CLOSED, FaultStatus.OPEN)).toThrow(AppException);
    expect(() => assertFaultTransition(FaultStatus.OPEN, FaultStatus.RESOLVED)).toThrow(
      AppException,
    );
  });

  it('açık arızayı onaylar veya iptal eder', () => {
    expect(() => assertFaultTransition(FaultStatus.OPEN, FaultStatus.ACKNOWLEDGED)).not.toThrow();
    expect(() => assertFaultTransition(FaultStatus.OPEN, FaultStatus.CANCELLED)).not.toThrow();
  });

  it('iş emri ilerlemesine göre arıza durumunu türetir', () => {
    expect(deriveFaultStatus(FaultStatus.OPEN, [WorkOrderStatus.OPEN])).toBe(
      FaultStatus.ACKNOWLEDGED,
    );
    expect(deriveFaultStatus(FaultStatus.ACKNOWLEDGED, [WorkOrderStatus.IN_PROGRESS])).toBe(
      FaultStatus.IN_PROGRESS,
    );
    expect(deriveFaultStatus(FaultStatus.IN_PROGRESS, [WorkOrderStatus.COMPLETED])).toBe(
      FaultStatus.RESOLVED,
    );
    expect(deriveFaultStatus(FaultStatus.RESOLVED, [WorkOrderStatus.OPEN])).toBe(
      FaultStatus.ACKNOWLEDGED,
    );
    expect(deriveFaultStatus(FaultStatus.CLOSED, [WorkOrderStatus.OPEN])).toBe(FaultStatus.CLOSED);
    expect(deriveFaultStatus(FaultStatus.IN_PROGRESS, [WorkOrderStatus.CANCELLED])).toBe(
      FaultStatus.ACKNOWLEDGED,
    );
  });

  it('aktif iş emrini tanır', () => {
    expect(hasActiveWorkOrder([WorkOrderStatus.COMPLETED, WorkOrderStatus.ON_HOLD])).toBe(true);
    expect(hasActiveWorkOrder([WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED])).toBe(false);
  });
});
