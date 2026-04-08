'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authStorage } from '@/lib/auth';
import { api } from '@/lib/api';

export interface TenantBranding {
  primary_color?: string;
  logo?: string;
}

export interface TenantConfig {
  branding?: TenantBranding;
  features?: Record<string, boolean>;
  locale?: string;
  tax?: Record<string, unknown>;
}

interface TenantContextValue {
  tenantSlug: string | null;
  tenantName: string | null;
  tenantConfig: TenantConfig | null;
}

const TenantContext = createContext<TenantContextValue>({
  tenantSlug: null,
  tenantName: null,
  tenantConfig: null,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantSlug, setTenantSlug]     = useState<string | null>(null);
  const [tenantName, setTenantName]     = useState<string | null>(null);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);

  useEffect(() => {
    const slug = authStorage.getSlug();
    if (!slug) return;

    setTenantSlug(slug);

    api.get('/config').then((data) => {
      setTenantName(data?.name ?? null);
      const cfg: TenantConfig = data?.config ?? data ?? null;
      setTenantConfig(cfg);

      // Apply branding CSS variable
      if (cfg?.branding?.primary_color) {
        document.documentElement.style.setProperty(
          '--color-primary',
          cfg.branding.primary_color,
        );
      }
    }).catch(() => {
      // Non-fatal: config endpoint may not exist yet
    });
  }, []);

  return (
    <TenantContext.Provider value={{ tenantSlug, tenantName, tenantConfig }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
