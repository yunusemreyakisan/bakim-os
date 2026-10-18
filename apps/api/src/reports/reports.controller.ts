import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';
import { Permission } from '../common/auth/permissions';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import type { TenantRequestContext } from '../common/types';
import { ReportsService } from './reports.service';

class ReportQuery {
  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;
}

@ApiTags('reports')
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-id')
@UseGuards(TenantGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('maintenance')
  @Roles(...Permission.REPORT_READ)
  async maintenance(@CurrentTenant() tenant: TenantRequestContext, @Query() query: ReportQuery) {
    return { data: await this.reports.maintenance(tenant.tenantId, query.from, query.to) };
  }
}
