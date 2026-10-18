import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { TenantStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../errors/app.exception';
import type { AuthUser, TenantRequestContext } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user: AuthUser;
      tenantContext?: TenantRequestContext;
    }>();
    const header = request.headers['x-tenant-id'];
    const tenantId = Array.isArray(header) ? header[0] : header;
    if (!tenantId || !UUID_RE.test(tenantId)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'TENANT_REQUIRED',
        'Geçerli bir X-Tenant-Id başlığı gerekli.',
      );
    }
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId: request.user.id } },
      include: { tenant: true, user: true },
    });
    if (
      !membership ||
      membership.tenant.status !== TenantStatus.ACTIVE ||
      membership.user.status !== UserStatus.ACTIVE
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'TENANT_FORBIDDEN',
        'Bu şirket için erişiminiz yok.',
      );
    }
    request.tenantContext = {
      tenantId,
      role: membership.role,
      membershipId: membership.id,
    };
    return true;
  }
}
