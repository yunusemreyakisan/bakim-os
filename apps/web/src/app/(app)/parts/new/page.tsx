'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, errorText } from '@/lib/api';

export default function NewPartPage() {
  const auth = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [minQuantity, setMinQuantity] = useState('0');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth.tenant) return;
    try {
      const body = await api<{ data: { id: string } }>(
        '/api/v1/parts',
        {
          method: 'POST',
          body: JSON.stringify({ code, name, minQuantity: Number(minQuantity) }),
        },
        auth.tenant.tenantId,
      );
      router.push(`/parts/${body.data.id}`);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <Card className="max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold">Parça kartı</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <Label htmlFor="code">Kod</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="name">Ad</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="min">Minimum</Label>
          <Input id="min" type="number" min={0} value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit">Kaydet</Button>
      </form>
    </Card>
  );
}
