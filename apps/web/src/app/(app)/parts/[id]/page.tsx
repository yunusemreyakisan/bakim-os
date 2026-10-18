'use client';

import { StockReason, type ListResponse, type PartDto, type StockMovementDto } from '@bakimos/api-contracts';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, errorText } from '@/lib/api';

export default function PartDetailPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const [part, setPart] = useState<PartDto | null>(null);
  const [moves, setMoves] = useState<StockMovementDto[]>([]);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<typeof StockReason.RECEIPT | typeof StockReason.ISSUE>(
    StockReason.RECEIPT,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.tenant) return;
    const tenantId = auth.tenant.tenantId;
    const body = await api<{ data: PartDto }>(`/api/v1/parts/${params.id}`, {}, tenantId);
    setPart(body.data);
    const list = await api<ListResponse<StockMovementDto>>(
      `/api/v1/stock/movements?partId=${params.id}`,
      {},
      tenantId,
    );
    setMoves(list.data);
  }, [auth.tenant, params.id]);

  useEffect(() => {
    void load().catch((caught: unknown) => setError(errorText(caught)));
  }, [load]);

  async function onMove(event: FormEvent) {
    event.preventDefault();
    if (!auth.tenant) return;
    try {
      await api(
        '/api/v1/stock/movements',
        {
          method: 'POST',
          body: JSON.stringify({
            partId: params.id,
            reason,
            quantity: Number(quantity),
          }),
        },
        auth.tenant.tenantId,
      );
      await load();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  if (!part) return <p className="text-sm">{error ?? 'Yükleniyor…'}</p>;

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-2xl font-semibold">
          {part.code} · {part.name}
        </h1>
        <p className="text-sm">
          Stok: {part.quantity} {part.unit} · min {part.minQuantity}
          {part.belowMin ? ' · min altı' : ''}
        </p>
      </Card>
      <Card>
        <form className="flex flex-wrap items-end gap-2" onSubmit={onMove}>
          <div>
            <Label htmlFor="reason">Hareket</Label>
            <select
              id="reason"
              className="h-10 rounded-md border border-line bg-card px-3 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
            >
              <option value={StockReason.RECEIPT}>Giriş</option>
              <option value={StockReason.ISSUE}>Çıkış</option>
            </select>
          </div>
          <div>
            <Label htmlFor="qty">Miktar</Label>
            <Input id="qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <Button type="submit">Uygula</Button>
        </form>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">Hareket geçmişi</h2>
        <ul className="space-y-1 text-sm">
          {moves.map((row) => (
            <li key={row.id}>
              {new Date(row.createdAt).toLocaleString('tr-TR')} · {row.reason} · {row.delta} ·{' '}
              {row.actor.name} · kalan {row.quantityAfter}
              {row.note ? ` · ${row.note}` : ''}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
