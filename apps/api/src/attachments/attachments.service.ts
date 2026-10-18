import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AttachmentDto, AttachmentEntityType } from '@bakimos/api-contracts';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.port';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async list(tenantId: string, entityType: AttachmentEntityType, entityId: string) {
    await this.assertEntity(tenantId, entityType, entityId);
    const rows = await this.prisma.attachment.findMany({
      where: { tenantId, entityType, entityId },
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDto);
  }

  async upload(
    tenantId: string,
    actorId: string,
    input: {
      entityType: AttachmentEntityType;
      entityId: string;
      fileName: string;
      contentType: string;
      buffer: Buffer;
    },
  ): Promise<AttachmentDto> {
    if (!ALLOWED_TYPES.has(input.contentType)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'ATTACHMENT_TYPE',
        'Yalnızca JPEG, PNG veya PDF kabul edilir.',
      );
    }
    if (input.buffer.length === 0 || input.buffer.length > MAX_BYTES) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'ATTACHMENT_SIZE',
        'Dosya 5 MB sınırını aşıyor veya boş.',
      );
    }
    await this.assertEntity(tenantId, input.entityType, input.entityId);
    const id = randomUUID();
    const ext = extension(input.contentType);
    const storageKey = `${tenantId}/${input.entityType}/${input.entityId}/${id}.${ext}`;
    await this.storage.put(storageKey, input.buffer);
    const row = await this.prisma.attachment.create({
      data: {
        id,
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: sanitizeName(input.fileName),
        contentType: input.contentType,
        size: input.buffer.length,
        storageKey,
        uploadedById: actorId,
      },
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
    });
    await this.audit.write(this.prisma, {
      tenantId,
      actorId,
      action: 'attachment.uploaded',
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: { attachmentId: id, size: input.buffer.length },
    });
    return toDto(row);
  }

  async getContent(tenantId: string, id: string): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    const row = await this.prisma.attachment.findFirst({ where: { id, tenantId } });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, 'ATTACHMENT_NOT_FOUND', 'Dosya bulunamadı.');
    const buffer = await this.storage.get(row.storageKey);
    if (!buffer)
      throw new AppException(HttpStatus.NOT_FOUND, 'ATTACHMENT_MISSING', 'Dosya depoda yok.');
    return { buffer, contentType: row.contentType, fileName: row.fileName };
  }

  private async assertEntity(
    tenantId: string,
    entityType: AttachmentEntityType,
    entityId: string,
  ): Promise<void> {
    if (entityType === 'fault') {
      const row = await this.prisma.fault.findFirst({ where: { id: entityId, tenantId } });
      if (!row) throw new AppException(HttpStatus.NOT_FOUND, 'FAULT_NOT_FOUND', 'Arıza bulunamadı.');
      return;
    }
    if (entityType === 'work_order') {
      const row = await this.prisma.workOrder.findFirst({ where: { id: entityId, tenantId } });
      if (!row)
        throw new AppException(HttpStatus.NOT_FOUND, 'WORK_ORDER_NOT_FOUND', 'İş emri bulunamadı.');
      return;
    }
    const row = await this.prisma.maintenanceTask.findFirst({
      where: { id: entityId, tenantId },
    });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, 'MAINTENANCE_TASK_NOT_FOUND', 'Görev bulunamadı.');
  }
}

function toDto(row: {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: Date;
  uploadedBy: { id: string; name: string; email: string };
}): AttachmentDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entityType: row.entityType as AttachmentDto['entityType'],
    entityId: row.entityId,
    fileName: row.fileName,
    contentType: row.contentType,
    size: row.size,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function extension(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'application/pdf') return 'pdf';
  return 'jpg';
}

function sanitizeName(name: string): string {
  return name.replace(/[/\\]/g, '_').slice(0, 180) || 'dosya';
}
