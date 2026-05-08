/**
 * Shared API base URL for fetch-based clients (tenant and public endpoints).
 */

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Base URL for the Django API. Requires ``NEXT_PUBLIC_API_URL`` in production.
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw == null || String(raw).trim() === '') {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  return normalizeBase(String(raw).trim());
}
