'use client';

import Link from 'next/link';
import { useConnectivity } from '@/components/connectivity-provider';
import { Button } from '@/components/ui/button';

export function SyncStatusBar() {
  const { online, pendingCount, lastSyncAt, syncing, syncNow } = useConnectivity();

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-card px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={online ? 'text-accent' : 'text-danger'}
          title={online ? 'Bağlı' : 'Çevrimdışı'}
        >
          {online ? 'Çevrimiçi' : 'Çevrimdışı'}
        </span>
        <span>
          Bekleyen: <strong>{pendingCount}</strong>
        </span>
        <span className="text-ink/70">
          Son senkron:{' '}
          {lastSyncAt ? new Date(lastSyncAt).toLocaleString('tr-TR') : 'henüz yok'}
        </span>
        <Link href="/offline" className="underline">
          Veri indir
        </Link>
      </div>
      <Button size="sm" variant="outline" disabled={syncing || !online} onClick={() => void syncNow()}>
        {syncing ? 'Senkron…' : 'Şimdi senkronize et'}
      </Button>
    </div>
  );
}
