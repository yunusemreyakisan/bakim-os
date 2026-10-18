'use client';

import type { EquipmentDto, FaultDto, ListResponse, MaintenanceTaskDto } from '@bakimos/api-contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '@/components/auth-provider';
import { useConnectivity } from '@/components/connectivity-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, errorText } from '@/lib/api';
import { getCachedEquipment } from '@/lib/offline/equipment-cache';
import { formatInTimeZone } from '@/lib/utils';

type ViewEquipment = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  qrUrl: string | null;
  site: { name: string; timezone: string };
  source: 'server' | 'cache';
};

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const { online } = useConnectivity();
  const [equipment, setEquipment] = useState<ViewEquipment | null>(null);
  const [faults, setFaults] = useState<FaultDto[]>([]);
  const [history, setHistory] = useState<MaintenanceTaskDto[]>([]);
  const [qr, setQr] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.me || !auth.tenant) return;
    const userId = auth.me.id;
    const tenantId = auth.tenant.tenantId;
    void (async () => {
      try {
        if (online) {
          const body = await api<{ data: EquipmentDto }>(
            `/api/v1/equipment/${params.id}`,
            {},
            tenantId,
          );
          setEquipment({
            id: body.data.id,
            code: body.data.code,
            name: body.data.name,
            description: body.data.description,
            status: body.data.status,
            version: body.data.version,
            qrUrl: body.data.qrUrl,
            site: body.data.site,
            source: 'server',
          });
          setQr(await QRCode.toString(body.data.qrUrl, { type: 'svg', margin: 1, width: 160 }));
          const faultList = await api<ListResponse<FaultDto>>(
            `/api/v1/faults?equipmentId=${params.id}`,
            {},
            tenantId,
          );
          setFaults(faultList.data);
          const tasks = await api<ListResponse<MaintenanceTaskDto>>(
            `/api/v1/maintenance/tasks?equipmentId=${params.id}&pageSize=20`,
            {},
            tenantId,
          );
          setHistory(tasks.data);
          setError(null);
          return;
        }
        const cached = await getCachedEquipment(userId, tenantId, params.id);
        if (!cached) {
          setError('Bu ekipman yerel önbellekte yok. Çevrimiçiyken /offline üzerinden indirin.');
          return;
        }
        setEquipment({
          id: cached.id,
          code: cached.code,
          name: cached.name,
          description: cached.description,
          status: cached.status,
          version: cached.version,
          qrUrl: null,
          site: { name: cached.siteName, timezone: cached.siteTimezone },
          source: 'cache',
        });
        setFaults([]);
        setError(null);
      } catch (caught) {
        const cached = await getCachedEquipment(userId, tenantId, params.id);
        if (cached) {
          setEquipment({
            id: cached.id,
            code: cached.code,
            name: cached.name,
            description: cached.description,
            status: cached.status,
            version: cached.version,
            qrUrl: null,
            site: { name: cached.siteName, timezone: cached.siteTimezone },
            source: 'cache',
          });
          setError(errorText(caught) + ' Yerel önbellek gösteriliyor.');
        } else {
          setError(errorText(caught));
        }
      }
    })();
  }, [auth.me, auth.tenant, online, params.id]);

  if (error && !equipment) return <p className="text-sm text-danger">{error}</p>;
  if (!equipment) return <p className="text-sm">Yükleniyor…</p>;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
      <div className="space-y-4">
        <Card>
          <p className="text-sm text-ink/70">
            {equipment.code}
            {equipment.source === 'cache' ? ' · yerel önbellek' : ''}
          </p>
          <h1 className="text-2xl font-semibold">{equipment.name}</h1>
          <p className="mt-2 text-sm">{equipment.description}</p>
          <p className="mt-2 text-sm">
            {equipment.site.name} · {equipment.status} · sürüm {equipment.version}
          </p>
          {equipment.source === 'server' ? (
            <p className="mt-1 text-sm text-ink/70">
              {formatInTimeZone(new Date().toISOString(), equipment.site.timezone)}
            </p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <Link href={`/equipment/${equipment.id}/fault`}>
            <Button className="mt-4">Arıza bildir</Button>
          </Link>
        </Card>
        <Card>
          <h2 className="mb-2 font-medium">Arızalar</h2>
          <ul className="space-y-2 text-sm">
            {faults.map((fault) => (
              <li key={fault.id}>
                <Link className="underline" href={`/faults/${fault.id}`}>
                  {fault.priority} · {fault.status} · {fault.description}
                </Link>
              </li>
            ))}
            {faults.length === 0 ? (
              <li>{equipment.source === 'cache' ? 'Çevrimdışı: sunucu arızaları yok.' : 'Kayıt yok.'}</li>
            ) : null}
          </ul>
        </Card>
        {equipment.source === 'server' ? (
          <Card>
            <h2 className="mb-2 font-medium">Bakım geçmişi</h2>
            <ul className="space-y-2 text-sm">
              {history.map((task) => (
                <li key={task.id}>
                  <Link className="underline" href={`/maintenance/tasks/${task.id}`}>
                    {task.status} · {task.title} · {new Date(task.dueAt).toLocaleDateString('tr-TR')}
                    {task.completedAt
                      ? ` · ${task.completedBy?.name ?? ''} ${new Date(task.completedAt).toLocaleDateString('tr-TR')}`
                      : ''}
                  </Link>
                </li>
              ))}
              {history.length === 0 ? <li>Tamamlanan bakım yok.</li> : null}
            </ul>
          </Card>
        ) : null}
      </div>
      {equipment.qrUrl ? (
        <Card>
          <h2 className="mb-2 text-sm font-medium">Kalıcı QR</h2>
          <div dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="mt-2 break-all text-xs">{equipment.qrUrl}</p>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-2 text-sm font-medium">Kalıcı QR</h2>
          <p className="text-sm text-ink/70">Çevrimdışı önbellekte QR görüntülenmez.</p>
        </Card>
      )}
    </div>
  );
}
