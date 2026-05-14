'use client';

import { useEffect, useState } from 'react';

import { authStorage } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

const TICK_MS = 60_000;

/** Decimal hour [0,24) for boundary-safe greeting ranges */
function hourDecimal(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/**
 * Morning 12:00 AM–12:00 PM · Afternoon 12:00 PM–5:00 PM · Evening 5:00 PM–11:59 PM
 */
export function getTimeBasedGreeting(date: Date): string {
  const t = hourDecimal(date);
  if (t >= 0 && t < 12) return 'Good morning';
  if (t >= 12 && t < 17) return 'Good afternoon';
  return 'Good evening';
}


function getDisplayFirstName(user: unknown): string {
  if (!user || typeof user !== 'object') return 'there';
  const u = user as Record<string, unknown>;

  const full =
    (typeof u.full_name === 'string' && u.full_name.trim()) ||
    (typeof u.name === 'string' && u.name.trim()) ||
    (typeof u.first_name === 'string' && u.first_name.trim());
  if (full) {
    return full.split(/\s+/)[0] ?? 'there';
  }

  const email = u.email;
  if (typeof email === 'string' && email.includes('@')) {
    const local = email.split('@')[0];
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there';
  }

  return 'there';
}

export interface DashboardGreetingProps {
  /** Small label above the greeting (e.g. “Overview”, “Leads”) */
  eyebrow?: string;
  className?: string;
}

export default function DashboardGreeting({
  eyebrow = 'Overview',
  className,
}: DashboardGreetingProps) {
  /**
   * SSR + initial client paint must NOT read localStorage — server has no user,
   * client hydration must match that HTML. Sync real name after mount in useEffect.
  */
 const [greeting, setGreeting] = useState('Good morning');
 const [displayName, setDisplayName] = useState('there');
 const [slug, setSlug] = useState<string | null>(null);
 const router = useRouter();

  useEffect(() => {
    function refresh() {
      setGreeting(getTimeBasedGreeting(new Date()));
      setDisplayName(getDisplayFirstName(authStorage.getUser()));
      setSlug(authStorage.getSlug());
    }

    refresh();

    const interval = window.setInterval(refresh, TICK_MS);

    function onStorage(e: StorageEvent) {
      if (e.key === 'cos_user') {
        setDisplayName(getDisplayFirstName(authStorage.getUser()));
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') refresh();
    }

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="flex items-center justify-between gap-2">
  {/* Left Content */}
  <div className={cn('min-w-0 text-left', className)}>
    <p className="text-[12px] font-medium text-slate-500 sm:text-[13px]">
      {eyebrow}
    </p>

    <h1 className="mt-0.5 truncate text-3xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
      {greeting}, {displayName}
    </h1>
  </div>

  <button
  type="button"
  onClick={() => router.push(`/app/${slug}/enquiries/create`)}
  className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
>
  <Plus size={16} />
  New Lead
</button>
</div>
  );
}
