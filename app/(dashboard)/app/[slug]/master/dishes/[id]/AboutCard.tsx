import type { Dish } from '@/types/dish';

interface Props {
  dish: Dish;
  onEditClick?: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const SERVING_UNIT_LABELS: Record<string, string> = {
  PLATE:   'Per Plate',
  KG:      'Per KG',
  PIECE:   'Per Piece',
  LITRE:   'Per Litre',
  PORTION: 'Per Portion',
};

export default function AboutCard({ dish, onEditClick }: Props) {
  const isEmpty = !dish.description?.trim();

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-3">About this Dish</h2>

      {isEmpty ? (
        <p className="text-sm text-gray-400 mb-4">
          No description added yet.
          {onEditClick && (
            <>
              {' '}
              <button
                type="button"
                onClick={onEditClick}
                className="text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
              >
                + Add description
              </button>
            </>
          )}
        </p>
      ) : (
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{dish.description}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-gray-100">
        <MetaField label="Category" value={dish.category_name ?? '—'} />
        <MetaField label="Serving Unit" value={SERVING_UNIT_LABELS[dish.serving_unit] ?? dish.serving_unit ?? '—'} />
        <MetaField label="Type">
          <span
            className={[
              'text-xs font-medium rounded-full border px-2.5 py-0.5',
              dish.veg_non_veg === 'veg'
                ? 'border-green-500 text-green-600 bg-green-50'
                : 'border-red-400 text-red-500 bg-red-50',
            ].join(' ')}
          >
            {dish.veg_non_veg === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}
          </span>
        </MetaField>
        <MetaField label="Status">
          <span
            className={[
              'text-xs font-medium rounded-full border px-2.5 py-0.5',
              dish.is_active
                ? 'border-green-500 text-green-600 bg-green-50'
                : 'border-gray-300 text-gray-500 bg-gray-50',
            ].join(' ')}
          >
            {dish.is_active ? 'Active' : 'Inactive'}
          </span>
        </MetaField>
        <MetaField
          label="Added On"
          value={dish.created_at ? dateFormatter.format(new Date(dish.created_at)) : '—'}
        />
      </div>
    </div>
  );
}

function MetaField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {children ?? <p className="text-sm font-medium text-gray-800">{value}</p>}
    </div>
  );
}
