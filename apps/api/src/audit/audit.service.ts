import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditMetadata = Record<string, string | number | boolean | null>;

type AuditWriter = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(
    writer: AuditWriter,
    input: {
      tenantId: string;
      actorId?: string | null;
      action: string;
      entityType: string;
      entityId: string;
      metadata?: AuditMetadata;
    },
  ): Promise<void> {
    await writer.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }
}
