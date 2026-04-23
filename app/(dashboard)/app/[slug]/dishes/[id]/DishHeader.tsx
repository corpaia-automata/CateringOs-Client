'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import type { Dish } from '@/types/dish';

const SERVING_UNIT_LABELS: Record<string, string> = {
  PLATE:   'Per Plate',
  KG:      'Per KG',
  PIECE:   'Per Piece',
  LITRE:   'Per Litre',
  PORTION: 'Per Portion',
};

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric',
});

interface Props {
  dish: Dish;
  onEditClick: () => void;
}

export default function DishHeader({ dish, onEditClick }: Props) {
  const router = useRouter();
  const isVeg = dish.veg_non_veg === 'veg';

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors shrink-0 mt-0.5"
          aria-label="Go back"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-gray-900 truncate">{dish.name}</h1>
            <span
              className={[
                'rounded-full border text-xs px-3 py-0.5 font-medium shrink-0',
                isVeg
                  ? 'border-green-500 text-green-600 bg-green-50'
                  : 'border-red-400 text-red-500 bg-red-50',
              ].join(' ')}
            >
              {isVeg ? 'Veg' : 'Non-Veg'}
            </span>
          </div>

          <p className="text-sm text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{dish.category_name ?? '—'}</span>
            <span className="text-gray-300">·</span>
            <span>{SERVING_UNIT_LABELS[dish.serving_unit] ?? dish.serving_unit}</span>
            <span className="text-gray-300">·</span>
            <span>Added {dateFormatter.format(new Date(dish.created_at))}</span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onEditClick}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
      >
        <Pencil size={14} />
        Edit Dish
      </button>
    </div>
  );
}
