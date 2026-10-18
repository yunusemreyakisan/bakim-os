import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Permission } from '../common/auth/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import type { AuthUser, TenantRequestContext } from '../common/types';
import { SyncPushDto } from './dto/sync-push.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-id')
@UseGuards(TenantGuard, RolesGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  @Roles(...Permission.SYNC_PUSH)
  @HttpCode(200)
  async push(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Body() body: SyncPushDto,
  ) {
    return { data: await this.sync.push(tenant.tenantId, user.id, body) };
  }
}
