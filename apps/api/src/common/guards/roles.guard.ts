import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { MembershipRole } from '@bakimos/api-contracts';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException } from '../errors/app.exception';
import type { TenantRequestContext } from '../types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MembershipRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const request = context.switchToHttp().getRequest<{ tenantContext?: TenantRequestContext }>();
    const role = request.tenantContext?.role;
    if (!role || !required.includes(role)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'ROLE_FORBIDDEN', 'Bu işlem için yetkiniz yok.');
    }
    return true;
  }
}
