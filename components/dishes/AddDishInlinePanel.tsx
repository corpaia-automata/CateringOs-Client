'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, X, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { parseGuestCount } from '@/lib/utils';

const BORDER = '#e0e0e0';
const PANEL_BG = '#f9f9f9';
const NAVY = '#1a1a2e';
const BLUE_FILL = '#1a6bff';
const ORANGE = '#f97316';

export interface ApiDishCategory {
  id: string;
  name: string;
  sort_order?: number;
}

export interface ApiDish {
  id: string;
  name: string;
  dish_type: 'recipe' | 'live_counter' | 'fixed_price';
  veg_non_veg: 'veg' | 'non_veg';
  serving_unit: 'PLATE' | 'KG' | 'PIECE' | 'LITRE' | 'PORTION';
  selling_price: number;
  base_price: number;
  category: string | null;
  category_name?: string | null;
  is_active: boolean;
  batch_size?: number | string;
  batch_unit?: string;
}

/** Select value for dishes with no global category FK */
export const DISH_PICKER_UNCATEGORIZED_ID = '__uncategorized__';

/**
 * Merge global `/categories/` with categories implied by dish rows (covers empty seeds,
 * inactive global rows still referenced, and uncategorized dishes).
 */
export function buildDishPickerCategories(
  apiCategories: ApiDishCategory[],
  activeDishes: ApiDish[],
): ApiDishCategory[] {
  const sortedApi = [...apiCategories].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
  );
  const hasUncat = activeDishes.some(d => !d.category);
  const fromDishes = new Map<string, ApiDishCategory>();
  for (const d of activeDishes) {
    if (d.category) {
      const name = (d.category_name && String(d.category_name).trim()) || 'Category';
      if (!fromDishes.has(d.category)) fromDishes.set(d.category, { id: d.category, name });
    }
  }
  const apiIds = new Set(sortedApi.map(c => c.id));
  const extras = [...fromDishes.values()]
    .filter(c => !apiIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  let merged = [...sortedApi, ...extras];
  if (hasUncat) {
    merged = [{ id: DISH_PICKER_UNCATEGORIZED_ID, name: 'Uncategorized' }, ...merged];
  }
  return merged;
}

const SERVING_UNIT_LABEL: Record<string, string> = {
  PLATE: 'plates',
  KG: 'kg',
  PIECE: 'pieces',
  LITRE: 'litres',
  PORTION: 'portions',
};

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function unitPlural(dish: ApiDish): string {
  return SERVING_UNIT_LABEL[dish.serving_unit] ?? 'items';
}

function unitSingular(dish: ApiDish): string {
  const u = unitPlural(dish);
  if (u === 'kg') return 'kg';
  return u.endsWith('s') ? u.slice(0, -1) : u;
}

/** Secondary line under dish name on each chip */
export function dishChipPriceHint(dish: ApiDish): { text: string; variant: 'event' | 'rate' } {
  if (dish.dish_type === 'live_counter') {
    return { text: 'price on event', variant: 'event' };
  }
  const n = Number(dish.selling_price) || Number(dish.base_price) || 0;
  if (n > 0) {
    return { text: `${fmtINR(n)} per ${unitSingular(dish)}`, variant: 'rate' };
  }
  return { text: '—', variant: 'rate' };
}

export type AddDishControlledForm = {
  selectedCategoryId: string;
  onSelectedCategoryIdChange: (id: string) => void;
  selectedDish: ApiDish | null;
  onSelectedDishChange: (d: ApiDish | null) => void;
  quantity: number;
  onQuantityChange: (n: number) => void;
  pricePerPlate: number;
  onPricePerPlateChange: (n: number) => void;
};

export interface AddDishInlinePanelProps {
  existingIds: Set<string>;
  onClose: () => void;
  onConfirmAdd: (dish: ApiDish, qty: number, price: number) => void | Promise<void>;
  submitting?: boolean;
  confirmLabel?: string;
  /** Defaults Quantity when picking a dish (e.g. event guest count). Falls back to 1. */
  defaultGuestQty?: number;
  /** Lift form state to parent (e.g. quotation Menu tab). When set, panel uses these instead of internal state. */
  controlled?: AddDishControlledForm;
  /** Fires once categories are loaded from the API (sorted). */
  onCategoriesLoaded?: (categories: ApiDishCategory[]) => void;
}

