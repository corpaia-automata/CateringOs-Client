'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';

export interface Dish {
  id: string;
  name: string;
  veg_non_veg: string;
  category_name: string;
  created_at: string;
  is_active: boolean;
}

interface Props {
  dish: Dish;
  onEditClick?: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
});

export default function DishDetailHeader({ dish, onEditClick }: Props) {
  const router = useRouter();

  const isVeg = dish.veg_non_veg?.toLowerCase() === 'veg';

  return (
    <div className="flex items-center justify-between gap-4">
      {/* ── Left ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-gray-900 truncate">
              {dish.name}
            </h1>

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

          <p className="text-sm text-gray-500 mt-0.5">
            {dish.category_name}&nbsp;&bull;&nbsp;Added On&nbsp;
            {dateFormatter.format(new Date(dish.created_at))}
          </p>
        </div>
      </div>

      {/* ── Right ── */}
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
