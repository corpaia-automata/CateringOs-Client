'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Bell, ChevronRight, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { authStorage } from '@/lib/auth';
import { COS_BORDER, COS_CANVAS, COS_FOREST } from '@/lib/cosTheme';

const LABEL_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads',
  events: 'Events',
  grocery: 'Grocery',
  reports: 'Reports',
  master: 'Master Data',
  quotations: 'Quotations',
  settings: 'Settings',
  enquiries: 'Enquiries',
};

function getBreadcrumbs(pathname: string) {
  if (pathname.includes('/enquiries/create')) {
    const parts = pathname.split('/').filter(Boolean);
    const slug = parts[0] === 'app' && parts[1] ? parts[1] : (parts[0] ?? '');
    const base = parts[0] === 'app' ? `/app/${slug}` : '';
    return [
      { label: 'Quotations', href: `${base}/quotations`, isLast: false },
      { label: 'Create Quotation', href: pathname, isLast: true },
    ];
  }
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((seg, i) => ({
    label: LABEL_MAP[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname ?? '');

  const [user, setUser] = useState<{ full_name?: string; email?: string; role?: string } | null>(null);
  const [headerDate, setHeaderDate] = useState<string>('');
  const [searchFocused, setSearchFocused] = useState(false);

  // User + date come from client only — avoids SSR (null user) vs client (localStorage) mismatch.
  useEffect(() => {
    setUser(authStorage.getUser() as { full_name?: string; email?: string; role?: string } | null);
    setHeaderDate(
      new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    );
  }, []);

  // Mobile: controls the slide-in drawer
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  // Tablet/Desktop: controls icons-only collapsed mode
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Tracks whether the viewport is below the md breakpoint (768px)
  const [isMobile, setIsMobile]               = useState(false);

  // Responsive init + resize handler
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      if (w < 768) {
        setSidebarOpen(false);
        setSidebarCollapsed(false);
      } else if (w < 1024) {
        setSidebarCollapsed(true);   // tablet: icons-only by default
      } else {
        setSidebarCollapsed(false);  // desktop: full sidebar
      }
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  function handleMenuToggle() {
    if (isMobile) {
      setSidebarOpen(prev => !prev);
    } else {
      setSidebarCollapsed(prev => !prev);
    }
  }

  const sidebarWidth   = sidebarCollapsed ? 84 : 268;
  const mainMarginLeft = isMobile ? 0 : sidebarWidth;

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="flex min-h-screen" style={{ background: COS_CANVAS }}>
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggle={handleMenuToggle}
      />

      {/* ── Main area ── */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{ marginLeft: mainMarginLeft }}
      >
        {/* ── Top Navbar ── */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between gap-3"
          style={{
            height: 72,
            background: 'rgba(251,252,251,0.96)',
            borderBottom: `1px solid ${COS_BORDER}`,
            paddingLeft: 16,
            paddingRight: 20,
            boxShadow: '0 1px 3px rgba(19,78,58,0.05)',
          }}
        >
          {/* ── Left: hamburger + breadcrumb ── */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleMenuToggle}
              aria-label="Toggle sidebar"
              className="md:hidden flex items-center justify-center rounded-xl shrink-0 transition-all duration-150"
              style={{
                width:      36,
                height:     36,
                background: COS_CANVAS,
                border: `1px solid ${COS_BORDER}`,
                color: '#5c7168',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#dce8e3';
                e.currentTarget.style.color = COS_FOREST;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = COS_CANVAS;
                e.currentTarget.style.color = '#5c7168';
              }}
            >
              <Menu size={15} />
            </button>

            <div className="flex flex-col justify-center gap-0.5 min-w-0">
              <nav className="flex items-center gap-1">
                {crumbs.map((crumb, i) => (
                  <span key={crumb.href} className="flex items-center gap-1 min-w-0">
                    {i > 0 && <ChevronRight size={13} style={{ color: '#9cb0a5', flexShrink: 0 }} />}
                    <span
                      className={`truncate transition-colors duration-150 text-[13px] ${
                        crumb.isLast ? 'font-semibold' : 'font-normal text-[#6b7f76]'
                      }`}
                      style={crumb.isLast ? { color: COS_FOREST } : undefined}
                    >
                      {crumb.label}
                    </span>
                  </span>
                ))}
              </nav>
              <p className="hidden text-[11px] font-normal sm:block" style={{ color: '#9cb0a5' }}>
                {headerDate || '\u00a0'}
              </p>
            </div>
          </div>

          {/* ── Right controls ── */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Search — hidden on mobile */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200"
              style={{
                background: searchFocused ? '#fff' : COS_CANVAS,
                border: `1px solid ${searchFocused ? COS_FOREST : COS_BORDER}`,
                width:      searchFocused ? 220 : 160,
                boxShadow:  searchFocused ? `0 0 0 3px rgba(19,78,58,0.12)` : 'none',
              }}
            >
              <Search size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent outline-none flex-1 min-w-0 text-[13px]"
                style={{ color: COS_FOREST }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {!searchFocused && (
                <kbd
                  className="rounded-md px-1.5 shrink-0 text-[10px] font-medium bg-slate-100 border border-slate-200 text-slate-400 leading-4.5"
                >
                  /
                </kbd>
              )}
            </div>

            {/* Notifications */}
            <button
              className="relative flex items-center justify-center rounded-xl transition-all duration-150"
              style={{
                width:      36,
                height:     36,
                background: COS_CANVAS,
                border: `1px solid ${COS_BORDER}`,
                color: '#5c7168',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#dce8e3';
                e.currentTarget.style.color = COS_FOREST;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = COS_CANVAS;
                e.currentTarget.style.color = '#5c7168';
              }}
            >
              <Bell size={15} />
              <span
                className="absolute rounded-full"
                style={{
                  width:      7,
                  height:     7,
                  background: '#F97316',
                  border:     '2px solid #fff',
                  top:        7,
                  right:      7,
                }}
              />
            </button>

            {/* Divider — hidden on mobile */}
            <div className="hidden sm:block" style={{ width: 1, height: 24, background: COS_BORDER }} />

            {/* User avatar */}

              <div className="flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center rounded-xl shrink-0 text-[11px] font-bold text-white"
                  style={{
                    width: 36,
                    height: 36,
                    background: `linear-gradient(145deg, ${COS_FOREST} 0%, #0d3d2c 100%)`,
                    boxShadow: '0 2px 10px rgba(19,78,58,0.25)',
                  }}
                >
                  {initials}
                </div>

                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-[13px] font-semibold leading-tight" style={{ color: COS_FOREST }}>
                    {user?.full_name || user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="truncate text-[11px] capitalize" style={{ color: '#6b7f76' }}>
                    {(user?.role || 'Staff').toLowerCase().replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
