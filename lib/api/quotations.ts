import { authStorage } from '@/lib/auth';
import type { QuotationData, QuotationSnapshot } from '@/types/quotation';

const API_BASE =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

function previewUrl(tenantSlug: string, id: string): string {
  return `${API_BASE}/api/app/${encodeURIComponent(tenantSlug)}/quotations/${encodeURIComponent(id)}/preview/`;
}

function nextJsPuppeteerPdfUrl(tenantSlug: string, id: string): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  return `${origin}/api/app/${encodeURIComponent(tenantSlug)}/quotations/${encodeURIComponent(id)}/pdf`;
}

function exportPdfUrl(tenantSlug: string, id: string): string {
  return `${API_BASE}/api/app/${encodeURIComponent(tenantSlug)}/quotations/${encodeURIComponent(id)}/export-pdf/`;
}

function messageFromErrorBody(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Request failed';
  const o = body as Record<string, unknown>;
  const detail = o.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((d) => (typeof d === 'string' ? d : JSON.stringify(d)));
    return parts.join('; ');
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const m = (detail as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  const err = o.error;
  if (typeof err === 'string') return err;
  const msg = o.message;
  if (typeof msg === 'string') return msg;
  try {
    return JSON.stringify(body);
  } catch {
    return 'Request failed';
  }
}

function asSectionList(raw: unknown): QuotationSnapshot['sections'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    const s = item as Record<string, unknown>;
    return {
      id: String(s.id ?? `section-${idx}`),
      label: String(s.label ?? ''),
      enabled: Boolean(s.enabled ?? true),
      order: typeof s.order === 'number' ? s.order : idx + 1,
    };
  });
}

function normalizeSnapshot(raw: Record<string, unknown>): QuotationSnapshot {
  return {
    business_name: String(raw.business_name ?? ''),
    tagline: String(raw.tagline ?? ''),
    logo_url: String(raw.logo_url ?? ''),
    primary_color: String(raw.primary_color ?? '#1a6b4a'),
    accent_color: String(raw.accent_color ?? '#ffffff'),
    phone: String(raw.phone ?? ''),
    email: String(raw.email ?? ''),
    since_year:
      raw.since_year !== undefined && raw.since_year !== null
        ? (raw.since_year as string | number)
        : '2013',
    about_text: String(raw.about_text ?? ''),
    sections: asSectionList(raw.sections),
  };
}

function asLineItems(raw: unknown): QuotationData['line_items'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    const qty = Number(r.qty ?? r.quantity ?? 0);
    const rate = Number(r.rate ?? 0);
    const amount = Number(r.amount ?? r.total ?? 0);
    return {
      description: String(
        r.description ?? r.label ?? r.name ?? r.ingredient_name ?? '',
      ),
      qty: Number.isFinite(qty) ? qty : 0,
      rate: Number.isFinite(rate) ? rate : 0,
      amount: Number.isFinite(amount) ? amount : 0,
    };
  });
}

function asMenu(raw: unknown): QuotationData['menu'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((sec, i) => {
    const s = sec as Record<string, unknown>;
    const itemsRaw = s.items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map((it) => {
          const x = it as Record<string, unknown>;
          const name = String(x.name ?? '');
          const highlight = Boolean(x.highlight);
          return highlight ? { name, highlight: true } : { name };
        })
      : [];
    return {
      category: String(s.category ?? `Section ${i + 1}`),
      items,
    };
  });
}

function asServices(raw: unknown): QuotationData['services'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((card) => {
    const c = card as Record<string, unknown>;
    const itemsRaw = c.items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map((x) => String(x))
      : [];
    return {
      title: String(c.title ?? 'Service'),
      items,
    };
  });
}

function asTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t)).filter(Boolean);
}

function normalizeQuotation(raw: Record<string, unknown>): QuotationData {
  return {
    quote_number: String(raw.quote_number ?? ''),
    created_at: String(raw.created_at ?? ''),
    valid_until: String(raw.valid_until ?? ''),
    customer_name: String(raw.customer_name ?? ''),
    event_type: String(raw.event_type ?? ''),
    event_date: String(raw.event_date ?? ''),
    venue: String(raw.venue ?? ''),
    pax: Number(raw.pax ?? 0) || 0,
    service_type: String(raw.service_type ?? ''),
    advance_amount: Number(raw.advance_amount ?? 0) || 0,
    total_amount: Number(raw.total_amount ?? 0) || 0,
    line_items: asLineItems(raw.line_items),
    menu: asMenu(raw.menu),
    services: asServices(raw.services),
    terms: asTerms(raw.terms),
    notes: String(raw.notes ?? ''),
  };
}

export interface FetchQuotationContext {
  accessToken: string;
  tenantSlug: string;
}

/**
 * Load quotation preview payload (snapshot + quotation) for the React PDF preview.
 * Server: pass `context` from cookies. Client: omit `context` to use authStorage.
 */
export async function fetchQuotation(
  id: string,
  context?: FetchQuotationContext,
): Promise<{ snapshot: QuotationSnapshot; quotation: QuotationData }> {
  const accessToken = context?.accessToken ?? authStorage.getAccess();
  const tenantSlug = context?.tenantSlug ?? authStorage.getSlug();
  if (!accessToken || !tenantSlug) {
    throw new Error('Missing authentication or workspace. Sign in again.');
  }

  const res = await fetch(previewUrl(tenantSlug, id), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(messageFromErrorBody(body));
  }

  const snapRaw = (body as Record<string, unknown>).snapshot;
  const quotRaw = (body as Record<string, unknown>).quotation;
  if (!snapRaw || typeof snapRaw !== 'object' || !quotRaw || typeof quotRaw !== 'object') {
    throw new Error('Invalid preview response shape');
  }

  return {
    snapshot: normalizeSnapshot(snapRaw as Record<string, unknown>),
    quotation: normalizeQuotation(quotRaw as Record<string, unknown>),
  };
}

/** POST/GET export PDF (blob). Uses Puppeteer route on the Next host when NEXT_PUBLIC_QUOTATION_PDF_RENDERER=puppeteer (browser only). */
export async function exportQuotationPdfBlob(
  id: string,
  opts: { accessToken: string; tenantSlug: string },
): Promise<{ blob: Blob; filename: string }> {
  const usePuppeteer =
    typeof window !== 'undefined' &&
    (process.env.NEXT_PUBLIC_QUOTATION_PDF_RENDERER === 'puppeteer' ||
      process.env.NEXT_PUBLIC_QUOTATION_PDF_RENDERER === 'chrome');

  let url: string;
  let method: 'GET' | 'POST' = 'POST';
  if (usePuppeteer) {
    url = nextJsPuppeteerPdfUrl(opts.tenantSlug, id);
    method = 'GET';
  } else {
    url = exportPdfUrl(opts.tenantSlug, id);
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
    },
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(messageFromErrorBody(errBody));
  }
  const cd = res.headers.get('Content-Disposition');
  let filename = `quotation-${id}.pdf`;
  if (cd) {
    const m = /filename="([^"]+)"/.exec(cd) ?? /filename=([^;]+)/.exec(cd);
    if (m?.[1]) filename = m[1].trim();
  }
  const blob = await res.blob();
  return { blob, filename };
}
