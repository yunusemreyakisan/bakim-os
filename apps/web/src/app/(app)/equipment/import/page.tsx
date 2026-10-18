'use client';

import type { EquipmentImportResult } from '@bakimos/api-contracts';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { errorText, uploadForm } from '@/lib/api';

export default function EquipmentImportPage() {
  const auth = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<EquipmentImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth.tenant || !file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const body = await uploadForm<{ data: EquipmentImportResult }>(
        '/api/v1/equipment/import',
        form,
        auth.tenant.tenantId,
      );
      setResult(body.data);
      setError(null);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <Card className="max-w-2xl space-y-3">
      <h1 className="text-2xl font-semibold">Excel aktarımı</h1>
      <p className="text-sm text-ink/70">Sütunlar: Kod, Ad, Site, Açıklama</p>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          type="file"
          accept=".xlsx"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          required
        />
        <Button type="submit">Yükle</Button>
      </form>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {result ? (
        <div className="text-sm">
          <p>
            Oluştu {result.created} · atlandı {result.skipped} · hata {result.failed}
          </p>
          <ul className="mt-2 space-y-1">
            {result.rows.map((row) => (
              <li key={`${row.row}-${row.code ?? ''}`}>
                Satır {row.row}: {row.status} · {row.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
