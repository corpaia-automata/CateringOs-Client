import { authStorage } from './auth';
import { subscriptionStore } from '@/store/subscriptionStore';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Paths that must NOT be prefixed with /app/{slug}
const GLOBAL_PATHS = ['/auth/refresh/', '/billing/', '/onboard', '/categories/'];

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown, message = 'API request failed') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class TrialExpiredError extends ApiError {
  constructor(status: number, data: unknown) {
    super(status, data, 'Trial access has expired');
    this.name = 'TrialExpiredError';
  }
}

function buildPath(path: string): string {
  // Already slug-rooted or is a global path — leave as-is
  if (path.startsWith('/app/')) return path;
  if (GLOBAL_PATHS.some(p => path.startsWith(p))) return path;

  const slug = authStorage.getSlug();
  if (slug) return `/app/${slug}${path}`;
  return path;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = authStorage.getAccess();
  const fullPath = buildPath(path);

  const res = await fetch(`${BASE}/api${fullPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) { authStorage.clear(); window.location.href = '/login'; return; }
    return apiFetch(path, options);
  }
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const reqBody = options.body;
    const reqBodyPreview =
      typeof reqBody === 'string'
        ? (reqBody.length > 500 ? `${reqBody.slice(0, 500)}…` : reqBody)
        : reqBody;
    console.error(
      `[apiFetch] ${res.status} ${options.method ?? 'GET'} ${BASE}/api${fullPath}`,
      'response:',
      errJson,
      'request body:',
      reqBodyPreview,
    );
    throwApiError(res.status, errJson);
  }
  return parseSuccessfulResponse(res);
}

async function tryRefresh(): Promise<boolean> {
  const refresh = authStorage.getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    authStorage.setTokens(data.access, data.refresh, authStorage.getUser());
    return true;
  } catch { return false; }
}

export const api = {
  get:    (path: string)                  => apiFetch(path),
  post:   (path: string, body: object)    => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  (path: string, body: object)    => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  put:    (path: string, body: object)    => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path: string)                  => apiFetch(path, { method: 'DELETE' }),
  // Multipart upload — omits Content-Type so the browser sets it with the boundary
  upload: async (path: string, body: FormData) => {
    const token = authStorage.getAccess();
    const fullPath = buildPath(path);
    const res = await fetch(`${BASE}/api${fullPath}`, {
      method: 'POST',
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throwApiError(res.status, errBody);
    }
    return parseSuccessfulResponse(res);
  },
  download: async (path: string, filename: string) => {
    const token = authStorage.getAccess();
    const fullPath = buildPath(path);
    const res = await fetch(`${BASE}/api${fullPath}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throwApiError(res.status, body);
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  },
};

async function parseSuccessfulResponse(res: Response) {
  if (res.status === 204) return null;

  const body = await res.json();
  if (body && typeof body === 'object' && 'subscription' in body) {
    subscriptionStore.getState().syncFromApi(body.subscription);
  }
  return body;
}

function throwApiError(status: number, body: unknown): never {
  if (status === 403 && isAccessBlocked(body)) {
    subscriptionStore.getState().syncFromApi({
      subscription_status: 'EXPIRED',
      trial_days_left: 0,
      trial_ends_at: null,
      has_active_access: false,
    });
    throw new TrialExpiredError(status, body);
  }

  const errData = (body as Record<string, unknown>)?.errors ?? body;
  throw new ApiError(status, errData);
}

function isAccessBlocked(body: unknown): body is { error: string } {
  return Boolean(
    body
      && typeof body === 'object'
      && ((body as { error?: unknown }).error === 'trial_ended'
        || (body as { trial_ended?: unknown }).trial_ended === true)
  );
}
