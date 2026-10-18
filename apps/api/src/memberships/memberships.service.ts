import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import type { MembershipRole } from '@bakimos/api-contracts';
import bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { canAssignRole } from '../common/auth/permissions';
import { AppException } from '../common/errors/app.exception';
import { normalizeEmail } from '../common/normalize';
import { pageArgs, pageMeta } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMembershipDto } from './dto/create-membership.dto';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, page = 1, pageSize = 20) {
    const args = pageArgs(page, pageSize);
    const where = { tenantId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.membership.count({ where }),
      this.prisma.membership.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'asc' },
        skip: args.skip,
        take: args.take,
      }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        email: row.user.email,
        name: row.user.name,
        role: row.role,
        createdAt: row.createdAt.toISOString(),
      })),
      meta: pageMeta(args.page, args.pageSize, total),
    };
  }

  async create(
    tenantId: string,
    actorId: string,
    actorRole: MembershipRole,
    dto: CreateMembershipDto,
    bcryptCost: number,
  ) {
    if (!canAssignRole(actorRole, dto.role)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'ROLE_ASSIGN_FORBIDDEN',
        'Bu rolü atayamazsınız.',
      );
    }
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing && !dto.password) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'PASSWORD_REQUIRED',
        'Yeni kullanıcı için parola gerekli.',
      );
    }
    if (existing && existing.status !== UserStatus.ACTIVE) {
      throw new AppException(HttpStatus.CONFLICT, 'USER_DISABLED', 'Bu kullanıcı aktif değil.');
    }
    const passwordHash =
      existing || !dto.password ? null : await bcrypt.hash(dto.password, bcryptCost);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user =
          existing ??
          (await tx.user.create({
            data: {
              email,
              name: dto.name.trim(),
              passwordHash: passwordHash ?? '',
            },
          }));
        const membership = await tx.membership.create({
          data: { tenantId, userId: user.id, role: dto.role },
        });
        await this.audit.write(tx, {
          tenantId,
          actorId,
          action: 'membership.created',
          entityType: 'membership',
          entityId: membership.id,
          metadata: { role: membership.role, userId: user.id },
        });
        return {
          id: membership.id,
          userId: user.id,
          email: user.email,
          name: user.name,
          role: membership.role,
          createdAt: membership.createdAt.toISOString(),
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          HttpStatus.CONFLICT,
          'MEMBERSHIP_EXISTS',
          'Kullanıcı bu şirkete zaten üye.',
        );
      }
      throw error;
    }
  }
}
