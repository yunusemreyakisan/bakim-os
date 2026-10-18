'use client';

import type { EquipmentDto } from '@bakimos/api-contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { api, errorText } from '@/lib/api';

export default function QrPage() {
  const params = useParams<{ qrPublicId: string }>();
  const [equipment, setEquipment] = useState<EquipmentDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ data: EquipmentDto }>(`/api/v1/equipment/by-qr/${params.qrPublicId}`)
      .then((body) => setEquipment(body.data))
      .catch((caught: unknown) => setError(errorText(caught)));
  }, [params.qrPublicId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!equipment) return <p className="text-sm">Ekipman aranıyor…</p>;

  return (
    <Card>
      <p className="text-sm text-ink/70">QR ile bulunan ekipman</p>
      <h1 className="text-2xl font-semibold">
        {equipment.code} · {equipment.name}
      </h1>
      <Link className="mt-4 inline-block text-sm underline" href={`/equipment/${equipment.id}`}>
        Detaya git
      </Link>
    </Card>
  );
}
