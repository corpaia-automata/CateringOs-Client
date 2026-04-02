'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ShoppingCart,
  BarChart3,
  Database,
  Settings,
  LogOut,
  ChefHat,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { authStorage } from '@/lib/auth';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Leads',     href: '/leads',     icon: Users },
  { label: 'Events',    href: '/events',    icon: Calendar },
  { label: 'Grocery',  href: '/grocery',   icon: ShoppingCart },
  { label: 'Reports',  href: '/reports',   icon: BarChart3 },
  { label: 'Master',   href: '/master',    icon: Database },
];

const BOTTOM_ITEMS = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

type SidebarProps = {
  isOpen: boolean;       // mobile: drawer open
  isCollapsed: boolean;  // tablet/desktop: icons-only mode
  onClose: () => void;
  onToggle: () => void;  // desktop: collapse/expand
};

export default function Sidebar({ isOpen, isCollapsed, onClose, onToggle }: SidebarProps) {
  const pathname      = usePathname();
  const router        = useRouter();
  const [user]                        = useState<{ full_name?: string; email?: string; role?: string } | null>(
    () => authStorage.getUser()
  );
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  function handleLogout() {
    authStorage.clear();
    router.push('/login');
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  const sidebarWidth = isCollapsed ? 64 : 240;

  function NavItem({ label, href, icon: Icon }: typeof NAV_ITEMS[0]) {
    const active  = isActive(href);
    const hovered = hoveredHref === href;
    return (
      <li>
        <Link
          href={href}
          onClick={onClose}
          title={isCollapsed ? label : undefined}
          className="relative flex items-center rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden"
          style={{
            gap:            isCollapsed ? 0 : 12,
            padding:        isCollapsed ? '8px 0' : '10px 12px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            color:          active ? '#fff' : hovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
            background:     active
              ? 'linear-gradient(90deg, rgba(249,115,22,0.22) 0%, rgba(249,115,22,0.06) 100%)'
              : hovered
              ? 'rgba(255,255,255,0.06)'
              : 'transparent',
            boxShadow: active ? 'inset 3px 0 0 #F97316' : 'none',
          }}
          onMouseEnter={() => setHoveredHref(href)}
          onMouseLeave={() => setHoveredHref(null)}
        >
          <span
            className="flex items-center justify-center rounded-lg shrink-0 transition-all duration-150"
            style={{
              width: 30,
              height: 30,
              background: active
                ? 'rgba(249,115,22,0.2)'
                : hovered
                ? 'rgba(255,255,255,0.07)'
                : 'transparent',
              color: active ? '#FB923C' : 'inherit',
            }}
          >
            <Icon size={15} />
          </span>
          {!isCollapsed && (
            <>
              <span style={{ fontSize: 13 }}>{label}</span>
              {active && (
                <span
                  className="absolute right-3 rounded-full"
                  style={{ width: 5, height: 5, background: '#F97316', opacity: 0.8 }}
                />
              )}
            </>
          )}
        </Link>
      </li>
    );
  }

  return (
    <>
      {/* ── Mobile overlay ── */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-all duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed left-0 top-0 h-screen flex flex-col z-40 select-none transition-all duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          width: sidebarWidth,
          background: 'linear-gradient(180deg, #0D1B2E 0%, #0F2040 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* ── Logo ── */}
        <div
          className="shrink-0 flex items-center pt-6 pb-5 transition-all duration-300"
          style={{
            paddingLeft:    isCollapsed ? 0 : 20,
            paddingRight:   isCollapsed ? 0 : 20,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: 38,
                height: 38,
                background: 'linear-gradient(135deg, #F97316, #EA580C)',
                boxShadow: '0 0 0 3px rgba(249,115,22,0.2), 0 4px 12px rgba(249,115,22,0.3)',
              }}
            >
              <ChefHat size={19} color="#fff" />
            </div>
            {!isCollapsed && (
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                  Afsal Catering
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.06em' }}>
                  CATERING OS
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Desktop collapse/expand toggle ── */}
        <button
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex items-center justify-center transition-all duration-150"
          style={{
            position:     'absolute',
            top:          72,
            right:        -12,
            width:        24,
            height:       24,
            borderRadius: '50%',
            background:   '#1E3358',
            border:       '1px solid rgba(255,255,255,0.15)',
            color:        'rgba(255,255,255,0.6)',
            zIndex:       50,
            boxShadow:    '0 2px 6px rgba(0,0,0,0.3)',
            cursor:       'pointer',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background  = '#F97316';
            e.currentTarget.style.color       = '#fff';
            e.currentTarget.style.borderColor = '#F97316';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background  = '#1E3358';
            e.currentTarget.style.color       = 'rgba(255,255,255,0.6)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
          }}
        >
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 8, flexShrink: 0 }} />

        {/* ── Primary Navigation ── */}
        <nav
          className="flex-1 overflow-y-auto pb-2 transition-all duration-300"
          style={{ padding: isCollapsed ? '0 8px' : '0 12px' }}
        >
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(item => <NavItem key={item.href} {...item} />)}
          </ul>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '12px 4px' }} />

          <ul className="space-y-0.5">
            {BOTTOM_ITEMS.map(item => <NavItem key={item.href} {...item} />)}
          </ul>
        </nav>

        {/* ── User section ── */}
        {isCollapsed ? (
          /* Collapsed: avatar + logout icon stacked */
          <div className="flex flex-col items-center gap-1.5 mx-2 mb-4 shrink-0">
            <div
              className="flex items-center justify-center rounded-lg font-bold"
              style={{
                width: 34, height: 34,
                background: 'linear-gradient(135deg, #F97316, #EA580C)',
                color: '#fff', fontSize: 12,
                boxShadow: '0 2px 8px rgba(249,115,22,0.3)',
              }}
              title={user?.full_name || user?.email || 'User'}
            >
              {initials}
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="flex items-center justify-center rounded-lg transition-all duration-150"
              style={{ width: 34, height: 34, color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                e.currentTarget.style.color      = '#FCA5A5';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color      = 'rgba(255,255,255,0.4)';
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          /* Expanded: full user card */
          <div
            className="mx-3 mb-4 rounded-xl p-3 flex flex-col gap-2 shrink-0"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center rounded-lg shrink-0 font-bold"
                style={{
                  width: 34, height: 34,
                  background: 'linear-gradient(135deg, #F97316, #EA580C)',
                  color: '#fff', fontSize: 12,
                  boxShadow: '0 2px 8px rgba(249,115,22,0.3)',
                }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 12, fontWeight: 600, color: '#fff' }} className="truncate">
                  {user?.full_name || user?.email || 'User'}
                </p>
                <p
                  className="truncate"
                  style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500, textTransform: 'capitalize' }}
                >
                  {user?.role?.toLowerCase() || 'staff'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg transition-all duration-150 font-medium"
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', background: 'transparent' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                e.currentTarget.style.color      = '#FCA5A5';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color      = 'rgba(255,255,255,0.4)';
              }}
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
