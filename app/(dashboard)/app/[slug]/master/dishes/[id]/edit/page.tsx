'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import CreateDishForm, { DishApiResponse } from '../../../CreateDishForm';

// ── Edit Dish Page ─────────────────────────────────────────────────────────────

export default function EditDishPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; id: string }>();
  const slug = params?.slug ?? '';
  const id = params?.id ?? '';
  const listPath = `/app/${slug}/master`;

  const { data: dish, isLoading, isError } = useQuery<DishApiResponse>({
    queryKey: ['dish', id],
    queryFn:  () => api.get(`/master/dishes/${id}/`),
    staleTime: 0,   // always fetch fresh data for an edit form
    retry: 1,
  });

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: '#fafafa' }}>

        {/* Loading skeleton — mirrors the form's section layout */}
        {isLoading && (
          <div className="mx-auto max-w-7xl space-y-7 px-6 py-8">
            {/* Dish type cards */}
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            {/* Basic info */}
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-9 rounded-lg" />
                <Skeleton className="h-9 rounded-lg" />
              </div>
              <Skeleton className="h-20 rounded-lg" />
            </div>
            {/* Pricing */}
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
            </div>
            {/* Ingredients placeholder */}
            <Skeleton className="h-24 rounded-xl" />
            {/* Labour + cost preview */}
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-20 text-center">
            <p className="text-sm font-medium" style={{ color: '#0F172A' }}>
              Could not load dish
            </p>
            <p className="text-xs mt-1 mb-4" style={{ color: '#94A3B8' }}>
              The dish may have been deleted or you may not have permission to edit it.
            </p>
            <button
              type="button"
              onClick={() => router.push(listPath)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1.5px solid #E2E8F0', color: '#475569', backgroundColor: '#fff' }}
            >
              Back to Dishes
            </button>
          </div>
        )}

        {/* Form — only mounted once data is ready, so useState initialiser runs once with real data */}
        {dish && (
          <CreateDishForm initialData={dish} dishId={id} />
        )}
    </div>
  );
}
