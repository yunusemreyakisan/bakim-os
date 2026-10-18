'use client';

import type { MeDto, MembershipDto } from '@bakimos/api-contracts';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refreshSession, setAccessToken } from '@/lib/api';
import { clearEquipmentCacheForUser } from '@/lib/offline/equipment-cache';
import { countPendingForUser } from '@/lib/offline/pending-operations';

const TENANT_KEY = 'bakimos.tenantId';

type AuthState = {
  loading: boolean;
  me: MeDto | null;
  tenant: MembershipDto | null;
  setTenantId: (tenantId: string) => void;
  refreshMe: () => Promise<void>;
  /** false = kullanıcı iptal etti (bekleyen işlem uyarısı) */
  logout: () => Promise<boolean>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeDto | null>(null);
  const [tenantId, setTenantIdState] = useState<string | null>(null);

  async function refreshMe() {
    const profile = await api<{ data: MeDto }>('/api/v1/me');
    setMe(profile.data);
    const stored = sessionStorage.getItem(TENANT_KEY);
    const active = profile.data.memberships.find(
      (item) => item.tenantId === stored && item.tenantStatus === 'ACTIVE',
    );
    const fallback =
      profile.data.memberships.find((item) => item.tenantStatus === 'ACTIVE') ?? null;
    const next = active?.tenantId ?? fallback?.tenantId ?? null;
    setTenantIdState(next);
    if (next) sessionStorage.setItem(TENANT_KEY, next);
  }

  useEffect(() => {
    void (async () => {
      const ok = await refreshSession();
      if (ok) await refreshMe().catch(() => setMe(null));
      setLoading(false);
    })();
  }, []);

  const tenant = useMemo(
    () => me?.memberships.find((item) => item.tenantId === tenantId) ?? null,
    [me, tenantId],
  );

  async function logout(): Promise<boolean> {
    if (me) {
      const pending = await countPendingForUser(me.id);
      if (pending > 0) {
        const proceed = window.confirm(
          `${pending} bekleyen çevrimdışı işlem var. Çıkış bekleyen kayıtları silmez; ` +
            `aynı hesapla yeniden girişte senkron devam eder. Ekipman önbelleği bu cihazdan temizlenir. Devam?`,
        );
        if (!proceed) return false;
      }
      await clearEquipmentCacheForUser(me.id).catch(() => undefined);
    }
    await api('/api/v1/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setMe(null);
    setTenantIdState(null);
    sessionStorage.removeItem(TENANT_KEY);
    return true;
  }

  function setTenantId(next: string) {
    setTenantIdState(next);
    sessionStorage.setItem(TENANT_KEY, next);
  }

  return (
    <AuthContext.Provider value={{ loading, me, tenant, setTenantId, refreshMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider gerekli.');
  return value;
}
