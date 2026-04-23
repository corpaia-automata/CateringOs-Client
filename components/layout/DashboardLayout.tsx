'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Bell, ChevronRight, Menu, User } from 'lucide-react';
import Sidebar from './Sidebar';
import { authStorage } from '@/lib/auth';

const LABEL_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  leads:     'Leads',
  events:    'Events',
  grocery:   'Grocery',
  reports:   'Reports',
  master:    'Master Data',
  settings:  'Settings',
};

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((seg, i) => ({
    label:  LABEL_MAP[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    href:   '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const crumbs   = getBreadcrumbs(pathname);

  const [user]          = useState<{ full_name?: string; email?: string; role?: string } | null>(
    () => authStorage.getUser()
  );
  const [searchFocused, setSearchFocused] = useState(false);

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

  const sidebarWidth   = sidebarCollapsed ? 64 : 240;
  const mainMarginLeft = isMobile ? 0 : sidebarWidth;

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="flex min-h-screen" style={{ background: '#F1F5F9' }}>
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
            height:       72,
            background:   'rgba(255,255,255,0.97)',
            borderBottom: '1px solid rgba(226,232,240,0.8)',
            paddingLeft:  16,
            paddingRight: 16,
            boxShadow:    '0 1px 3px rgba(0,0,0,0.04)',
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
                background: '#F8FAFC',
                border:     '1px solid #E2E8F0',
                color:      '#64748B',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#F1F5F9';
                e.currentTarget.style.color      = '#0F172A';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#F8FAFC';
                e.currentTarget.style.color      = '#64748B';
              }}
            >
              <Menu size={15} />
            </button>

            <div className="flex flex-col justify-center gap-0.5 min-w-0">
              <nav className="flex items-center gap-1">
                {crumbs.map((crumb, i) => (
                  <span key={crumb.href} className="flex items-center gap-1 min-w-0">
                    {i > 0 && <ChevronRight size={13} style={{ color: '#CBD5E1', flexShrink: 0 }} />}
                    <span
                      className={`truncate transition-colors duration-150 text-[13px] ${crumb.isLast ? 'font-semibold text-slate-900' : 'font-normal text-slate-400'}`}
                    >
                      {crumb.label}
                    </span>
                  </span>
                ))}
              </nav>
              <p className="hidden sm:block text-[11px] font-normal text-slate-300">
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* ── Right controls ── */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Search — hidden on mobile */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200"
              style={{
                background: searchFocused ? '#fff' : '#F8FAFC',
                border:     `1px solid ${searchFocused ? '#CBD5E1' : '#E2E8F0'}`,
                width:      searchFocused ? 220 : 160,
                boxShadow:  searchFocused ? '0 0 0 3px rgba(15,23,42,0.06)' : 'none',
              }}
            >
              <Search size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent outline-none flex-1 min-w-0 text-[13px] text-slate-900"
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
                background: '#F8FAFC',
                border:     '1px solid #E2E8F0',
                color:      '#64748B',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#F1F5F9';
                e.currentTarget.style.color      = '#0F172A';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#F8FAFC';
                e.currentTarget.style.color      = '#64748B';
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
            <div className="hidden sm:block" style={{ width: 1, height: 24, background: '#E2E8F0' }} />

            {/* User avatar */}

              <div className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className="flex items-center justify-center rounded-xl transition-all duration-150 group-hover:scale-105 shrink-0"
                  style={{
                    width: 34,
                    height: 34,
                    background: 'linear-gradient(135deg, #0D1B2E, #0F2040)',
                    boxShadow: '0 2px 8px rgba(13,27,46,0.2)',
                  }}
                >
                  <User size={16} color="#fff" />
                </div>

                {/* <div className="hidden md:block">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">
                    {user?.full_name?.split(' ')[0] || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize">
                    {user?.role?.toLowerCase() || 'staff'}
                  </p>
                </div> */}
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
