import { Module } from '@nestjs/common';
import { BootstrapTokenGuard } from '../common/guards/bootstrap-token.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, BootstrapTokenGuard],
})
export class TenantsModule {}