export function AddDishInlinePanel({
  existingIds,
  onClose,
  onConfirmAdd,
  submitting = false,
  confirmLabel = 'Add',
  defaultGuestQty,
  controlled,
  onCategoriesLoaded,
}: AddDishInlinePanelProps) {
  const [categories, setCategories] = useState<ApiDishCategory[]>([]);
  const [allDishes, setAllDishes] = useState<ApiDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [internalActiveCatId, setInternalActiveCatId] = useState('');
  const [internalExpandedId, setInternalExpandedId] = useState<string | null>(null);
  const [internalQty, setInternalQty] = useState(1);
  const [internalPrice, setInternalPrice] = useState(0);

  const isControlled = controlled != null;

  const activeCatId = isControlled ? controlled.selectedCategoryId : internalActiveCatId;

  const selectedDishModel = isControlled ? controlled.selectedDish : null;
  const expandedId = isControlled ? (selectedDishModel?.id ?? null) : internalExpandedId;

  const qty = isControlled ? controlled.quantity : internalQty;
  const setQty = isControlled ? controlled.onQuantityChange : setInternalQty;
  const price = isControlled ? controlled.pricePerPlate : internalPrice;
  const setPrice = isControlled ? controlled.onPricePerPlateChange : setInternalPrice;

  function handleCategoryChange(id: string) {
    if (isControlled) {
      controlled.onSelectedCategoryIdChange(id);
      controlled.onSelectedDishChange(null);
    } else {
      setInternalActiveCatId(id);
      setInternalExpandedId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchError(false);
      try {
        const [catsRaw, dishesRaw] = await Promise.all([
          // Global Category IDs match Dish.category FK (not tenant DishCategory rows).
          api.get('/categories/'),
          api.get('/master/dishes/?page_size=200'),
        ]);
        if (cancelled) return;
        const cats: ApiDishCategory[] = Array.isArray(catsRaw)
          ? catsRaw
          : (catsRaw.results ?? []);
        const dshs: ApiDish[] = Array.isArray(dishesRaw)
          ? dishesRaw
          : (dishesRaw.results ?? []);
        const activeList = dshs.filter(d => d.is_active);
        const merged = buildDishPickerCategories(cats, activeList);
        setCategories(merged);
        setAllDishes(activeList);
        onCategoriesLoaded?.(merged);
      } catch {
        if (!cancelled) setFetchError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadKey]);

  useEffect(() => {
    if (!categories.length) return;
    if (isControlled) return;
    setInternalActiveCatId(prev => {
      if (prev && categories.some(c => c.id === prev)) return prev;
      return categories[0].id;
    });
  }, [categories, isControlled]);

  const dishesInCategory = useMemo(() => {
    if (!activeCatId) return [];
    if (activeCatId === DISH_PICKER_UNCATEGORIZED_ID) {
      return allDishes.filter(d => !d.category);
    }
    return allDishes.filter(d => d.category === activeCatId);
  }, [allDishes, activeCatId]);

  const qtyDefault = Math.max(1, defaultGuestQty ?? 1);

  function selectDish(dish: ApiDish) {
    if (expandedId === dish.id) {
      if (isControlled) controlled.onSelectedDishChange(null);
      else setInternalExpandedId(null);
      return;
    }
    if (isControlled) {
      controlled.onSelectedDishChange(dish);
      controlled.onQuantityChange(qtyDefault);
      if (dish.dish_type === 'live_counter') {
        controlled.onPricePerPlateChange(0);
      } else {
        controlled.onPricePerPlateChange(Number(dish.selling_price) || Number(dish.base_price) || 0);
      }
      return;
    }
    setInternalExpandedId(dish.id);
    setInternalQty(qtyDefault);
    if (dish.dish_type === 'live_counter') {
      setInternalPrice(0);
    } else {
      setInternalPrice(Number(dish.selling_price) || Number(dish.base_price) || 0);
    }
  }

  function collapseForm() {
    if (isControlled) controlled.onSelectedDishChange(null);
    else setInternalExpandedId(null);
  }

  async function commit(dish: ApiDish) {
    try {
      await onConfirmAdd(dish, qty, price);
      if (isControlled) controlled.onSelectedDishChange(null);
      else setInternalExpandedId(null);
      onClose();
    } catch {
      /* Parent shows toast; leave panel open for retry */
    }
  }

  const expandedDish =
    isControlled && controlled.selectedDish
      ? controlled.selectedDish
      : expandedId
        ? dishesInCategory.find(d => d.id === expandedId)
        : undefined;

  return (
    <div
      className="relative mb-4 rounded-xl font-sans"
      style={{
        backgroundColor: PANEL_BG,
        border: `1px solid ${BORDER}`,
        padding: 20,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600 disabled:opacity-40"
        title="Close"
      >
        <X size={14} />
      </button>

      <div className="mb-4 space-y-2 pr-8">
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Category
        </label>
        <div className="relative min-w-0 w-full">
          <select
            value={activeCatId}
            aria-label="Category"
            onChange={e => handleCategoryChange(e.target.value)}
            disabled={loading || !categories.length || submitting}
            className="w-full max-w-full cursor-pointer appearance-none truncate rounded-[9999px] border bg-white py-2.5 pl-4 pr-10 text-left text-[13px] font-semibold leading-snug outline-none transition-colors focus:border-[#1a1a2e] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: BORDER, color: NAVY }}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 opacity-70"
            style={{ color: NAVY }}
            aria-hidden
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-xs">Loading dishes…</span>
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <p className="text-sm text-slate-500">Failed to load dishes.</p>
          <button
            type="button"
            onClick={() => setLoadKey(k => k + 1)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : categories.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">No categories available.</div>
      ) : dishesInCategory.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">No dishes in this category.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {dishesInCategory.map(dish => {
              const alreadyAdded = existingIds.has(dish.id);
              const hint = dishChipPriceHint(dish);
              const selected = expandedId === dish.id;

              return (
                <button
                  key={dish.id}
                  type="button"
                  disabled={alreadyAdded || submitting}
                  onClick={() => {
                    if (!alreadyAdded && !submitting) selectDish(dish);
                  }}
                  className={[
                    'inline-flex max-w-full flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors',
                    alreadyAdded ? 'cursor-not-allowed opacity-45 bg-white' : '',
                    !alreadyAdded && !selected ? 'border bg-white hover:bg-slate-50' : '',
                    selected && !alreadyAdded ? 'border-transparent text-white' : '',
                  ].join(' ')}
                  style={
                    selected && !alreadyAdded
                      ? { backgroundColor: BLUE_FILL, borderColor: BLUE_FILL }
                      : !selected || alreadyAdded
                        ? { borderColor: BORDER }
                        : undefined
                  }
                >
                  <span
                    className={[
                      'text-sm font-medium leading-snug',
                      selected && !alreadyAdded ? 'text-white' : 'text-slate-800',
                    ].join(' ')}
                  >
                    {dish.name}
                  </span>
                  <span
                    className={[
                      'text-[11px] leading-tight',
                      selected && !alreadyAdded
                        ? hint.variant === 'event'
                          ? 'font-medium italic text-white/85'
                          : 'text-white/80'
                        : hint.variant === 'event'
                          ? 'font-medium italic text-orange-500'
                          : 'text-slate-500',
                    ].join(' ')}
                  >
                    {alreadyAdded ? 'Added' : hint.text}
                  </span>
                </button>
              );
            })}
          </div>

          {expandedDish && (
            <div className="mt-4 border-t pt-4" style={{ borderColor: BORDER }}>
              {expandedDish.dish_type === 'live_counter' && (
                <div
                  className="mb-4 flex items-start gap-2 rounded-lg border border-orange-200 bg-[#fffbeb] px-3 py-2.5"
                  style={{ borderLeftWidth: 4, borderLeftColor: ORANGE }}
                >
                  <Zap size={15} className="mt-0.5 shrink-0" style={{ color: ORANGE }} aria-hidden />
                  <p className="text-[12px] font-medium leading-snug" style={{ color: ORANGE }}>
                    Live Counter — enter the agreed price for this event
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-4">
                <label className="block shrink-0">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Quantity
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={e => setQty(parseGuestCount(e.target.value, 1))}
                    disabled={submitting}
                    className="w-[88px] rounded-lg border bg-white px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-800 outline-none transition-colors disabled:opacity-50"
                    style={{ borderColor: NAVY }}
                  />
                </label>
                <label className="block min-w-[120px] flex-1">
                  <span
                    className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide"
                    style={expandedDish.dish_type === 'live_counter' ? { color: ORANGE } : { color: '#64748b' }}
                  >
                    Price / {unitSingular(expandedDish)}
                    {expandedDish.dish_type === 'live_counter'
                      ? <span style={{ color: ORANGE }}> *</span>
                      : ' (₹)'}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={price || ''}
                    placeholder="0"
                    onChange={e => setPrice(Math.max(0, Number.parseFloat(e.target.value) || 0))}
                    disabled={submitting}
                    className="w-full max-w-[140px] rounded-lg border bg-white px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-800 outline-none transition-colors disabled:opacity-50"
                    style={{
                      borderColor: expandedDish.dish_type === 'live_counter' ? ORANGE : NAVY,
                      borderWidth: expandedDish.dish_type === 'live_counter' ? 2 : 1,
                    }}
                  />
                </label>

                <div className="flex min-w-[min(100%,220px)] flex-1 basis-full justify-end gap-2 sm:basis-auto">
                  <button
                    type="button"
                    onClick={collapseForm}
                    disabled={submitting}
                    className="rounded-full px-4 py-2 text-xs font-bold transition-colors disabled:opacity-40"
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: NAVY,
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void commit(expandedDish)}
                    disabled={submitting || qty < 1 || price <= 0}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
                    style={{ backgroundColor: BLUE_FILL }}
                  >
                    {submitting && <Loader2 size={13} className="animate-spin" />}
                    {confirmLabel}
                  </button>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Subtotal{' '}
                <span className="font-semibold tabular-nums text-slate-700">{fmtINR(qty * price)}</span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
