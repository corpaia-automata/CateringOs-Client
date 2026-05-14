'use client';

import { useState, useId, useEffect, useLayoutEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, UtensilsCrossed, Wrench, ClipboardList, Zap,
  X, ChevronDown, ShieldCheck, RefreshCw, Maximize2, Minimize2,
  CheckCircle2, AlertTriangle, Circle,
  TrendingUp, Send, Info, BadgeCheck,
  History, CheckCheck, PenLine, MailOpen, PhoneCall, FileCheck2, FileText,
  XCircle, Clock, Loader2,
  Download, Link2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, ApiError } from '@/lib/api';
import {
  AddDishInlinePanel,
  buildDishPickerCategories,
  DISH_PICKER_UNCATEGORIZED_ID,
  type ApiDish,
  type ApiDishCategory,
} from '@/components/dishes/AddDishInlinePanel';

/** Flatten REST validation / ApiError payloads for inline menu-save feedback. */
function formatMenuMutationError(error: unknown): string {
  if (error instanceof ApiError) {
    const d = error.data;
    if (typeof d === 'string') return d;
    if (d && typeof d === 'object') {
      const detail = (d as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
      const rec = d as Record<string, unknown>;
      for (const v of Object.values(rec)) {
        if (typeof v === 'string') return v;
        if (Array.isArray(v) && v.length && typeof v[0] === 'string') return v[0];
      }
    }
    return `Save failed (${error.status})`;
  }
  if (error instanceof Error) return error.message;
  return 'Save failed — please retry';
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type QuotationTab = 'menu' | 'costing' | 'validation' | 'pricing' | 'history';

type PricingType = 'per plate' | 'per item' | 'per kg';
type StatusBadge = 'LIVE' | 'FIXED' | 'DRAFT';

interface Dish {
  id: string;
  name: string;
  category: string;
  pricingType: PricingType;
  statusBadge: StatusBadge;
  qty: number;
  unit: string;
  rate: number;
  subtotal: number;
  batch_size?: number | string;
  base_recipe_qty?: number | string;
}

/** Local menu row state (mirrors server `dishes` + add/edit panel state). */
interface AddedMenuDishEntry {
  dish: Dish;
  category: string;
  quantity: number;
  pricePerPlate: number;
  subtotal: number;
  status: 'DRAFT';
  masterDish?: ApiDish;
}

interface Service {
  id: string;
  name: string;
  rate: number;
  qty: number;
  subtotal: number;
}

// ─── Validation sheet types ────────────────────────────────────────────────────

interface SheetIngredient {
  ingredientId: string;
  name: string;
  category: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

interface ValidationCategory {
  name: string;
  label: string;
  items: SheetIngredient[];
  subtotal: number;
}

interface ValidationSheet {
  syncedAt: string;
  categories: ValidationCategory[];
  billValue: number;
}

interface ApiRecipeLine {
  id: string;
  ingredient: string;
  ingredient_name: string;
  ingredient_uom: string;
  ingredient_category: string;
  qty_per_unit: number;
  unit: string;
  unit_cost_snapshot: number;
}

interface ApiRecipeResponse {
  exists: boolean;
  batch_size?: number | string;
  batch_unit?: string;
  lines: ApiRecipeLine[];
}

/** Costing row: recipe lines are driven by menu; manual rows are independent (nullable dishId = quote-level). */
interface DishCostItem {
  id: string;
  dishId: string | null;
  dishName: string;
  source: 'recipe' | 'manual';
  category: string;
  name: string;
  qty: number;
  unit: string;
  rate: number;
}

const QUOTE_LEVEL_LABEL = 'Quote-level';

/** Same rule as events/services._is_fixed_charge_category — no scaling with dish qty for these ingredients. */
function isFixedChargeIngredientCategory(raw?: string | null): boolean {
  const k = String(raw ?? '').trim().toLowerCase();
  return k === 'rental' || k === 'rentals' || k === 'other' || k === 'others';
}

function normalizeDishCostCategory(value?: string | null): string {
  const raw = (value ?? '').trim();
  if (!raw) return 'Other';
  return raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function recipeCostRowsFromApi(dish: Dish, recipe: ApiRecipeResponse): DishCostItem[] {
  const lines = Array.isArray(recipe?.lines) ? recipe.lines : [];
  const batchSize = Number(dish.batch_size ?? dish.base_recipe_qty ?? recipe?.batch_size) || 1;
  const dishQty = Number(dish.qty) || 0;
  return lines.map((line, index) => {
    const rawCat = (line as { category?: string; ingredient_category?: string }).ingredient_category
      ?? (line as { category?: string }).category;
    const scale = isFixedChargeIngredientCategory(rawCat)
      ? 1
      : dishQty / batchSize;
    const qty = scale * (Number(line.qty_per_unit) || 0);
    const lineUnit = (line.unit || '').toLowerCase();
    const ingUom = String((line as { ingredient_uom?: string }).ingredient_uom ?? '').toLowerCase();
    const bulkPricedSmallLine =
      (lineUnit === 'g' || lineUnit === 'gram') && ingUom === 'kg'
      || ['ml', 'millilitre', 'milliliter'].includes(lineUnit) && ['litre', 'liter', 'ltr'].includes(ingUom);
    const snap = Number(line.unit_cost_snapshot) || 0;
    // gram/ml unit cost conversion: bulk snapshot is ₹ per kg / per litre; qty is in g/ml
    const rate = bulkPricedSmallLine ? snap / 1000 : snap;
    return {
      id: `recipe-${dish.id}-${line.id || index}`,
      dishId: dish.id,
      dishName: dish.name,
      source: 'recipe' as const,
      category: normalizeDishCostCategory(line.ingredient_category),
      name: line.ingredient_name,
      qty,
      unit: line.unit || line.ingredient_uom || 'unit',
      rate,
    };
  });
}

function parseCostingRows(snapshot: unknown): DishCostItem[] {
  const rows = Array.isArray(snapshot)
    ? snapshot
    : snapshot && typeof snapshot === 'object' && 'items' in snapshot
      ? ((snapshot as { items?: unknown[] }).items ?? [])
      : [];

  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .map((row, index) => {
      const rawDid = row.dishId ?? row.dish_id;
      const dishId = rawDid === null || rawDid === undefined || rawDid === ''
        ? null
        : String(rawDid);
      const src = row.source === 'manual' ? 'manual' as const : 'recipe' as const;
      return {
        id: String(row.id ?? `cost-${index}`),
        dishId,
        dishName: String(row.dishName ?? row.dish_name ?? QUOTE_LEVEL_LABEL),
        source: src,
        category: String(row.category ?? 'Other'),
        name: String(row.name ?? row.ingredient_name ?? 'Item'),
        qty: Number(row.qty ?? row.quantity ?? 0) || 0,
        unit: String(row.unit ?? 'unit'),
        rate: Number(row.rate ?? row.unit_rate ?? 0) || 0,
      };
    })
    .filter(item => item.name.trim().length > 0);
}

/** Manual-only rows for hydration (menu drives recipe rows). */
function manualRowsFromSnapshot(snapshot: unknown): DishCostItem[] {
  return parseCostingRows(snapshot).filter(i => i.source === 'manual');
}

// ─── Helpers ─── (mock seed data removed)

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function normalizeDish(d: unknown): Dish {
  const raw = (d ?? {}) as Record<string, unknown>;
  // Server returns 'quantity' (string); local cache and new serializer return 'qty' (number).
  // Read both so data round-trips correctly regardless of which is present.
  const qty = Number(raw.qty ?? raw.quantity) || 0;
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    name: String(raw.name ?? ''),
    category: String(raw.category ?? 'Uncategorized'),
    pricingType: (raw.pricingType as PricingType) ?? 'per plate',
    statusBadge: (raw.statusBadge as StatusBadge) ?? 'LIVE',
    qty,
    unit: String(raw.unit ?? 'plates'),
    rate: Number(raw.rate) || 0,
    subtotal: Number(raw.subtotal) || 0,
    batch_size: raw.batch_size as number | string | undefined,
    base_recipe_qty: raw.base_recipe_qty as number | string | undefined,
  };
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function inputCls(extra = '') {
  return (
    'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white ' +
    'placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 focus:bg-white/8 ' +
    'transition-colors ' + extra
  );
}

// ─── Master dish → quotation row mapping ─────────────────────────────────────────

const DISH_CARD_BORDER = '#e0e0e0';
const DISH_NAVY = '#1a1a2e';
const DISH_BLUE_ACCENT = '#1a6bff';
const DISH_REMOVE = '#e53935';
const LIVE_BADGE_BG = '#fef9c3';
const LIVE_BADGE_TEXT = '#854d0e';

const SERVING_UNIT_MAP: Record<string, { pricingType: PricingType; unit: string }> = {
  PLATE: { pricingType: 'per plate', unit: 'plates' },
  KG: { pricingType: 'per kg', unit: 'kg' },
  PIECE: { pricingType: 'per item', unit: 'pieces' },
  LITRE: { pricingType: 'per item', unit: 'litres' },
  PORTION: { pricingType: 'per item', unit: 'portions' },
};

const DISH_TYPE_TO_BADGE: Record<string, StatusBadge> = {
  recipe: 'LIVE',
  live_counter: 'LIVE',
  fixed_price: 'FIXED',
};

// ─── Menu Tab ──────────────────────────────────────────────────────────────────

interface MenuTabProps {
  quotationId: string | null;
  dishes: Dish[];
  services: Service[];
  isSaving: boolean;
  /** Server / client error message after add/update/remove menu rows; null when none. */
  saveError: string | null;
  guestCount?: number;
  onAddDish: (dish: Dish) => void;
  onUpdateDish: (dish: Dish) => void;
  onRemoveDish: (id: string) => void;
  onAddService: (svc: Service) => void;
  onUpdateService: (svc: Service) => void;
  onRemoveService: (id: string) => void;
}

function MenuDishCard({
  dish,
  onEdit,
  onRemove,
}: {
  dish: Dish;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  function statusPill() {
    const s = dish.statusBadge;
    if (s === 'LIVE') {
      return (
        <span
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: LIVE_BADGE_BG, color: LIVE_BADGE_TEXT }}
        >
          <Zap size={11} strokeWidth={2.5} className="shrink-0" aria-hidden />
          LIVE
        </span>
      );
    }
    if (s === 'DRAFT') {
      return (
        <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          DRAFT
        </span>
      );
    }
    return (
      <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
        FIXED
      </span>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:gap-6"
      style={{ borderColor: DISH_CARD_BORDER }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug" style={{ color: DISH_NAVY, fontSize: 15 }}>
          {dish.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[11px] text-neutral-500">{dish.category}</span>
          <span className="text-[11px] font-semibold capitalize" style={{ color: DISH_BLUE_ACCENT }}>
            {dish.pricingType}
          </span>
          {statusPill()}
        </div>
      </div>  

      <div className="shrink-0 text-left sm:text-right">
        <p className="text-sm font-medium tabular-nums" style={{ color: DISH_NAVY }}>
          {(dish.qty ?? 0).toLocaleString('en-IN')} {dish.unit} × {fmtINR(dish.rate ?? 0)}
        </p>
        <p className="mt-1 text-xs text-neutral-500 tabular-nums">
          Subtotal: {fmtINR(dish.subtotal ?? 0)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-center gap-1 sm:ml-auto">
        <button
          type="button"
          onClick={() => onEdit(dish.id)}
          className="text-[10px] font-bold uppercase tracking-wide hover:opacity-80"
          style={{ color: DISH_BLUE_ACCENT }}
        >
          EDIT
        </button>
        <button
          type="button"
          onClick={() => onRemove(dish.id)}
          className="text-[10px] font-bold uppercase tracking-wide hover:opacity-80"
          style={{ color: DISH_REMOVE }}
        >
          REMOVE
        </button>
      </div>
    </div>
  );
}

const MenuTab = memo(function MenuTab({
  quotationId,
  dishes,
  services,
  isSaving,
  saveError,
  guestCount,
  onAddDish,
  onUpdateDish,
  onRemoveDish,
  onAddService,
  onUpdateService,
  onRemoveService,
}: MenuTabProps) {
  const guestQtyDefault = useMemo(() => Math.max(1, guestCount ?? 1), [guestCount]);

  const [showAddDish, setShowAddDish] = useState(false);
  const [categoriesCatalog, setCategoriesCatalog] = useState<ApiDishCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ApiDishCategory | null>(null);
  const [selectedDish, setSelectedDish] = useState<ApiDish | null>(null);
  const [quantity, setQuantity] = useState(guestQtyDefault);
  const [pricePerPlate, setPricePerPlate] = useState(0);
  const [addedDishes, setAddedDishes] = useState<AddedMenuDishEntry[]>([]);
  const [editingMenuDishId, setEditingMenuDishId] = useState<string | null>(null);

  const [showAddService, setShowAddService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState<number | ''>('');

  useEffect(() => {
    setQuantity(guestQtyDefault);
  }, [guestQtyDefault]);

  // Track which quotation we last synced from so that cache updates / background
  // refetches after an add/edit never overwrite the optimistic local state.
  // We only reinitialize when the quotation identity itself changes (e.g. first
  // load, or the user navigates to a different lead).
  const syncedQuotationIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (syncedQuotationIdRef.current === quotationId) return;
    syncedQuotationIdRef.current = quotationId;
    setAddedDishes(
      dishes.map(d => ({
        dish: d,
        category: d.category,
        quantity: d.qty,
        pricePerPlate: d.rate,
        subtotal: d.subtotal,
        status: 'DRAFT' as const,
      })),
    );
  // dishes must be in the dep array so the effect sees the loaded data when
  // quotationId first becomes non-null and dishes arrive in the same render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId, dishes]);

  useEffect(() => {
    if (!showAddDish || editingMenuDishId) return;
    setQuantity(guestQtyDefault);
    setPricePerPlate(0);
    setSelectedDish(null);
  }, [showAddDish, editingMenuDishId, guestQtyDefault]);

  const handleCategoriesLoaded = useCallback((cats: ApiDishCategory[]) => {
    setCategoriesCatalog(cats);
    setSelectedCategory(prev =>
      prev && cats.some(c => c.id === prev.id) ? prev : cats[0] ?? null,
    );
  }, []);

  function resetAddDishForm() {
    setSelectedDish(null);
    setPricePerPlate(0);
    setQuantity(guestQtyDefault);
    setEditingMenuDishId(null);
  }

  async function openDishPanelForEdit(dishId: string) {
    const entry = addedDishes.find(e => e.dish.id === dishId);
    if (!entry) return;
    let cats = categoriesCatalog;
    if (cats.length === 0) {
      try {
        const [catsRaw, dishesRaw] = await Promise.all([
          api.get('/categories/'),
          api.get('/master/dishes/?page_size=200'),
        ]);
        const list: ApiDishCategory[] = Array.isArray(catsRaw)
          ? catsRaw
          : (catsRaw.results ?? []);
        const dshs: ApiDish[] = Array.isArray(dishesRaw)
          ? dishesRaw
          : (dishesRaw.results ?? []);
        cats = buildDishPickerCategories(list, dshs.filter(d => d.is_active));
        setCategoriesCatalog(cats);
      } catch {
        toast.error('Could not load categories');
        return;
      }
    }
    let md = entry.masterDish ?? null;
    if (!md) {
      try {
        md = (await api.get(`/master/dishes/${dishId}/`)) as ApiDish;
      } catch {
        toast.error('Could not load dish details');
        return;
      }
    }
    const cat =
      (md.category
        ? cats.find(c => c.id === md.category)
        : cats.find(c => c.id === DISH_PICKER_UNCATEGORIZED_ID))
      ?? cats[0]
      ?? null;
    setSelectedCategory(cat);
    setSelectedDish(md);
    setQuantity(entry.quantity);
    setPricePerPlate(entry.pricePerPlate);
    setEditingMenuDishId(dishId);
    setShowAddDish(true);
  }

  const existingIds = useMemo(() => {
    const ids = new Set(addedDishes.map(e => e.dish.id));
    if (editingMenuDishId) ids.delete(editingMenuDishId);
    return ids;
  }, [addedDishes, editingMenuDishId]);

  function handleAddService() {
    if (!svcName.trim() || !svcPrice || Number(svcPrice) <= 0) return;
    const price = Number(svcPrice);
    if (editingServiceId) {
      onUpdateService({
        id: editingServiceId,
        name: svcName.trim(),
        rate: price,
        qty: 1,
        subtotal: price,
      });
    } else {
      onAddService({
        id: crypto.randomUUID(),
        name: svcName.trim(),
        rate: price,
        qty: 1,
        subtotal: price,
      });
    }
    setEditingServiceId(null);
    setSvcName('');
    setSvcPrice('');
    setShowAddService(false);
  }

  function openServiceEdit(svc: Service) {
    setShowAddService(true);
    setEditingServiceId(svc.id);
    setSvcName(svc.name);
    setSvcPrice(svc.rate);
  }

  const menuTotal =
    addedDishes.reduce((s, e) => s + e.dish.subtotal, 0)
    + services.reduce((s, sv) => s + sv.subtotal, 0);

  function removeAddedDish(dishId: string) {
    setAddedDishes(prev => prev.filter(e => e.dish.id !== dishId));
    onRemoveDish(dishId);
  }

  return (
    <div className="flex flex-col shadow-2xl">
      {/* ── Dishes ── */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UtensilsCrossed size={15} className="text-blue-700" />
            <span className="text-sm font-bold text-black">Dishes</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-700/15 text-blue-700 border border-blue-700/20 tabular-nums">
              {addedDishes.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAddDish(prev => {
                const next = !prev;
                if (!next) resetAddDishForm();
                return next;
              });
            }}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors',
              showAddDish
                ? 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                : 'bg-blue-500/15 text-blue-700 border border-blue-500/20 hover:bg-blue-500/25',
            ].join(' ')}
          >
            {showAddDish
              ? <><X size={13} /> Cancel</>
              : <><Plus size={13} /> Add Dish</>
            }
          </button>
        </div>

        {/* ── Add Dish Panel ── */}
        {showAddDish && (
          <AddDishInlinePanel
            existingIds={existingIds}
            submitting={isSaving}
            defaultGuestQty={guestCount != null && guestCount > 0 ? guestCount : undefined}
            controlled={{
              selectedCategoryId: selectedCategory?.id ?? '',
              onSelectedCategoryIdChange: id =>
                setSelectedCategory(categoriesCatalog.find(c => c.id === id) ?? null),
              selectedDish,
              onSelectedDishChange: setSelectedDish,
              quantity,
              onQuantityChange: setQuantity,
              pricePerPlate,
              onPricePerPlateChange: setPricePerPlate,
            }}
            onCategoriesLoaded={handleCategoriesLoaded}
            confirmLabel={editingMenuDishId ? 'Save' : 'Add'}
            onClose={() => {
              setShowAddDish(false);
              resetAddDishForm();
            }}
            onConfirmAdd={(apiDish, qty, price) => {
              const rowId = editingMenuDishId ?? apiDish.id;
              const map = SERVING_UNIT_MAP[apiDish.serving_unit]
                ?? { pricingType: 'per plate' as PricingType, unit: 'plates' };
              const batchSize = Number(apiDish.batch_size) || 1;
              const row: Dish = {
                id: rowId,
                name: apiDish.name,
                category: apiDish.category_name ?? 'Uncategorized',
                pricingType: map.pricingType,
                statusBadge: (DISH_TYPE_TO_BADGE[apiDish.dish_type] ?? 'LIVE') as StatusBadge,
                qty,
                unit: map.unit,
                rate: price,
                subtotal: qty * price,
                batch_size: batchSize,
                base_recipe_qty: batchSize,
              };
              const entry: AddedMenuDishEntry = {
                dish: row,
                category: row.category,
                quantity: qty,
                pricePerPlate: price,
                subtotal: qty * price,
                status: 'DRAFT',
                masterDish: apiDish,
              };
              setAddedDishes(prev =>
                editingMenuDishId
                  ? prev.map(e => (e.dish.id === editingMenuDishId ? entry : e))
                  : [...prev, entry],
              );
              if (editingMenuDishId) {
                onUpdateDish(row);
              } else {
                onAddDish(row);
              }
            }}
          />
        )}

        {addedDishes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-white/10">
            <UtensilsCrossed size={28} className="text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 font-medium">No dishes added yet.</p>
            <button
              type="button"
              onClick={() => setShowAddDish(true)}
              className="mt-3 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors"
            >
              Add your first dish →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {addedDishes.map(entry => (
              <MenuDishCard
                key={entry.dish.id}
                dish={entry.dish}
                onEdit={openDishPanelForEdit}
                onRemove={removeAddedDish}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/6 mx-5" />

      {/* ── Services ── */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wrench size={15} className="text-teal-400" />
            <span className="text-sm font-bold text-black">Services</span>
            {services.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/20 tabular-nums">
                {services.length}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setShowAddService(p => !p);
              setEditingServiceId(null);
              setSvcName('');
              setSvcPrice('');
            }}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors',
              showAddService
                ? 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                : 'bg-teal-500/15 text-teal-400 border border-teal-500/20 hover:bg-teal-500/25',
            ].join(' ')}
          >
            {showAddService ? <><X size={13} /> Cancel</> : <><Plus size={13} /> Add Service</>}
          </button>
        </div>

        {/* ── Inline add-service form ── */}
        {showAddService && (
          <div className="mb-4 rounded-2xl border border-teal-200 bg-teal-50 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Service Name
                </label>
                <input
                  type="text"
                  value={svcName}
                  onChange={e => setSvcName(e.target.value)}
                  placeholder="e.g. Staffing, Décor, Transport"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm
                             text-slate-800 placeholder:text-slate-400 focus:outline-none
                             focus:border-teal-400 transition-colors"
                />
              </div>
              <div className="w-36">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Rate (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={svcPrice}
                  onChange={e => setSvcPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold
                             text-slate-800 text-right tabular-nums focus:outline-none
                             focus:border-teal-400 transition-colors"
                />
              </div>
              <button
                onClick={handleAddService}
                disabled={!svcName.trim() || !svcPrice || Number(svcPrice) <= 0}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-teal-600 text-white
                           hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {editingServiceId ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-white/10">
            <Wrench size={26} className="text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 font-medium">No services added.</p>
            <p className="text-xs text-slate-600 mt-1">Add items like staffing, décor, transport, etc.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-white/8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5 pl-4 pr-3">Service</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5 px-3">Rate (₹)</th>
                  <th className="py-2.5 pl-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {services.map(svc => (
                  <tr key={svc.id} className="border-b border-white/5 group hover:bg-white/3 transition-colors">
                    <td className="py-3 pl-4 pr-3 text-sm font-semibold text-black">{svc.name}</td>
                    <td className="py-3 px-3 text-right text-sm font-bold text-black tabular-nums">{fmtINR(svc.rate)}</td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openServiceEdit(svc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => onRemoveService(svc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-black px-5 py-4.5 flex items-center justify-between">
        <span className="text-lg font-semibold text-white uppercase tracking-wide">Menu Total</span>
        <div className="flex items-center gap-3">
          {isSaving && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 size={12} className="animate-spin" /> Saving…
            </span>
          )}
          {saveError && (
            <span className="text-xs text-red-400 max-w-[min(420px,70vw)] text-right">{saveError}</span>
          )}
          <span className="text-lg font-bold text-white tabular-nums">{fmtINR(menuTotal)}</span>
        </div>
      </div>
    </div>
  );
});

// ─── Costing Tab ──────────────────────────────────────────────────────────────

type CostingSection = string;

const DEFAULT_COSTING_SECTIONS = [
  'Grocery', 'Vegetables', 'Fruits', 'Snacks', 'Rental', 'Labour', 'Transport', 'Decoration', 'Equipment', 'Other',
];

const SECTION_COLOR_PALETTE = [
  { dot: 'bg-orange-400', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { dot: 'bg-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { dot: 'bg-teal-400', badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  { dot: 'bg-purple-400', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { dot: 'bg-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { dot: 'bg-rose-400', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { dot: 'bg-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { dot: 'bg-lime-400', badge: 'bg-lime-500/10 text-lime-400 border-lime-500/20' },
  { dot: 'bg-fuchsia-400', badge: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' },
  { dot: 'bg-slate-400', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
];

interface CostItem {
  id: string;
  section: CostingSection;
  name: string;
  qty: number;
  unit: string;
  rate: number;
}

const BLANK_FORM = { section: 'Grocery' as CostingSection, name: '', qty: 1, unit: 'kg', rate: 0 };

interface CostingSheetItem {
  ingredient_name: string;
  total_quantity: number;
  unit: string;
  category?: string;
  rate?: number;
  unit_cost?: number;
  amount?: number;
}

interface CostingSheetResponse {
  items: CostingSheetItem[];
}

function normalizeCostSection(value?: string | null): CostingSection {
  const raw = (value ?? '').trim();
  if (!raw) return 'Other';
  return raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface CostingTabProps {
  leadId: string;
  items: CostItem[];
  setItems: React.Dispatch<React.SetStateAction<CostItem[]>>;
}

function CostingTab({ leadId, items, setItems }: CostingTabProps) {
  const uid = useId();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  const computedTotal = form.qty * form.rate;
  const grandTotal = items.reduce((s, i) => s + i.qty * i.rate, 0);

  const costingSections = useMemo(() => {
    const fromItems = items.map(i => normalizeCostSection(i.section));
    const merged = [...DEFAULT_COSTING_SECTIONS, ...fromItems];
    return [...new Set(merged)];
  }, [items]);

  const grouped = useMemo(() => {
    return items.reduce<Record<CostingSection, CostItem[]>>((acc, item) => {
      const sec = normalizeCostSection(item.section);
      if (!acc[sec]) acc[sec] = [];
      acc[sec].push({ ...item, section: sec });
      return acc;
    }, {});
  }, [items]);

  function openAddForm() { setEditId(null); setForm(BLANK_FORM); setShowForm(true); }

  function openEditForm(item: CostItem) {
    setEditId(item.id);
    setForm({ section: item.section, name: item.name, qty: item.qty, unit: item.unit, rate: item.rate });
    setShowForm(true);
  }

  function handleCancel() { setShowForm(false); setEditId(null); setForm(BLANK_FORM); }

  function handleSave() {
    if (!form.name.trim() || form.qty <= 0 || form.rate < 0) return;
    const normalizedSection = normalizeCostSection(form.section);
    if (editId) {
      setItems(prev => prev.map(i => i.id === editId ? { ...i, ...form, section: normalizedSection } : i));
    } else {
      setItems(prev => [...prev, { id: `${Date.now()}`, ...form, section: normalizedSection }]);
    }
    handleCancel();
  }

  function handleRemove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    if (editId === id) handleCancel();
  }

  async function handleSyncFromIngredients() {
    setSyncing(true);
    setSyncError('');
    try {
      const raw = await api.get(`/quotations/?inquiry=${leadId}`);
      const quotes: ApiQuotation[] = Array.isArray(raw) ? raw : (raw?.results ?? []);
      const quotationId = quotes[0]?.id;
      if (!quotationId) {
        setSyncError('Add dishes in Menu first, then sync internal costing.');
        return;
      }

      const data = await api.get(`/quotations/${quotationId}/grocery-sheet/`) as CostingSheetResponse;
      const nextItems: CostItem[] = (data.items ?? []).map((item, idx) => ({
        // Prefer direct unit rate; otherwise derive from amount / qty if provided.
        // This keeps synced Internal Costing totals meaningful whenever backend returns costing values.
        // eslint-disable-next-line no-nested-ternary
        rate: Number(item.rate ?? item.unit_cost ?? (item.amount && item.total_quantity ? item.amount / item.total_quantity : 0)) || 0,
        id: `sync-${Date.now()}-${idx}`,
        section: normalizeCostSection(item.category),
        name: item.ingredient_name,
        qty: Number(item.total_quantity) || 0,
        unit: item.unit || 'unit',
      }));
      setItems(nextItems);
    } catch {
      setSyncError('Unable to sync ingredient categories right now. Please retry.');
    } finally {
      setSyncing(false);
    }
  }

  const sectionsWithItems = Object.keys(grouped).filter(section => grouped[section]?.length > 0);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-white/6">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ClipboardList size={15} className="text-yellow-400" />
            <span className="text-sm font-bold text-black">Internal Costing Sheet</span>
          </div>
          <p className="text-[11px] text-slate-500 pl-5.75">Manual cost breakdown — admin only</p>
        </div>
        <button onClick={openAddForm}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                     bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/25 transition-colors">
          <Plus size={13} /> Add Item
        </button>
        <button
          onClick={() => void handleSyncFromIngredients()}
          disabled={syncing}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                     bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          Sync Ingredients
        </button>
      </div>
      {syncError && <p className="px-5 pb-2 text-[11px] text-red-500">{syncError}</p>}

      {/* Inline form */}
      {showForm && (
        <div className="mx-5 mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-wide">
              {editId ? 'Edit Item' : 'New Item'}
            </span>
            <button onClick={handleCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor={`${uid}-section`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Section</label>
              <div className="relative">
                <select id={`${uid}-section`} value={form.section}
                  onChange={e => setForm(f => ({ ...f, section: e.target.value as CostingSection }))}
                  className={inputCls('appearance-none pr-8 cursor-pointer')}>
                  {costingSections.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="col-span-2">
              <label htmlFor={`${uid}-name`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Item Name</label>
              <input id={`${uid}-name`} type="text" placeholder="e.g. Chicken, Rice, Plates…"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls()} />
            </div>

            <div>
              <label htmlFor={`${uid}-qty`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty</label>
              <input id={`${uid}-qty`} type="number" min={0} step={0.5} value={form.qty}
                onChange={e => setForm(f => ({ ...f, qty: parseFloat(e.target.value) || 0 }))}
                className={inputCls('text-right tabular-nums')} />
            </div>

            <div>
              <label htmlFor={`${uid}-unit`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Unit</label>
              <input id={`${uid}-unit`} type="text" placeholder="kg" value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className={inputCls()} />
            </div>

            <div>
              <label htmlFor={`${uid}-rate`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Rate (₹)</label>
              <input id={`${uid}-rate`} type="number" min={0} step={1} placeholder="0"
                value={form.rate || ''}
                onChange={e => setForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))}
                className={inputCls('text-right tabular-nums')} />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/8">
            <div className="text-[11px] text-slate-500">
              Total&nbsp;=&nbsp;
              <span className="text-black font-bold tabular-nums text-sm">{fmtINR(computedTotal)}</span>
              {form.qty > 0 && form.rate > 0 && (
                <span className="ml-1 text-slate-600">({form.qty}&nbsp;{form.unit || 'units'}&nbsp;×&nbsp;{fmtINR(form.rate)})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCancel}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400
                           border border-white/10 hover:border-white/20 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={!form.name.trim() || form.qty <= 0}
                className="px-3 py-1.5 rounded-xl text-xs font-bold
                           bg-yellow-500/20 text-yellow-400 border border-yellow-500/30
                           hover:bg-yellow-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {editId ? 'Update Item' : 'Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <ClipboardList size={30} className="text-slate-700 mb-3" />
          <p className="text-sm text-slate-500 font-medium">No cost items yet.</p>
          <p className="text-xs text-slate-600 mt-1">Add grocery, labour, transport or misc costs.</p>
          <button onClick={openAddForm}
            className="mt-4 text-sm font-semibold text-yellow-400 hover:text-yellow-300 transition-colors">
            + Add first item
          </button>
        </div>
      )}

      {/* Grouped list */}
      {sectionsWithItems.length > 0 && (
        <div className="px-5 pt-4 pb-2 flex flex-col gap-5">
          {sectionsWithItems.map(section => {
            const sectionItems = grouped[section];
            const sectionTotal = sectionItems.reduce((s, i) => s + i.qty * i.rate, 0);
            const paletteIndex = section.charCodeAt(0) % SECTION_COLOR_PALETTE.length;
            const { dot, badge } = SECTION_COLOR_PALETTE[paletteIndex];
            return (
              <div key={section}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge}`}>{section}</span>
                    <span className="text-[11px] text-slate-600 tabular-nums">
                      {sectionItems.length} item{sectionItems.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 tabular-nums">{fmtINR(sectionTotal)}</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-white/8">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/8 bg-white/3">
                        <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 pl-4 pr-3">Item</th>
                        <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Qty</th>
                        <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Rate</th>
                        <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Total</th>
                        <th className="py-2 pl-2 pr-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {sectionItems.map(item => (
                        <tr key={item.id} className="border-b border-white/5 last:border-0 group hover:bg-white/3 transition-colors">
                          <td className="py-2.5 pl-4 pr-3 text-sm font-medium text-black">{item.name}</td>
                          <td className="py-2.5 px-3 text-right text-sm text-slate-400 tabular-nums">
                            {item.qty}&nbsp;<span className="text-slate-600 text-xs">{item.unit}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-sm text-slate-400 tabular-nums">{fmtINR(item.rate)}</td>
                          <td className="py-2.5 px-3 text-right text-sm font-bold text-black tabular-nums">{fmtINR(item.qty * item.rate)}</td>
                          <td className="py-2.5 pl-2 pr-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditForm(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Edit">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => handleRemove(item.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remove">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && <div className="pb-1" />}

      {items.length > 0 && (
        <div className="border-t border-white/10 bg-white/4 px-5 py-3.5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Grand Total</span>
            <span className="ml-2 text-[11px] text-slate-600 tabular-nums">({items.length} item{items.length > 1 ? 's' : ''})</span>
          </div>
          <span className="text-lg font-bold text-black tabular-nums">{fmtINR(grandTotal)}</span>
        </div>
      )}
    </div>
  );
}

const DISH_COST_BLANK_FORM = {
  dishId: '',
  category: 'Other',
  name: '',
  qty: 1,
  unit: 'kg',
  rate: 0,
};

const QUOTE_LEVEL_FORM_VALUE = '__quote_level__';

interface CostingTabByDishProps {
  dishes: Dish[];
  items: DishCostItem[];
  setItems: React.Dispatch<React.SetStateAction<DishCostItem[]>>;
  /** Shown when manual costs need review (e.g. all dishes removed but manual lines remain). */
  manualReviewWarning: string | null;
}

function CostingTabByDish({ dishes, items, setItems, manualReviewWarning }: CostingTabByDishProps) {
  const uid = useId();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DISH_COST_BLANK_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  const computedTotal = form.qty * form.rate;
  const grandTotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const totalRecipe = items.filter(i => i.source === 'recipe').reduce((s, i) => s + i.qty * i.rate, 0);
  const totalManual = items.filter(i => i.source === 'manual').reduce((s, i) => s + i.qty * i.rate, 0);
  const dishMap = useMemo(() => new Map(dishes.map(d => [d.id, d])), [dishes]);

  const { groupedByDish, quoteLevelManual, orphanManual } = useMemo(() => {
    const byDish = dishes.map(dish => {
      const dishItems = items.filter(item => item.dishId === dish.id);
      return {
        dish,
        dishItems,
        dishTotal: dishItems.reduce((sum, item) => sum + item.qty * item.rate, 0),
      };
    });
    const quoteLevel = items.filter(
      i => i.source === 'manual' && (i.dishId == null || i.dishId === ''),
    );
    const orphan = items.filter(
      i => i.source === 'manual' && i.dishId != null && i.dishId !== '' && !dishMap.has(i.dishId),
    );
    return { groupedByDish: byDish, quoteLevelManual: quoteLevel, orphanManual: orphan };
  }, [dishes, items, dishMap]);

  function openAddForm(dishId?: string) {
    setEditId(null);
    if (dishId) {
      setForm({ ...DISH_COST_BLANK_FORM, dishId });
    } else if (dishes.length > 0) {
      setForm({ ...DISH_COST_BLANK_FORM, dishId: dishes[0].id });
    } else {
      setForm({ ...DISH_COST_BLANK_FORM, dishId: QUOTE_LEVEL_FORM_VALUE });
    }
    setShowForm(true);
  }

  function openEditForm(item: DishCostItem) {
    setEditId(item.id);
    setForm({
      dishId: item.dishId == null || item.dishId === '' ? QUOTE_LEVEL_FORM_VALUE : item.dishId,
      category: item.category,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      rate: item.rate,
    });
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditId(null);
    setForm(DISH_COST_BLANK_FORM);
  }

  function handleSave() {
    if (!form.name.trim() || form.qty <= 0 || form.rate < 0) return;
    const isQuoteLevel = form.dishId === QUOTE_LEVEL_FORM_VALUE || form.dishId === '';
    if (!isQuoteLevel && !dishMap.get(form.dishId)) return;

    const linkedDish = isQuoteLevel ? null : dishMap.get(form.dishId);
    const nextPayload: Omit<DishCostItem, 'id'> = {
      dishId: isQuoteLevel ? null : form.dishId,
      dishName: linkedDish ? linkedDish.name : QUOTE_LEVEL_LABEL,
      source: editId ? (items.find(i => i.id === editId)?.source ?? 'manual') : 'manual',
      category: normalizeDishCostCategory(form.category),
      name: form.name.trim(),
      qty: form.qty,
      unit: form.unit.trim() || 'unit',
      rate: form.rate,
    };
    if (editId) {
      setItems(prev => prev.map(i => i.id === editId ? { ...i, ...nextPayload } : i));
    } else {
      setItems(prev => [...prev, { id: `manual-${Date.now()}`, ...nextPayload }]);
    }
    handleCancel();
  }

  function handleRemove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    if (editId === id) handleCancel();
  }

  function handleRateChange(itemId: string, nextRate: number) {
    setItems(prev => prev.map(item => (
      item.id === itemId ? { ...item, rate: Math.max(0, nextRate) } : item
    )));
  }

  async function handleSyncFromDishes() {
    if (dishes.length === 0) return;
    setSyncing(true);
    setSyncError('');
    try {
      const recipeItemsByDish = await Promise.all(
        dishes.map(async (dish) => {
          const recipe = await api.get(`/master/dishes/${dish.id}/recipe/`) as ApiRecipeResponse;
          return recipeCostRowsFromApi(dish, recipe);
        }),
      );
      const recipeItems = recipeItemsByDish.flat();
      setItems(prev => {
        const manualItems = prev.filter(i => i.source === 'manual');
        return [...recipeItems, ...manualItems];
      });
    } catch {
      setSyncError('Unable to sync dish ingredients right now. Please retry.');
    } finally {
      setSyncing(false);
    }
  }

  function renderCostingTableRows(
    dishItems: DishCostItem[],
    emptyMessage: string,
  ) {
    if (dishItems.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
            {emptyMessage}
          </td>
        </tr>
      );
    }
    return dishItems.map(item => (
      <tr key={item.id} className="border-b border-white/5 last:border-0 group hover:bg-white/3 transition-colors">
        <td className="py-2.5 pl-4 pr-3 text-sm font-medium text-black">
          <div className="flex items-center gap-2 flex-wrap">
            <span>{item.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              {item.source === 'recipe' ? 'recipe' : 'manual'}
            </span>
            <span className="text-[10px] text-slate-500">{item.category}</span>
          </div>
        </td>
        <td className="py-2.5 px-3 text-right text-sm text-slate-700 tabular-nums">
          {item.qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
        </td>
        <td className="py-2.5 px-3 text-sm text-slate-600">{item.unit}</td>
        <td className="py-2.5 px-3 text-right">
          <input
            type="number"
            min={0}
            step={1}
            value={item.rate}
            onChange={e => handleRateChange(item.id, parseFloat(e.target.value) || 0)}
            className="w-24 bg-white border border-slate-200 rounded-md px-2 py-1 text-sm text-right tabular-nums"
          />
        </td>
        <td className="py-2.5 px-3 text-right text-sm font-bold text-black tabular-nums">{fmtINR(item.qty * item.rate)}</td>
        <td className="py-2.5 pl-2 pr-3 text-right">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => openEditForm(item)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
              title="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={() => handleRemove(item.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </td>
      </tr>
    ));
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-white/6">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ClipboardList size={15} className="text-yellow-400" />
            <span className="text-sm font-bold text-black">Internal Costing Sheet</span>
          </div>
          <p className="text-[11px] text-slate-500 pl-5.75">
            Recipe costs follow the menu; manual lines (rentals, labour, misc.) stay until you remove them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSyncFromDishes()}
            disabled={syncing || dishes.length === 0}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                     bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            Sync from Dishes
          </button>
          <button
            type="button"
            onClick={() => openAddForm()}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                     bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/25 transition-colors"
          >
            <Plus size={13} /> Add Item
          </button>
        </div>
      </div>
      {manualReviewWarning && (
        <div
          className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
        >
          <AlertTriangle className="shrink-0 mt-0.5" size={16} />
          <span>{manualReviewWarning}</span>
        </div>
      )}
      {syncError && <p className="px-5 pt-3 text-[11px] text-red-500">{syncError}</p>}

      {showForm && (
        <div className="mx-5 mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-wide">
              {editId ? 'Edit Item' : 'New Item'}
            </span>
            <button type="button" onClick={handleCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor={`${uid}-dish`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dish (optional for quote-level)</label>
              <div className="relative">
                <select
                  id={`${uid}-dish`}
                  value={form.dishId === '' ? QUOTE_LEVEL_FORM_VALUE : form.dishId}
                  onChange={e => setForm(f => ({ ...f, dishId: e.target.value }))}
                  className={inputCls('appearance-none pr-8 cursor-pointer')}
                >
                  <option value={QUOTE_LEVEL_FORM_VALUE} className="bg-slate-900">{QUOTE_LEVEL_LABEL} (rentals, labour, misc.)</option>
                  {dishes.map(dish => (
                    <option key={dish.id} value={dish.id} className="bg-slate-900">{dish.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div className="col-span-2">
              <label htmlFor={`${uid}-category`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
              <input id={`${uid}-category`} type="text" placeholder="e.g. Grocery, Rental, Labour"
                value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className={inputCls()} />
            </div>
            <div className="col-span-2">
              <label htmlFor={`${uid}-name`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Item Name</label>
              <input id={`${uid}-name`} type="text" placeholder="e.g. Packaging, Extra labor, Transport"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls()} />
            </div>
            <div>
              <label htmlFor={`${uid}-qty`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty</label>
              <input id={`${uid}-qty`} type="number" min={0} step={0.5} value={form.qty}
                onChange={e => setForm(f => ({ ...f, qty: parseFloat(e.target.value) || 0 }))}
                className={inputCls('text-right tabular-nums')} />
            </div>
            <div>
              <label htmlFor={`${uid}-unit`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Unit</label>
              <input id={`${uid}-unit`} type="text" placeholder="kg" value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className={inputCls()} />
            </div>
            <div>
              <label htmlFor={`${uid}-rate`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Rate (₹)</label>
              <input id={`${uid}-rate`} type="number" min={0} step={1} placeholder="0"
                value={form.rate || ''}
                onChange={e => setForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))}
                className={inputCls('text-right tabular-nums')} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/8">
            <div className="text-[11px] text-slate-500">
              Total&nbsp;=&nbsp;
              <span className="text-black font-bold tabular-nums text-sm">{fmtINR(computedTotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCancel}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.name.trim() || form.qty <= 0}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {editId ? 'Update Item' : 'Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dishes.length === 0 && items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <ClipboardList size={30} className="text-slate-700 mb-3" />
          <p className="text-sm text-slate-500 font-medium">No dishes in menu.</p>
          <p className="text-xs text-slate-600 mt-1">Add dishes in the Menu tab for recipe costs, or add quote-level manual costs below.</p>
        </div>
      )}

      {dishes.length > 0 && items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <ClipboardList size={30} className="text-slate-700 mb-3" />
          <p className="text-sm text-slate-500 font-medium">No internal costing items yet.</p>
          <p className="text-xs text-slate-600 mt-1">Recipe lines are added when you add dishes; use Sync to refresh from recipes.</p>
          <button
            type="button"
            onClick={() => void handleSyncFromDishes()}
            className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Sync now
          </button>
        </div>
      )}

      {(groupedByDish.some(group => group.dishItems.length > 0)
        || quoteLevelManual.length > 0
        || orphanManual.length > 0) && (
        <div className="px-5 pt-4 pb-2 flex flex-col gap-5">
          {groupedByDish.map(({ dish, dishItems, dishTotal }) => (
            <div key={dish.id} className="rounded-xl border border-white/8 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-white/8">
                <div>
                  <p className="text-sm font-bold text-black">{dish.name}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Dish Qty: {(dish.qty ?? 0).toLocaleString('en-IN')} {dish.unit}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-600 tabular-nums">
                    {dishItems.length} item{dishItems.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => openAddForm(dish.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-yellow-500/15 text-yellow-600 border border-yellow-500/20 hover:bg-yellow-500/25 transition-colors"
                  >
                    <Plus size={11} /> Add Item
                  </button>
                </div>
              </div>
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/3">
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 pl-4 pr-3">Item Name</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Quantity</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Unit</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Rate</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Total</th>
                      <th className="py-2 pl-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {renderCostingTableRows(dishItems, 'No ingredients or extras added for this dish.')}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-white/10 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Dish Total Cost</span>
                <span className="text-base font-bold text-black tabular-nums">{fmtINR(dishTotal)}</span>
              </div>
            </div>
          ))}

          {orphanManual.length > 0 && (
            <div className="rounded-xl border border-orange-200 overflow-hidden bg-orange-50/30">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-orange-50 border-b border-orange-100">
                <div>
                  <p className="text-sm font-bold text-orange-900">Linked to removed dish — review</p>
                  <p className="text-[11px] text-orange-800 mt-0.5">These manual lines reference a dish no longer on the menu.</p>
                </div>
              </div>
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-orange-100 bg-white/80">
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 pl-4 pr-3">Item Name</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Quantity</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Unit</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Rate</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Total</th>
                      <th className="py-2 pl-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {renderCostingTableRows(orphanManual, '—')}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {quoteLevelManual.length > 0 && (
            <div className="rounded-xl border border-white/8 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-white/8">
                <div>
                  <p className="text-sm font-bold text-black">{QUOTE_LEVEL_LABEL}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Rentals, labour, transport, and other non-recipe costs</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setForm({ ...DISH_COST_BLANK_FORM, dishId: QUOTE_LEVEL_FORM_VALUE });
                    setShowForm(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-yellow-500/15 text-yellow-600 border border-yellow-500/20 hover:bg-yellow-500/25 transition-colors"
                >
                  <Plus size={11} /> Add Item
                </button>
              </div>
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/3">
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 pl-4 pr-3">Item Name</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Quantity</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Unit</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Rate</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3">Total</th>
                      <th className="py-2 pl-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {renderCostingTableRows(quoteLevelManual, 'Add quote-level items with the form above.')}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {items.length > 0 && <div className="pb-1" />}

      {items.length > 0 && (
        <div className="border-t border-white/10 bg-black px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-lg font-semibold text-white">Total Internal Cost</span>
            <span className="ml-2 text-[11px] text-slate-400 tabular-nums">({items.length} item{items.length > 1 ? 's' : ''})</span>
            <p className="text-[10px] text-slate-500 mt-1 tabular-nums">
              From menu (recipe) {fmtINR(totalRecipe)} · Manual {fmtINR(totalManual)} · Total {fmtINR(grandTotal)}
            </p>
          </div>
          <span className="text-4xl font-bold text-white tabular-nums">{fmtINR(grandTotal)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Validation helpers ────────────────────────────────────────────────────────

const INGREDIENT_CATEGORY_LABELS: Record<string, string> = {
  GROCERY: 'Grocery',
  DAIRY: 'Dairy',
  VEGETABLE: 'Vegetable',
  FRUIT: 'Fruit',
  CHICKEN: 'Chicken',
  BEEF: 'Beef',
  MUTTON: 'Mutton',
  FISH: 'Fish',
  MEAT: 'Meat',
  DISPOSABLE: 'Disposable',
  RENTAL: 'Rental',
  OTHER: 'Other',
};

// ─── Validation Tab ────────────────────────────────────────────────────────────

interface ValidationTabProps {
  dishes: Dish[];
  quotationId: string | null;
  clientName: string;
  eventDate?: string;
  guestCount?: number;
  eventType: string;
  quoteId: string;
}

interface GrocerySheetItem {
  ingredient_name: string;
  total_quantity: number;
  unit: string;
  category?: string;
}

interface GrocerySheetResponse {
  quotation_id: string;
  client_name: string;
  event_date?: string | null;
  total_guests?: number | null;
  generated_at: string;
  items: GrocerySheetItem[];
}

function ValidationTab({ dishes, quotationId, clientName, eventDate, guestCount, eventType, quoteId }: ValidationTabProps) {
  const [sheet, setSheet] = useState<GrocerySheetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleSync() {
    if (!quotationId) return;
    setLoading(true);
    setSyncError(false);
    try {
      const data = await api.get(`/quotations/${quotationId}/grocery-sheet/`) as GrocerySheetResponse;
      setSheet(data);
    } catch {
      setSyncError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(kind: 'pdf' | 'excel') {
    if (!quotationId) return;
    const ext = kind === 'pdf' ? 'pdf' : 'xlsx';
    await api.download(
      `/quotations/${quotationId}/grocery-sheet/export-${kind}/`,
      `grocery-sheet-${quoteId}.${ext}`,
    );
  }

  const items = sheet?.items ?? [];

  return (
    <div className="flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/6">
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldCheck size={15} className="text-green-400 shrink-0" />
          <span className="text-sm font-bold text-black">Ingredient Validation</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                           bg-green-500/10 text-green-400 border border-green-500/20 tracking-wide">
            Grocery Sheet
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sheet && (
            <>
              <button
                onClick={() => void handleDownload('excel')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                         bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 transition-colors"
              >
                Download Grocery Sheet (Excel)
              </button>
              <button
                onClick={() => void handleDownload('pdf')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                         bg-purple-500/10 text-purple-400 border border-purple-500/25 hover:bg-purple-500/20 transition-colors"
              >
                Download Grocery Sheet (PDF)
              </button>
            </>
          )}
          <button
            onClick={() => void handleSync()}
            disabled={!quotationId || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                     bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Sync Ingredients from Menu
          </button>
          {sheet && (
            <button
              onClick={() => void handleSync()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                         bg-white/5 text-slate-400 border border-white/10 hover:text-white/80 hover:border-white/20 transition-colors"
            >
              <RefreshCw size={12} /> Re-sync from Menu
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-xl text-slate-400 bg-white/5 border border-white/10
                       hover:text-white hover:border-white/20 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* ── Dark info header block ── */}
      <div className="mx-5 mt-4 rounded-xl overflow-hidden border border-white/8">
        {/* Title bar */}
        <div className="bg-slate-900 px-4 py-3 border-b border-white/8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
              Ingredient Validation Sheet
            </p>
            <p className="text-xs font-bold text-black tabular-nums">{quoteId}</p>
          </div>
          {sheet && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400">
                <ClipboardList size={10} /> {items.length} ingredients
              </span>
            </div>
          )}
        </div>

        {/* Lead metadata row */}
        <div className="bg-slate-900/60 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Client', value: clientName },
            { label: 'Event Date', value: fmtDate(eventDate) },
            { label: 'No of Guests', value: guestCount ? `${guestCount} Pax` : '—' },
            { label: 'Items', value: `${dishes.length} dishes` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-0.5">{label}</p>
              <p className="text-xs font-semibold text-slate-300">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Empty state ── */}
      {!sheet && (
        <div className="flex flex-col items-center justify-center py-14 text-center px-6">
          <div className="relative mb-4">
            <UtensilsCrossed size={32} className="text-slate-700" />
            <X size={14} className="absolute -bottom-1 -right-1 text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-400 mb-1">No grocery items yet</p>
          <p className="text-xs text-slate-600 mb-5">
            Sync ingredients directly from the dishes in your Menu tab.
          </p>
          <button
            onClick={() => void handleSync()}
            disabled={dishes.length === 0 || !quotationId || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold
                       bg-green-500/15 text-green-400 border border-green-500/25
                       hover:bg-green-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Sync Ingredients from Menu
          </button>
          {syncError && (
            <p className="mt-3 text-[11px] text-red-400">Failed to generate grocery sheet. Please retry.</p>
          )}
          {dishes.length === 0 && (
            <p className="mt-3 text-[11px] text-slate-600">Add dishes in the Menu tab first.</p>
          )}
        </div>
      )}

      {/* ── Ingredient table ── */}
      {sheet && items.length > 0 && (
        <div className={`px-5 pt-4 ${expanded ? '' : 'pb-2'}`}>
          <div className="rounded-xl overflow-hidden border border-white/8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5 pl-4 pr-3">Category</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5 px-3">Ingredient Name</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5 px-3">Total Quantity</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5 px-3">Unit</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={`${item.ingredient_name}-${idx}`} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pl-4 pr-3 text-sm text-slate-400">{item.category || 'OTHER'}</td>
                    <td className="py-3 px-3 text-sm font-medium text-black">{item.ingredient_name}</td>
                    <td className="py-3 px-3 text-right text-sm text-slate-300 tabular-nums">
                      {Number(item.total_quantity).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </td>
                    <td className="py-3 px-3 text-sm text-slate-500">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary pills */}
          <div className="flex items-center gap-3 mt-3 mb-4 flex-wrap">
            <span className="text-[11px] text-slate-600">{items.length} ingredients total</span>
            <span className="text-[11px] text-slate-600">Generated from selected menu dishes</span>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Pricing Tab ──────────────────────────────────────────────────────────────

interface PricingTabProps {
  quotationId: string | null;
  isLocked: boolean;
  initialSellingPrice: number;
  initialInternalCost: number;
  initialAdvanceAmount: number;
  menuTotal: number;
  internalCost: number;
  hasCostItems: boolean;
  guestCount?: number;
  quoteId: string;
  onFinalise: (payload: {
    final_selling_price: number;
    internal_cost: number;
    advance_amount: number;
    costing_data: ReturnType<typeof buildCostingSnapshot>;
    grocery_data: unknown;
    pricing_data: Record<string, number | string>;
  }) => Promise<void>;
}

function pricingInputCls(extra = '') {
  return (
    'w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-2xl font-semibold ' +
    'text-slate-900 tabular-nums placeholder:text-slate-400 ' +
    'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all ' + extra
  );
}

function PricingTab({
  quotationId,
  isLocked,
  initialSellingPrice,
  initialInternalCost,
  initialAdvanceAmount,
  menuTotal,
  internalCost,
  hasCostItems,
  guestCount,
  quoteId,
  onFinalise,
}: PricingTabProps) {


  const defaultSellingPrice =
  initialSellingPrice > 0
    ? initialSellingPrice
    : internalCost > 0
      ? Math.round(internalCost * 1.3)
      : menuTotal;

  const [sellingPrice, setSellingPrice] = useState<number>(defaultSellingPrice);

  const [advanceAmount, setAdvanceAmount] = useState<number>(
    initialAdvanceAmount || 0
  );

  const [finalising, setFinalising] = useState(false);

  // Auto-sync selling price unless manually edited
  const [userEdited, setUserEdited] = useState(false);

  useEffect(() => {
    if (!userEdited && !isLocked) {
      setSellingPrice(
        initialSellingPrice > 0
          ? initialSellingPrice
          : internalCost > 0
            ? Math.round(internalCost * 1.3)
            : menuTotal
      );
    }
  }, [
    initialSellingPrice,
    internalCost,
    menuTotal,
    userEdited,
    isLocked,
  ]);

  useEffect(() => {
    setSellingPrice(
      initialSellingPrice > 0
        ? initialSellingPrice
        : internalCost > 0
          ? Math.round(internalCost * 1.3)
          : menuTotal
    );

    setAdvanceAmount(initialAdvanceAmount || 0);

    setUserEdited(false);
  }, [
    initialSellingPrice,
    initialAdvanceAmount,
    internalCost,
    menuTotal,
  ]);

  const margin =
    sellingPrice > 0
      ? Math.round((((sellingPrice - internalCost) / sellingPrice) * 100) * 100) / 100
      : 0;

  const perPlate = guestCount && guestCount > 0 ? Math.round(sellingPrice / guestCount) : null;
  const balance = sellingPrice - advanceAmount;

  async function handleFinalise() {
    if (!quotationId || sellingPrice <= 0 || isLocked) return;
    setFinalising(true);
    try {
      await onFinalise({
        final_selling_price: sellingPrice,
        internal_cost: internalCost,
        advance_amount: advanceAmount,
        costing_data: buildCostingSnapshot([]),
        grocery_data: {},
        pricing_data: {
          final_selling_price: sellingPrice,
          selling_price: sellingPrice,
          internal_cost: internalCost,
          total_cost: internalCost,
          advance_amount: advanceAmount,
          credited_amount: advanceAmount,
          balance_amount: Math.max(0, balance),
          margin_percentage: margin,
          menu_total: menuTotal,
        },
      });
    } finally {
      setFinalising(false);
    }
  }

  return (
    <div className="flex flex-col">

      {/* ── Header ── */}
      <div className="px-6 pt-7 pb-5 border-b border-slate-200">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Pricing</h3>
          <p className="text-md text-slate-600 mt-1">Set the final selling price to quote the client</p>
        </div>
      </div>

      <div className="px-6 py-6 flex flex-col gap-5">

        {/* ── Internal cost box ── */}
        <div className={`rounded-2xl p-5 border ${hasCostItems
          ? 'bg-slate-50 border-slate-200'
          : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-medium text-slate-600">
                INTERNAL COST
              </p>
              <p className="text-lg text-slate-400 mt-1">
                {hasCostItems ? 'From Costing sheet' : 'Add items in Costing tab'}
              </p>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${hasCostItems ? 'text-slate-900' : 'text-slate-500'}`}>
              {fmtINR(internalCost)}
            </p>
          </div>
        </div>

        {/* ── Editable fields ── */}
        <div className="flex flex-col gap-4">
          {/* Final selling price */}
          <div>
            <label className="block text-lg font-medium text-slate-900 mb-2.5">
              Final Selling Price (₹)
            </label>
            <div className="relative ">
              <input
                type="number"
                min={0}
                step={100}
                value={sellingPrice}
                disabled={isLocked}
                onChange={e => {
                  setUserEdited(true);
                  setSellingPrice(parseFloat(e.target.value) || 0);
                }}
                className={pricingInputCls()}
              />
              {perPlate !== null && sellingPrice > 0 && (
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm text-slate-500 tabular-nums">
                  ₹{perPlate.toLocaleString('en-IN')}/plate
                </span>
              )}
            </div>
            {!isLocked && userEdited && sellingPrice !== menuTotal && (
              <button
                onClick={() => { setSellingPrice(menuTotal); setUserEdited(false); }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                Reset to menu total ({fmtINR(menuTotal)})
              </button>
            )}
          </div>

          {/* Advance amount */}
          <div>
            <label className="block text-lg font-medium text-slate-900 mb-2.5">
              Advance Amount (₹)
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={100}
                value={advanceAmount || ''}
                placeholder="0"
                disabled={isLocked}
                onChange={e => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                className={
                  'w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-xl font-medium ' +
                  'text-slate-900 tabular-nums placeholder:text-slate-400 ' +
                  'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all'
                }
              />
              {advanceAmount > 0 && sellingPrice > 0 && (
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-base text-slate-500 tabular-nums">
                  Balance: {fmtINR(balance)}
                </span>
              )}
            </div>
          </div>

        </div>

        {/* ── Summary badges ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-1.5">SELLING</p>
            <p className="text-xl font-bold tabular-nums text-emerald-800 leading-none">
              {fmtINR(sellingPrice)}
            </p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-700 mb-1.5">COST</p>
            <p className={`text-xl font-bold tabular-nums leading-none ${hasCostItems ? 'text-rose-800' : 'text-slate-500'}`}>
              {fmtINR(internalCost)}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-700 mb-1.5">MARGIN</p>
            <p className={`text-xl font-bold tabular-nums leading-none ${!hasCostItems ? 'text-slate-500' : 'text-blue-800'}`}>
              {!hasCostItems ? '—' : `${margin}%`}
            </p>
          </div>
        </div>

        {/* ── Finalise button ── */}
        {isLocked && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            Pricing is locked. Use Revise Quotation to make changes.
          </p>
        )}
        <button
          onClick={handleFinalise}
          disabled={!quotationId || sellingPrice <= 0 || isLocked || finalising}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
                     text-xl font-bold transition-all duration-200
                     bg-gradient-to-r from-indigo-500 to-violet-600
                     text-white disabled:opacity-50 disabled:cursor-not-allowed
                     hover:from-indigo-600 hover:to-violet-700 shadow-sm"
        >
          {isLocked
            ? <><BadgeCheck size={18} /> Quotation Finalised</>
            : <><Send size={18} /> Finalise &amp; Send Quotation</>
          }
        </button>
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

type EventStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'REVISED';

interface RevisionEvent {
  id: string;
  action: string;
  icon: keyof typeof EVENT_ICONS;
  status: EventStatus;
  timestamp: string; // ISO string
  by?: string;
  note?: string;
}

interface Revision {
  rev: number;
  isCurrent: boolean;
  events: RevisionEvent[];
}

// Icon registry — keeps the data layer free of JSX
const EVENT_ICONS = {
  created: CheckCheck,
  edited: PenLine,
  sent: Send,
  opened: MailOpen,
  called: PhoneCall,
  approved: FileCheck2,
  rejected: XCircle,
  pending: Clock,
} as const;

const STATUS_CONFIG: Record<EventStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Pending', cls: 'bg-purple-500/15 text-purple-400 border border-purple-500/25' },
  SENT: { label: 'Sent', cls: 'bg-blue-500/15   text-blue-400   border border-blue-500/25' },
  ACCEPTED: { label: 'Accepted', cls: 'bg-green-500/15  text-green-400  border border-green-500/25' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-500/15    text-red-400    border border-red-500/25' },
  REVISED: { label: 'Revised', cls: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25' },
};

const ICON_BG: Record<keyof typeof EVENT_ICONS, string> = {
  created: 'bg-green-500/15  text-green-400',
  edited: 'bg-blue-500/15   text-blue-400',
  sent: 'bg-purple-500/15 text-purple-400',
  opened: 'bg-teal-500/15   text-teal-400',
  called: 'bg-orange-500/15 text-orange-400',
  approved: 'bg-green-500/15  text-green-400',
  rejected: 'bg-red-500/15    text-red-400',
  pending: 'bg-slate-500/15  text-slate-400',
};

function fmtTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', '
    + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
}

// ── Mock history data ──────────────────────────────────────────────────────────

const MOCK_REVISIONS: Revision[] = [
  {
    rev: 3,
    isCurrent: true,
    events: [
      {
        id: 'r3-e1', action: 'Quotation revised — menu updated', icon: 'edited',
        status: 'PENDING', timestamp: '2026-04-14T10:30:00', by: 'Mufees Rahman',
        note: 'Added Seekh Kebab, revised per-plate rate',
      },
      {
        id: 'r3-e2', action: 'Quotation sent to client', icon: 'sent',
        status: 'SENT', timestamp: '2026-04-14T11:22:00', by: 'Mufees Rahman',
      },
      {
        id: 'r3-e3', action: 'Client opened quotation email', icon: 'opened',
        status: 'SENT', timestamp: '2026-04-14T13:45:00',
      },
    ],
  },
  {
    rev: 2,
    isCurrent: false,
    events: [
      {
        id: 'r2-e1', action: 'Quotation revised — price adjusted', icon: 'edited',
        status: 'REVISED', timestamp: '2026-04-10T09:00:00', by: 'Mufees Rahman',
        note: 'Client requested discount on welcome drinks',
      },
      {
        id: 'r2-e2', action: 'Quotation sent to client', icon: 'sent',
        status: 'SENT', timestamp: '2026-04-10T09:45:00', by: 'Mufees Rahman',
      },
      {
        id: 'r2-e3', action: 'Follow-up call made', icon: 'called',
        status: 'PENDING', timestamp: '2026-04-11T15:00:00', by: 'Mufees Rahman',
        note: 'Client reviewing with family',
      },
      {
        id: 'r2-e4', action: 'Client requested revision', icon: 'pending',
        status: 'REVISED', timestamp: '2026-04-12T11:30:00',
      },
    ],
  },
  {
    rev: 1,
    isCurrent: false,
    events: [
      {
        id: 'r1-e1', action: 'Enquiry created', icon: 'created',
        status: 'PENDING', timestamp: '2026-04-05T10:00:00', by: 'System',
      },
      {
        id: 'r1-e2', action: 'Initial quotation drafted', icon: 'edited',
        status: 'PENDING', timestamp: '2026-04-07T14:20:00', by: 'Mufees Rahman',
      },
      {
        id: 'r1-e3', action: 'Quotation sent to client', icon: 'sent',
        status: 'SENT', timestamp: '2026-04-07T15:00:00', by: 'Mufees Rahman',
      },
      {
        id: 'r1-e4', action: 'Client requested changes', icon: 'pending',
        status: 'REVISED', timestamp: '2026-04-09T18:45:00',
        note: 'Wanted more starters, lower dessert count',
      },
    ],
  },
];

// ── HistoryTab component ───────────────────────────────────────────────────────

interface HistoryTabProps {
  quoteId: string;
  revisions: Revision[];
}

function HistoryTab({ quoteId, revisions }: HistoryTabProps) {
  return (
    <div className="px-6 py-5 flex flex-col gap-4 bg-white">
      <p className="text-xs text-slate-500">History for {quoteId}</p>
      <div className="flex flex-col gap-4">
        {revisions.map((revision, revIdx) => (
          <div key={revision.rev}>
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-slate-600">
                    <FileText size={15} />
                    <span className="text-[15px] font-extrabold tracking-wide text-slate-600 uppercase">
                      Quotation — Rev. {revision.rev}
                    </span>
                  </div>
                  <span className={[
                    'text-[12px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide',
                    revision.isCurrent
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-200 text-slate-600',
                  ].join(' ')}>
                    {revision.isCurrent ? 'Current' : 'Locked'}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <div className="relative ml-2 pl-4 border-l-2 border-slate-200">
                  {revision.events.map((evt, evtIdx) => {
                    const IconComp = EVENT_ICONS[evt.icon];
                    const statusCfg = STATUS_CONFIG[evt.status];
                    const isLast = evtIdx === revision.events.length - 1;

                    return (
                      <div key={evt.id} className={`relative flex gap-3 ${isLast ? '' : 'pb-5'}`}>
                        <span className="absolute -left-[27px] top-0.5 w-6 h-6 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-indigo-500">
                          <IconComp size={14} className="text-indigo-500" />
                        </span>
                        <div className="flex-1 min-w-0 pl-3 pt-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-lg text-slate-800 leading-snug">
                              {evt.action}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-[17px] font-semibold ${statusCfg.cls}`}>{statusCfg.label}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-[16px] text-slate-500">
                              {fmtTimestamp(evt.timestamp)}
                            </span>
                            {evt.by && (
                              <>
                                <span className="text-slate-400">·</span>
                                <span className="text-[16px] text-slate-500">{evt.by}</span>
                              </>
                            )}
                          </div>

                          {evt.note && (
                            <p className="mt-1.5 text-[14px] text-slate-500 leading-relaxed border-l-2 border-slate-200 pl-2">
                              {evt.note}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>

              {revIdx < revisions.length - 1 && (
                <div className="h-1" />
              )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab config ────────────────────────────────────────────────────────────────

const TABS: { key: QuotationTab; label: string }[] = [
  { key: 'menu', label: 'Menu' },
  { key: 'costing', label: 'Costing' },
  { key: 'validation', label: 'Validation' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'history', label: 'History' },
];

// ─── QuotationCard ─────────────────────────────────────────────────────────────

interface QuotationCardProps {
  leadId: string;
  clientName: string;
  eventDate?: string;
  guestCount?: number;
  eventType: string;
}

interface ApiQuotation {
  id: string;
  inquiry: string;
  created_at?: string;
  updated_at?: string;
  version_number?: number;
  status?: string;
  is_locked?: boolean;
  /** UUID for public /q/{token} link */
  public_token?: string;
  accepted_at?: string | null;
  final_selling_price?: number | string | null;
  internal_cost?: number | string | null;
  margin?: number | string | null;
  advance_amount?: number | string | null;
  payment_terms?: string;
  menu_dishes?: Dish[];
  menu_services?: Service[];
  costing_data?: unknown;
  grocery_data?: unknown;
  pricing_data?: unknown;
}

function buildCostingSnapshot(items: DishCostItem[]) {
  return {
    items: items.map(item => ({
      ...item,
      dish_id: item.dishId,
      quantity: item.qty,
      unit_rate: item.rate,
      total: item.qty * item.rate,
      amount: item.qty * item.rate,
      ingredient_name: item.name,
      dish_name: item.dishName,
    })),
  };
}

export default function QuotationCard({
  leadId, clientName, eventDate, guestCount, eventType,
}: QuotationCardProps) {
  const [activeTab, setActiveTab] = useState<QuotationTab>('menu');
  const queryClient = useQueryClient();
  const [menuSaveError, setMenuSaveError] = useState<string | null>(null);
  const [costItems, setCostItems] = useState<DishCostItem[]>([]);
  const hydratedQuotationRef = useRef<string | null>(null);
  const recipeSyncGen = useRef(0);
  const costItemsStorageKey = `quotation-cost-items:${leadId}`;
  const { data: quotationVersions = [] } = useQuery<ApiQuotation[]>({
    queryKey: ['quotation-menu', leadId],
    queryFn: async () => {
      const raw = await api.get(`/quotations/?inquiry=${leadId}`);
      const quotes: ApiQuotation[] = Array.isArray(raw) ? raw : (raw?.results ?? []);
      return quotes;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const quotationData = quotationVersions[0] ?? null;
  const quotationId = quotationData?.id ?? null;
  const menuDishesRaw = quotationData?.menu_dishes;
  const menuServicesRaw = quotationData?.menu_services;
  const dishes = useMemo(
    () => Array.isArray(menuDishesRaw) ? (menuDishesRaw as unknown[]).map(normalizeDish) : [],
    [menuDishesRaw],
  );
  const services = useMemo(
    () => Array.isArray(menuServicesRaw) ? (menuServicesRaw as Service[]) : [],
    [menuServicesRaw],
  );
  const isLocked = Boolean(quotationData?.is_locked);
  const currentRevision = Number(quotationData?.version_number ?? 1);

  const dishesMenuSignature = useMemo(
    () => JSON.stringify(
      (dishes ?? []).map(d => ({
        id: d.id,
        qty: d.qty,
        unit: d.unit,
        batch_size: d.batch_size,
        base_recipe_qty: d.base_recipe_qty,
      })),
    ),
    [dishes],
  );

  const manualReviewWarning = useMemo(() => {
    const manual = costItems.filter(i => i.source === 'manual');
    if (dishes.length === 0 && manual.length > 0) {
      return 'Manual items still exist. Please review costing.';
    }
    const dishIds = new Set(dishes.map(d => d.id));
    if (manual.some(i => i.dishId != null && i.dishId !== '' && !dishIds.has(i.dishId))) {
      return 'Manual items still exist. Please review costing.';
    }
    return null;
  }, [dishes, costItems]);

  /** Load manual-only rows from server or local cache; recipe rows are filled by menu sync below. */
  useLayoutEffect(() => {
    if (!quotationData?.id || hydratedQuotationRef.current === quotationData.id) return;

    let manualFromApi = manualRowsFromSnapshot(quotationData.costing_data);
    if (manualFromApi.length === 0) {
      try {
        const raw = window.localStorage.getItem(costItemsStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            manualFromApi = parseCostingRows(parsed).filter(i => i.source === 'manual');
          }
        }
      } catch {
        /* ignore */
      }
    }

    // Bootstrap manual rows from snapshot before async recipe sync runs (see next effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time hydration per quotation id
    setCostItems(manualFromApi);
    hydratedQuotationRef.current = quotationData.id;
  }, [costItemsStorageKey, quotationData?.costing_data, quotationData?.id]);

  /** Menu drives recipe lines; manual lines are preserved. */
  useEffect(() => {
    if (!quotationId || isLocked || hydratedQuotationRef.current !== quotationId) return;

    const gen = ++recipeSyncGen.current;
    let cancelled = false;

    (async () => {
      try {
        if (!dishes.length) {
          if (cancelled || gen !== recipeSyncGen.current) return;
          setCostItems(prev => prev.filter(i => i.source === 'manual'));
          return;
        }
        const blocks = await Promise.all(
          dishes.map(async d => {
            const recipe = await api.get(`/master/dishes/${d.id}/recipe/`) as ApiRecipeResponse;
            return recipeCostRowsFromApi(d, recipe);
          }),
        );
        if (cancelled || gen !== recipeSyncGen.current) return;
        setCostItems(prev => [...blocks.flat(), ...prev.filter(i => i.source === 'manual')]);
      } catch {
        if (cancelled || gen !== recipeSyncGen.current) return;
        setCostItems(prev => {
          const manual = prev.filter(i => i.source === 'manual');
          const ids = new Set(dishes.map(d => d.id));
          const recipeKept = prev.filter(
            i => i.source === 'recipe' && i.dishId != null && ids.has(i.dishId),
          );
          return [...recipeKept, ...manual];
        });
      }
    })();

    return () => { cancelled = true; };
    // dishesMenuSignature tracks all menu fields that affect recipe quantities
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishesMenuSignature, isLocked, quotationId]);

  useEffect(() => {
    if (!quotationId || isLocked || hydratedQuotationRef.current !== quotationId) return;
    const timeout = window.setTimeout(() => {
      const total = costItems.reduce((s, i) => s + i.qty * i.rate, 0);
      void api.patch(`/quotations/${quotationId}/`, {
        costing_data: buildCostingSnapshot(costItems),
        internal_cost: total.toFixed(2),
      }).then(() => {
        // Only costing fields changed — update them in the cache without
        // triggering a full menu refetch that would create new dish/service
        // array references and cause unnecessary MenuTab re-renders.
        queryClient.setQueryData<ApiQuotation[]>(['quotation-menu', leadId], (old) => {
          if (!old?.length) return old;
          return [{ ...old[0], internal_cost: total.toFixed(2) }];
        });
        void queryClient.invalidateQueries({ queryKey: ['lead-quotation-summary', leadId] });
      });
      try {
        window.localStorage.setItem(costItemsStorageKey, JSON.stringify(costItems));
      } catch {
        /* ignore */
      }
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [costItems, isLocked, quotationId, leadId, queryClient, costItemsStorageKey]);

  async function refetchMenu() {
    await queryClient.invalidateQueries({ queryKey: ['quotation-menu', leadId] });
  }

  async function ensureQuotationId() {
    if (quotationId) return quotationId;
    const existingRaw = await api.get(`/quotations/?inquiry=${leadId}`);
    const existingQuotes: ApiQuotation[] = Array.isArray(existingRaw) ? existingRaw : (existingRaw?.results ?? []);
    if (existingQuotes[0]?.id) return String(existingQuotes[0].id);
    const created = await api.post('/quotations/', { inquiry: leadId });
    if (!created?.id) throw new Error('Unable to create quotation');
    return String(created.id);
  }

  /** Read current menu state directly from the React Query cache — no extra network request. */
  function getMenuFromCache(): { menu_dishes: Dish[]; menu_services: Service[] } {
    const cached = queryClient.getQueryData<ApiQuotation[]>(['quotation-menu', leadId]);
    return {
      menu_dishes: Array.isArray(cached?.[0]?.menu_dishes)
        ? (cached![0].menu_dishes as unknown[]).map(normalizeDish)
        : [],
      menu_services: Array.isArray(cached?.[0]?.menu_services)
        ? (cached![0].menu_services as Service[])
        : [],
    };
  }

  /** Push new menu state into the cache — avoids a refetch race where stale data wipes local adds. */
  function updateMenuCache(menu_dishes: Dish[], menu_services: Service[]) {
    queryClient.setQueryData<ApiQuotation[]>(['quotation-menu', leadId], (old) => {
      if (!old?.length) return old;
      return [{ ...old[0], menu_dishes, menu_services }];
    });
    void queryClient.invalidateQueries({ queryKey: ['lead-quotation-summary', leadId] });
  }

  const addItemMutation = useMutation({
    mutationFn: async ({ itemType, item }: { itemType: 'dish' | 'service'; item: Dish | Service }) => {
      const prevQid = quotationId;
      const qid = await ensureQuotationId();
      const { menu_dishes, menu_services } = getMenuFromCache();
      const newDishes = itemType === 'dish' ? [...menu_dishes, item as Dish] : menu_dishes;
      const newSvcs = itemType === 'service' ? [...menu_services, item as Service] : menu_services;
      await api.patch(`/quotations/${qid}/`, { menu_dishes: newDishes, menu_services: newSvcs });
      return { prevQid, qid, menu_dishes: newDishes, menu_services: newSvcs };
    },
    onSuccess: ({ prevQid, qid, menu_dishes, menu_services }) => {
      setMenuSaveError(null);
      if (!prevQid) {
        // Quotation was just created. Seed the cache with our local dish values so
        // that when quotationId changes (null → qid) MenuTab's sync effect reads
        // correct data instead of whatever the server round-tripped.
        queryClient.setQueryData<ApiQuotation[]>(['quotation-menu', leadId], (old) => {
          const base: ApiQuotation = old?.[0] ?? ({ id: qid, inquiry: leadId } as ApiQuotation);
          return [{ ...base, id: qid, menu_dishes, menu_services }];
        });
        void queryClient.invalidateQueries({ queryKey: ['lead-quotation-summary', leadId] });
        // Background refetch to populate public_token, version_number, etc.
        // MenuTab's sync effect won't fire again because quotationId won't change.
        void queryClient.invalidateQueries({ queryKey: ['quotation-menu', leadId] });
      } else {
        updateMenuCache(menu_dishes, menu_services);
      }
    },
    onError: (err) => setMenuSaveError(formatMenuMutationError(err)),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemType, item }: { itemType: 'dish' | 'service'; item: Dish | Service }) => {
      const qid = await ensureQuotationId();
      const { menu_dishes, menu_services } = getMenuFromCache();
      const newDishes = itemType === 'dish'
        ? menu_dishes.map(d => String(d.id) === String((item as Dish).id) ? item as Dish : d)
        : menu_dishes;
      const newSvcs = itemType === 'service'
        ? menu_services.map(s => String(s.id) === String((item as Service).id) ? item as Service : s)
        : menu_services;
      await api.patch(`/quotations/${qid}/`, { menu_dishes: newDishes, menu_services: newSvcs });
      return { menu_dishes: newDishes, menu_services: newSvcs };
    },
    onSuccess: ({ menu_dishes, menu_services }) => {
      setMenuSaveError(null);
      updateMenuCache(menu_dishes, menu_services);
    },
    onError: (err) => setMenuSaveError(formatMenuMutationError(err)),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ itemType, itemId }: { itemType: 'dish' | 'service'; itemId: string }) => {
      const qid = await ensureQuotationId();
      const { menu_dishes, menu_services } = getMenuFromCache();
      const newDishes = itemType === 'dish'
        ? menu_dishes.filter(d => String(d.id) !== String(itemId))
        : menu_dishes;
      const newSvcs = itemType === 'service'
        ? menu_services.filter(s => String(s.id) !== String(itemId))
        : menu_services;
      await api.patch(`/quotations/${qid}/`, { menu_dishes: newDishes, menu_services: newSvcs });
      return { menu_dishes: newDishes, menu_services: newSvcs };
    },
    onSuccess: ({ menu_dishes, menu_services }) => {
      setMenuSaveError(null);
      updateMenuCache(menu_dishes, menu_services);
    },
    onError: (err) => setMenuSaveError(formatMenuMutationError(err)),
  });

  const onAddDish = useCallback((dish: Dish) => {
    addItemMutation.mutate({ itemType: 'dish', item: dish });
  }, [addItemMutation]);

  const onUpdateDish = useCallback((dish: Dish) => {
    updateItemMutation.mutate({ itemType: 'dish', item: dish });
  }, [updateItemMutation]);

  const onRemoveDish = useCallback((id: string) => {
    deleteItemMutation.mutate({ itemType: 'dish', itemId: id });
  }, [deleteItemMutation]);

  const onAddService = useCallback((service: Service) => {
    addItemMutation.mutate({ itemType: 'service', item: service });
  }, [addItemMutation]);

  const onUpdateService = useCallback((service: Service) => {
    updateItemMutation.mutate({ itemType: 'service', item: service });
  }, [updateItemMutation]);

  const onRemoveService = useCallback((id: string) => {
    deleteItemMutation.mutate({ itemType: 'service', itemId: id });
  }, [deleteItemMutation]);

  // Derived totals consumed by multiple tabs
  const menuTotal = dishes.reduce((s, d) => s + d.subtotal, 0)
    + services.reduce((s, sv) => s + sv.subtotal, 0);
  const internalCost = costItems.reduce((s, i) => s + i.qty * i.rate, 0);

  // Derive a deterministic quote ID from the leadId
  const quoteId = `QT-${new Date().getFullYear()}-${leadId.slice(-4).toUpperCase().padStart(4, '0')}`;
  const revisions: Revision[] = quotationVersions.length > 0
    ? quotationVersions.map((q, index) => ({
        rev: Number(q.version_number ?? (quotationVersions.length - index)),
        isCurrent: index === 0,
        events: [{
          id: `rev-${q.id}`,
          action: q.is_locked
            ? `Finalised at ${fmtINR(Number(q.final_selling_price ?? 0))}`
            : 'Draft revision created',
          icon: q.is_locked ? 'approved' : 'edited',
          status: q.is_locked ? 'SENT' : 'REVISED',
          timestamp: q.updated_at || q.created_at || new Date().toISOString(),
          by: 'Staff',
          note: q.payment_terms || undefined,
        }],
      }))
    : MOCK_REVISIONS;

  const quotationStatusUpper = String(quotationData?.status ?? 'DRAFT').toUpperCase();
  const acceptedAtRaw = quotationData?.accepted_at;

  async function handleDownloadQuotationPdf() {
    if (!quotationId) {
      toast.error('No quotation to download');
      return;
    }
    try {
      const safeName = (clientName || 'client').replace(/[\\/:*?"<>|]/g, '').trim() || 'client';
      await api.download(`/quotations/${quotationId}/export-pdf/`, `${quoteId} — ${safeName}.pdf`);
    } catch {
      toast.error('Failed to download quotation');
    }
  }

  async function handleShareWithClient() {
    const token = quotationData?.public_token;
    if (!quotationId) {
      toast.error('No quotation to share');
      return;
    }
    if (!token) {
      toast.error('Share link not available');
      return;
    }
    const url = `${window.location.origin}/q/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!', { duration: 2000 });
    } catch {
      toast.error('Could not copy link');
    }
  }

  let acceptedAtDisplay: string | null = null;
  if (acceptedAtRaw) {
    try {
      const d = new Date(acceptedAtRaw);
      acceptedAtDisplay = d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      acceptedAtDisplay = String(acceptedAtRaw);
    }
  }

  // Called by PricingTab when "Finalise & Send Quotation" is clicked
  async function handleFinalise(payload: {
    final_selling_price: number;
    internal_cost: number;
    advance_amount: number;
    costing_data: ReturnType<typeof buildCostingSnapshot>;
    grocery_data: unknown;
    pricing_data: Record<string, number | string>;
  }) {
    const qid = await ensureQuotationId();
    let groceryData = quotationData?.grocery_data ?? {};
    try {
      groceryData = await api.get(`/quotations/${qid}/grocery-sheet/`);
    } catch {
      groceryData = quotationData?.grocery_data ?? {};
    }
    const costingData = buildCostingSnapshot(costItems);
    const body = {
      ...payload,
      costing_data: costingData,
      grocery_data: groceryData,
      pricing_data: {
        ...payload.pricing_data,
        total_cost: payload.internal_cost,
        cost: payload.internal_cost,
      },
    };

    await api.post(`/quotations/${qid}/finalize/`, body);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['quotation-menu', leadId] }),
      queryClient.invalidateQueries({ queryKey: ['lead-quotation-summary', leadId] }),
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] }),
    ]);
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">

      {/* Share / download + client response status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/90">
        <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
          {quotationStatusUpper === 'ACCEPTED' ? (
            <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
              <span>Client accepted</span>
              {acceptedAtDisplay ? (
                <span className="font-normal text-emerald-800 opacity-90">· {acceptedAtDisplay}</span>
              ) : null}
            </span>
          ) : null}
          {quotationStatusUpper === 'SENT' ? (
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold bg-amber-100 text-amber-950 border border-amber-200">
              Awaiting response
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDownloadQuotationPdf()}
            disabled={!quotationId}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} aria-hidden />
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => void handleShareWithClient()}
            disabled={!quotationId || !quotationData?.public_token}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Link2 size={16} aria-hidden />
            Share with client
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-white/10 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'flex-1 min-w-20 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-200',
              activeTab === key
                ? 'text-blue-700 border-b-2 border-blue-700 bg-blue-700/10'
                : 'text-gray-700 border-b-2 border-transparent hover:text-gray-500',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {/* MenuTab is always mounted so local form state (addedDishes, open panels,
          scroll position) survives tab switches. CSS `hidden` keeps it out of
          layout without unmounting it. */}
      <div className={activeTab !== 'menu' ? 'hidden' : undefined}>
        <MenuTab
          quotationId={quotationId}
          dishes={dishes}
          services={services}
          isSaving={addItemMutation.isPending || updateItemMutation.isPending || deleteItemMutation.isPending}
          saveError={menuSaveError}
          guestCount={guestCount}
          onAddDish={onAddDish}
          onUpdateDish={onUpdateDish}
          onRemoveDish={onRemoveDish}
          onAddService={onAddService}
          onUpdateService={onUpdateService}
          onRemoveService={onRemoveService}
        />
      </div>
      {activeTab === 'costing' && (
        <CostingTabByDish
          dishes={dishes}
          items={costItems}
          setItems={setCostItems}
          manualReviewWarning={manualReviewWarning}
        />
      )}
      {activeTab === 'validation' && (
        <ValidationTab
          dishes={dishes}
          quotationId={quotationId}
          clientName={clientName}
          eventDate={eventDate}
          guestCount={guestCount}
          eventType={eventType}
          quoteId={quoteId}
        />
      )}
      {activeTab === 'pricing' && (
        <PricingTab
          quotationId={quotationId}
          isLocked={isLocked}
          initialSellingPrice={Number(quotationData?.final_selling_price ?? 0)}
          initialInternalCost={Number(quotationData?.internal_cost ?? 0)}
          initialAdvanceAmount={Number(quotationData?.advance_amount ?? 0)}
          menuTotal={menuTotal}
          internalCost={internalCost}
          hasCostItems={costItems.length > 0}
          guestCount={guestCount}
          quoteId={quoteId}
          onFinalise={handleFinalise}
        />
      )}
      {activeTab === 'history' && (
        <HistoryTab quoteId={quoteId} revisions={revisions} />
      )}

    </div>
  );
}
