import { HttpStatus, Injectable } from '@nestjs/common';
import type { MaintenanceReportDto } from '@bakimos/api-contracts';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async maintenance(tenantId: string, fromRaw: string, toRaw: string): Promise<MaintenanceReportDto> {
    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_RANGE',
        'Geçerli bir from/to tarih aralığı gerekli.',
      );
    }
    const maxMs = 366 * 86_400_000;
    if (to.getTime() - from.getTime() > maxMs) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'RANGE_TOO_WIDE',
        'Rapor aralığı en fazla 366 gün olabilir.',
      );
    }

    const faults = await this.prisma.fault.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      include: {
        equipment: { select: { id: true, code: true, name: true } },
        workOrders: { select: { startedAt: true }, orderBy: { startedAt: 'asc' } },
      },
    });

    const firstResponses: number[] = [];
    const closes: number[] = [];
    for (const fault of faults) {
      const firstWork = fault.workOrders.find((item) => item.startedAt)?.startedAt ?? null;
      const first = fault.acknowledgedAt ?? firstWork;
      if (first) firstResponses.push((first.getTime() - fault.createdAt.getTime()) / 60_000);
      if (fault.closedAt) closes.push((fault.closedAt.getTime() - fault.createdAt.getTime()) / 60_000);
    }

    const dueTasks = await this.prisma.maintenanceTask.findMany({
      where: { tenantId, dueAt: { gte: from, lte: to } },
    });
    const completedOnTime = dueTasks.filter(
      (task) =>
        task.status === 'COMPLETED' &&
        task.completedAt &&
        task.completedAt.getTime() <= task.dueAt.getTime(),
    ).length;

    const counts = new Map<string, { equipmentId: string; code: string; name: string; count: number }>();
    for (const fault of faults) {
      const current = counts.get(fault.equipmentId) ?? {
        equipmentId: fault.equipment.id,
        code: fault.equipment.code,
        name: fault.equipment.name,
        count: 0,
      };
      current.count += 1;
      counts.set(fault.equipmentId, current);
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      faultCount: faults.length,
      avgFirstResponseMinutes: average(firstResponses),
      avgCloseMinutes: average(closes),
      plannedCompliancePercent:
        dueTasks.length === 0 ? null : Math.round((completedOnTime / dueTasks.length) * 1000) / 10,
      dueTaskCount: dueTasks.length,
      completedOnTimeCount: completedOnTime,
      recurringFaults: [...counts.values()].filter((row) => row.count >= 2).sort((a, b) => b.count - a.count),
    };
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, item) => sum + item, 0) / values.length) * 10) / 10;
}
