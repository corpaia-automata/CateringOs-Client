import { authStorage } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Paths that must NOT be prefixed with /app/{slug}
const GLOBAL_PATHS = ['/auth/refresh/', '/auth/find-tenant', '/onboard'];

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
    const body = await res.json().catch(() => ({}));
    const errData = (body as Record<string, unknown>)?.errors ?? body;
    throw { status: res.status, data: errData };
  }
  return res.status === 204 ? null : res.json();
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
  download: async (path: string, filename: string) => {
    const token = authStorage.getAccess();
    const fullPath = buildPath(path);
    const res = await fetch(`${BASE}/api${fullPath}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw { status: res.status, data: body };
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
