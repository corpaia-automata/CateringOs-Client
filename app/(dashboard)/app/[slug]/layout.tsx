'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authStorage } from '@/lib/auth';

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const urlSlug = params?.slug;

  useEffect(() => {
    if (!authStorage.isLoggedIn()) {
      router.replace('/login');
      return;
    }

    const storedSlug = authStorage.getSlug();

    if (!storedSlug) {
      // No slug stored — redirect to login
      router.replace('/login');
      return;
    }

    if (storedSlug !== urlSlug) {
      // URL slug doesn't match the authenticated tenant — redirect to correct workspace
      router.replace(`/app/${storedSlug}/dashboard`);
      return;
    }
  }, [urlSlug, router]);

  return <>{children}</>;
}
