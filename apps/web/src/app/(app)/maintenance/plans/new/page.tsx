'use client';

import { MaintenanceCadence } from '@bakimos/api-contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, errorText } from '@/lib/api';

export default function NewMaintenancePlanPage() {
  const auth = useAuth();
  const router = useRouter();
  const [equipmentId, setEquipmentId] = useState('');
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<(typeof MaintenanceCadence)[keyof typeof MaintenanceCadence]>(
    MaintenanceCadence.WEEKLY,
  );
  const [items, setItems] = useState('Yağ seviyesi\nCıvata kontrolü');
  const [nextDueAt, setNextDueAt] = useState(new Date().toISOString().slice(0, 16));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth.tenant) return;
    setPending(true);
    try {
      await api(
        '/api/v1/maintenance/plans',
        {
          method: 'POST',
          body: JSON.stringify({
            equipmentId,
            title,
            cadence,
            interval: 1,
            nextDueAt: new Date(nextDueAt).toISOString(),
            items: items
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((label) => ({ label, required: true })),
          }),
        },
        auth.tenant.tenantId,
      );
      router.push('/maintenance');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold">Bakım planı</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <Label htmlFor="equipmentId">Ekipman kimliği</Label>
          <Input id="equipmentId" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="title">Başlık</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cadence">Periyot</Label>
          <select
            id="cadence"
            className="h-10 w-full rounded-md border border-line bg-card px-3 text-sm"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as typeof cadence)}
          >
            {Object.values(MaintenanceCadence).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="nextDueAt">İlk vade</Label>
          <Input
            id="nextDueAt"
            type="datetime-local"
            value={nextDueAt}
            onChange={(e) => setNextDueAt(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="items">Kontrol maddeleri (satır satır)</Label>
          <Textarea id="items" value={items} onChange={(e) => setItems(e.target.value)} required />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button disabled={pending} type="submit">
          Kaydet
        </Button>
      </form>
    </Card>
  );
}
