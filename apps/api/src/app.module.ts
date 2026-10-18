import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { APP_CONFIG, type AppConfig } from './config/app-config';
import { AppConfigModule } from './config/app-config.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { EquipmentModule } from './equipment/equipment.module';
import { FaultsModule } from './faults/faults.module';
import { HealthModule } from './health/health.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PrismaModule } from './prisma/prisma.module';
import { SitesModule } from './sites/sites.module';
import { TenantsModule } from './tenants/tenants.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { SyncModule } from './sync/sync.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { InventoryModule } from './inventory/inventory.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ name: 'default', ttl: config.throttleTtlMs, limit: config.throttleLimit }],
      }),
    }),
    HealthModule,
    AuthModule,
    TenantsModule,
    SitesModule,
    MembershipsModule,
    EquipmentModule,
    FaultsModule,
    WorkOrdersModule,
    SyncModule,
    MaintenanceModule,
    InventoryModule,
    AttachmentsModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
