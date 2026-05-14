import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import LeftPanel, { type QuotationTemplateConfig } from '@/components/template-builder/LeftPanel';
import PreviewPanel from '@/components/template-builder/PreviewPanel';
import { authStorage } from '@/lib/auth';
import { useAuth, useRequireAuthenticatedSession } from '@/hooks/useAuth';

/** Prefers `API_URL` / `NEXT_PUBLIC_API_URL`; defaults to local Django (`http://localhost:8000`). */
const API_BASE =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const needle = `${name}=`;
  const segments = cookieHeader.split(';').map((s) => s.trim());
  for (const seg of segments) {
    if (seg.startsWith(needle)) {
      return decodeURIComponent(seg.slice(needle.length));
    }
  }
  return null;
}

function getAccessTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  return (
    readCookie(cookieHeader, 'cos_access') ?? readCookie(cookieHeader, 'access_token')
  );
}

async function fetchTenantLabelForTemplate(
  templateId: string,
  token: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/quotations/templates/`, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ id: string; tenant_name?: string }>;
    if (!Array.isArray(rows)) return null;
    const hit = rows.find((r) => String(r.id) === templateId);
    return hit?.tenant_name ?? null;
  } catch {
    return null;
  }
}

function normalizeTemplate(raw: Record<string, unknown>): QuotationTemplateConfig {
  const ps = raw.pricing_style;
  const pricing_style =
    ps === 'simple_total' || ps === 'tax_table' || ps === 'per_head' ? ps : 'simple_total';

  const rawTier = raw.template_type ?? raw.level;
  let template_type: QuotationTemplateConfig['template_type'] = 'classic';
  if (rawTier === 'premium' || rawTier === 'classic' || rawTier === 'minimal') {
    template_type = rawTier;
  } else if (rawTier === 'standard') {
    template_type = 'classic';
  } else if (rawTier === 'simple') {
    template_type = 'minimal';
  }

  return {
    id: String(raw.id ?? ''),
    tenant: String(raw.tenant ?? ''),
    template_type,
    business_name: String(raw.business_name ?? ''),
    tagline: String(raw.tagline ?? ''),
    logo_url: String(raw.logo_url ?? ''),
    cover_image_url: String(raw.cover_image_url ?? ''),
    phone: String(raw.phone ?? ''),
    offices: String(raw.offices ?? ''),
    primary_color: String(raw.primary_color ?? '#1a6b4a'),
    accent_color: String(raw.accent_color ?? '#ffffff'),
    background_color: String(raw.background_color ?? '#ffffff'),
    font_family: String(raw.font_family ?? 'Georgia'),
    footer_text: String(raw.footer_text ?? ''),
    pricing_style,
    tax_percent: Number(raw.tax_percent ?? 0),
    advance_percent: Number(raw.advance_percent ?? 0),
    about_text: String(raw.about_text ?? ''),
    gallery_images: Array.isArray(raw.gallery_images)
      ? (raw.gallery_images as string[])
      : [],
    special_notes: Array.isArray(raw.special_notes)
      ? (raw.special_notes as string[])
      : [],
    terms_clauses: Array.isArray(raw.terms_clauses)
      ? (raw.terms_clauses as string[])
      : [],
  };
}

type PageProps = {
  template: QuotationTemplateConfig | null;
  tenantLabel: string | null;
  error: string | null;
};

export default function AdminTemplateBuilderPage({
  template: initialTemplate,
  tenantLabel,
  error: loadError,
}: PageProps) {
  const router = useRouter();
  const { token } = useAuth();

  const [config, setConfig] = useState<QuotationTemplateConfig | null>(initialTemplate);

  useEffect(() => {
    setConfig(initialTemplate);
  }, [initialTemplate]);

  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  useRequireAuthenticatedSession();

  const templateId = typeof router.query.id === 'string' ? router.query.id : '';

  function updateConfig(key: string, value: unknown) {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
    setSaved(false);
  }

  const displayTenantLabel = useMemo(() => {
    if (!initialTemplate) return '';
    return (
      tenantLabel ||
      String(initialTemplate.business_name ?? '') ||
      'Workspace template'
    );
  }, [tenantLabel, initialTemplate]);

  const saveTemplate = useCallback(async () => {
    const tid = typeof router.query.id === 'string' ? router.query.id : templateId;
    const bearer = authStorage.getAccess() ?? token ?? '';
    if (!tid || !bearer || !config) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/quotations/templates/${tid}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        console.error('[template-builder] PATCH failed', res.status);
        setSaved(false);
        return;
      }
      const body = (await res.json()) as Record<string, unknown>;
      setConfig(normalizeTemplate(body));
      setSaved(true);
    } catch (e) {
      console.error('[template-builder] PATCH error', e);
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }, [config, router.query.id, templateId, token]);

  if (loadError || initialTemplate === null || config === null) {
    return (
      <>
        <Head>
          <title>Quotation template · Error</title>
        </Head>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8fafc] px-6 py-12">
          <p className="text-center text-lg font-semibold text-[#0f172a]">
            {loadError ?? 'Failed to load'}
          </p>
          <p className="max-w-md text-center text-sm text-[#64748b]">
            Check that Django is running at{' '}
            <code className="rounded bg-[#e2e8f0] px-1">http://localhost:8000</code> and that your session cookie includes a valid staff JWT.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/admin/templates"
              className="rounded-lg bg-[#1C3355] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162a47]"
            >
              Back to templates
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#f1f5f9]"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Quotation template · Admin</title>
      </Head>

      <style dangerouslySetInnerHTML={{
        __html: `
          .builder-shell {
            display: grid;
            grid-template-columns: 1fr 1fr;
            height: 100vh;
            overflow: hidden;
          }
          .panel-left {
            border-right: 1px solid #e5e7eb;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .panel-body {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
          }
        `,
      }}
      />

      <div className="builder-shell">
        <div className="panel-left">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1
                className="truncate text-base font-semibold text-[#0f172a]"
                title={displayTenantLabel}
              >
                {displayTenantLabel || '—'}
              </h1>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveTemplate()}
              className="rounded-lg bg-[#1C3355] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </header>

          <LeftPanel config={config} onChange={updateConfig} />

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-[#64748b]">
              {saved && !saving ? (
                <span className="text-emerald-600">Saved</span>
              ) : (
                <span>Unsaved changes</span>
              )}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveTemplate()}
              className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#0f172a] shadow-sm hover:bg-[#f8fafc] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </div>

        <PreviewPanel config={config} />
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const rawId = ctx.params?.id;
  const id =
    typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
  if (!id) {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }

  const token = getAccessTokenFromCookieHeader(ctx.req.headers.cookie);
  if (!token) {
    console.log('NO TOKEN — trying without auth');
    // continue without token for now
  }

  /** Matches Django mount: GET http://localhost:8000/api/quotations/templates/{id}/ */
  const url = `${API_BASE}/api/quotations/templates/${encodeURIComponent(id)}/`;

  try {
    console.log('=== TEMPLATE BUILDER DEBUG ===');
    console.log('Raw ID:', rawId);
    console.log('ID:', id);
    console.log('Token found:', !!token);
    console.log('API URL:', url);

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    console.log('Response status:', res.status);
    console.log('==============================');

    if (!res.ok) {
      return {
        props: {
          template: null,
          tenantLabel: null,
          error: 'Failed to load',
        },
      };
    }

    const rawJson = (await res.json()) as Record<string, unknown>;
    const template = normalizeTemplate(rawJson);
    const tenantLabel = token
      ? await fetchTenantLabelForTemplate(id, token)
      : null;

    return {
      props: {
        template,
        tenantLabel,
        error: null,
      },
    };
  } catch {
    return {
      props: {
        template: null,
        tenantLabel: null,
        error: 'Failed to load',
      },
    };
  }
};
