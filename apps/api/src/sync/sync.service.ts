import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  SyncOperationType,
  SyncResultStatus,
  type SyncPushOperationResult,
  type SyncPushResponse,
} from '@bakimos/api-contracts';
import { EquipmentStatus, FaultStatus, Prisma, SyncOpStatus, SyncOpType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { toFaultDto } from '../faults/fault.presenter';
import { PrismaService } from '../prisma/prisma.service';
import type { SyncPushDto, SyncPushOperationDto } from './dto/sync-push.dto';

const faultInclude = {
  equipment: true,
  _count: { select: { workOrders: true } },
} satisfies Prisma.FaultInclude;

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async push(tenantId: string, userId: string, dto: SyncPushDto): Promise<SyncPushResponse> {
    const results: SyncPushOperationResult[] = [];
    for (const operation of dto.operations) {
      results.push(await this.processOne(tenantId, userId, dto.deviceId, operation));
    }
    return { results };
  }

  private async processOne(
    tenantId: string,
    userId: string,
    deviceId: string,
    operation: SyncPushOperationDto,
  ): Promise<SyncPushOperationResult> {
    if (operation.type !== SyncOperationType.FAULT_CREATE) {
      return {
        operationId: operation.operationId,
        status: SyncResultStatus.REJECTED,
        code: 'UNSUPPORTED_OPERATION',
        message: 'Bu işlem türü desteklenmiyor.',
      };
    }

    const payloadHash = hashPayload(operation);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.syncOperation.findUnique({
          where: {
            tenantId_operationId: { tenantId, operationId: operation.operationId },
          },
        });
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            return {
              operationId: operation.operationId,
              status: SyncResultStatus.CONFLICT,
              code: 'PAYLOAD_CONFLICT',
              message: 'Aynı operationId farklı içerikle tekrar gönderildi.',
            };
          }
          return this.duplicateResult(tx, existing);
        }

        const equipment = await tx.equipment.findFirst({
          where: {
            id: operation.payload.equipmentId,
            tenantId,
            status: { not: EquipmentStatus.ARCHIVED },
          },
        });
        if (!equipment) {
          await tx.syncOperation.create({
            data: {
              tenantId,
              userId,
              deviceId,
              operationId: operation.operationId,
              type: SyncOpType.FAULT_CREATE,
              payloadHash,
              status: SyncOpStatus.REJECTED,
              resultCode: 'EQUIPMENT_NOT_FOUND',
              resultMessage: 'Ekipman bulunamadı veya erişim yok.',
              clientCreatedAt: new Date(operation.clientCreatedAt),
            },
          });
          return {
            operationId: operation.operationId,
            status: SyncResultStatus.REJECTED,
            code: 'EQUIPMENT_NOT_FOUND',
            message: 'Ekipman bulunamadı veya erişim yok.',
          };
        }

        const fault = await tx.fault.create({
          data: {
            tenantId,
            equipmentId: equipment.id,
            reporterId: userId,
            description: operation.payload.description.trim(),
            priority: operation.payload.priority,
            status: FaultStatus.OPEN,
          },
          include: faultInclude,
        });
        await tx.syncOperation.create({
          data: {
            tenantId,
            userId,
            deviceId,
            operationId: operation.operationId,
            type: SyncOpType.FAULT_CREATE,
            payloadHash,
            status: SyncOpStatus.APPLIED,
            entityType: 'fault',
            entityId: fault.id,
            resultCode: 'APPLIED',
            resultMessage: 'Arıza kaydı oluşturuldu.',
            clientCreatedAt: new Date(operation.clientCreatedAt),
          },
        });
        await this.audit.write(tx, {
          tenantId,
          actorId: userId,
          action: 'fault.created',
          entityType: 'fault',
          entityId: fault.id,
          metadata: {
            equipmentId: equipment.id,
            priority: fault.priority,
            operationId: operation.operationId,
            offline: true,
          },
        });
        return {
          operationId: operation.operationId,
          status: SyncResultStatus.APPLIED,
          code: 'APPLIED',
          message: 'Arıza kaydı oluşturuldu.',
          entityType: 'fault',
          entityId: fault.id,
          entity: toFaultDto(fault),
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.syncOperation.findUnique({
          where: {
            tenantId_operationId: { tenantId, operationId: operation.operationId },
          },
        });
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            return {
              operationId: operation.operationId,
              status: SyncResultStatus.CONFLICT,
              code: 'PAYLOAD_CONFLICT',
              message: 'Aynı operationId farklı içerikle tekrar gönderildi.',
            };
          }
          return this.duplicateResult(this.prisma, existing);
        }
      }
      if (error instanceof AppException) throw error;
      return {
        operationId: operation.operationId,
        status: SyncResultStatus.RETRYABLE,
        code: 'SYNC_TRANSIENT',
        message: 'Geçici bir hata oluştu. Yeniden deneyin.',
      };
    }
  }

  private async duplicateResult(
    db: PrismaService | Prisma.TransactionClient,
    existing: {
      operationId: string;
      status: SyncOpStatus;
      resultCode: string | null;
      resultMessage: string | null;
      entityType: string | null;
      entityId: string | null;
    },
  ): Promise<SyncPushOperationResult> {
    if (existing.status === SyncOpStatus.REJECTED) {
      return {
        operationId: existing.operationId,
        status: SyncResultStatus.REJECTED,
        code: existing.resultCode ?? 'REJECTED',
        message: existing.resultMessage ?? 'İşlem daha önce reddedildi.',
      };
    }
    if (existing.status === SyncOpStatus.CONFLICT) {
      return {
        operationId: existing.operationId,
        status: SyncResultStatus.CONFLICT,
        code: existing.resultCode ?? 'PAYLOAD_CONFLICT',
        message: existing.resultMessage ?? 'Çakışma.',
      };
    }
    let entity = undefined;
    if (existing.entityType === 'fault' && existing.entityId) {
      const fault = await db.fault.findUnique({
        where: { id: existing.entityId },
        include: faultInclude,
      });
      if (fault) entity = toFaultDto(fault);
    }
    return {
      operationId: existing.operationId,
      status: SyncResultStatus.DUPLICATE,
      code: 'DUPLICATE',
      message: 'İşlem daha önce uygulandı.',
      entityType: existing.entityType ?? undefined,
      entityId: existing.entityId ?? undefined,
      entity,
    };
  }
}

function hashPayload(operation: SyncPushOperationDto): string {
  const canonical = JSON.stringify({
    type: operation.type,
    equipmentId: operation.payload.equipmentId,
    description: operation.payload.description.trim(),
    priority: operation.payload.priority,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
