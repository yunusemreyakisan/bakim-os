'use client';

import type { ListResponse, PartDto } from '@bakimos/api-contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, errorText } from '@/lib/api';

export default function PartsPage() {
  const auth = useAuth();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PartDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.tenant) return;
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    if (search.trim()) params.set('search', search.trim());
    void api<ListResponse<PartDto>>(`/api/v1/parts?${params}`, {}, auth.tenant.tenantId)
      .then((result) => {
        setRows(result.data);
        setError(null);
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  }, [auth.tenant, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Yedek parça</h1>
        <Link href="/parts/new">
          <Button>Parça ekle</Button>
        </Link>
      </div>
      <Input placeholder="Kod veya ad" value={search} onChange={(event) => setSearch(event.target.value)} />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <Link key={row.id} href={`/parts/${row.id}`}>
            <Card className="flex items-center justify-between hover:border-accent">
              <div>
                <p className="font-medium">
                  {row.code} · {row.name}
                </p>
                <p className="text-sm text-ink/70">
                  {row.quantity} {row.unit} · min {row.minQuantity}
                </p>
              </div>
              {row.belowMin ? <span className="text-sm text-danger">Min altı</span> : null}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
