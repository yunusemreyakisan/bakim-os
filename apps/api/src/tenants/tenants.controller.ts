import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { BootstrapTokenGuard } from '../common/guards/bootstrap-token.guard';
import type { AuthUser } from '../common/types';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post()
  @Public()
  @UseGuards(BootstrapTokenGuard)
  @HttpCode(201)
  @ApiHeader({ name: 'X-Bootstrap-Token', required: true })
  @ApiOkResponse({
    description:
      'Operatör kurulum jetonu ile şirket, varsayılan tesis ve süper yönetici oluşturulur.',
  })
  async create(@Body() body: CreateTenantDto) {
    return { data: await this.tenants.provision(body, this.config.bcryptCost) };
  }

  @Get()
  @ApiBearerAuth('access-token')
  async listMine(@CurrentUser() user: AuthUser) {
    return { data: await this.tenants.listForUser(user.id) };
  }
}
