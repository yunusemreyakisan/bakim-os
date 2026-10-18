'use client';

import type { EquipmentDto, ListResponse } from '@bakimos/api-contracts';
import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useConnectivity } from '@/components/connectivity-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, errorText } from '@/lib/api';
import { cacheEquipmentList, listCachedEquipment } from '@/lib/offline/equipment-cache';
import type { OfflineEquipment } from '@/lib/offline/types';

export default function OfflinePage() {
  const auth = useAuth();
  const connectivity = useConnectivity();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState<OfflineEquipment[]>([]);
  const [pending, setPending] = useState(false);

  async function download() {
    if (!auth.me || !auth.tenant) return;
    setPending(true);
    setError(null);
    try {
      const result = await api<ListResponse<EquipmentDto>>(
        '/api/v1/equipment?page=1&pageSize=100',
        {},
        auth.tenant.tenantId,
      );
      await cacheEquipmentList(auth.me.id, auth.tenant.tenantId, result.data);
      const local = await listCachedEquipment(auth.me.id, auth.tenant.tenantId);
      setCached(local);
      setMessage(`${local.length} ekipman bu cihaza indirildi.`);
      await connectivity.refreshQueue();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  async function showLocal() {
    if (!auth.me || !auth.tenant) return;
    const local = await listCachedEquipment(auth.me.id, auth.tenant.tenantId);
    setCached(local);
    setMessage(`Yerel önbellekte ${local.length} ekipman var.`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Çevrimdışı veri</h1>
        <p className="text-sm text-ink/70">
          Bağlıyken ekipman listesini indirin. Bağlantı kesilince bu kayıtlarla arıza
          bildirebilirsiniz.
        </p>
      </div>
      <Card className="space-y-3">
        <p className="text-sm">
          Durum: {connectivity.online ? 'çevrimiçi' : 'çevrimdışı'} · Bekleyen işlem:{' '}
          {connectivity.pendingCount}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || !connectivity.online} onClick={() => void download()}>
            {pending ? 'İndiriliyor…' : 'Ekipmanları indir'}
          </Button>
          <Button variant="outline" onClick={() => void showLocal()}>
            Yerel listeyi göster
          </Button>
          <Button
            variant="outline"
            disabled={!connectivity.online || connectivity.syncing}
            onClick={() => void connectivity.syncNow()}
          >
            Kuyruğu senkronize et
          </Button>
        </div>
        {message ? <p className="text-sm text-accent">{message}</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">Yerel ekipman</h2>
        <ul className="space-y-1 text-sm">
          {cached.map((row) => (
            <li key={row.id}>
              {row.code} · {row.name} · {row.siteName}
            </li>
          ))}
          {cached.length === 0 ? <li>Henüz indirilmiş ekipman yok.</li> : null}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">Bekleyen işlemler</h2>
        <ul className="space-y-2 text-sm">
          {connectivity.operations.map((op) => (
            <li key={op.operationId}>
              {op.status} · {op.type} · {op.payload.description.slice(0, 60)}
              {op.lastError ? ` · ${op.lastError}` : ''}
            </li>
          ))}
          {connectivity.operations.length === 0 ? <li>Kuyruk boş.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
