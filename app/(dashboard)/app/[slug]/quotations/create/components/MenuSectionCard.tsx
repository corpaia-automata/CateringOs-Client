'use client';

import { forwardRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useFieldArray,
  Control,
  UseFormRegister,
  Controller,
  UseFormSetValue,
  useWatch,
} from 'react-hook-form';
import { ChevronDown, Plus } from 'lucide-react';

import { api } from '@/lib/api';
import type { Dish } from '@/types/dish';
import type { FormValues } from '../types';
import { COS_BORDER, COS_CANVAS, COS_FOREST } from '@/lib/cosTheme';

const MUTED_BG = COS_CANVAS;
const RED = '#e53935';

interface Props {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  sectionIndex: number;
  guestCount: number;
  canDelete: boolean;
  onRemove: () => void;
}

function fmtPlatePrice(raw: string) {
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return '₹0 / plate';
  const formatted = n.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `₹${formatted} / plate`;
}

const MenuSectionCard = forwardRef<HTMLDivElement, Props>(function MenuSectionCard(
  { control, register, setValue, sectionIndex, guestCount, canDelete, onRemove },
  ref,
) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: dishesRes } = useQuery({
    queryKey: ['master-dishes-enquiry-menu'],
    queryFn: () => api.get('/master/dishes/?page_size=500&is_active=true') as Promise<
      { results?: Dish[] } | Dish[]
    >,
  });

  const dishes: Dish[] = Array.isArray(dishesRes)
    ? dishesRes
    : (dishesRes?.results ?? []);

  const { fields, append, remove } = useFieldArray({
    control,
    name: `menuSections.${sectionIndex}.items` as `menuSections.${number}.items`,
  });

  function addItem() {
    append({
      dish: '',
      pricePerPlate: '',
      quantity: guestCount > 0 ? String(guestCount) : '',
    });
  }

  return (
    <div
      ref={ref}
      className="bg-white p-4 md:p-5"
      style={{ border: `1px solid ${COS_BORDER}`, borderRadius: '14px' }}
    >
      {/* Card header — category title | + Add item | delete */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          {...register(`menuSections.${sectionIndex}.name`)}
          placeholder="Category name"
          className="min-w-0 flex-1 bg-transparent text-[13px] font-bold uppercase tracking-wide outline-none placeholder:text-neutral-400"
          style={{ color: COS_FOREST }}
        />

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={addItem}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-3 py-2 text-[12px] font-semibold outline-none transition-colors hover:bg-neutral-50"
            style={{ borderColor: COS_BORDER, color: COS_FOREST }}
          >
            <Plus size={14} strokeWidth={2.25} />
            Add item
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-neutral-500">Delete?</span>
              <button
                type="button"
                onClick={onRemove}
                className="cursor-pointer font-medium underline"
                style={{ color: RED }}
              >
                Yes
              </button>
              <span className="text-neutral-400">/</span>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="cursor-pointer text-neutral-500 underline"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={!canDelete}
              title="Delete category"
              className="cursor-pointer text-[17px] leading-none opacity-80 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-20"
              style={{ color: RED }}
              aria-label="Delete category"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Nested inset — bordered area for dish rows */}
      <div
        className="flex flex-col gap-3 bg-white p-4 md:p-5"
        style={{
          border: `1px solid ${COS_BORDER}`,
          borderRadius: '14px',
        }}
      >
        {fields.length === 0 ? (
          <p className="py-5 text-center text-[13px] text-neutral-400 select-none">
            No dishes yet — tap &quot;+ Add item&quot; above
          </p>
        ) : (
          fields.map((field, itemIndex) => (
            <DishRow
              key={field.id}
              control={control}
              sectionIndex={sectionIndex}
              itemIndex={itemIndex}
              dishes={dishes}
              setValue={setValue}
              register={register}
              onRemove={() => remove(itemIndex)}
            />
          ))
        )}
      </div>
    </div>
  );
});

function DishRow({
  control,
  sectionIndex,
  itemIndex,
  dishes,
  setValue,
  register,
  onRemove,
}: {
  control: Control<FormValues>;
  sectionIndex: number;
  itemIndex: number;
  dishes: Dish[];
  setValue: UseFormSetValue<FormValues>;
  register: UseFormRegister<FormValues>;
  onRemove: () => void;
}) {
  const base = `menuSections.${sectionIndex}.items.${itemIndex}` as const;

  const pricePerPlate = useWatch({ control, name: `${base}.pricePerPlate` }) as string | undefined;

  return (
    <div className="flex min-h-[46px] items-center gap-3">
      <Controller
        control={control}
        name={`${base}.dish`}
        render={({ field }) => (
          <div className="relative min-w-0 flex-1">
            <select
              value={field.value}
              onChange={(e) => {
                const name = e.target.value;
                field.onChange(name);
                const d = dishes.find((x) => x.name === name);
                setValue(
                  `${base}.pricePerPlate`,
                  d ? String(d.selling_price ?? '') : '',
                  { shouldDirty: true, shouldValidate: true },
                );
              }}
              className="w-full max-w-full cursor-pointer appearance-none truncate rounded-xl border bg-white py-2.5 pl-4 pr-10 text-left text-[13px] leading-snug outline-none transition-colors focus:border-[#134e3a]"
              style={{ borderColor: COS_BORDER, color: COS_FOREST }}
            >
              <option value="">Select dish</option>
              {dishes.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 opacity-70"
              style={{ color: COS_FOREST }}
              aria-hidden
            />
          </div>
        )}
      />

      <span
        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[9999px] px-3 py-2 text-[12px] font-medium tabular-nums leading-none"
        style={{ backgroundColor: MUTED_BG, color: COS_FOREST }}
      >
        {fmtPlatePrice(String(pricePerPlate ?? ''))}
      </span>

      <input
        type="hidden"
        {...register(`${base}.pricePerPlate`)}
      />

      <input
        type="number"
        min={0}
        title="Quantity"
        className="box-border h-9 w-[52px] shrink-0 cursor-pointer rounded-lg border-0 px-1 py-2 text-center text-[13px] font-medium tabular-nums outline-none"
        style={{ backgroundColor: MUTED_BG, color: COS_FOREST }}
        {...register(`${base}.quantity`)}
      />

      <button
        type="button"
        onClick={onRemove}
        title="Remove item"
        className="flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-[17px] leading-none outline-none"
        style={{ color: RED }}
        aria-label="Remove dish row"
      >
        🗑️
      </button>
    </div>
  );
}

export default MenuSectionCard;
