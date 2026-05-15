'use client';

import { usePathname } from 'next/navigation';
import { authStorage } from '@/lib/auth';
import { useSubscriptionStore } from '@/store/subscriptionStore';

const AUTH_PATHS = ['/login', '/register', '/signup'];

export default function TrialBanner() {
  const pathname = usePathname();
  const subscriptionStatus = useSubscriptionStore((state) => state.subscriptionStatus);
  const trialDaysLeft = useSubscriptionStore((state) => state.trialDaysLeft);
  const trialEndDate = useSubscriptionStore((state) => state.trialEndDate);
  const isLoggedIn = authStorage.isLoggedIn();
  const isAuthPage = AUTH_PATHS.some((path) => pathname?.startsWith(path));

  if (!isLoggedIn || isAuthPage || subscriptionStatus !== 'TRIAL') return null;

  const style =
    trialDaysLeft === 0
      ? 'border-red-200 bg-red-50 text-red-900'
      : trialDaysLeft <= 3
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-indigo-200 bg-indigo-50 text-indigo-900';

  const message =
    trialDaysLeft === 0
      ? 'Your free trial ends today.'
      : trialDaysLeft <= 3
        ? `Your free trial ends in ${trialDaysLeft} days.`
        : `You have ${trialDaysLeft} days left in your free trial.`;

  const formattedEndDate = trialEndDate
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(trialEndDate))
    : null;

  return (
    <div className={`sticky top-0 z-40 flex items-center justify-center border px-4 py-2 text-center text-sm ${style}`}>
      <div className="font-medium">
        {message}
        {formattedEndDate && <span className="ml-2 font-normal opacity-80">Ends {formattedEndDate}</span>}
      </div>
    </div>
  );
}
