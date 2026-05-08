'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { QuotationFormValues } from './QuotationForm';

interface ServiceRowProps {
  index: number;
  register: UseFormRegister<QuotationFormValues>;
  errors: FieldErrors<QuotationFormValues>;
  onRemove: () => void;
}

/**
 * Single service row editor (staffing + counters + equipment).
 */
export function ServiceRow({ index, register, errors, onRemove }: ServiceRowProps) {
  const path = `services.${index}` as const;
  const rowErrors = errors?.services?.[index] as
    | {
        name?: { message?: string };
        staff_count?: { message?: string };
        counter_count?: { message?: string };
      }
    | undefined;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-12">
      <div className="md:col-span-4">
        <label className="mb-1 block text-xs font-medium text-slate-600">Service name</label>
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register(`${path}.name`, { required: 'Service name is required' })}
        />
        {rowErrors?.name?.message ? <p className="mt-1 text-xs text-red-600">{rowErrors.name.message}</p> : null}
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-600">Staff</label>
        <input
          type="number"
          min={0}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register(`${path}.staff_count`, { valueAsNumber: true, min: { value: 0, message: 'Invalid staff' } })}
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-600">Counters</label>
        <input
          type="number"
          min={0}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register(`${path}.counter_count`, {
            valueAsNumber: true,
            min: { value: 0, message: 'Invalid counter count' },
          })}
        />
      </div>

      <div className="md:col-span-3">
        <label className="mb-1 block text-xs font-medium text-slate-600">Equipment (comma separated)</label>
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="e.g. Chafing dishes, Warmers, Tables"
          {...register(`${path}.equipment_input`)}
        />
      </div>

      <div className="md:col-span-1 md:flex md:items-end md:justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-red-200 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
          aria-label="Remove service row"
        >
          X
        </button>
      </div>
    </div>
  );
}
