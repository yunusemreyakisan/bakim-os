import { MembershipRole, WorkActivityKind, WorkOrderStatus } from '@bakimos/api-contracts';
import { AppException } from '../common/errors/app.exception';
import { assertWorkOrderTransition, canAddActivity, canAssignInStatus } from './work-order-status';

describe('work order status', () => {
  const base = {
    hasAssignee: true,
    hasAction: true,
    actorRole: MembershipRole.MAINTENANCE_MANAGER,
  };

  it('yalnızca tanımlı geçişlere izin verir', () => {
    expect(() =>
      assertWorkOrderTransition({
        ...base,
        from: WorkOrderStatus.OPEN,
        to: WorkOrderStatus.IN_PROGRESS,
      }),
    ).not.toThrow();
    expect(() =>
      assertWorkOrderTransition({
        ...base,
        from: WorkOrderStatus.COMPLETED,
        to: WorkOrderStatus.OPEN,
      }),
    ).toThrow(AppException);
    expect(() =>
      assertWorkOrderTransition({
        ...base,
        from: WorkOrderStatus.OPEN,
        to: WorkOrderStatus.COMPLETED,
      }),
    ).toThrow(AppException);
  });

  it('atanmamış iş emrinin başlamasını engeller', () => {
    try {
      assertWorkOrderTransition({
        ...base,
        from: WorkOrderStatus.OPEN,
        to: WorkOrderStatus.IN_PROGRESS,
        hasAssignee: false,
      });
      throw new Error('beklenmeyen başarı');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getResponse()).toEqual(
        expect.objectContaining({ code: 'ASSIGNEE_REQUIRED' }),
      );
    }
  });

  it('işlemsiz tamamlamayı engeller', () => {
    try {
      assertWorkOrderTransition({
        ...base,
        from: WorkOrderStatus.IN_PROGRESS,
        to: WorkOrderStatus.COMPLETED,
        hasAction: false,
      });
      throw new Error('beklenmeyen başarı');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getResponse()).toEqual(
        expect.objectContaining({ code: 'ACTIVITY_REQUIRED' }),
      );
    }
  });

  it('teknisyenin iptalini engeller', () => {
    expect(() =>
      assertWorkOrderTransition({
        ...base,
        from: WorkOrderStatus.OPEN,
        to: WorkOrderStatus.CANCELLED,
        actorRole: MembershipRole.TECHNICIAN,
      }),
    ).toThrow(AppException);
  });

  it('işlem türünü duruma göre sınırlar', () => {
    expect(canAddActivity(WorkOrderStatus.OPEN, WorkActivityKind.NOTE)).toBe(true);
    expect(canAddActivity(WorkOrderStatus.OPEN, WorkActivityKind.ACTION)).toBe(false);
    expect(canAddActivity(WorkOrderStatus.IN_PROGRESS, WorkActivityKind.ACTION)).toBe(true);
    expect(canAddActivity(WorkOrderStatus.COMPLETED, WorkActivityKind.NOTE)).toBe(false);
    expect(canAssignInStatus(WorkOrderStatus.COMPLETED)).toBe(false);
  });
});
