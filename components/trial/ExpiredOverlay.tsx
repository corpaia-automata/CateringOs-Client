'use client';

import { usePathname } from 'next/navigation';
import { authStorage } from '@/lib/auth';
import { useIsExpired } from '@/store/subscriptionStore';

const PUBLIC_PATHS = ['/login', '/register', '/signup', '/pricing'];

export default function ExpiredOverlay() {
  const pathname = usePathname();
  const isExpired = useIsExpired();
  const isLoggedIn = authStorage.isLoggedIn();

  const isPublicPage =
    pathname === '/' ||
    PUBLIC_PATHS.some((path) => pathname?.startsWith(path));

  // Only show overlay for logged-in expired users on protected pages
  if (!isLoggedIn || !isExpired || isPublicPage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="text-5xl" aria-hidden="true">
          ⚠️
        </div>

        <h2 className="mt-5 text-2xl font-bold text-slate-950">
          Your Trial Has Ended
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your workspace trial has expired. Please contact support to continue
          using CateringOS.
        </p>

        <p className="mt-4 text-sm font-medium text-slate-700">
          hello@yourcompany.com
        </p>
      </div>
    </div>
  );
}