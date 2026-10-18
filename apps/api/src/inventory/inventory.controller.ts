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
  CreatePartDto,
  CreateStockMovementDto,
  IssueWorkOrderPartDto,
  ListMovementsQuery,
  ListPartsQuery,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-id')
@UseGuards(TenantGuard, RolesGuard)
@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('parts')
  @Roles(...Permission.STOCK_READ)
  listParts(@CurrentTenant() tenant: TenantRequestContext, @Query() query: ListPartsQuery) {
    return this.inventory.listParts(tenant.tenantId, query);
  }

  @Post('parts')
  @Roles(...Permission.STOCK_WRITE)
  @HttpCode(201)
  async createPart(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Body() body: CreatePartDto,
  ) {
    return { data: await this.inventory.createPart(tenant.tenantId, user.id, body) };
  }

  @Get('parts/:id')
  @Roles(...Permission.STOCK_READ)
  async getPart(
    @CurrentTenant() tenant: TenantRequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.inventory.getPart(tenant.tenantId, id) };
  }

  @Get('stock/movements')
  @Roles(...Permission.STOCK_READ)
  listMovements(
    @CurrentTenant() tenant: TenantRequestContext,
    @Query() query: ListMovementsQuery,
  ) {
    return this.inventory.listMovements(tenant.tenantId, query);
  }

  @Post('stock/movements')
  @Roles(...Permission.STOCK_WRITE)
  @HttpCode(201)
  async move(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateStockMovementDto,
  ) {
    return { data: await this.inventory.move(tenant.tenantId, user.id, body) };
  }

  @Get('work-orders/:id/parts')
  @Roles(...Permission.STOCK_READ)
  async workOrderParts(
    @CurrentTenant() tenant: TenantRequestContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.inventory.listWorkOrderParts(tenant.tenantId, id) };
  }

  @Post('work-orders/:id/parts')
  @Roles(...Permission.STOCK_WRITE)
  @HttpCode(201)
  async issueWorkOrderPart(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: IssueWorkOrderPartDto,
  ) {
    return { data: await this.inventory.issueForWorkOrder(tenant.tenantId, user.id, id, body) };
  }
}
