import { MembershipRole } from '@bakimos/api-contracts';

const ALL_ROLES: MembershipRole[] = [
  MembershipRole.SUPER_ADMIN,
  MembershipRole.ADMIN,
  MembershipRole.MAINTENANCE_MANAGER,
  MembershipRole.TECHNICIAN,
  MembershipRole.OPERATOR,
  MembershipRole.WAREHOUSE,
];

const FAULT_ROLES: MembershipRole[] = [
  MembershipRole.SUPER_ADMIN,
  MembershipRole.ADMIN,
  MembershipRole.MAINTENANCE_MANAGER,
  MembershipRole.TECHNICIAN,
  MembershipRole.OPERATOR,
];

export const Permission = {
  MEMBERSHIP_WRITE: [MembershipRole.SUPER_ADMIN, MembershipRole.ADMIN],
  MEMBERSHIP_READ: [MembershipRole.SUPER_ADMIN, MembershipRole.ADMIN],
  SITE_WRITE: [MembershipRole.SUPER_ADMIN, MembershipRole.ADMIN],
  SITE_READ: ALL_ROLES,
  EQUIPMENT_READ: ALL_ROLES,
  EQUIPMENT_WRITE: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
  ],
  FAULT_READ: FAULT_ROLES,
  FAULT_WRITE: FAULT_ROLES,
  FAULT_ACKNOWLEDGE: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
    MembershipRole.TECHNICIAN,
  ],
  FAULT_MANAGE: [MembershipRole.SUPER_ADMIN, MembershipRole.ADMIN, MembershipRole.MAINTENANCE_MANAGER],
  WORK_ORDER_READ: FAULT_ROLES,
  WORK_ORDER_WRITE: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
  ],
  WORK_ORDER_ASSIGN: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
  ],
  WORK_ORDER_EXECUTE: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
    MembershipRole.TECHNICIAN,
  ],
  SYNC_PUSH: FAULT_ROLES,
  MAINTENANCE_READ: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
    MembershipRole.TECHNICIAN,
  ],
  MAINTENANCE_WRITE: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
  ],
  MAINTENANCE_COMPLETE: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
    MembershipRole.TECHNICIAN,
  ],
  STOCK_READ: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
    MembershipRole.TECHNICIAN,
    MembershipRole.WAREHOUSE,
  ],
  STOCK_WRITE: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
    MembershipRole.WAREHOUSE,
  ],
  ATTACHMENT_WRITE: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
    MembershipRole.TECHNICIAN,
    MembershipRole.OPERATOR,
  ],
  REPORT_READ: [
    MembershipRole.SUPER_ADMIN,
    MembershipRole.ADMIN,
    MembershipRole.MAINTENANCE_MANAGER,
  ],
} as const;

export const ASSIGNABLE_ROLES: MembershipRole[] = [
  MembershipRole.SUPER_ADMIN,
  MembershipRole.ADMIN,
  MembershipRole.MAINTENANCE_MANAGER,
  MembershipRole.TECHNICIAN,
];

export function isAssignableRole(role: MembershipRole): boolean {
  return ASSIGNABLE_ROLES.includes(role);
}

export function isManagerRole(role: MembershipRole): boolean {
  return (
    role === MembershipRole.SUPER_ADMIN ||
    role === MembershipRole.ADMIN ||
    role === MembershipRole.MAINTENANCE_MANAGER
  );
}

export function canAssignRole(actor: MembershipRole, target: MembershipRole): boolean {
  if (actor === MembershipRole.SUPER_ADMIN) return true;
  if (actor === MembershipRole.ADMIN) return target !== MembershipRole.SUPER_ADMIN;
  return false;
}
