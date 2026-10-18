'use client';

import type { ListResponse, SiteDto } from '@bakimos/api-contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, errorText } from '@/lib/api';

export default function NewEquipmentPage() {
  const auth = useAuth();
  const router = useRouter();
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [siteId, setSiteId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!auth.tenant) return;
    void api<ListResponse<SiteDto>>('/api/v1/sites?pageSize=100', {}, auth.tenant.tenantId)
      .then((result) => {
        setSites(result.data);
        setSiteId(result.data[0]?.id ?? '');
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  }, [auth.tenant]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth.tenant) return;
    setPending(true);
    setError(null);
    try {
      const created = await api<{ data: { id: string } }>(
        '/api/v1/equipment',
        { method: 'POST', body: JSON.stringify({ siteId, code, name, description }) },
        auth.tenant.tenantId,
      );
      router.push(`/equipment/${created.data.id}`);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold">Ekipman ekle</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <Label htmlFor="site">Tesis</Label>
          <select
            id="site"
            className="h-10 w-full rounded-md border border-line bg-card px-3 text-sm"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="code">Kod</Label>
          <Input
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="name">Ad</Label>
          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Açıklama</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button disabled={pending || !siteId} type="submit">
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </form>
    </Card>
  );
}
