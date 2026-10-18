import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AttachmentEntityType } from '@bakimos/api-contracts';
import type { Response } from 'express';
import { IsEnum, IsUUID } from 'class-validator';
import { Permission } from '../common/auth/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/tenant-context.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AppException } from '../common/errors/app.exception';
import { HttpStatus } from '@nestjs/common';
import type { AuthUser, TenantRequestContext } from '../common/types';
import { AttachmentsService } from './attachments.service';

class AttachmentQuery {
  @IsEnum(AttachmentEntityType)
  entityType!: AttachmentEntityType;

  @IsUUID()
  entityId!: string;
}

class UploadAttachmentDto {
  @IsEnum(AttachmentEntityType)
  entityType!: AttachmentEntityType;

  @IsUUID()
  entityId!: string;
}

@ApiTags('attachments')
@ApiBearerAuth('access-token')
@ApiSecurity('tenant-id')
@UseGuards(TenantGuard, RolesGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  @Roles(...Permission.FAULT_READ, ...Permission.MAINTENANCE_READ)
  async list(@CurrentTenant() tenant: TenantRequestContext, @Query() query: AttachmentQuery) {
    return { data: await this.attachments.list(tenant.tenantId, query.entityType, query.entityId) };
  }

  @Post()
  @Roles(...Permission.ATTACHMENT_WRITE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @HttpCode(201)
  async upload(
    @CurrentTenant() tenant: TenantRequestContext,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadAttachmentDto,
  ) {
    if (!file) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'ATTACHMENT_REQUIRED', 'Dosya gerekli.');
    }
    return {
      data: await this.attachments.upload(tenant.tenantId, user.id, {
        entityType: body.entityType,
        entityId: body.entityId,
        fileName: file.originalname,
        contentType: file.mimetype,
        buffer: file.buffer,
      }),
    };
  }

  @Get(':id/content')
  @Roles(...Permission.FAULT_READ, ...Permission.MAINTENANCE_READ, ...Permission.STOCK_READ)
  async content(
    @CurrentTenant() tenant: TenantRequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const file = await this.attachments.getContent(tenant.tenantId, id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
    response.send(file.buffer);
  }
}
