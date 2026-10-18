'use client';

import type { ListResponse, MaintenancePlanDto, MaintenanceTaskDto } from '@bakimos/api-contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, errorText } from '@/lib/api';

export default function MaintenancePage() {
  const auth = useAuth();
  const [overdue, setOverdue] = useState<MaintenanceTaskDto[]>([]);
  const [upcoming, setUpcoming] = useState<MaintenanceTaskDto[]>([]);
  const [plans, setPlans] = useState<MaintenancePlanDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    if (!auth.tenant) return;
    const tenantId = auth.tenant.tenantId;
    try {
      const [late, soon, planList] = await Promise.all([
        api<ListResponse<MaintenanceTaskDto>>('/api/v1/maintenance/tasks?overdue=true&pageSize=50', {}, tenantId),
        api<ListResponse<MaintenanceTaskDto>>(
          '/api/v1/maintenance/tasks?upcomingDays=7&pageSize=50',
          {},
          tenantId,
        ),
        api<ListResponse<MaintenancePlanDto>>('/api/v1/maintenance/plans?pageSize=50', {}, tenantId),
      ]);
      setOverdue(late.data);
      setUpcoming(soon.data);
      setPlans(planList.data);
      setError(null);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  useEffect(() => {
    void load();
  }, [auth.tenant]);

  async function generate() {
    if (!auth.tenant) return;
    setPending(true);
    try {
      await api('/api/v1/maintenance/generate', { method: 'POST' }, auth.tenant.tenantId);
      await load();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Periyodik bakım</h1>
          <p className="text-sm text-ink/70">Yaklaşan ve geciken görevler.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={pending} onClick={() => void generate()}>
            Görevleri üret
          </Button>
          <Link href="/maintenance/plans/new">
            <Button>Plan ekle</Button>
          </Link>
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Card>
        <h2 className="mb-2 font-medium">Geciken</h2>
        <TaskList rows={overdue} />
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">Yaklaşan (7 gün)</h2>
        <TaskList rows={upcoming} />
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">Planlar</h2>
        <ul className="space-y-2 text-sm">
          {plans.map((plan) => (
            <li key={plan.id}>
              {plan.equipment.code} · {plan.title} · {plan.cadence} · sonraki{' '}
              {new Date(plan.nextDueAt).toLocaleDateString('tr-TR')}
            </li>
          ))}
          {plans.length === 0 ? <li>Plan yok.</li> : null}
        </ul>
      </Card>
    </div>
  );
}

function TaskList({ rows }: { rows: MaintenanceTaskDto[] }) {
  if (rows.length === 0) return <p className="text-sm">Kayıt yok.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.id}>
          <Link className="underline" href={`/maintenance/tasks/${row.id}`}>
            {row.equipment.code} · {row.title} · {row.status}
            {row.overdue ? ' · gecikti' : ''}
          </Link>
        </li>
      ))}
    </ul>
  );
}
