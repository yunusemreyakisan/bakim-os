'use client';

import { FaultStatus, type FaultDto, type ListResponse } from '@bakimos/api-contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Card } from '@/components/ui/card';
import { api, errorText } from '@/lib/api';

export default function FaultsPage() {
  const auth = useAuth();
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<FaultDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.tenant) return;
    const tenantId = auth.tenant.tenantId;
    setLoading(true);
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    if (status) params.set('status', status);
    void api<ListResponse<FaultDto>>(`/api/v1/faults?${params.toString()}`, {}, tenantId)
      .then((result) => {
        setRows(result.data);
        setError(null);
      })
      .catch((caught: unknown) => setError(errorText(caught)))
      .finally(() => setLoading(false));
  }, [auth.tenant, status]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Arızalar</h1>
        <p className="text-sm text-ink/70">Açık kayıtlardan iş emri üretilebilir.</p>
      </div>
      <select
        className="h-10 rounded-md border border-line bg-card px-3 text-sm"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="">Tüm durumlar</option>
        {Object.values(FaultStatus).map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      {loading ? <p className="text-sm">Yükleniyor…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <Link key={row.id} href={`/faults/${row.id}`}>
            <Card className="flex items-center justify-between hover:border-accent">
              <div>
                <p className="font-medium">
                  {row.equipment.code} · {row.priority}
                </p>
                <p className="text-sm text-ink/70">{row.description}</p>
              </div>
              <span className="text-sm">
                {row.status} · {row.workOrderCount} iş emri
              </span>
            </Card>
          </Link>
        ))}
        {!loading && rows.length === 0 ? <p className="text-sm">Kayıt bulunamadı.</p> : null}
      </div>
    </div>
  );
}
