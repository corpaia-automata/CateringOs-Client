'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  UtensilsCrossed,
  ShoppingBasket,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { authStorage } from '@/lib/auth';
import { useTenant } from '@/contexts/TenantContext';

const NAV_PATHS = [
  { label: 'Dashboard',  path: 'dashboard', icon: LayoutDashboard },
  { label: 'Leads',      path: 'leads',      icon: Users },
  { label: 'Events',     path: 'events',     icon: Calendar },
  { label: 'Menu',       path: 'master',     icon: UtensilsCrossed },
  { label: 'Grocery',    path: 'grocery',    icon: ShoppingBasket },
  { label: 'Quotations', path: 'quotations', icon: FileText },
  { label: 'Payments',   path: 'payments',   icon: CreditCard },
  // { label: 'Reports',    path: 'reports',    icon: BarChart3 },
  { label: 'Settings',   path: 'settings',   icon: Settings },
];

type SidebarProps = {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggle: () => void;
};

export default function Sidebar({ isOpen, isCollapsed, onClose, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { tenantSlug } = useTenant();
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const slug = tenantSlug ?? '';
  const base = slug ? `/app/${slug}` : '';
  const NAV_ITEMS = NAV_PATHS.map(({ label, path, icon }) => ({
    label,
    href: `${base}/${path}`,
    icon,
  }));

  function handleLogout() {
    authStorage.clear();
    router.push('/login');
  }

  function isActive(href: string) {
    const dashboardHref = `${base}/dashboard`;
    if (href === dashboardHref) return pathname === dashboardHref;
    return pathname.startsWith(href);
  }

  const sidebarWidth = isCollapsed ? 72 : 240;

  function NavItem({ label, href, icon: Icon }: typeof NAV_ITEMS[0]) {
    const active = isActive(href);
    return (
      <li>
        <Link
          href={href}
          onClick={onClose}
          title={isCollapsed ? label : undefined}
          className="flex items-center rounded-lg transition-all duration-150 select-none"
          style={{
            gap:            isCollapsed ? 0 : 10,
            padding:        isCollapsed ? '9px 0' : '9px 12px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            color:          active ? '#ffffff' : '#64748b',
            background:     active ? '#16a34a' : 'transparent',
            fontWeight:     active ? 600 : 500,
            fontSize:       16,
          }}
          onMouseEnter={e => {
            if (!active) e.currentTarget.style.background = '#f1f5f9';
          }}
          onMouseLeave={e => {
            if (!active) e.currentTarget.style.background = 'transparent';
          }}
        >
          <Icon
            size={18}
            style={{ flexShrink: 0, color: active ? '#ffffff' : '#94a3b8' }}
          />
          {!isCollapsed && <span>{label}</span>}
        </Link>
      </li>
    );
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-all duration-300  md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen flex flex-col z-40 select-none shadow-2xl transition-all duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          width:       sidebarWidth,
          background:  '#ffffff',
          borderRight: '1px solid #e2e8f0',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center shrink-0 transition-all duration-300"
          style={{
            padding:        isCollapsed ? '20px 0' : '20px 18px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Green "A" square */}
            <div
              className="flex items-center justify-center rounded-xl shrink-0 font-bold text-white"
              style={{
                width:      38,
                height:     38,
                background: '#16a34a',
                fontSize:   18,
              }}
            >
              C
            </div>
            {!isCollapsed && (
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
                CateringOS
              </span>
            )}
          </div>
        </div>

        {/* Desktop collapse/expand toggle */}
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
            background:   '#ffffff',
            border:       '1px solid #e2e8f0',
            color:        '#94a3b8',
            zIndex:       50,
            boxShadow:    '0 2px 6px rgba(0,0,0,0.1)',
            cursor:       'pointer',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background  = '#16a34a';
            e.currentTarget.style.color       = '#fff';
            e.currentTarget.style.borderColor = '#16a34a';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background  = '#ffffff';
            e.currentTarget.style.color       = '#94a3b8';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        {/* Divider */}
        <div style={{ height: 1, background: '#e2e8f0', flexShrink: 0 }} />

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto py-3"
          style={{ padding: isCollapsed ? '12px 8px' : '12px 12px' }}
        >
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(item => <NavItem key={item.href} {...item} />)}
          </ul>
        </nav>

        {/* Divider */}
        <div style={{ height: 1, background: '#e2e8f0', flexShrink: 0 }} />

        {/* Sign out */}
        <div
          className="shrink-0 flex py-3 "
          style={{
            padding:        isCollapsed ? '12px 0' : '12px 16px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}
        >
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex items-center w-full gap-2 rounded-lg transition-all duration-150 font-medium"
            style={{
              padding:   isCollapsed ? '8px 0' : '8px 10px',
              fontSize:  13,
              color:     '#94a3b8',
              width:     isCollapsed ? 36 : undefined,
              height:    isCollapsed ? 36 : undefined,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#fee2e2';
              e.currentTarget.style.color      = '#ef4444';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color      = '#94a3b8';
            }}
          >
            <LogOut size={16} />
            {!isCollapsed && 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  );
}
