'use client';

import type { ReactNode } from 'react';
import { useIsExpired } from '@/store/subscriptionStore';

type AccessGateProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export default function AccessGate({ children, fallback }: AccessGateProps) {
  const isExpired = useIsExpired();

  if (!isExpired) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  return <div className="opacity-50 pointer-events-none cursor-not-allowed">{children}</div>;
}
