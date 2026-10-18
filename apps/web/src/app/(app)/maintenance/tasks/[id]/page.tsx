'use client';

import type { AttachmentDto, MaintenanceTaskDto } from '@bakimos/api-contracts';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, errorText, uploadForm } from '@/lib/api';

export default function MaintenanceTaskPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const [task, setTask] = useState<MaintenanceTaskDto | null>(null);
  const [files, setFiles] = useState<AttachmentDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!auth.tenant) return;
    const tenantId = auth.tenant.tenantId;
    const body = await api<{ data: MaintenanceTaskDto }>(
      `/api/v1/maintenance/tasks/${params.id}`,
      {},
      tenantId,
    );
    setTask(body.data);
    const list = await api<{ data: AttachmentDto[] }>(
      `/api/v1/attachments?entityType=maintenance_task&entityId=${params.id}`,
      {},
      tenantId,
    );
    setFiles(list.data);
  }, [auth.tenant, params.id]);

  useEffect(() => {
    void load().catch((caught: unknown) => setError(errorText(caught)));
  }, [load]);

  async function toggle(itemId: string, checked: boolean) {
    if (!auth.tenant) return;
    setPending(true);
    try {
      const body = await api<{ data: MaintenanceTaskDto }>(
        `/api/v1/maintenance/tasks/${params.id}/items/${itemId}`,
        { method: 'POST', body: JSON.stringify({ checked }) },
        auth.tenant.tenantId,
      );
      setTask(body.data);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  async function complete() {
    if (!auth.tenant || !task) return;
    setPending(true);
    try {
      const body = await api<{ data: MaintenanceTaskDto }>(
        `/api/v1/maintenance/tasks/${params.id}/complete`,
        { method: 'POST', body: JSON.stringify({ version: task.version }) },
        auth.tenant.tenantId,
      );
      setTask(body.data);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  async function upload(file: File) {
    if (!auth.tenant) return;
    const form = new FormData();
    form.append('entityType', 'maintenance_task');
    form.append('entityId', params.id);
    form.append('file', file);
    await uploadForm('/api/v1/attachments', form, auth.tenant.tenantId);
    await load();
  }

  if (error && !task) return <p className="text-sm text-danger">{error}</p>;
  if (!task) return <p className="text-sm">Yükleniyor…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-ink/70">{task.equipment.code}</p>
        <h1 className="text-2xl font-semibold">{task.title}</h1>
        <p className="mt-2 text-sm">
          {task.status} · vade {new Date(task.dueAt).toLocaleString('tr-TR')}
          {task.overdue ? ' · gecikti' : ''}
        </p>
        {task.completedAt ? (
          <p className="text-sm">
            Tamamlayan: {task.completedBy?.name} · {new Date(task.completedAt).toLocaleString('tr-TR')}
          </p>
        ) : null}
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">Kontrol listesi</h2>
        <ul className="space-y-2 text-sm">
          {task.items.map((item) => (
            <li key={item.id}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={task.status !== 'OPEN' || pending}
                  onChange={(event) => void toggle(item.id, event.target.checked)}
                />
                {item.label}
                {item.required ? ' *' : ''}
              </label>
            </li>
          ))}
        </ul>
        {task.status === 'OPEN' ? (
          <Button className="mt-4" disabled={pending} onClick={() => void complete()}>
            Tamamla
          </Button>
        ) : null}
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">Belgeler</h2>
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((file) => (
            <li key={file.id}>
              <a className="underline" href={`/api/v1/attachments/${file.id}/content`} target="_blank">
                {file.fileName}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
