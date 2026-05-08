'use client';

import { useSubscriptionSync } from '@/hooks/useSubscriptionSync';

export default function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  useSubscriptionSync();

  return <>{children}</>;
}
