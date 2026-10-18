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
import {
  AssignWorkOrderDto,
  CreateWorkActivityDto,
  CreateWorkOrderDto,
  ListWorkOrdersQuery,
  TransitionWorkOrderDto,
  VersionedWorkOrderDto,
} from './dto/work-order.dto';
import { WorkOrdersService } from './work-orders.service';

@ApiTags('work-orders')
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-id')
@UseGuards(TenantGuard, RolesGuard)
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrders: WorkOrdersService) {}

  @Get()
  @Roles(...Permission.WORK_ORDER_READ)
  list(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Query() query: ListWorkOrdersQuery,
  ) {
    return this.workOrders.list(tenant.tenantId, user.id, query);
  }

  @Get('assignees')
  @Roles(...Permission.WORK_ORDER_ASSIGN)
  async assignees(@CurrentTenant() tenant: TenantRequestContext) {
    return { data: await this.workOrders.listAssignees(tenant.tenantId) };
  }

  @Get(':id')
  @Roles(...Permission.WORK_ORDER_READ)
  async get(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      data: await this.workOrders.getById(tenant.tenantId, id, { id: user.id, role: tenant.role }),
    };
  }

  @Post()
  @Roles(...Permission.WORK_ORDER_WRITE)
  @HttpCode(201)
  async create(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateWorkOrderDto,
  ) {
    return {
      data: await this.workOrders.create(
        tenant.tenantId,
        user.id,
        { id: user.id, role: tenant.role },
        body,
      ),
    };
  }

  @Post(':id/assign')
  @Roles(...Permission.WORK_ORDER_ASSIGN)
  async assign(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignWorkOrderDto,
  ) {
    return {
      data: await this.workOrders.assign(
        tenant.tenantId,
        user.id,
        { id: user.id, role: tenant.role },
        id,
        body,
      ),
    };
  }

  @Post(':id/claim')
  @Roles(...Permission.WORK_ORDER_EXECUTE)
  async claim(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VersionedWorkOrderDto,
  ) {
    return {
      data: await this.workOrders.claim(
        tenant.tenantId,
        user.id,
        { id: user.id, role: tenant.role },
        id,
        body.version,
      ),
    };
  }

  @Post(':id/transition')
  @Roles(...Permission.WORK_ORDER_EXECUTE)
  async transition(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionWorkOrderDto,
  ) {
    return {
      data: await this.workOrders.transition(
        tenant.tenantId,
        user.id,
        { id: user.id, role: tenant.role },
        id,
        body,
      ),
    };
  }

  @Post(':id/activities')
  @Roles(...Permission.WORK_ORDER_EXECUTE)
  @HttpCode(201)
  async addActivity(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateWorkActivityDto,
  ) {
    return {
      data: await this.workOrders.addActivity(
        tenant.tenantId,
        user.id,
        { id: user.id, role: tenant.role },
        id,
        body,
      ),
    };
  }
}
