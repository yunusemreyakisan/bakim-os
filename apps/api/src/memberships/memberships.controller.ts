import { Body, Controller, Get, HttpCode, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { Permission } from '../common/auth/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQuery } from '../common/dto/pagination.query';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import type { AuthUser, TenantRequestContext } from '../common/types';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('memberships')
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-id')
@UseGuards(TenantGuard, RolesGuard)
@Controller('memberships')
export class MembershipsController {
  constructor(
    private readonly memberships: MembershipsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  @Roles(...Permission.MEMBERSHIP_READ)
  list(@CurrentTenant() tenant: TenantRequestContext, @Query() query: PaginationQuery) {
    return this.memberships.list(tenant.tenantId, query.page, query.pageSize);
  }

  @Post()
  @Roles(...Permission.MEMBERSHIP_WRITE)
  @HttpCode(201)
  async create(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateMembershipDto,
  ) {
    return {
      data: await this.memberships.create(
        tenant.tenantId,
        user.id,
        tenant.role,
        body,
        this.config.bcryptCost,
      ),
    };
  }
}
