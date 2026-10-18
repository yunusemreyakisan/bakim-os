import { HttpStatus, Injectable } from '@nestjs/common';
import { EquipmentStatus, Prisma } from '@prisma/client';
import type { EquipmentDto, EquipmentImportResult, EquipmentImportRowResult } from '@bakimos/api-contracts';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { normalizeEquipmentCode } from '../common/normalize';
import { pageArgs, pageMeta } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ArchiveEquipmentDto,
  CreateEquipmentDto,
  ListEquipmentQuery,
  UpdateEquipmentDto,
} from './dto/equipment.dto';
import { toEquipmentDto } from './equipment.presenter';
import { createQrPublicId } from './qr-public-id';

const equipmentInclude = { site: true } satisfies Prisma.EquipmentInclude;

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: ListEquipmentQuery, webOrigin: string) {
    if (query.siteId) await this.assertSite(tenantId, query.siteId);
    const args = pageArgs(query.page, query.pageSize);
    const where: Prisma.EquipmentWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : { status: { not: EquipmentStatus.ARCHIVED } }),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search.trim().toUpperCase(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.equipment.count({ where }),
      this.prisma.equipment.findMany({
        where,
        include: equipmentInclude,
        orderBy: { createdAt: 'desc' },
        skip: args.skip,
        take: args.take,
      }),
    ]);
    return {
      data: rows.map((row) => toEquipmentDto(row, webOrigin)),
      meta: pageMeta(args.page, args.pageSize, total),
    };
  }

  async getById(tenantId: string, id: string, webOrigin: string): Promise<EquipmentDto> {
    const row = await this.prisma.equipment.findFirst({
      where: { id, tenantId },
      include: equipmentInclude,
    });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, 'EQUIPMENT_NOT_FOUND', 'Ekipman bulunamadı.');
    return toEquipmentDto(row, webOrigin);
  }

  async getByQr(userId: string, qrPublicId: string, webOrigin: string): Promise<EquipmentDto> {
    const row = await this.prisma.equipment.findUnique({
      where: { qrPublicId },
      include: equipmentInclude,
    });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, 'EQUIPMENT_NOT_FOUND', 'Ekipman bulunamadı.');
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: row.tenantId, userId } },
      include: { tenant: true, user: true },
    });
    if (
      !membership ||
      membership.tenant.status !== 'ACTIVE' ||
      membership.user.status !== 'ACTIVE'
    ) {
      throw new AppException(HttpStatus.NOT_FOUND, 'EQUIPMENT_NOT_FOUND', 'Ekipman bulunamadı.');
    }
    return toEquipmentDto(row, webOrigin);
  }

  async create(
    tenantId: string,
    actorId: string,
    dto: CreateEquipmentDto,
    webOrigin: string,
  ): Promise<EquipmentDto> {
    await this.assertSite(tenantId, dto.siteId);
    const code = normalizeEquipmentCode(dto.code);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const row = await tx.equipment.create({
            data: {
              tenantId,
              siteId: dto.siteId,
              code,
              name: dto.name.trim(),
              description: emptyToNull(dto.description),
              qrPublicId: createQrPublicId(),
            },
            include: equipmentInclude,
          });
          await this.audit.write(tx, {
            tenantId,
            actorId,
            action: 'equipment.created',
            entityType: 'equipment',
            entityId: row.id,
            metadata: { code: row.code, siteId: row.siteId },
          });
          return row;
        });
        return toEquipmentDto(created, webOrigin);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = String(error.meta?.target ?? '');
          if (target.includes('qrPublicId') && attempt < 2) continue;
          throw new AppException(
            HttpStatus.CONFLICT,
            'EQUIPMENT_CODE_TAKEN',
            'Bu ekipman kodu şirkette kullanılıyor.',
          );
        }
        throw error;
      }
    }
    throw new AppException(HttpStatus.CONFLICT, 'QR_ALLOCATION_FAILED', 'QR kimliği üretilemedi.');
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateEquipmentDto,
    webOrigin: string,
  ): Promise<EquipmentDto> {
    if (dto.siteId) await this.assertSite(tenantId, dto.siteId);
    const current = await this.getById(tenantId, id, webOrigin);
    if (current.status === EquipmentStatus.ARCHIVED) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'EQUIPMENT_ARCHIVED',
        'Arşivlenmiş ekipman güncellenemez.',
      );
    }
    try {
      const count = await this.prisma.$transaction(async (tx) => {
        const result = await tx.equipment.updateMany({
          where: { id, tenantId, version: dto.version, status: { not: EquipmentStatus.ARCHIVED } },
          data: {
            ...(dto.siteId ? { siteId: dto.siteId } : {}),
            ...(dto.code ? { code: normalizeEquipmentCode(dto.code) } : {}),
            ...(dto.name ? { name: dto.name.trim() } : {}),
            ...(dto.description !== undefined ? { description: emptyToNull(dto.description) } : {}),
            ...(dto.status ? { status: dto.status } : {}),
            version: { increment: 1 },
          },
        });
        if (result.count === 1) {
          await this.audit.write(tx, {
            tenantId,
            actorId,
            action: 'equipment.updated',
            entityType: 'equipment',
            entityId: id,
            metadata: { version: dto.version + 1 },
          });
        }
        return result.count;
      });
      if (count !== 1) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'VERSION_CONFLICT',
          'Ekipman başka bir işlemle güncellendi.',
        );
      }
      return this.getById(tenantId, id, webOrigin);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          HttpStatus.CONFLICT,
          'EQUIPMENT_CODE_TAKEN',
          'Bu ekipman kodu şirkette kullanılıyor.',
        );
      }
      throw error;
    }
  }

  async archive(
    tenantId: string,
    actorId: string,
    id: string,
    dto: ArchiveEquipmentDto,
    webOrigin: string,
  ): Promise<EquipmentDto> {
    const current = await this.getById(tenantId, id, webOrigin);
    if (current.status === EquipmentStatus.ARCHIVED) return current;
    const count = await this.prisma.$transaction(async (tx) => {
      const result = await tx.equipment.updateMany({
        where: { id, tenantId, version: dto.version, status: { not: EquipmentStatus.ARCHIVED } },
        data: { status: EquipmentStatus.ARCHIVED, version: { increment: 1 } },
      });
      if (result.count === 1) {
        await this.audit.write(tx, {
          tenantId,
          actorId,
          action: 'equipment.archived',
          entityType: 'equipment',
          entityId: id,
          metadata: { version: dto.version + 1 },
        });
      }
      return result.count;
    });
    if (count !== 1) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'VERSION_CONFLICT',
        'Ekipman başka bir işlemle güncellendi.',
      );
    }
    return this.getById(tenantId, id, webOrigin);
  }

  async importExcel(
    tenantId: string,
    actorId: string,
    buffer: Buffer,
    webOrigin: string,
  ): Promise<EquipmentImportResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'IMPORT_EMPTY', 'Excel sayfası boş.');
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
      defval: '',
    });
    const results: EquipmentImportRowResult[] = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;
    for (const [index, raw] of rows.entries()) {
      const row = index + 2;
      const mapped = mapImportRow(raw);
      if (!mapped.code || !mapped.name || !mapped.siteName) {
        failed += 1;
        results.push({
          row,
          status: 'error',
          message: 'Kod, ad ve site adı zorunludur.',
        });
        continue;
      }
      try {
        const site = await this.prisma.site.findFirst({
          where: { tenantId, name: { equals: mapped.siteName, mode: 'insensitive' } },
        });
        if (!site) {
          failed += 1;
          results.push({ row, status: 'error', code: mapped.code, message: 'Site bulunamadı.' });
          continue;
        }
        const equipment = await this.create(
          tenantId,
          actorId,
          {
            siteId: site.id,
            code: mapped.code,
            name: mapped.name,
            description: mapped.description,
          },
          webOrigin,
        );
        created += 1;
        results.push({
          row,
          status: 'created',
          code: equipment.code,
          equipmentId: equipment.id,
          message: 'Oluşturuldu.',
        });
      } catch (error) {
        if (error instanceof AppException && error.getStatus() === 409) {
          skipped += 1;
          results.push({
            row,
            status: 'skipped',
            code: mapped.code,
            message: 'Kod zaten kayıtlı.',
          });
          continue;
        }
        failed += 1;
        results.push({
          row,
          status: 'error',
          code: mapped.code,
          message: error instanceof Error ? error.message : 'Satır işlenemedi.',
        });
      }
    }
    return { created, skipped, failed, rows: results };
  }

  async qrPdf(tenantId: string, equipmentIds: string[], webOrigin: string): Promise<Buffer> {
    if (equipmentIds.length === 0 || equipmentIds.length > 100) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'QR_SELECTION',
        '1 ile 100 arasında ekipman seçin.',
      );
    }
    const rows = await this.prisma.equipment.findMany({
      where: { tenantId, id: { in: equipmentIds } },
      include: equipmentInclude,
      orderBy: { code: 'asc' },
    });
    if (rows.length !== equipmentIds.length) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'EQUIPMENT_NOT_FOUND',
        'Seçilen ekipmanların bir kısmı bulunamadı.',
      );
    }
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const row of rows) {
      const dto = toEquipmentDto(row, webOrigin);
      const png = await QRCode.toBuffer(dto.qrUrl, { type: 'png', margin: 1, width: 240 });
      const page = pdf.addPage([298, 210]);
      const image = await pdf.embedPng(png);
      page.drawImage(image, { x: 24, y: 50, width: 120, height: 120 });
      page.drawText('BakimOS', { x: 160, y: 160, size: 12, font, color: rgb(0.08, 0.12, 0.2) });
      page.drawText(dto.code, { x: 160, y: 138, size: 16, font });
      page.drawText(dto.name.slice(0, 28), { x: 160, y: 116, size: 10, font });
      page.drawText(dto.site.name.slice(0, 28), { x: 160, y: 100, size: 10, font });
      page.drawText(dto.qrPublicId, { x: 24, y: 28, size: 8, font });
    }
    return Buffer.from(await pdf.save());
  }

  private async assertSite(tenantId: string, siteId: string): Promise<void> {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId } });
    if (!site) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'SITE_NOT_IN_TENANT',
        'Tesis bu şirkete ait değil.',
      );
    }
  }
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function mapImportRow(raw: Record<string, unknown>): {
  code: string;
  name: string;
  siteName: string;
  description?: string;
} {
  const lookup = new Map<string, string>();
  for (const [key, value] of Object.entries(raw)) {
    lookup.set(normalizeHeader(key), String(value ?? '').trim());
  }
  return {
    code: lookup.get('code') ?? lookup.get('kod') ?? '',
    name: lookup.get('name') ?? lookup.get('ad') ?? lookup.get('adi') ?? '',
    siteName: lookup.get('site') ?? lookup.get('siteadi') ?? lookup.get('tesis') ?? '',
    description: lookup.get('description') ?? lookup.get('aciklama') ?? undefined,
  };
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9]/g, '');
}
