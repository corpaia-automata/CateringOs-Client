'use client';

import { useState, useId, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, UtensilsCrossed, Wrench, ClipboardList,
  X, ChevronDown, ShieldCheck, RefreshCw, Maximize2, Minimize2,
  CheckCircle2, AlertTriangle, Circle,
  TrendingUp, Send, Info, BadgeCheck,
  History, CheckCheck, PenLine, MailOpen, PhoneCall, FileCheck2, FileText,
  XCircle, Clock, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

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
  lines: ApiRecipeLine[];
}

// ─── Helpers ─── (mock seed data removed)

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
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

// ─── Shared badge sub-components ───────────────────────────────────────────────

const PRICING_TYPE_STYLES: Record<PricingType, string> = {
  'per plate': 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  'per item': 'bg-purple-500/15 text-purple-400 border border-purple-500/25',
  'per kg': 'bg-teal-500/15 text-teal-400 border border-teal-500/25',
};

const STATUS_BADGE_STYLES: Record<StatusBadge, string> = {
  LIVE: 'bg-green-500/15 text-green-400 border border-green-500/25',
  FIXED: 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  DRAFT: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
};

function PricingBadge({ type }: { type: PricingType }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${PRICING_TYPE_STYLES[type]}`}>
      {type}
    </span>
  );
}

function StatusBadgeChip({ status }: { status: StatusBadge }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide ${STATUS_BADGE_STYLES[status]}`}>
      {status}
    </span>
  );
}

// ─── Add-Dish Panel ────────────────────────────────────────────────────────────

interface ApiDishCategory {
  id: string;
  name: string;
  sort_order?: number;
}

interface ApiDish {
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
}

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

interface AddDishPanelProps {
  existingIds: Set<string>;
  onAdd: (dish: Dish) => void;
  onClose: () => void;
}

