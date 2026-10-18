import { equipmentQrPath, type EquipmentDto } from '@bakimos/api-contracts';
import type { Equipment, Site } from '@prisma/client';

export function toEquipmentDto(row: Equipment & { site: Site }, webOrigin: string): EquipmentDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    siteId: row.siteId,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    qrPublicId: row.qrPublicId,
    qrPath: equipmentQrPath(row.qrPublicId),
    qrUrl: `${webOrigin}${equipmentQrPath(row.qrPublicId)}`,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    site: { id: row.site.id, name: row.site.name, timezone: row.site.timezone },
  };
}
