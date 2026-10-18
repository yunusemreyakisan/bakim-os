import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { Permission } from '../common/auth/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import type { AuthUser, TenantRequestContext } from '../common/types';
import {
  ArchiveEquipmentDto,
  CreateEquipmentDto,
  ListEquipmentQuery,
  QrPdfDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';
import { EquipmentService } from './equipment.service';
import { isQrPublicId } from './qr-public-id';
import { AppException } from '../common/errors/app.exception';
import { HttpStatus } from '@nestjs/common';

@ApiTags('equipment')
@ApiBearerAuth('access-token')
@Controller('equipment')
export class EquipmentController {
  constructor(
    private readonly equipment: EquipmentService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('by-qr/:qrPublicId')
  async byQr(@CurrentUser() user: AuthUser, @Param('qrPublicId') qrPublicId: string) {
    if (!isQrPublicId(qrPublicId)) {
      throw new AppException(HttpStatus.NOT_FOUND, 'EQUIPMENT_NOT_FOUND', 'Ekipman bulunamadı.');
    }
    return { data: await this.equipment.getByQr(user.id, qrPublicId, this.config.webOrigin) };
  }

  @Get()
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(...Permission.EQUIPMENT_READ)
  @ApiSecurity('tenant-id')
  list(@CurrentTenant() tenant: TenantRequestContext, @Query() query: ListEquipmentQuery) {
    return this.equipment.list(tenant.tenantId, query, this.config.webOrigin);
  }

  @Post('import')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(...Permission.EQUIPMENT_WRITE)
  @ApiSecurity('tenant-id')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async importExcel(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'IMPORT_FILE_REQUIRED', 'Excel dosyası gerekli.');
    }
    return {
      data: await this.equipment.importExcel(tenant.tenantId, user.id, file.buffer, this.config.webOrigin),
    };
  }

  @Post('qr-pdf')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(...Permission.EQUIPMENT_READ)
  @ApiSecurity('tenant-id')
  async qrPdf(
    @CurrentTenant() tenant: TenantRequestContext,
    @Body() body: QrPdfDto,
    @Res() response: Response,
  ) {
    const pdf = await this.equipment.qrPdf(tenant.tenantId, body.equipmentIds, this.config.webOrigin);
    response.status(201);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="bakimos-qr.pdf"');
    response.send(pdf);
  }

  @Get(':id')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(...Permission.EQUIPMENT_READ)
  @ApiSecurity('tenant-id')
  async get(@CurrentTenant() tenant: TenantRequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.equipment.getById(tenant.tenantId, id, this.config.webOrigin) };
  }

  @Post()
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(...Permission.EQUIPMENT_WRITE)
  @ApiSecurity('tenant-id')
  @HttpCode(201)
  async create(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateEquipmentDto,
  ) {
    return {
      data: await this.equipment.create(tenant.tenantId, user.id, body, this.config.webOrigin),
    };
  }

  @Patch(':id')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(...Permission.EQUIPMENT_WRITE)
  @ApiSecurity('tenant-id')
  async update(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEquipmentDto,
  ) {
    return {
      data: await this.equipment.update(tenant.tenantId, user.id, id, body, this.config.webOrigin),
    };
  }

  @Post(':id/archive')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(...Permission.EQUIPMENT_WRITE)
  @ApiSecurity('tenant-id')
  async archive(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ArchiveEquipmentDto,
  ) {
    return {
      data: await this.equipment.archive(tenant.tenantId, user.id, id, body, this.config.webOrigin),
    };
  }
}
