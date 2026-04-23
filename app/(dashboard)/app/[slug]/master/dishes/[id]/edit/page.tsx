'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import CreateDishForm, { DishApiResponse } from '../../../CreateDishForm';

// ── Edit Dish Page ─────────────────────────────────────────────────────────────

export default function EditDishPage() {
  const router = useRouter();
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const listPath = `/app/${slug}/master`;

  const { data: dish, isLoading, isError } = useQuery<DishApiResponse>({
    queryKey: ['dish', id],
    queryFn:  () => api.get(`/master/dishes/${id}/`),
    staleTime: 0,   // always fetch fresh data for an edit form
    retry: 1,
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'white' }}>

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-6 py-4"
        style={{ backgroundColor: '#fff', borderBottom: '1px solid #F1F5F9' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(listPath)}
            className="p-1.5 rounded-lg transition-colors hover:bg-slate-100"
            title="Back to dishes"
          >
            <ArrowLeft size={18} style={{ color: '#64748B' }} />
          </button>
          <div>
            <h1 className="text-base font-semibold" style={{ color: '#0F172A' }}>
              {isLoading ? 'Loading…' : dish ? `Edit — ${dish.name}` : 'Edit Dish'}
            </h1>
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Update dish details and ingredients
            </p>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-6">

        {/* Loading skeleton — mirrors the form's section layout */}
        {isLoading && (
          <div className="max-w-2xl mx-auto space-y-7">
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
          <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20 text-center">
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
    </div>
  );
}
