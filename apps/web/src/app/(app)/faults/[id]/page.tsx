'use client';

import { MembershipRole, type AttachmentDto, type FaultDetailDto } from '@bakimos/api-contracts';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, errorText, uploadForm } from '@/lib/api';

const MANAGERS: string[] = [
  MembershipRole.SUPER_ADMIN,
  MembershipRole.ADMIN,
  MembershipRole.MAINTENANCE_MANAGER,
];

export default function FaultDetailPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const router = useRouter();
  const [fault, setFault] = useState<FaultDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [files, setFiles] = useState<AttachmentDto[]>([]);

  const load = useCallback(() => {
    if (!auth.tenant) return;
    void api<{ data: FaultDetailDto }>(`/api/v1/faults/${params.id}`, {}, auth.tenant.tenantId)
      .then(async (body) => {
        setFault(body.data);
        const list = await api<{ data: AttachmentDto[] }>(
          `/api/v1/attachments?entityType=fault&entityId=${params.id}`,
          {},
          auth.tenant?.tenantId,
        );
        setFiles(list.data);
        setError(null);
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  }, [auth.tenant, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function action(path: string) {
    if (!auth.tenant) return;
    setPending(true);
    try {
      const body = await api<{ data: FaultDetailDto }>(
        `/api/v1/faults/${params.id}/${path}`,
        { method: 'POST' },
        auth.tenant.tenantId,
      );
      setFault(body.data);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  async function createWorkOrder() {
    if (!auth.tenant) return;
    setPending(true);
    try {
      const body = await api<{ data: { id: string } }>(
        '/api/v1/work-orders',
        { method: 'POST', body: JSON.stringify({ faultId: params.id }) },
        auth.tenant.tenantId,
      );
      router.push(`/work-orders/${body.data.id}`);
    } catch (caught) {
      setError(errorText(caught));
      setPending(false);
    }
  }

  if (error && !fault) return <p className="text-sm text-danger">{error}</p>;
  if (!fault) return <p className="text-sm">Yükleniyor…</p>;

  const role = auth.tenant?.role;
  const canManage = role ? MANAGERS.includes(role) : false;
  const canAcknowledge = role === MembershipRole.TECHNICIAN || canManage;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-ink/70">
          {fault.equipment.code} · {fault.priority}
        </p>
        <h1 className="text-2xl font-semibold">Arıza</h1>
        <p className="mt-2 text-sm">{fault.description}</p>
        <p className="mt-2 text-sm">Durum: {fault.status}</p>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {canAcknowledge && fault.status === 'OPEN' ? (
            <Button disabled={pending} onClick={() => void action('acknowledge')}>
              Onayla
            </Button>
          ) : null}
          {canManage ? (
            <Button disabled={pending} onClick={() => void createWorkOrder()}>
              {pending ? 'İşleniyor…' : 'İş emri aç'}
            </Button>
          ) : null}
          {canManage && fault.status === 'RESOLVED' ? (
            <Button disabled={pending} onClick={() => void action('close')}>
              Kapat
            </Button>
          ) : null}
          {canManage && fault.status !== 'CLOSED' && fault.status !== 'CANCELLED' ? (
            <Button variant="danger" disabled={pending} onClick={() => void action('cancel')}>
              İptal
            </Button>
          ) : null}
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">İş emirleri</h2>
        <ul className="space-y-2 text-sm">
          {fault.workOrders.map((item) => (
            <li key={item.id}>
              <Link className="underline" href={`/work-orders/${item.id}`}>
                {item.number} · {item.status} · {item.assignee?.name ?? 'atanmamış'}
              </Link>
            </li>
          ))}
          {fault.workOrders.length === 0 ? <li>Henüz iş emri yok.</li> : null}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">Fotoğraflar</h2>
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file || !auth.tenant) return;
            const form = new FormData();
            form.append('entityType', 'fault');
            form.append('entityId', params.id);
            form.append('file', file);
            void uploadForm(`/api/v1/attachments`, form, auth.tenant.tenantId)
              .then(() => load())
              .catch((caught: unknown) => setError(errorText(caught)));
          }}
        />
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((file) => (
            <li key={file.id}>{file.fileName}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
