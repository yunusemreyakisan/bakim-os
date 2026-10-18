'use client';

import type { EquipmentDto, ListResponse } from '@bakimos/api-contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useConnectivity } from '@/components/connectivity-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, errorText, getAccessToken } from '@/lib/api';
import { listCachedEquipment } from '@/lib/offline/equipment-cache';

type Row = {
  id: string;
  code: string;
  name: string;
  siteName: string;
  status: string;
  source: 'server' | 'cache';
};

export default function EquipmentListPage() {
  const auth = useAuth();
  const { online } = useConnectivity();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!auth.me || !auth.tenant) return;
    const userId = auth.me.id;
    const tenantId = auth.tenant.tenantId;
    const handle = setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          if (online) {
            const params = new URLSearchParams({ page: '1', pageSize: '20' });
            if (search.trim()) params.set('search', search.trim());
            const result = await api<ListResponse<EquipmentDto>>(
              `/api/v1/equipment?${params.toString()}`,
              {},
              tenantId,
            );
            setRows(
              result.data.map((row) => ({
                id: row.id,
                code: row.code,
                name: row.name,
                siteName: row.site.name,
                status: row.status,
                source: 'server',
              })),
            );
            setFromCache(false);
          } else {
            const local = await listCachedEquipment(userId, tenantId);
            const filtered = search.trim()
              ? local.filter(
                  (row) =>
                    row.code.toLowerCase().includes(search.trim().toLowerCase()) ||
                    row.name.toLowerCase().includes(search.trim().toLowerCase()),
                )
              : local;
            setRows(
              filtered.map((row) => ({
                id: row.id,
                code: row.code,
                name: row.name,
                siteName: row.siteName,
                status: row.status,
                source: 'cache',
              })),
            );
            setFromCache(true);
          }
          setError(null);
        } catch (caught) {
          try {
            const local = await listCachedEquipment(userId, tenantId);
            setRows(
              local.map((row) => ({
                id: row.id,
                code: row.code,
                name: row.name,
                siteName: row.siteName,
                status: row.status,
                source: 'cache',
              })),
            );
            setFromCache(true);
            setError(errorText(caught) + ' Yerel önbellek gösteriliyor.');
          } catch {
            setError(errorText(caught));
          }
        } finally {
          setLoading(false);
        }
      })();
    }, 200);
    return () => clearTimeout(handle);
  }, [auth.me, auth.tenant, online, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ekipman</h1>
          <p className="text-sm text-ink/70">
            {auth.tenant?.role}
            {fromCache ? ' · yerel önbellek' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/equipment/import">
            <Button variant="outline" disabled={!online}>
              Excel aktar
            </Button>
          </Link>
          <Button
            variant="outline"
            disabled={!online || rows.length === 0}
            onClick={() => {
              if (!auth.tenant) return;
              const token = getAccessToken();
              void fetch('/api/v1/equipment/qr-pdf', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Tenant-Id': auth.tenant.tenantId,
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: 'include',
                body: JSON.stringify({ equipmentIds: rows.map((row) => row.id) }),
              }).then(async (response) => {
                if (!response.ok) return;
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'bakimos-qr.pdf';
                link.click();
                URL.revokeObjectURL(url);
              });
            }}
          >
            QR PDF
          </Button>
          <Link href="/equipment/new">
            <Button disabled={!online}>Ekipman ekle</Button>
          </Link>
        </div>
      </div>
      <Input
        placeholder="Kod veya ad ara"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {loading ? <p className="text-sm">Yükleniyor…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <Link key={row.id} href={`/equipment/${row.id}`}>
            <Card className="flex items-center justify-between hover:border-accent">
              <div>
                <p className="font-medium">
                  {row.code} · {row.name}
                </p>
                <p className="text-sm text-ink/70">{row.siteName}</p>
              </div>
              <span className="text-sm">{row.status}</span>
            </Card>
          </Link>
        ))}
        {!loading && rows.length === 0 ? (
          <p className="text-sm">
            Kayıt bulunamadı.
            {!online ? ' Önce çevrimiçiyken /offline sayfasından veri indirin.' : ''}
          </p>
        ) : null}
      </div>
    </div>
  );
}
