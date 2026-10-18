'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/components/auth-provider';
import { countOpenOperations, listPendingOperations } from '@/lib/offline/pending-operations';
import { getLastSyncAt, runSync, type SyncEngineResult } from '@/lib/offline/sync-engine';
import type { PendingOperation } from '@/lib/offline/types';

type ConnectivityState = {
  online: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  operations: PendingOperation[];
  syncing: boolean;
  lastResult: SyncEngineResult | null;
  refreshQueue: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const ConnectivityContext = createContext<ConnectivityState | null>(null);

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [operations, setOperations] = useState<PendingOperation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncEngineResult | null>(null);
  const syncingRef = useRef(false);

  const refreshQueue = useCallback(async () => {
    if (!auth.me || !auth.tenant) {
      setPendingCount(0);
      setOperations([]);
      setLastSyncAt(null);
      return;
    }
    const [count, ops, last] = await Promise.all([
      countOpenOperations(auth.me.id, auth.tenant.tenantId),
      listPendingOperations(auth.me.id, auth.tenant.tenantId),
      getLastSyncAt(auth.me.id, auth.tenant.tenantId),
    ]);
    setPendingCount(count);
    setOperations(ops);
    setLastSyncAt(last);
  }, [auth.me, auth.tenant]);

  const syncNow = useCallback(async () => {
    if (!auth.me || !auth.tenant || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await runSync(auth.me.id, auth.tenant.tenantId);
      setLastResult(result);
      await refreshQueue();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [auth.me, auth.tenant, refreshQueue]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    if (!online || !auth.me || !auth.tenant) return;
    void syncNow();
  }, [online, auth.me?.id, auth.tenant?.tenantId, syncNow]);

  const value = useMemo(
    () => ({
      online,
      pendingCount,
      lastSyncAt,
      operations,
      syncing,
      lastResult,
      refreshQueue,
      syncNow,
    }),
    [
      online,
      pendingCount,
      lastSyncAt,
      operations,
      syncing,
      lastResult,
      refreshQueue,
      syncNow,
    ],
  );

  return (
    <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  const value = useContext(ConnectivityContext);
  if (!value) throw new Error('ConnectivityProvider gerekli.');
  return value;
}
