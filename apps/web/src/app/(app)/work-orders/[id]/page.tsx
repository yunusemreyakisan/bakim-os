'use client';

import {
  WorkActivityKind,
  WorkOrderStatus,
  type PartDto,
  type ListResponse,
  type WorkOrderDetailDto,
  type WorkOrderPartUseDto,
} from '@bakimos/api-contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, errorText } from '@/lib/api';

type Assignee = { id: string; name: string; email: string; role: string };

export default function WorkOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrderDetailDto | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [kind, setKind] = useState<(typeof WorkActivityKind)[keyof typeof WorkActivityKind]>(
    WorkActivityKind.ACTION,
  );
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [parts, setParts] = useState<WorkOrderPartUseDto[]>([]);
  const [catalog, setCatalog] = useState<PartDto[]>([]);
  const [partId, setPartId] = useState('');
  const [partQty, setPartQty] = useState('1');

  const load = useCallback(async () => {
    if (!auth.tenant) return;
    const tenantId = auth.tenant.tenantId;
    const body = await api<{ data: WorkOrderDetailDto }>(
      `/api/v1/work-orders/${params.id}`,
      {},
      tenantId,
    );
    setWorkOrder(body.data);
    setAssigneeId(body.data.assignee?.id ?? '');
    if (body.data.canAssign) {
      const list = await api<{ data: Assignee[] }>('/api/v1/work-orders/assignees', {}, tenantId);
      setAssignees(list.data);
    }
    const used = await api<{ data: WorkOrderPartUseDto[] }>(
      `/api/v1/work-orders/${params.id}/parts`,
      {},
      tenantId,
    ).catch(() => ({ data: [] as WorkOrderPartUseDto[] }));
    setParts(used.data);
    const catalogList = await api<ListResponse<PartDto>>('/api/v1/parts?pageSize=50', {}, tenantId).catch(
      () => ({ data: [] as PartDto[] }),
    );
    setCatalog(catalogList.data);
  }, [auth.tenant, params.id]);

  useEffect(() => {
    void load().catch((caught: unknown) => setError(errorText(caught)));
  }, [load]);

  async function mutate(path: string, body?: unknown) {
    if (!auth.tenant) return;
    setPending(true);
    setError(null);
    try {
      const result = await api<{ data: WorkOrderDetailDto }>(
        `/api/v1/work-orders/${params.id}${path}`,
        { method: 'POST', body: body ? JSON.stringify(body) : '{"version":1}' },
        auth.tenant.tenantId,
      );
      setWorkOrder(result.data);
      setAssigneeId(result.data.assignee?.id ?? '');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    if (!workOrder) return;
    await mutate('/assign', { assigneeId, version: workOrder.version });
  }

  async function onActivity(event: FormEvent) {
    event.preventDefault();
    await mutate('/activities', { kind, description });
    setDescription('');
  }

  if (error && !workOrder) return <p className="text-sm text-danger">{error}</p>;
  if (!workOrder) return <p className="text-sm">Yükleniyor…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-ink/70">{workOrder.number}</p>
        <h1 className="text-2xl font-semibold">{workOrder.title}</h1>
        <p className="mt-2 text-sm">{workOrder.description}</p>
        <p className="mt-2 text-sm">
          {workOrder.equipment.code} · {workOrder.status} · sürüm {workOrder.version}
        </p>
        <p className="text-sm">
          Atanan: {workOrder.assignee?.name ?? 'yok'} ·{' '}
          <Link className="underline" href={`/faults/${workOrder.faultId}`}>
            Arızaya dön
          </Link>
        </p>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {workOrder.canClaim ? (
            <Button
              disabled={pending}
              onClick={() => void mutate('/claim', { version: workOrder.version })}
            >
              Üstlen
            </Button>
          ) : null}
          {workOrder.allowedTransitions.map((status) => (
            <Button
              key={status}
              variant={status === WorkOrderStatus.CANCELLED ? 'danger' : 'default'}
              disabled={pending}
              onClick={() => void mutate('/transition', { status, version: workOrder.version })}
            >
              {status}
            </Button>
          ))}
        </div>
      </Card>

      {workOrder.canAssign ? (
        <Card>
          <h2 className="mb-3 font-medium">Teknisyen ata</h2>
          <form className="flex flex-wrap items-end gap-3" onSubmit={onAssign}>
            <div className="min-w-64 flex-1 space-y-1">
              <Label htmlFor="assignee">Atanacak kişi</Label>
              <select
                id="assignee"
                className="h-10 w-full rounded-md border border-line bg-card px-3 text-sm"
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
              >
                <option value="">Seçin</option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.role}
                  </option>
                ))}
              </select>
            </div>
            <Button disabled={pending || !assigneeId} type="submit">
              Ata
            </Button>
          </form>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 font-medium">Kullanılan parçalar</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {parts.map((row) => (
            <li key={row.id}>
              {row.partCode} · {row.partName} · {row.quantity}
            </li>
          ))}
          {parts.length === 0 ? <li>Parça yok.</li> : null}
        </ul>
        {catalog.length > 0 ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!auth.tenant || !partId) return;
              void api(
                `/api/v1/work-orders/${params.id}/parts`,
                {
                  method: 'POST',
                  body: JSON.stringify({ partId, quantity: Number(partQty) }),
                },
                auth.tenant.tenantId,
              )
                .then(() => load())
                .catch((caught: unknown) => setError(errorText(caught)));
            }}
          >
            <select
              className="h-10 rounded-md border border-line bg-card px-3 text-sm"
              value={partId}
              onChange={(event) => setPartId(event.target.value)}
            >
              <option value="">Parça seç</option>
              {catalog.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} ({row.quantity})
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={1}
              className="w-24"
              value={partQty}
              onChange={(event) => setPartQty(event.target.value)}
            />
            <Button type="submit">Düş</Button>
          </form>
        ) : null}
      </Card>
      <Card>
        <h2 className="mb-3 font-medium">Yapılan işlemler</h2>
        <ul className="mb-4 space-y-2 text-sm">
          {workOrder.activities.map((item) => (
            <li key={item.id}>
              {item.kind} · {item.actor.name} · {item.description}
            </li>
          ))}
          {workOrder.activities.length === 0 ? <li>Kayıt yok.</li> : null}
        </ul>
        {workOrder.canAddActivity ? (
          <form className="space-y-3" onSubmit={onActivity}>
            <div className="space-y-1">
              <Label htmlFor="kind">Tür</Label>
              <select
                id="kind"
                className="h-10 w-full rounded-md border border-line bg-card px-3 text-sm"
                value={kind}
                onChange={(event) =>
                  setKind(
                    event.target.value as (typeof WorkActivityKind)[keyof typeof WorkActivityKind],
                  )
                }
              >
                {Object.values(WorkActivityKind).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="activity">Açıklama</Label>
              <Textarea
                id="activity"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </div>
            <Button disabled={pending} type="submit">
              {pending ? 'Kaydediliyor…' : 'İşlem ekle'}
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
