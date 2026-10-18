import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  AssignMaintenanceTaskDto,
  CheckMaintenanceItemDto,
  CompleteMaintenanceTaskDto,
  CreateMaintenancePlanDto,
  ListMaintenancePlansQuery,
  ListMaintenanceTasksQuery,
  UpdateMaintenancePlanDto,
} from './dto/maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance')
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-id')
@UseGuards(TenantGuard, RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get('plans')
  @Roles(...Permission.MAINTENANCE_READ)
  listPlans(
    @CurrentTenant() tenant: TenantRequestContext,
    @Query() query: ListMaintenancePlansQuery,
  ) {
    return this.maintenance.listPlans(tenant.tenantId, query);
  }

  @Post('plans')
  @Roles(...Permission.MAINTENANCE_WRITE)
  @HttpCode(201)
  async createPlan(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateMaintenancePlanDto,
  ) {
    return { data: await this.maintenance.createPlan(tenant.tenantId, user.id, body) };
  }

  @Get('plans/:id')
  @Roles(...Permission.MAINTENANCE_READ)
  async getPlan(
    @CurrentTenant() tenant: TenantRequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.maintenance.getPlan(tenant.tenantId, id) };
  }

  @Patch('plans/:id')
  @Roles(...Permission.MAINTENANCE_WRITE)
  async updatePlan(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMaintenancePlanDto,
  ) {
    return { data: await this.maintenance.updatePlan(tenant.tenantId, user.id, id, body) };
  }

  @Get('tasks')
  @Roles(...Permission.MAINTENANCE_READ)
  listTasks(
    @CurrentTenant() tenant: TenantRequestContext,
    @Query() query: ListMaintenanceTasksQuery,
  ) {
    return this.maintenance.listTasks(tenant.tenantId, query);
  }

  @Post('generate')
  @Roles(...Permission.MAINTENANCE_WRITE)
  async generate(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
  ) {
    return { data: await this.maintenance.generateDueTasks(tenant.tenantId, user.id) };
  }

  @Get('tasks/:id')
  @Roles(...Permission.MAINTENANCE_READ)
  async getTask(
    @CurrentTenant() tenant: TenantRequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.maintenance.getTask(tenant.tenantId, id) };
  }

  @Post('tasks/:id/assign')
  @Roles(...Permission.MAINTENANCE_WRITE)
  async assign(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignMaintenanceTaskDto,
  ) {
    return { data: await this.maintenance.assignTask(tenant.tenantId, user.id, id, body) };
  }

  @Post('tasks/:id/items/:itemId')
  @Roles(...Permission.MAINTENANCE_COMPLETE)
  async checkItem(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: CheckMaintenanceItemDto,
  ) {
    return { data: await this.maintenance.checkItem(tenant.tenantId, user.id, id, itemId, body) };
  }

  @Post('tasks/:id/complete')
  @Roles(...Permission.MAINTENANCE_COMPLETE)
  async complete(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteMaintenanceTaskDto,
  ) {
    return { data: await this.maintenance.completeTask(tenant.tenantId, user.id, id, body) };
  }
}
