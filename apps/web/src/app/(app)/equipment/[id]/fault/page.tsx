'use client';

import { FaultPriority, type FaultDto } from '@bakimos/api-contracts';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useConnectivity } from '@/components/connectivity-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, errorText } from '@/lib/api';
import { getCachedEquipment } from '@/lib/offline/equipment-cache';
import { enqueueFaultCreate } from '@/lib/offline/pending-operations';

export default function FaultPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const router = useRouter();
  const connectivity = useConnectivity();
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<FaultDto['priority']>(FaultPriority.MEDIUM);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [equipmentLabel, setEquipmentLabel] = useState<string>(params.id);

  useEffect(() => {
    if (!auth.me || !auth.tenant) return;
    void getCachedEquipment(auth.me.id, auth.tenant.tenantId, params.id).then((row) => {
      if (row) setEquipmentLabel(`${row.code} · ${row.name}`);
    });
  }, [auth.me, auth.tenant, params.id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth.me || !auth.tenant) return;
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      if (connectivity.online) {
        await api(
          '/api/v1/faults',
          {
            method: 'POST',
            body: JSON.stringify({
              equipmentId: params.id,
              description,
              priority,
            }),
          },
          auth.tenant.tenantId,
        );
        router.push(`/equipment/${params.id}`);
        return;
      }

      const cached = await getCachedEquipment(auth.me.id, auth.tenant.tenantId, params.id);
      if (!cached) {
        throw new Error('Bu ekipman yerel önbellekte yok. Önce çevrimiçiyken indirin.');
      }
      const op = await enqueueFaultCreate({
        userId: auth.me.id,
        tenantId: auth.tenant.tenantId,
        payload: {
          equipmentId: params.id,
          description: description.trim(),
          priority,
        },
      });
      await connectivity.refreshQueue();
      setInfo(
        `Arıza bekleyen olarak kaydedildi (${op.status}). Bağlantı gelince sunucuya aktarılacak.`,
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold">Arıza bildir</h1>
      <p className="mb-4 text-sm text-ink/70">
        {equipmentLabel} · {connectivity.online ? 'çevrimiçi' : 'çevrimdışı (yerel kuyruk)'}
      </p>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <Label htmlFor="priority">Öncelik</Label>
          <select
            id="priority"
            className="h-10 w-full rounded-md border border-line bg-card px-3 text-sm"
            value={priority}
            onChange={(event) => setPriority(event.target.value as FaultDto['priority'])}
          >
            {Object.values(FaultPriority).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Açıklama</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            minLength={5}
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {info ? <p className="text-sm text-accent">{info}</p> : null}
        <Button disabled={pending} type="submit">
          {pending
            ? 'Kaydediliyor…'
            : connectivity.online
              ? 'Kaydı aç'
              : 'Yerel olarak kaydet'}
        </Button>
      </form>
    </Card>
  );
}
