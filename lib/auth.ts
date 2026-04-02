export const authStorage = {
  setTokens(access: string, refresh: string, user: any) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('cos_access', access);
    localStorage.setItem('cos_refresh', refresh);
    localStorage.setItem('cos_user', JSON.stringify(user));
    document.cookie = `cos_access=${access}; path=/; max-age=3600`;
  },
  getAccess: () => typeof window !== 'undefined' ? localStorage.getItem('cos_access') : null,
  getRefresh: () => typeof window !== 'undefined' ? localStorage.getItem('cos_refresh') : null,
  getUser: () => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('cos_user');
    return raw ? JSON.parse(raw) : null;
  },
  clear() {
    ['cos_access', 'cos_refresh', 'cos_user'].forEach(k => localStorage.removeItem(k));
    document.cookie = 'cos_access=; path=/; max-age=0';
  },
  isLoggedIn: () => typeof window !== 'undefined' && !!localStorage.getItem('cos_access'),
};
