'use client';

import type { MaintenanceReportDto } from '@bakimos/api-contracts';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, errorText } from '@/lib/api';

export default function ReportsPage() {
  const auth = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<MaintenanceReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth.tenant) return;
    try {
      const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
      const toIso = new Date(`${to}T23:59:59.000Z`).toISOString();
      const body = await api<{ data: MaintenanceReportDto }>(
        `/api/v1/reports/maintenance?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
        {},
        auth.tenant.tenantId,
      );
      setReport(body.data);
      setError(null);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Bakım KPI</h1>
      <Card>
        <form className="flex flex-wrap items-end gap-2" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="from">Başlangıç</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="to">Bitiş</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
          </div>
          <Button type="submit">Hesapla</Button>
        </form>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </Card>
      {report ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-sm text-ink/70">Arıza sayısı</p>
            <p className="text-2xl font-semibold">{report.faultCount}</p>
          </Card>
          <Card>
            <p className="text-sm text-ink/70">Ort. müdahale (dk)</p>
            <p className="text-2xl font-semibold">{report.avgFirstResponseMinutes ?? '—'}</p>
          </Card>
          <Card>
            <p className="text-sm text-ink/70">Ort. kapanış (dk)</p>
            <p className="text-2xl font-semibold">{report.avgCloseMinutes ?? '—'}</p>
          </Card>
          <Card>
            <p className="text-sm text-ink/70">Planlı bakım uyumu</p>
            <p className="text-2xl font-semibold">
              {report.plannedCompliancePercent == null ? '—' : `${report.plannedCompliancePercent}%`}
            </p>
            <p className="text-xs text-ink/70">
              {report.completedOnTimeCount}/{report.dueTaskCount} zamanında
            </p>
          </Card>
          <Card className="sm:col-span-2">
            <h2 className="mb-2 font-medium">Tekrarlayan arızalar</h2>
            <ul className="text-sm">
              {report.recurringFaults.map((row) => (
                <li key={row.equipmentId}>
                  {row.code} · {row.name} · {row.count}
                </li>
              ))}
              {report.recurringFaults.length === 0 ? <li>Yok</li> : null}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
