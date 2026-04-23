'use client';

import { forwardRef, useState } from 'react';
import { useFieldArray, Control, UseFormRegister } from 'react-hook-form';
import { Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import type { FormValues } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  control:      Control<FormValues>;
  register:     UseFormRegister<FormValues>;
  sectionIndex: number;
  guestCount:   number;
  canDelete:    boolean;
  onRemove:     () => void;
}

// ─── Column headers ───────────────────────────────────────────────────────────

function ItemHeaders() {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="flex-1 min-w-0 text-xs text-muted-foreground/70">Dish</span>
      <span className="w-20 shrink-0 text-xs text-muted-foreground/70">₹/plate</span>
      <span className="w-16 shrink-0 text-xs text-muted-foreground/70">Qty</span>
      <span className="w-6 shrink-0" aria-hidden />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const MenuSectionCard = forwardRef<HTMLDivElement, Props>(function MenuSectionCard(
  { control, register, sectionIndex, guestCount, canDelete, onRemove },
  ref,
) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { fields, append, remove } = useFieldArray({
    control,
    name: `menuSections.${sectionIndex}.items` as `menuSections.${number}.items`,
  });

  function addItem() {
    append({
      dish:          '',
      pricePerPlate: '',
      quantity:      guestCount > 0 ? String(guestCount) : '',
    });
  }

  return (
    <div ref={ref} className="border border-border rounded-lg p-4">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">

        {/* Editable category name */}
        <input
          {...register(`menuSections.${sectionIndex}.name`)}
          placeholder="Category name"
          className="text-sm font-semibold text-foreground bg-transparent border border-transparent rounded-md px-1.5 -ml-1.5 flex-1 min-w-0 h-7 hover:border-border focus:border-input focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
        />

        {/* Add item */}
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0 whitespace-nowrap"
        >
          <Plus size={12} />
          Add Item
        </button>

        {/* Delete / confirm */}
        {confirmDelete ? (
          <div className="flex items-center gap-1 text-xs shrink-0">
            <span className="text-muted-foreground">Delete?</span>
            <button
              type="button"
              onClick={onRemove}
              className="font-medium text-destructive hover:underline"
            >
              Yes
            </button>
            <span className="text-muted-foreground">/</span>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-muted-foreground hover:underline"
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
            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-25 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Trash2 size={13} />
          </button>
        )}

      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center select-none">
          <UtensilsCrossed size={22} className="text-muted-foreground/20 mb-2" aria-hidden />
          <p className="text-sm text-muted-foreground/60">No items added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          <ItemHeaders />
          {fields.map((field, itemIndex) => (
            <div key={field.id} className="flex items-center gap-2 group/row">

              {/* Dish name */}
              <input
                {...register(`menuSections.${sectionIndex}.items.${itemIndex}.dish`)}
                placeholder="Dish name"
                className="h-9 text-sm flex-1 min-w-0 rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
              />

              {/* Price per plate */}
              <div className="relative shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none select-none">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register(`menuSections.${sectionIndex}.items.${itemIndex}.pricePerPlate`)}
                  placeholder="0"
                  title="Price per plate"
                  className="h-9 text-sm w-20 pl-6 rounded-md border border-input bg-background pr-2 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Quantity */}
              <input
                type="number"
                min="0"
                {...register(`menuSections.${sectionIndex}.items.${itemIndex}.quantity`)}
                placeholder="Qty"
                title="Quantity"
                className="h-9 text-sm w-16 shrink-0 rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
              />

              {/* Delete item */}
              <button
                type="button"
                onClick={() => remove(itemIndex)}
                title="Remove item"
                className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0"
              >
                <Trash2 size={13} />
              </button>

            </div>
          ))}
        </div>
      )}

    </div>
  );
});

export default MenuSectionCard;
