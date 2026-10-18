import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TenantRequestContext } from '../types';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantRequestContext => {
    const request = ctx.switchToHttp().getRequest<{ tenantContext: TenantRequestContext }>();
    return request.tenantContext;
  },
);
