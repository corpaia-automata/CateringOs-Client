export const authStorage = {
  setTokens(access: string, refresh: string, user: unknown) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('cos_access', access);
    localStorage.setItem('cos_refresh', refresh);
    localStorage.setItem('cos_user', JSON.stringify(user));
    document.cookie = `cos_access=${access}; path=/; max-age=3600`;
    document.cookie = `access_token=${access}; path=/; max-age=3600`;
  },
  getAccess: () => typeof window !== 'undefined' ? localStorage.getItem('cos_access') : null,
  getRefresh: () => typeof window !== 'undefined' ? localStorage.getItem('cos_refresh') : null,
  getUser: () => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('cos_user');
    return raw ? JSON.parse(raw) : null;
  },
  setSlug(slug: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('tenantSlug', slug);
    const maxAge = 60 * 60 * 24 * 400;
    document.cookie = `cos_tenant_slug=${encodeURIComponent(slug)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  },
  getSlug: () => typeof window !== 'undefined' ? localStorage.getItem('tenantSlug') : null,
  clear() {
    ['cos_access', 'cos_refresh', 'cos_user', 'tenantSlug'].forEach(k => localStorage.removeItem(k));
    document.cookie = 'cos_access=; path=/; max-age=0';
    document.cookie = 'access_token=; path=/; max-age=0';
    document.cookie = 'subscription_status=; path=/; max-age=0';
    document.cookie = 'cos_tenant_slug=; path=/; max-age=0';
  },
  isLoggedIn: () => typeof window !== 'undefined' && !!localStorage.getItem('cos_access'),
};
