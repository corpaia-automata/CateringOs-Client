'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useDish, useRecipe } from '@/src/hooks/useDishDetail';
import DishDetailHeader from './DishDetailHeader';
import AboutCard from './AboutCard';
import IngredientsCard from './IngredientsCard';
import EconomicsPanel from './EconomicsPanel';
import EditDishModal from './EditDishModal';

// ── Skeletons ──────────────────────────────────────────────────────────────────

function FullPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="flex gap-6 mt-6 items-start">
        <div className="flex-1 space-y-5">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="w-80 h-64 rounded-2xl shrink-0" />
      </div>
    </div>
  );
}

function ErrorState({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center max-w-sm w-full">
        <p className="text-base font-semibold text-gray-900">Could not load dish</p>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          It may have been deleted or you may not have access.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back to dishes
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DishDetailPage() {
  const { slug, id: dishId } = useParams<{ slug: string; id: string }>();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);

  const { data: dish,   isLoading: dishLoading,   isError: dishError   } = useDish(slug, dishId);
  const { data: recipe, isLoading: recipeLoading                        } = useRecipe(slug, dishId);

  if (dishLoading || recipeLoading) return <FullPageSkeleton />;

  if (dishError || !dish) {
    return <ErrorState onBack={() => router.push(`/app/${slug}/master`)} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <DishDetailHeader dish={dish} onEditClick={() => setEditOpen(true)} />

      <div className="flex gap-6 mt-6 items-start">
        <div className="flex-1 space-y-5">
          <AboutCard dish={dish} onEditClick={() => setEditOpen(true)} />
          <IngredientsCard
            dishId={dishId}
            dishName={dish.name}
            recipe={recipe}
            slug={slug}
          />
        </div>
        <EconomicsPanel
          dish={dish}
          lines={recipe.lines}
          onAnalyze={() => router.push(`/app/${slug}/calculator`)}
        />
      </div>

      {editOpen && (
        <EditDishModal
          dish={dish}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
