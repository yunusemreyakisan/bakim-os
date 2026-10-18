import { SetMetadata } from '@nestjs/common';
import type { MembershipRole } from '@bakimos/api-contracts';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: readonly MembershipRole[]) => SetMetadata(ROLES_KEY, [...roles]);