function AddDishPanel({ existingIds, onAdd, onClose }: AddDishPanelProps) {
  const [categories, setCategories] = useState<ApiDishCategory[]>([]);
  const [allDishes, setAllDishes] = useState<ApiDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [activeCatId, setActiveCatId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [qty, setQty] = useState(0);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchError(false);
      try {
        const [catsRaw, dishesRaw] = await Promise.all([
          api.get('/master/dish-categories/'),
          api.get('/master/dishes/?page_size=200'),
        ]);
        if (cancelled) return;
        const cats: ApiDishCategory[] = Array.isArray(catsRaw)
          ? catsRaw : (catsRaw.results ?? []);
        const dshs: ApiDish[] = Array.isArray(dishesRaw)
          ? dishesRaw : (dishesRaw.results ?? []);
        setCategories([...cats].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        setAllDishes(dshs.filter(d => d.is_active));
      } catch {
        if (!cancelled) setFetchError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [loadKey]);

  const displayed = activeCatId
    ? allDishes.filter(d => d.category === activeCatId)
    : allDishes;

  function selectDish(dish: ApiDish) {
    if (expandedId === dish.id) { setExpandedId(null); return; }
    setExpandedId(dish.id);
    setQty(1);
    setPrice(Number(dish.selling_price) || Number(dish.base_price) || 0);
  }

  function commit(dish: ApiDish) {
    const map = SERVING_UNIT_MAP[dish.serving_unit]
      ?? { pricingType: 'per plate' as PricingType, unit: 'plates' };
    onAdd({
      id: dish.id,
      name: dish.name,
      category: dish.category_name ?? 'Uncategorized',
      pricingType: map.pricingType,
      statusBadge: (DISH_TYPE_TO_BADGE[dish.dish_type] ?? 'LIVE') as StatusBadge,
      qty,
      unit: map.unit,
      rate: price,
      subtotal: qty * price,
    });
    setExpandedId(null);
  }

  const unitLabel = (d: ApiDish) => SERVING_UNIT_MAP[d.serving_unit]?.unit ?? 'plates';
  const unitSingular = (d: ApiDish) => unitLabel(d).replace(/s$/, '');
  const displayPrice = (d: ApiDish) => Number(d.selling_price) || Number(d.base_price);

  return (
    <div className="mb-4 rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm">

      {/* ── Panel header ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border-b border-blue-100">
        <UtensilsCrossed size={13} className="text-blue-600 shrink-0" />
        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide flex-1">
          Select Dish
        </span>

        {/* Category filter */}
        <div className="relative">
          <select
            value={activeCatId}
            onChange={e => { setActiveCatId(e.target.value); setExpandedId(null); }}
            className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-7
                       text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-400
                       transition-colors cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-xs">Loading dishes…</span>
        </div>

      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <p className="text-sm text-slate-500">Failed to load dishes.</p>
          <button
            onClick={() => setLoadKey(k => k + 1)}
            className="text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors"
          >
            Try again
          </button>
        </div>

      ) : displayed.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">
          {activeCatId ? 'No dishes in this category.' : 'No dishes available.'}
        </div>

      ) : (
        <div className="flex flex-col divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {displayed.map(dish => {
            const isExpanded = expandedId === dish.id;
            const alreadyAdded = existingIds.has(dish.id);
            const dp = displayPrice(dish);

            return (
              <div key={dish.id}>
                {/* Dish row */}
                <button
                  onClick={() => { if (!alreadyAdded) selectDish(dish); }}
                  disabled={alreadyAdded}
                  className={[
                    'w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors',
                    isExpanded ? 'bg-blue-50'
                      : alreadyAdded ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Veg / non-veg indicator */}
                    <span className={`w-2.5 h-2.5 rounded-sm border-2 shrink-0 ${dish.veg_non_veg === 'veg'
                        ? 'border-green-500 bg-green-400/30'
                        : 'border-red-500   bg-red-400/30'
                      }`} />
                    <span className="text-sm font-semibold text-slate-800 truncate">{dish.name}</span>
                    {dish.category_name && (
                      <span className="text-[11px] text-slate-400 shrink-0 hidden sm:inline">
                        {dish.category_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {dish.dish_type === 'live_counter' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                       bg-green-500/15 text-green-600 border border-green-500/25">
                        LIVE
                      </span>
                    )}
                    {dish.dish_type === 'fixed_price' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                       bg-orange-500/15 text-orange-600 border border-orange-500/25">
                        FIXED
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-600 tabular-nums">
                      {dp > 0 ? fmtINR(dp) : '—'}
                    </span>
                    {alreadyAdded
                      ? <span className="text-[10px] text-slate-400 font-semibold">Added</span>
                      : <ChevronDown size={13} className={`text-slate-400 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                    }
                  </div>
                </button>

                {/* Inline form */}
                {isExpanded && (
                  <div className="px-4 pt-3 pb-4 bg-blue-50/70 border-t border-blue-100">

                    {dish.dish_type === 'live_counter' && (
                      <div className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-lg
                                      bg-amber-50 border border-amber-200">
                        <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          <span className="font-bold">Live Counter</span> — enter the agreed price for this event
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-end gap-3">
                      {/* Qty */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                          Qty ({unitLabel(dish)})
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={qty}
                          onChange={e => setQty(Math.max(1, parseInt(e.target.value)))}
                          className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold
                                     text-slate-800 text-right tabular-nums focus:outline-none
                                     focus:border-blue-400 transition-colors"
                        />
                      </div>

                      {/* Price */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                          Price / {unitSingular(dish)} (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={price || ''}
                          placeholder="0"
                          onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                          className="w-28 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold
                                     text-slate-800 text-right tabular-nums focus:outline-none
                                     focus:border-blue-400 transition-colors"
                        />
                      </div>

                      {/* Live subtotal */}
                      <div className="pb-2 text-sm text-slate-400">
                        =&nbsp;
                        <span className="font-bold text-slate-700 tabular-nums">{fmtINR(qty * price)}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => setExpandedId(null)}
                          className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500
                                     border border-slate-200 hover:border-slate-300 hover:text-slate-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => commit(dish)}
                          disabled={qty < 1 || price <= 0}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white
                                     hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Add to Menu
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Menu Tab ──────────────────────────────────────────────────────────────────

interface MenuTabProps {
  dishes: Dish[];
  services: Service[];
  isSaving: boolean;
  saveError: boolean;
  onAddDish: (dish: Dish) => void;
  onUpdateDish: (dish: Dish) => void;
  onRemoveDish: (id: string) => void;
  onAddService: (svc: Service) => void;
  onUpdateService: (svc: Service) => void;
  onRemoveService: (id: string) => void;
}

function DishRow({ dish, onEdit, onRemove }: { dish: Dish; onEdit: (id: string) => void; onRemove: (id: string) => void }) {
  return (
    <tr className="border-b border-white/50 group hover:bg-white/3 transition-colors">
      <td className="py-3 pl-4 pr-3">
        <p className="text-sm font-semibold text-black leading-snug">{dish.name}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{dish.category}</p>
      </td>
      <td className="py-3 px-3"><PricingBadge type={dish.pricingType} /></td>
      <td className="py-3 px-3"><StatusBadgeChip status={dish.statusBadge} /></td>
      <td className="py-3 px-3 text-right">
        <span className="text-sm text-black tabular-nums">
          {dish.qty.toLocaleString('en-IN')}&nbsp;
          <span className="text-slate-500 text-xs">{dish.unit}</span>
          &nbsp;×&nbsp;{fmtINR(dish.rate)}
        </span>
      </td>
      <td className="py-3 px-3 text-right">
        <span className="text-sm font-semibold text-black tabular-nums">{fmtINR(dish.subtotal)}</span>
      </td>
      <td className="py-3 pl-3 pr-4 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(dish.id)}
            className="p-1.5 rounded-lg text-blue-400 transition-colors" title="Edit">
            <Pencil size={13} />
          </button>
          <button onClick={() => onRemove(dish.id)}
            className="p-1.5 rounded-lg text-red-400  transition-colors" title="Remove">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function MenuTab({
  dishes,
  services,
  isSaving,
  saveError,
  onAddDish,
  onUpdateDish,
  onRemoveDish,
  onAddService,
  onUpdateService,
  onRemoveService,
}: MenuTabProps) {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishQty, setDishQty] = useState<number>(1);
  const [dishRate, setDishRate] = useState<number>(0);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState<number | ''>('');
  const existingIds = useMemo(() => new Set(dishes.map(d => d.id)), [dishes]);

  function openDishEdit(dishId: string) {
    const dish = dishes.find(d => d.id === dishId);
    if (!dish) return;
    setEditingDishId(dishId);
    setDishQty(dish.qty);
    setDishRate(dish.rate);
  }

  function cancelDishEdit() {
    setEditingDishId(null);
    setDishQty(1);
    setDishRate(0);
  }

  function saveDishEdit(dishId: string) {
    const original = dishes.find(d => d.id === dishId);
    if (!original || dishQty < 1 || dishRate <= 0) return;
    onUpdateDish({
      ...original,
      qty: dishQty,
      rate: dishRate,
      subtotal: dishQty * dishRate,
    });
    cancelDishEdit();
  }

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

  const menuTotal = dishes.reduce((s, d) => s + d.subtotal, 0)
    + services.reduce((s, sv) => s + sv.subtotal, 0);

  function handleAddDish(dish: Dish) {
    onAddDish(dish);
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
              {dishes.length}
            </span>
          </div>
          <button
            onClick={() => setShowAddPanel(p => !p)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors',
              showAddPanel
                ? 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                : 'bg-blue-500/15 text-blue-700 border border-blue-500/20 hover:bg-blue-500/25',
            ].join(' ')}
          >
            {showAddPanel
              ? <><X size={13} /> Cancel</>
              : <><Plus size={13} /> Add Dish</>
            }
          </button>
        </div>

        {/* ── Add Dish Panel ── */}
        {showAddPanel && (
          <AddDishPanel
            existingIds={existingIds}
            onAdd={handleAddDish}
            onClose={() => setShowAddPanel(false)}
          />
        )}

        {dishes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-white/10">
            <UtensilsCrossed size={28} className="text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 font-medium">No dishes added yet.</p>
            <button onClick={() => setShowAddPanel(true)}
              className="mt-3 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors">
              Add your first dish →
            </button>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-white/8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  {['Dish', 'Pricing', 'Status', 'Qty × Rate', 'Subtotal', ''].map((h, i) => (
                    <th key={i}
                      className={`text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5 px-3
                        ${i === 0 ? 'text-left pl-4' : i === 5 ? '' : i >= 3 ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dishes.map(dish => (
                  <DishRow key={dish.id} dish={dish}
                    onEdit={openDishEdit}
                    onRemove={onRemoveDish} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {editingDishId && (() => {
          const currentDish = dishes.find(d => d.id === editingDishId);
          if (!currentDish) return null;
          return (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Editing Dish</p>
                  <p className="text-sm font-bold text-slate-900">{currentDish.name}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={dishQty}
                    onChange={e => setDishQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Price / Plate (₹)</label>
                  <input
                    type="number"
                    min={1}
                    value={dishRate}
                    onChange={e => setDishRate(Math.max(1, Number(e.target.value) || 0))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Subtotal</label>
                  <div className="px-3 py-2 text-sm font-bold text-right rounded-lg bg-white border border-slate-200 tabular-nums">
                    {fmtINR(dishQty * dishRate)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={cancelDishEdit}
                  className="px-4 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveDishEdit(currentDish.id)}
                  disabled={dishQty < 1 || dishRate <= 0}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          );
        })()}
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
            <span className="text-xs text-red-400">Save failed — please retry</span>
          )}
          <span className="text-lg font-bold text-white tabular-nums">{fmtINR(menuTotal)}</span>
        </div>
      </div>
    </div>
  );
}

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

interface DishCostItem {
  id: string;
  dishId: string;
  dishName: string;
  source: 'recipe' | 'manual';
  category: string;
  name: string;
  qty: number;
  unit: string;
  rate: number;
}

const DISH_COST_BLANK_FORM = {
  dishId: '',
  category: 'Other',
  name: '',
  qty: 1,
  unit: 'kg',
  rate: 0,
};

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

interface CostingTabByDishProps {
  dishes: Dish[];
  items: DishCostItem[];
  setItems: React.Dispatch<React.SetStateAction<DishCostItem[]>>;
}

function CostingTabByDish({ dishes, items, setItems }: CostingTabByDishProps) {
  const uid = useId();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DISH_COST_BLANK_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  const computedTotal = form.qty * form.rate;
  const grandTotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const dishMap = useMemo(() => new Map(dishes.map(d => [d.id, d])), [dishes]);

  const groupedByDish = useMemo(() => {
    return dishes.map(dish => {
      const dishItems = items.filter(item => item.dishId === dish.id);
      return {
        dish,
        dishItems,
        dishTotal: dishItems.reduce((sum, item) => sum + item.qty * item.rate, 0),
      };
    });
  }, [dishes, items]);

  function openAddForm(dishId?: string) {
    setEditId(null);
    setForm({ ...DISH_COST_BLANK_FORM, dishId: dishId ?? dishes[0]?.id ?? '' });
    setShowForm(true);
  }

  function openEditForm(item: DishCostItem) {
    setEditId(item.id);
    setForm({
      dishId: item.dishId,
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
    if (!form.dishId || !form.name.trim() || form.qty <= 0 || form.rate < 0) return;
    const linkedDish = dishMap.get(form.dishId);
    if (!linkedDish) return;
    const nextPayload: Omit<DishCostItem, 'id'> = {
      dishId: form.dishId,
      dishName: linkedDish.name,
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
      const recipeItemsByDish = await Promise.all(dishes.map(async (dish) => {
        const recipe = await api.get(`/master/dishes/${dish.id}/recipe/`) as ApiRecipeResponse;
        const lines = Array.isArray(recipe?.lines) ? recipe.lines : [];
        return lines.map((line, index) => ({
          id: `recipe-${dish.id}-${line.id || index}`,
          dishId: dish.id,
          dishName: dish.name,
          source: 'recipe' as const,
          category: normalizeDishCostCategory(line.ingredient_category),
          name: line.ingredient_name,
          qty: (Number(dish.qty) || 0) * (Number(line.qty_per_unit) || 0),
          unit: line.unit || line.ingredient_uom || 'unit',
          rate: Number(line.unit_cost_snapshot) || 0,
        }));
      }));
      const recipeItems = recipeItemsByDish.flat();
      const activeDishIds = new Set(dishes.map(d => d.id));
      const manualItems = items.filter(item => item.source === 'manual' && activeDishIds.has(item.dishId));
      setItems([...recipeItems, ...manualItems]);
    } catch {
      setSyncError('Unable to sync dish ingredients right now. Please retry.');
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (dishes.length === 0) return;
    const activeDishIds = new Set(dishes.map(d => d.id));
    setItems(prev => prev
      .filter(item => activeDishIds.has(item.dishId))
      .map(item => {
        const latestDish = dishMap.get(item.dishId);
        if (!latestDish) return item;
        return { ...item, dishName: latestDish.name };
      }));
  }, [dishMap, dishes, setItems]);

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-white/6">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ClipboardList size={15} className="text-yellow-400" />
            <span className="text-sm font-bold text-black">Internal Costing Sheet</span>
          </div>
          <p className="text-[11px] text-slate-500 pl-5.75">Dish-wise ingredient costing — linked to recipes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleSyncFromDishes()}
            disabled={syncing || dishes.length === 0}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                     bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            Sync from Dishes
          </button>
          <button onClick={() => openAddForm()} disabled={dishes.length === 0}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                     bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/25 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus size={13} /> Add Item
          </button>
        </div>
      </div>
      {syncError && <p className="px-5 pt-3 text-[11px] text-red-500">{syncError}</p>}

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
              <label htmlFor={`${uid}-dish`} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dish</label>
              <div className="relative">
                <select id={`${uid}-dish`} value={form.dishId}
                  onChange={e => setForm(f => ({ ...f, dishId: e.target.value }))}
                  className={inputCls('appearance-none pr-8 cursor-pointer')}>
                  <option value="" className="bg-slate-900">Select Dish</option>
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
              <button onClick={handleSave} disabled={!form.dishId || !form.name.trim() || form.qty <= 0}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {editId ? 'Update Item' : 'Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dishes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <ClipboardList size={30} className="text-slate-700 mb-3" />
          <p className="text-sm text-slate-500 font-medium">No dishes in menu.</p>
          <p className="text-xs text-slate-600 mt-1">Add dishes in Menu tab first to build internal costing sheet.</p>
        </div>
      )}

      {dishes.length > 0 && items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <ClipboardList size={30} className="text-slate-700 mb-3" />
          <p className="text-sm text-slate-500 font-medium">No internal costing items yet.</p>
          <p className="text-xs text-slate-600 mt-1">Sync ingredients from dishes to start dish-wise costing.</p>
          <button onClick={() => void handleSyncFromDishes()}
            className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            Sync now
          </button>
        </div>
      )}

      {groupedByDish.some(group => group.dishItems.length > 0) && (
        <div className="px-5 pt-4 pb-2 flex flex-col gap-5">
          {groupedByDish.map(({ dish, dishItems, dishTotal }) => (
            <div key={dish.id} className="rounded-xl border border-white/8 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-white/8">
                <div>
                  <p className="text-sm font-bold text-black">{dish.name}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Dish Qty: {dish.qty.toLocaleString('en-IN')} {dish.unit}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-600 tabular-nums">
                    {dishItems.length} item{dishItems.length !== 1 ? 's' : ''}
                  </span>
                  <button
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
                    {dishItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                          No ingredients or extras added for this dish.
                        </td>
                      </tr>
                    ) : dishItems.map(item => (
                      <tr key={item.id} className="border-b border-white/5 last:border-0 group hover:bg-white/3 transition-colors">
                        <td className="py-2.5 pl-4 pr-3 text-sm font-medium text-black">
                          <div className="flex items-center gap-2">
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
                            <button onClick={() => openEditForm(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Edit">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => handleRemove(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-white/10 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Dish Total Cost</span>
                <span className="text-base font-bold text-black tabular-nums">{fmtINR(dishTotal)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && <div className="pb-1" />}

      {items.length > 0 && (
        <div className="border-t border-white/10 bg-black px-5 py-3.5 flex items-center justify-between">
          <div>
            <span className="text-lg font-semibold text-white">Total Internal Cost</span>
            <span className="ml-2 text-[11px] text-slate-400 tabular-nums">({items.length} item{items.length > 1 ? 's' : ''})</span>
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
  initialPaymentTerms: string;
  menuTotal: number;
  internalCost: number;
  hasCostItems: boolean;
  guestCount?: number;
  quoteId: string;
  onFinalise: (payload: {
    final_selling_price: number;
    internal_cost: number;
    advance_amount: number;
    payment_terms: string;
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
  initialPaymentTerms,
  menuTotal,
  internalCost,
  hasCostItems,
  guestCount,
  quoteId,
  onFinalise,
}: PricingTabProps) {
  const [sellingPrice, setSellingPrice] = useState<number>(initialSellingPrice || menuTotal);
  const [advanceAmount, setAdvanceAmount] = useState<number>(initialAdvanceAmount || 0);
  const [paymentTerms, setPaymentTerms] = useState(initialPaymentTerms);
  const [finalising, setFinalising] = useState(false);

  // Auto-sync selling price when menuTotal changes, unless the user has manually overridden it
  const [userEdited, setUserEdited] = useState(false);
  useEffect(() => {
    if (!userEdited && !isLocked && !initialSellingPrice) setSellingPrice(menuTotal);
  }, [menuTotal, userEdited, isLocked, initialSellingPrice]);

  useEffect(() => {
    setSellingPrice(initialSellingPrice || menuTotal);
    setAdvanceAmount(initialAdvanceAmount || 0);
    setPaymentTerms(initialPaymentTerms || '');
    setUserEdited(false);
  }, [initialSellingPrice, initialAdvanceAmount, initialPaymentTerms, menuTotal]);

  const margin =
    sellingPrice > 0
      ? Math.round((((sellingPrice - (initialInternalCost || internalCost)) / sellingPrice) * 100) * 100) / 100
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
        payment_terms: paymentTerms,
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
          <h3 className="text-2xl font-semibold text-slate-900">Pricing</h3>
          <p className="text-lg text-slate-600 mt-1">Set the final selling price to quote the client</p>
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
            <label className="block text-xl font-medium text-slate-900 mb-2.5">
              Final Selling Price (₹)
            </label>
            <div className="relative ">
              <input
                type="number"
                min={0}
                step={100}
                value={sellingPrice || ''}
                placeholder={String(menuTotal)}
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
            <label className="block text-xl font-medium text-slate-900 mb-2.5">
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

          {/* Payment terms */}
          <div>
            <label className="block text-xl font-medium text-slate-900 mb-2.5">
              Payment Terms
            </label>
            <input
              type="text"
              placeholder="e.g. 50% advance, balance on event day"
              value={paymentTerms}
              disabled={isLocked}
              onChange={e => setPaymentTerms(e.target.value)}
              className={
                'w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-lg font-medium text-slate-900 ' +
                'placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all'
              }
            />
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
                  {revision.isCurrent && (
                    <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full bg-violet-600 text-white uppercase tracking-wide">
                      Current
                    </span>
                  )}
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
  final_selling_price?: number | string | null;
  internal_cost?: number | string | null;
  margin?: number | string | null;
  advance_amount?: number | string | null;
  payment_terms?: string;
  menu_dishes?: Dish[];
  menu_services?: Service[];
}

export default function QuotationCard({
  leadId, clientName, eventDate, guestCount, eventType,
}: QuotationCardProps) {
  const [activeTab, setActiveTab] = useState<QuotationTab>('menu');
  const queryClient = useQueryClient();
  const [menuSaveError, setMenuSaveError] = useState(false);
  const [costItems, setCostItems] = useState<DishCostItem[]>([]);
  const costItemsStorageKey = `quotation-cost-items:${leadId}`;
  const { data: quotationVersions = [] } = useQuery<ApiQuotation[]>({
    queryKey: ['quotation-menu', leadId],
    queryFn: async () => {
      const raw = await api.get(`/quotations/?inquiry=${leadId}`);
      const quotes: ApiQuotation[] = Array.isArray(raw) ? raw : (raw?.results ?? []);
      return quotes;
    },
  });
  const quotationData = quotationVersions[0] ?? null;
  const quotationId = quotationData?.id ?? null;
  const dishes = Array.isArray(quotationData?.menu_dishes) ? quotationData.menu_dishes : [];
  const services = Array.isArray(quotationData?.menu_services) ? quotationData.menu_services : [];
  const isLocked = Boolean(quotationData?.is_locked);
  const currentRevision = Number(quotationData?.version_number ?? 1);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(costItemsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const hydrated = parsed.filter((item): item is DishCostItem => (
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.dishId === 'string' &&
        typeof item.dishName === 'string' &&
        (item.source === 'recipe' || item.source === 'manual') &&
        typeof item.name === 'string'
      )).map(item => ({
        ...item,
        qty: Number(item.qty) || 0,
        rate: Number(item.rate) || 0,
        unit: item.unit || 'unit',
        category: item.category || 'Other',
      }));
      if (hydrated.length > 0) setCostItems(hydrated);
    } catch {
      // Ignore malformed local cache and continue with fresh state.
    }
  }, [costItemsStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(costItemsStorageKey, JSON.stringify(costItems));
    } catch {
      // Ignore write failures (e.g. privacy mode).
    }
  }, [costItems, costItemsStorageKey]);

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

  const addItemMutation = useMutation({
    mutationFn: async ({ itemType, item }: { itemType: 'dish' | 'service'; item: Dish | Service }) => {
      const qid = await ensureQuotationId();
      await api.post('/quotations/quotation-items/', {
        quotation: qid,
        item_type: itemType,
        item,
      });
    },
    onSuccess: () => {
      setMenuSaveError(false);
      void refetchMenu();
    },
    onError: () => setMenuSaveError(true),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemType, item }: { itemType: 'dish' | 'service'; item: Dish | Service }) => {
      const qid = await ensureQuotationId();
      await api.patch(`/quotations/quotation-items/${item.id}/`, {
        quotation: qid,
        item_type: itemType,
        item,
      });
    },
    onSuccess: () => {
      setMenuSaveError(false);
      void refetchMenu();
    },
    onError: () => setMenuSaveError(true),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ itemType, itemId }: { itemType: 'dish' | 'service'; itemId: string }) => {
      const qid = await ensureQuotationId();
      await api.delete(`/quotations/quotation-items/${itemId}/?quotation=${qid}&item_type=${itemType}`);
    },
    onSuccess: () => {
      setMenuSaveError(false);
      void refetchMenu();
    },
    onError: () => setMenuSaveError(true),
  });

  function onAddDish(dish: Dish) {
    addItemMutation.mutate({ itemType: 'dish', item: dish });
  }

  function onUpdateDish(dish: Dish) {
    updateItemMutation.mutate({ itemType: 'dish', item: dish });
  }

  function onRemoveDish(id: string) {
    deleteItemMutation.mutate({ itemType: 'dish', itemId: id });
  }

  function onAddService(service: Service) {
    addItemMutation.mutate({ itemType: 'service', item: service });
  }

  function onUpdateService(service: Service) {
    updateItemMutation.mutate({ itemType: 'service', item: service });
  }

  function onRemoveService(id: string) {
    deleteItemMutation.mutate({ itemType: 'service', itemId: id });
  }

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

  // Called by PricingTab when "Finalise & Send Quotation" is clicked
  async function handleFinalise(payload: {
    final_selling_price: number;
    internal_cost: number;
    advance_amount: number;
    payment_terms: string;
  }) {
    const qid = await ensureQuotationId();
    await api.post(`/quotations/${qid}/finalize/`, payload);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['quotation-menu', leadId] }),
      queryClient.invalidateQueries({ queryKey: ['lead-quotation-summary', leadId] }),
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] }),
    ]);
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">

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
      {activeTab === 'menu' && (
        <MenuTab
          dishes={dishes}
          services={services}
          isSaving={addItemMutation.isPending || updateItemMutation.isPending || deleteItemMutation.isPending}
          saveError={menuSaveError}
          onAddDish={onAddDish}
          onUpdateDish={onUpdateDish}
          onRemoveDish={onRemoveDish}
          onAddService={onAddService}
          onUpdateService={onUpdateService}
          onRemoveService={onRemoveService}
        />
      )}
      {activeTab === 'costing' && (
        <CostingTabByDish dishes={dishes} items={costItems} setItems={setCostItems} />
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
          initialPaymentTerms={quotationData?.payment_terms ?? ''}
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
