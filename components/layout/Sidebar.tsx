'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ContactRound,
  UtensilsCrossed,
  FileText,
  PieChart,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authStorage } from '@/lib/auth';
import { useTenant } from '@/contexts/TenantContext';
import {
  COS_BORDER,
  COS_CANVAS,
  COS_FOREST,
  COS_FOREST_MID,
  COS_GOLD_LIGHT,
} from '@/lib/cosTheme';

type NavItem = { label: string; path: string; icon: typeof LayoutDashboard };

const NAV_PATHS: NavItem[] = [
  { label: 'Dashboard', path: 'dashboard', icon: LayoutDashboard },
  { label: 'Leads', path: 'leads', icon: Users },
  { label: 'Events', path: 'events', icon: Calendar },
  // { label: 'Contacts', path: 'leads', icon: ContactRound },
  { label: 'Menus', path: 'master', icon: UtensilsCrossed },
  // { label: 'Quotations', path: 'quotations', icon: FileText },
  // { label: 'Reports', path: 'dashboard', icon: PieChart },
  { label: 'Settings', path: 'settings', icon: Settings },
];

type SidebarProps = {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggle: () => void;
};

export default function Sidebar({ isOpen, isCollapsed, onClose, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenantSlug } = useTenant();

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const slug = tenantSlug ?? '';
  const base = slug ? `/app/${slug}` : '';
  const NAV_ITEMS = NAV_PATHS.map(({ label, path, icon }) => ({
    label,
    href: `${base}/${path}`,
    icon,
    pathKey: path,
  }));

  function handleLogout() {
    authStorage.clear();
    router.push('/login');
  }

  function isActive(href: string, pathKey: string) {
    const segments = (pathname ?? '').split('/').filter(Boolean);
    const currentSection = segments[0] === 'app' ? segments[2] : segments[0];
    if (pathKey === 'leads' && currentSection === 'leads') return true;
    if (pathKey === 'events' && currentSection === 'events') return true;
    return currentSection === pathKey;
  }

  const sidebarWidth = isCollapsed ? 84 : 268;

  function NavItemRow({ label, href, icon: Icon, pathKey }: (typeof NAV_ITEMS)[0]) {
    const active = isActive(href, pathKey);
    return (
      <li>
        <Link
          href={href}
          onClick={onClose}
          title={isCollapsed ? label : undefined}
          className="flex items-center rounded-lg transition-all duration-150 select-none"
          style={{
            gap: isCollapsed ? 0 : 10,
            padding: isCollapsed ? '10px 0' : '10px 12px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            color: active ? '#fff' : '#3d524a',
            background: active ? 'black' : 'transparent',
            fontWeight: active ? 600 : 500,
            fontSize: 14,
            boxShadow: active ? '0 2px 8px rgba(19,78,58,0.25)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (!active) e.currentTarget.style.background = COS_CANVAS;
          }}
          onMouseLeave={(e) => {
            if (!active) e.currentTarget.style.background = 'transparent';
          }}
        >
          <Icon
            size={19}
            strokeWidth={2}
            style={{
              flexShrink: 0,
              color: active ? COS_GOLD_LIGHT : '#5c7168',
            }}
          />
          {!isCollapsed && <span>{label}</span>}
        </Link>
      </li>
    );
  }

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-all duration-300 md:hidden ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        className={`
          fixed left-0 top-0 z-40 flex h-screen select-none flex-col shadow-xl transition-all duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          width: sidebarWidth,
          background: '#fbfcfb',
          borderRight: `1px solid ${COS_BORDER}`,
        }}
      >
        {/* Brand */}
        <div
          className="flex w-full shrink-0 items-center transition-all duration-300"
          style={{
            padding: isCollapsed ? '20px 0' : '20px 16px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}
        >
          <div
            className="relative overflow-hidden rounded-xl"
            style={{
              height: isCollapsed ? 44 : 52,
              width: isCollapsed ? 44 : '100%',
            }}
          >
            <img
              src="/logos/main.png"
              alt="CateringOS"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        <button
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute right-[-12px] top-[84px] z-50 hidden h-7 w-7 items-center justify-center rounded-full border transition-all duration-150 md:flex"
          style={{
            background: '#fff',
            borderColor: COS_BORDER,
            color: '#6b7f76',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = COS_FOREST;
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = COS_FOREST;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.color = '#6b7f76';
            e.currentTarget.style.borderColor = COS_BORDER;
          }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div style={{ height: 1, background: COS_BORDER, flexShrink: 0 }} />

        <nav
          className="min-h-0 flex-1 overflow-y-auto py-3"
          style={{ padding: isCollapsed ? '12px 8px' : '12px 12px' }}
        >
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <NavItemRow key={`${item.href}-${item.label}`} {...item} />
            ))}
          </ul>
        </nav>
{/* 
        {!isCollapsed && (
          <div className="shrink-0 px-3 pb-3">
            <div
              className="rounded-xl px-4 py-4"
              style={{
                background: `linear-gradient(180deg, ${COS_CANVAS} 0%, #dce5e0 100%)`,
                border: `1px solid ${COS_BORDER}`,
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <LifeBuoy size={18} style={{ color: COS_FOREST }} />
                <p className="text-[13px] font-semibold" style={{ color: COS_FOREST }}>
                  Need help?
                </p>
              </div>
              <p className="mb-3 text-[12px] leading-snug" style={{ color: '#5c6d66' }}>
                Our team can help with quotations, events, and billing.
              </p>
              <button
                type="button"
                className="w-full rounded-lg py-2.5 text-[12px] font-bold text-white transition-opacity hover:opacity-95"
                style={{ background: COS_FOREST }}
                onClick={() => toast('Support will reach you shortly')}
              >
                Contact support
              </button>
            </div>
          </div>
        )} */}

        <div style={{ height: 1, background: COS_BORDER, flexShrink: 0 }} />

        <div
          className="flex shrink-0 py-3"
          style={{
            padding: isCollapsed ? '12px 0' : '12px 14px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}
        >
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex w-full items-center gap-2 rounded-lg font-medium transition-all duration-150"
            style={{
              padding: isCollapsed ? '10px 0' : '10px 12px',
              fontSize: 13,
              color: '#6b7f76',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fde8e8';
              e.currentTarget.style.color = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6b7f76';
            }}
          >
            <LogOut size={17} />
            {!isCollapsed && 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  );
}
