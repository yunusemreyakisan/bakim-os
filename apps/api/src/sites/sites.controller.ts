import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Permission } from '../common/auth/permissions';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PaginationQuery } from '../common/dto/pagination.query';
import type { TenantRequestContext } from '../common/types';
import { CreateSiteDto } from './dto/create-site.dto';
import { SitesService } from './sites.service';

@ApiTags('sites')
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-id')
@UseGuards(TenantGuard, RolesGuard)
@Controller('sites')
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  @Roles(...Permission.SITE_READ)
  list(@CurrentTenant() tenant: TenantRequestContext, @Query() query: PaginationQuery) {
    return this.sites.list(tenant.tenantId, query.page, query.pageSize);
  }

  @Post()
  @Roles(...Permission.SITE_WRITE)
  @HttpCode(201)
  async create(@CurrentTenant() tenant: TenantRequestContext, @Body() body: CreateSiteDto) {
    return { data: await this.sites.create(tenant.tenantId, body) };
  }
}
