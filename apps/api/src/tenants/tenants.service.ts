import { HttpStatus, Injectable } from '@nestjs/common';
import { MembershipRole, Prisma, TenantStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import type { ProvisionTenantResult } from '@bakimos/api-contracts';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { normalizeEmail } from '../common/normalize';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((membership) => ({
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      status: membership.tenant.status,
      role: membership.role,
      createdAt: membership.tenant.createdAt.toISOString(),
      updatedAt: membership.tenant.updatedAt.toISOString(),
    }));
  }

  async provision(dto: CreateTenantDto, bcryptCost: number): Promise<ProvisionTenantResult> {
    const email = normalizeEmail(dto.admin.email);
    const timezone = dto.site?.timezone ?? 'Europe/Istanbul';
    const siteName = dto.site?.name ?? 'Ana Tesis';
    const passwordHash = await bcrypt.hash(dto.admin.password, bcryptCost);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: dto.name.trim(), slug: dto.slug, status: TenantStatus.ACTIVE },
        });
        const site = await tx.site.create({
          data: { tenantId: tenant.id, name: siteName.trim(), timezone },
        });
        const existing = await tx.user.findUnique({ where: { email } });
        const admin = existing
          ? existing
          : await tx.user.create({
              data: {
                email,
                name: dto.admin.name.trim(),
                passwordHash,
              },
            });
        if (existing && existing.status !== 'ACTIVE') {
          throw new AppException(
            HttpStatus.CONFLICT,
            'USER_DISABLED',
            'Bu e-posta ile üyelik açılamaz.',
          );
        }
        const membership = await tx.membership.create({
          data: { tenantId: tenant.id, userId: admin.id, role: MembershipRole.SUPER_ADMIN },
        });
        await this.audit.write(tx, {
          tenantId: tenant.id,
          actorId: admin.id,
          action: 'tenant.created',
          entityType: 'tenant',
          entityId: tenant.id,
          metadata: { slug: tenant.slug },
        });
        await this.audit.write(tx, {
          tenantId: tenant.id,
          actorId: admin.id,
          action: 'membership.created',
          entityType: 'membership',
          entityId: membership.id,
          metadata: { role: membership.role, userId: admin.id },
        });
        return {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            createdAt: tenant.createdAt.toISOString(),
            updatedAt: tenant.updatedAt.toISOString(),
          },
          site: {
            id: site.id,
            tenantId: site.tenantId,
            name: site.name,
            timezone: site.timezone,
            createdAt: site.createdAt.toISOString(),
            updatedAt: site.updatedAt.toISOString(),
          },
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: membership.role,
          },
        };
      });
    } catch (error) {
      if (error instanceof AppException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          HttpStatus.CONFLICT,
          'TENANT_SLUG_TAKEN',
          'Bu şirket kısaltması kullanılıyor.',
        );
      }
      throw error;
    }
  }
}
