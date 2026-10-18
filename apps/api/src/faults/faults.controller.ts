import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Permission } from '../common/auth/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import type { AuthUser, TenantRequestContext } from '../common/types';
import { CreateFaultDto, ListFaultsQuery } from './dto/fault.dto';
import { FaultsService } from './faults.service';

@ApiTags('faults')
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-id')
@UseGuards(TenantGuard, RolesGuard)
@Controller('faults')
export class FaultsController {
  constructor(private readonly faults: FaultsService) {}

  @Get()
  @Roles(...Permission.FAULT_READ)
  list(@CurrentTenant() tenant: TenantRequestContext, @Query() query: ListFaultsQuery) {
    return this.faults.list(tenant.tenantId, query);
  }

  @Get(':id')
  @Roles(...Permission.FAULT_READ)
  async get(@CurrentTenant() tenant: TenantRequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.faults.getById(tenant.tenantId, id) };
  }

  @Post()
  @Roles(...Permission.FAULT_WRITE)
  @HttpCode(201)
  async create(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateFaultDto,
  ) {
    return { data: await this.faults.create(tenant.tenantId, user.id, body) };
  }

  @Post(':id/acknowledge')
  @Roles(...Permission.FAULT_ACKNOWLEDGE)
  async acknowledge(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.faults.acknowledge(tenant.tenantId, user.id, id) };
  }

  @Post(':id/cancel')
  @Roles(...Permission.FAULT_MANAGE)
  async cancel(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.faults.cancel(tenant.tenantId, user.id, tenant.role, id) };
  }

  @Post(':id/close')
  @Roles(...Permission.FAULT_MANAGE)
  async close(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.faults.close(tenant.tenantId, user.id, tenant.role, id) };
  }
}
