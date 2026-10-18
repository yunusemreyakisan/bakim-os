import { MembershipRole } from '@bakimos/api-contracts';
import { canAssignRole, Permission } from './permissions';

describe('Permission', () => {
  it('depo rolüne arıza yazma yetkisi vermez', () => {
    expect(Permission.FAULT_WRITE).not.toContain(MembershipRole.WAREHOUSE);
    expect(Permission.EQUIPMENT_READ).toContain(MembershipRole.WAREHOUSE);
  });

  it('operatörün ekipman yazmasını engeller', () => {
    expect(Permission.EQUIPMENT_WRITE).not.toContain(MembershipRole.OPERATOR);
    expect(Permission.FAULT_WRITE).toContain(MembershipRole.OPERATOR);
  });

  it('depo iş emri okuyamaz, operatör yazamaz', () => {
    expect(Permission.WORK_ORDER_READ).not.toContain(MembershipRole.WAREHOUSE);
    expect(Permission.WORK_ORDER_WRITE).not.toContain(MembershipRole.OPERATOR);
    expect(Permission.WORK_ORDER_EXECUTE).toContain(MembershipRole.TECHNICIAN);
    expect(Permission.WORK_ORDER_ASSIGN).not.toContain(MembershipRole.TECHNICIAN);
  });

  it('depo stok yazar, bakım planı yazamaz; operatör stok düşemez', () => {
    expect(Permission.STOCK_WRITE).toContain(MembershipRole.WAREHOUSE);
    expect(Permission.MAINTENANCE_WRITE).not.toContain(MembershipRole.WAREHOUSE);
    expect(Permission.STOCK_WRITE).not.toContain(MembershipRole.OPERATOR);
    expect(Permission.MAINTENANCE_COMPLETE).toContain(MembershipRole.TECHNICIAN);
    expect(Permission.REPORT_READ).not.toContain(MembershipRole.OPERATOR);
  });

  it('yalnızca süper yöneticinin süper yönetici atamasına izin verir', () => {
    expect(canAssignRole(MembershipRole.ADMIN, MembershipRole.SUPER_ADMIN)).toBe(false);
    expect(canAssignRole(MembershipRole.SUPER_ADMIN, MembershipRole.SUPER_ADMIN)).toBe(true);
    expect(canAssignRole(MembershipRole.ADMIN, MembershipRole.TECHNICIAN)).toBe(true);
    expect(canAssignRole(MembershipRole.TECHNICIAN, MembershipRole.OPERATOR)).toBe(false);
  });
});
