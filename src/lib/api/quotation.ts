import { authStorage } from '@/lib/auth';

import { getApiBaseUrl } from './client';
import type { PublicQuotationResponse, Quotation } from '@/src/types/quotation';

export async function fetchPublicQuotation(token: string): Promise<PublicQuotationResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/q/${encodeURIComponent(token)}/`;
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<PublicQuotationResponse>;
}

export async function fetchQuotations(slug: string): Promise<Quotation[]> {
  const base = getApiBaseUrl();
  const url = `${base}/api/app/${encodeURIComponent(slug)}/quotations/`;
  const access = authStorage.getAccess();
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const data: unknown = await response.json();
  if (Array.isArray(data)) {
    return data as Quotation[];
  }
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: Quotation[] }).results;
  }
  return [];
}

export async function generatePdf(
  slug: string,
  /** Quotation PK: numeric or UUID string (Django uses UUID). */
  id: number | string,
): Promise<{ task_id: string; status: string }> {
  const base = getApiBaseUrl();
  const url = `${base}/api/app/${encodeURIComponent(slug)}/quotations/${encodeURIComponent(String(id))}/generate-pdf/`;
  const access = authStorage.getAccess();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<{ task_id: string; status: string }>;
}
