import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { pageArgs, pageMeta } from '../common/pagination';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSiteDto } from './dto/create-site.dto';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, page = 1, pageSize = 20) {
    const args = pageArgs(page, pageSize);
    const where = { tenantId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.site.count({ where }),
      this.prisma.site.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: args.skip,
        take: args.take,
      }),
    ]);
    return {
      data: rows.map((site) => ({
        id: site.id,
        tenantId: site.tenantId,
        name: site.name,
        timezone: site.timezone,
        createdAt: site.createdAt.toISOString(),
        updatedAt: site.updatedAt.toISOString(),
      })),
      meta: pageMeta(args.page, args.pageSize, total),
    };
  }

  async create(tenantId: string, dto: CreateSiteDto) {
    try {
      const site = await this.prisma.site.create({
        data: { tenantId, name: dto.name.trim(), timezone: dto.timezone },
      });
      return {
        id: site.id,
        tenantId: site.tenantId,
        name: site.name,
        timezone: site.timezone,
        createdAt: site.createdAt.toISOString(),
        updatedAt: site.updatedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          HttpStatus.CONFLICT,
          'SITE_NAME_TAKEN',
          'Bu tesiste aynı ad kullanılıyor.',
        );
      }
      throw error;
    }
  }
}
