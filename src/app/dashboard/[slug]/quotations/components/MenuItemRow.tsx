'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { QuotationFormValues } from './QuotationForm';

interface MenuItemRowProps {
  categoryIndex: number;
  itemIndex: number;
  register: UseFormRegister<QuotationFormValues>;
  errors: FieldErrors<QuotationFormValues>;
  onRemove: () => void;
}

/**
 * Single menu line item editor row.
 */
export function MenuItemRow({ categoryIndex, itemIndex, register, errors, onRemove }: MenuItemRowProps) {
  const path = `menuCategories.${categoryIndex}.items.${itemIndex}` as const;
  const itemErrors = errors?.menuCategories?.[categoryIndex]?.items?.[itemIndex] as
    | {
        name?: { message?: string };
        quantity?: { message?: string };
        unit?: { message?: string };
      }
    | undefined;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-12">
      <div className="md:col-span-4">
        <label className="mb-1 block text-xs font-medium text-slate-600">Dish name</label>
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register(`${path}.name`, { required: 'Dish name is required' })}
        />
        {itemErrors?.name?.message ? <p className="mt-1 text-xs text-red-600">{itemErrors.name.message}</p> : null}
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-600">Quantity</label>
        <input
          type="number"
          min={1}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register(`${path}.quantity`, {
            valueAsNumber: true,
            required: 'Quantity is required',
            min: { value: 1, message: 'Quantity must be at least 1' },
          })}
        />
        {itemErrors?.quantity?.message ? (
          <p className="mt-1 text-xs text-red-600">{itemErrors.quantity.message}</p>
        ) : null}
      </div>

      <div className="md:col-span-3">
        <label className="mb-1 block text-xs font-medium text-slate-600">Unit</label>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register(`${path}.unit`, { required: 'Unit is required' })}
        >
          <option value="kg">kg</option>
          <option value="pieces">pieces</option>
          <option value="litres">litres</option>
          <option value="portions">portions</option>
        </select>
      </div>

      <div className="flex items-center gap-2 md:col-span-2">
        <input type="checkbox" id={`${path}-complimentary`} {...register(`${path}.is_complimentary`)} />
        <label htmlFor={`${path}-complimentary`} className="text-xs text-slate-700">
          Complimentary
        </label>
      </div>

      <div className="md:col-span-1 md:flex md:items-end md:justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-red-200 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
          aria-label="Remove menu item"
        >
          X
        </button>
      </div>
    </div>
  );
}
