import { ChefHat, PlusCircle, Upload } from 'lucide-react';
import type { RecipeLine } from '@/types/dish';

interface Props {
  lines: RecipeLine[];
  onAddManually: () => void;
  onBulkUpload: () => void;
}

export default function RecipeCard({ lines, onAddManually, onBulkUpload }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <ChefHat size={16} className="text-gray-400" />
          <span className="text-base font-semibold text-gray-800">Recipe</span>
          {lines.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">
              {lines.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddManually}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <PlusCircle size={13} />
            Add Manually
          </button>
          <button
            type="button"
            onClick={onBulkUpload}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Upload size={13} />
            Bulk Upload
          </button>
        </div>
      </div>

      {/* Empty state */}
      {lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ChefHat size={36} className="text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">No ingredients added</p>
          <p className="text-xs text-gray-300 mt-1">
            Use &ldquo;Add Manually&rdquo; or &ldquo;Bulk Upload&rdquo; to build this recipe
          </p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-3 text-left">
                Ingredient Name
              </th>
              <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-3 text-left w-28">
                Quantity
              </th>
              <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-3 text-left w-24">
                Unit
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={line.id} className={i !== 0 ? 'border-t border-gray-100' : ''}>
                <td className="py-3 text-sm font-medium text-gray-800 pr-4">
                  {line.ingredient_name}
                </td>
                <td className="py-3 text-sm text-gray-600">{line.qty_per_unit}</td>
                <td className="py-3 text-sm text-gray-500">{line.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
