import type { Dish, RecipeLine } from '@/types/dish';

interface Props {
  dish: Dish;
  lines: RecipeLine[];
  onAnalyze: () => void;
}

export default function EconomicsPanel({ dish, lines, onAnalyze }: Props) {
  const sellingPrice    = Number(dish.selling_price ?? 0) || 0;
  const labourCost      = Number(dish.labour_cost   ?? 0) || 0;
  const ingredientCost  = lines.reduce(
    (sum, l) => sum + (Number(l.qty_per_unit) || 0) * (Number(l.unit_cost_snapshot) || 0),
    0,
  );
  const totalCost = ingredientCost + labourCost;
  const margin    = sellingPrice > 0
    ? ((sellingPrice - totalCost) / sellingPrice) * 100
    : 0;

  return (
    <div className="w-80 shrink-0 rounded-2xl shadow-sm overflow-hidden">
      {/* Dark header */}
      <div className="px-5 py-4" style={{ backgroundColor: '#111827' }}>
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Selling Price</p>
        <p className="text-3xl font-bold text-white">₹{sellingPrice.toFixed(2)}</p>
        <p className="text-xs text-gray-400 mt-0.5">per {dish.serving_unit?.toLowerCase() ?? 'serving'}</p>
      </div>

      {/* Cost + margin */}
      <div className="bg-white px-5 py-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Ingredient cost</span>
          <span className="text-sm font-medium text-gray-800">₹{ingredientCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Labour cost</span>
          <span className="text-sm font-medium text-gray-800">₹{labourCost.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Total cost</span>
          <span className="text-sm font-semibold text-gray-900">₹{totalCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Margin</span>
          <span
            className={[
              'text-sm font-semibold',
              margin >= 0 ? 'text-green-600' : 'text-red-500',
            ].join(' ')}
          >
            {margin.toFixed(1)}%
          </span>
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          className="w-full mt-1 text-sm text-blue-600 underline underline-offset-2 text-left hover:text-blue-700 transition-colors"
        >
          Analyze in calculator →
        </button>
      </div>
    </div>
  );
}
