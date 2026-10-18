import type { MembershipRole } from '@bakimos/api-contracts';

export type AuthUser = {
  id: string;
  email: string;
};

export type TenantRequestContext = {
  tenantId: string;
  role: MembershipRole;
  membershipId: string;
};

export type RequestMeta = {
  userAgent?: string;
  ip?: string;
};
