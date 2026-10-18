'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/components/auth-provider';
import { SyncStatusBar } from '@/components/sync-status-bar';
import { Button } from '@/components/ui/button';

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.me) router.replace('/login');
  }, [auth.loading, auth.me, router]);

  if (auth.loading) return <p className="p-8 text-sm">Oturum kontrol ediliyor…</p>;
  if (!auth.me) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-ink text-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/equipment" className="text-lg font-semibold tracking-tight">
              BakımOS
            </Link>
            <nav className="flex flex-wrap gap-3 text-sm">
              <Link href="/equipment" className="hover:underline">
                Ekipman
              </Link>
              <Link href="/faults" className="hover:underline">
                Arızalar
              </Link>
              <Link href="/work-orders" className="hover:underline">
                İş emirleri
              </Link>
              <Link href="/maintenance" className="hover:underline">
                Bakım
              </Link>
              <Link href="/parts" className="hover:underline">
                Stok
              </Link>
              <Link href="/reports" className="hover:underline">
                Rapor
              </Link>
              <Link href="/offline" className="hover:underline">
                Çevrimdışı
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {auth.me.memberships.length > 1 ? (
              <select
                className="h-9 rounded-md bg-white/10 px-2"
                value={auth.tenant?.tenantId ?? ''}
                onChange={(event) => auth.setTenantId(event.target.value)}
              >
                {auth.me.memberships.map((membership) => (
                  <option key={membership.id} value={membership.tenantId}>
                    {membership.tenantName}
                  </option>
                ))}
              </select>
            ) : (
              <span>{auth.tenant?.tenantName}</span>
            )}
            <span className="hidden sm:inline">{auth.me.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void auth.logout().then((done) => {
                  if (done) router.replace('/login');
                });
              }}
            >
              Çıkış
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <SyncStatusBar />
        {children}
      </main>
    </div>
  );
}
