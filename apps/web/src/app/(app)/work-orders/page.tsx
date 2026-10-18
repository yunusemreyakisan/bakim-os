'use client';

import { WorkOrderStatus, type ListResponse, type WorkOrderDto } from '@bakimos/api-contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Card } from '@/components/ui/card';
import { api, errorText } from '@/lib/api';

export default function WorkOrdersPage() {
  const auth = useAuth();
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const [rows, setRows] = useState<WorkOrderDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.tenant) return;
    const tenantId = auth.tenant.tenantId;
    setLoading(true);
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    if (status) params.set('status', status);
    if (mine) params.set('mine', 'true');
    void api<ListResponse<WorkOrderDto>>(`/api/v1/work-orders?${params.toString()}`, {}, tenantId)
      .then((result) => {
        setRows(result.data);
        setError(null);
      })
      .catch((caught: unknown) => setError(errorText(caught)))
      .finally(() => setLoading(false));
  }, [auth.tenant, mine, status]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">İş emirleri</h1>
        <p className="text-sm text-ink/70">Atama ve durum geçişleri sunucu kurallarına bağlıdır.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <select
          className="h-10 rounded-md border border-line bg-card px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Tüm durumlar</option>
          {Object.values(WorkOrderStatus).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mine}
            onChange={(event) => setMine(event.target.checked)}
          />
          Yalnızca bana atananlar
        </label>
      </div>
      {loading ? <p className="text-sm">Yükleniyor…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <Link key={row.id} href={`/work-orders/${row.id}`}>
            <Card className="flex items-center justify-between hover:border-accent">
              <div>
                <p className="font-medium">
                  {row.number} · {row.title}
                </p>
                <p className="text-sm text-ink/70">
                  {row.equipment.code} · {row.assignee?.name ?? 'atanmamış'}
                </p>
              </div>
              <span className="text-sm">{row.status}</span>
            </Card>
          </Link>
        ))}
        {!loading && rows.length === 0 ? <p className="text-sm">Kayıt bulunamadı.</p> : null}
      </div>
    </div>
  );
}
