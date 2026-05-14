'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Pencil, BookOpen, Check, X, Loader2,
  Trash2, ToggleLeft, ToggleRight, ChefHat, Package, AlertCircle, FileSpreadsheet, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Dish {
  id: string;
  name: string;
  category: string;
  category_name?: string | null;
  dish_type: string;
  veg_non_veg: string;
  price_unit: string;
  base_price: string | number;
  selling_price: string | number;
  unit_type?: string;
  is_active: boolean;
  has_recipe?: boolean;
  batch_size?: string | number;
  batch_unit?: string;
  recipe_count?: number;
  cost_per_unit?: string | number;
}

function isUuidLike(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

interface GlobalDishCategoryRow {
  id: string;
  name: string;
}

function normalizeDishCatLabel(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Map list row → category FK UUID for forms (`category` may be legacy text; `category_name` is read-only). */
function dishCategoryIdForForm(dish: Dish | null, apiCats: GlobalDishCategoryRow[]): string {
  if (!dish) return '';
  const raw = (dish.category ?? '').trim();
  if (isUuidLike(raw)) return raw;
  if (!apiCats.length) return '';
  const label = (dish.category_name ?? raw).trim();
  if (!label) return '';
  const key = normalizeDishCatLabel(label);
  let hit = apiCats.find(c => normalizeDishCatLabel(c.name) === key);
  if (hit) return hit.id;
  const stripPlural = (x: string) => (x.endsWith('s') && x.length > 1 ? x.slice(0, -1) : x);
  hit = apiCats.find(c => stripPlural(normalizeDishCatLabel(c.name)) === stripPlural(key));
  return hit?.id ?? '';
}

interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit_of_measure: string;
  is_active: boolean;
}

// ─── Constants (values must match backend model choices exactly) ────────────────

const DISH_CATEGORIES = ['All', 'Starter', 'Main Course', 'Dessert', 'Beverage', 'Bread', 'Rice', 'Salad', 'Snack', 'Other'];

// Ingredient.Category choices (ordered to match grocery display order)
const ING_CATEGORY_OPTIONS = [
  { value: 'GROCERY',    label: 'Grocery' },
  { value: 'DISPOSABLE', label: 'Disposable' },
  { value: 'VEGETABLE',  label: 'Vegetable' },
  { value: 'FRUIT',      label: 'Fruit' },
  { value: 'RENTAL',     label: 'Rental' },
  { value: 'CHICKEN',    label: 'Chicken' },
  { value: 'BEEF',       label: 'Beef' },
  { value: 'MUTTON',     label: 'Mutton' },
  { value: 'FISH',       label: 'Fish' },
  { value: 'MEAT',       label: 'Meat' },
  { value: 'OTHER',      label: 'Other' },
] as const;

// Dish.UnitType choices: PLATE KG PIECE LITRE PORTION
const DISH_UNIT_OPTIONS = [
  { value: 'PLATE', label: 'Plate' },
  { value: 'KG', label: 'Kilogram' },
  { value: 'PIECE', label: 'Piece' },
  { value: 'LITRE', label: 'Litre' },
  { value: 'PORTION', label: 'Portion' },
] as const;

// Dish.DishType choices
const DISH_TYPE_OPTIONS = [
  { value: 'recipe',       label: 'Recipe' },
  { value: 'live_counter', label: 'Live Counter' },
  { value: 'fixed_price',  label: 'Fixed Price' },
] as const;

// Dish.VegNonVeg choices
const VEG_OPTIONS = [
  { value: 'veg',     label: 'Veg' },
  { value: 'non_veg', label: 'Non-Veg' },
] as const;

// Dish.PriceUnit choices
const PRICE_UNIT_OPTIONS = [
  { value: 'per_plate', label: 'Per Plate' },
  { value: 'per_kg',    label: 'Per KG' },
  { value: 'per_piece', label: 'Per Piece' },
] as const;

// Ingredient.UOM choices: kg g litre ml piece
const ING_UOM_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'litre', label: 'litre' },
  { value: 'ml', label: 'ml' },
  { value: 'piece', label: 'piece' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: active ? '#ECFDF5' : '#F1F5F9', color: active ? '#0D9488' : '#94A3B8' }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function DishTypeBadge({ value }: { value?: string }) {
  const type = (value || '').toLowerCase();
  const style = type === 'fixed_price'
    ? { bg: '#DCFCE7', color: '#15803D', label: 'Fixed' }
    : type === 'recipe'
      ? { bg: '#EEF2FF', color: '#4338CA', label: 'Recipe' }
      : { bg: '#FFF7ED', color: '#C2410C', label: 'Live Counter' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}

function VegTypeBadge({ value }: { value?: string }) {
  const isVeg = (value || '').toLowerCase() === 'veg';
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold"
      style={{ color: isVeg ? '#16A34A' : '#DC2626' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isVeg ? '#22C55E' : '#EF4444' }} />
      {isVeg ? 'Veg' : 'Non-Veg'}
    </span>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-1 mt-1">
      <AlertCircle size={12} style={{ color: '#DC2626' }} />
      <span className="text-xs" style={{ color: '#DC2626' }}>{msg}</span>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading }: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}>
      <div className="rounded-xl p-6 flex flex-col gap-4 w-[360px]"
        style={{ backgroundColor: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div>
          <h3 className="font-semibold text-base" style={{ color: '#0F172A' }}>{title}</h3>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>{message}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ color: '#64748B', border: '1px solid #E2E8F0' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#DC2626', opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={13} className="animate-spin" />}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Generic Drawer Shell ─────────────────────────────────────────────────────

function Drawer({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; footer: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 transition-opacity"
        style={{ backgroundColor: 'rgba(15,23,42,0.4)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.2s' }} />
      <div ref={ref} className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width: 480, backgroundColor: '#fff', transform: open ? 'translateX(0)' : 'translateX(100%)', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', transition: 'transform 0.25s ease' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E2E8F0' }}>
          <h2 className="font-semibold text-base" style={{ color: '#0F172A' }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X size={18} style={{ color: '#64748B' }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <div className="border-t px-6 py-4" style={{ borderColor: '#E2E8F0' }}>{footer}</div>
      </div>
    </>
  );
}

// ─── Dish Form Drawer ─────────────────────────────────────────────────────────

const EMPTY_DISH = {
  name: '', category: '', dish_type: 'recipe', veg_non_veg: 'veg',
  price_unit: 'per_plate', base_price: '', selling_price: '',
  unit_type: 'PLATE', is_active: true,
};

/** Align drawer fields with DishSerializer (`serving_unit`, not legacy `price_unit` / `unit_type`). */
function servingUnitFromDrawerForm(priceUnit: string, unitType: string): string {
  const fromPrice: Record<string, string> = {
    per_plate: 'PLATE',
    per_kg: 'KG',
    per_piece: 'PIECE',
  };
  const pu = (priceUnit || '').toLowerCase();
  if (fromPrice[pu]) return fromPrice[pu];
  const ut = (unitType || 'PLATE').toUpperCase();
  if (['PLATE', 'KG', 'PIECE', 'LITRE', 'PORTION'].includes(ut)) return ut;
  return 'PLATE';
}

function DishDrawer({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void; editing: Dish | null; onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_DISH });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [dishCategories, setDishCategories] = useState<GlobalDishCategoryRow[]>([]);
  const [dishCategoriesLoading, setDishCategoriesLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDishCategoriesLoading(true);
    api.get('/categories/')
      .then((data: unknown) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? (data as GlobalDishCategoryRow[]) : [];
        setDishCategories([...list].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load categories'); })
      .finally(() => { if (!cancelled) setDishCategoriesLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name:          editing.name          ?? '',
      category:      isUuidLike(editing.category) ? (editing.category ?? '') : '',
      dish_type:     editing.dish_type     ?? 'recipe',
      veg_non_veg:   editing.veg_non_veg   ?? 'veg',
      price_unit:    editing.price_unit    ?? 'per_plate',
      base_price:    String(editing.base_price    ?? ''),
      selling_price: String(editing.selling_price ?? ''),
      unit_type:     editing.unit_type     ?? 'PLATE',
      is_active:     editing.is_active,
    } : { ...EMPTY_DISH });
    setFieldErrors({});
  }, [editing, open]);

  useEffect(() => {
    if (!open || !editing || !dishCategories.length) return;
    setForm(f => {
      if (f.category) return f;
      const id = dishCategoryIdForForm(editing, dishCategories);
      return id ? { ...f, category: id } : f;
    });
  }, [editing, open, dishCategories]);

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); setFieldErrors(e => ({ ...e, [k]: '' })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Client-side validation — mirrors backend required fields
    const errs: Record<string, string> = {};
    if (!form.name.trim())      errs.name          = 'Required';
    if (!form.dish_type)        errs.dish_type      = 'Required';
    if (!form.veg_non_veg)      errs.veg_non_veg    = 'Required';
    if (!form.price_unit)       errs.price_unit     = 'Required';
    if (!form.base_price)       errs.base_price     = 'Required';
    if (!form.selling_price)    errs.selling_price  = 'Required';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setSaving(true);
    setFieldErrors({});
    const { category: catId, price_unit, unit_type, ...rest } = form;
    const payload: Record<string, unknown> = {
      name:          rest.name.trim(),
      dish_type:     rest.dish_type,
      veg_non_veg:   rest.veg_non_veg,
      base_price:    rest.base_price,
      selling_price: rest.selling_price,
      is_active:     rest.is_active,
      serving_unit:  servingUnitFromDrawerForm(price_unit, unit_type),
    };
    if (catId) payload.category = catId;
    try {
      editing
        ? await api.patch(`/master/dishes/${editing.id}/`, payload)
        : await api.post('/master/dishes/', payload);
      toast.success(editing ? 'Dish updated' : 'Dish created successfully');
      onSaved(); onClose();
    } catch (err: any) {
      const data = err?.data ?? {};
      if (typeof data === 'object' && !Array.isArray(data)) {
        const errs: Record<string, string> = {};
        let hasFieldErrors = false;
        for (const [key, val] of Object.entries(data)) {
          const msg = Array.isArray(val) ? val.join(' ') : String(val);
          errs[key] = msg;
          hasFieldErrors = true;
        }
        if (hasFieldErrors) { setFieldErrors(errs); return; }
      }
      toast.error(Object.values(data).flat().join(', ') || 'Failed to save');
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors';
  const ist = { border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' };
  const ist_err = { border: '1.5px solid #DC2626', backgroundColor: '#FFF5F5', color: '#0F172A' };
  const lbl = 'block text-xs font-medium mb-1.5';

  return (
    <Drawer open={open} onClose={onClose} title={editing ? 'Edit Dish' : 'Add Dish'}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ color: '#64748B', border: '1px solid #E2E8F0' }}>Cancel</button>
          <button onClick={() => formRef.current?.requestSubmit()} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#D95F0E', opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Saving…' : editing ? 'Update' : 'Save Dish'}
          </button>
        </div>
      }>
      <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">

        {/* Dish Name */}
        <div>
          <label className={lbl} style={{ color: '#0F172A' }}>Dish Name <span style={{ color: '#DC2626' }}>*</span></label>
          <input className={inp} style={fieldErrors.name ? ist_err : ist} value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="e.g. Chicken Biryani"
            onFocus={e => { if (!fieldErrors.name) e.currentTarget.style.borderColor = '#D95F0E'; }}
            onBlur={e => { if (!fieldErrors.name) e.currentTarget.style.borderColor = '#E2E8F0'; }} />
          <FieldError msg={fieldErrors.name} />
        </div>

        {/* Dish Type */}
        <div>
          <label className={lbl} style={{ color: '#0F172A' }}>Dish Type <span style={{ color: '#DC2626' }}>*</span></label>
          <select className={inp} style={fieldErrors.dish_type ? ist_err : ist} value={form.dish_type}
            onChange={e => set('dish_type', e.target.value)}>
            {DISH_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <FieldError msg={fieldErrors.dish_type} />
        </div>

        {/* Category + Unit Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Category</label>
            <select className={inp} style={fieldErrors.category ? ist_err : ist} value={form.category}
              onChange={e => set('category', e.target.value)}>
              <option value="">{dishCategoriesLoading ? 'Loading…' : 'Select'}</option>
              {dishCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <FieldError msg={fieldErrors.category} />
          </div>
          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Unit Type</label>
            <select className={inp} style={fieldErrors.unit_type ? ist_err : ist} value={form.unit_type}
              onChange={e => set('unit_type', e.target.value)}>
              {DISH_UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <FieldError msg={fieldErrors.unit_type} />
          </div>
        </div>

        {/* Veg / Non-Veg + Price Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Veg / Non-Veg <span style={{ color: '#DC2626' }}>*</span></label>
            <select className={inp} style={fieldErrors.veg_non_veg ? ist_err : ist} value={form.veg_non_veg}
              onChange={e => set('veg_non_veg', e.target.value)}>
              {VEG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <FieldError msg={fieldErrors.veg_non_veg} />
          </div>
          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Price Unit <span style={{ color: '#DC2626' }}>*</span></label>
            <select className={inp} style={fieldErrors.price_unit ? ist_err : ist} value={form.price_unit}
              onChange={e => set('price_unit', e.target.value)}>
              {PRICE_UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <FieldError msg={fieldErrors.price_unit} />
          </div>
        </div>

        {/* Base Price + Selling Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Base Price (₹) <span style={{ color: '#DC2626' }}>*</span></label>
            <input type="number" min="0" step="0.01" className={inp} style={fieldErrors.base_price ? ist_err : ist}
              placeholder="0.00" value={form.base_price} onChange={e => set('base_price', e.target.value)} />
            <FieldError msg={fieldErrors.base_price} />
          </div>
          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Selling Price (₹) <span style={{ color: '#DC2626' }}>*</span></label>
            <input type="number" min="0" step="0.01" className={inp} style={fieldErrors.selling_price ? ist_err : ist}
              placeholder="0.00" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} />
            <FieldError msg={fieldErrors.selling_price} />
          </div>
        </div>

        {/* Server-side field errors */}
        {fieldErrors.non_field_errors && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            {fieldErrors.non_field_errors}
          </div>
        )}
        {fieldErrors.detail && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            {fieldErrors.detail}
          </div>
        )}

        {/* Active toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => set('is_active', !form.is_active)}
            className="relative w-9 h-5 rounded-full transition-colors"
            style={{ backgroundColor: form.is_active ? '#0D9488' : '#CBD5E1' }}>
            <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
              style={{ transform: form.is_active ? 'translateX(18px)' : 'translateX(2px)' }} />
          </div>
          <span className="text-sm" style={{ color: '#0F172A' }}>Active</span>
        </label>
      </form>
    </Drawer>
  );
}

// ─── Ingredient Form Drawer ───────────────────────────────────────────────────

const EMPTY_ING = { name: '', category: '', unit_of_measure: 'kg', is_active: true };

function IngredientDrawer({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void; editing: Ingredient | null; onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_ING });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setForm(editing ? {
      name: editing.name, category: editing.category ?? '',
      unit_of_measure: editing.unit_of_measure ?? 'kg', is_active: editing.is_active,
    } : { ...EMPTY_ING });
    setFieldErrors({});
  }, [editing, open]);

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); setFieldErrors(e => ({ ...e, [k]: '' })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setFieldErrors({});
    try {
      editing
        ? await api.patch(`/master/ingredients/${editing.id}/`, form)
        : await api.post('/master/ingredients/', form);
      toast.success(editing ? 'Ingredient updated' : 'Ingredient created successfully');
      onSaved(); onClose();
    } catch (err: any) {
      const data = err?.data ?? {};
      if (typeof data === 'object' && !Array.isArray(data)) {
        const errs: Record<string, string> = {};
        let hasFieldErrors = false;
        for (const [key, val] of Object.entries(data)) {
          const msg = Array.isArray(val) ? val.join(' ') : String(val);
          errs[key] = msg;
          hasFieldErrors = true;
        }
        if (hasFieldErrors) { setFieldErrors(errs); return; }
      }
      toast.error(Object.values(data).flat().join(', ') || 'Failed to save');
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors';
  const ist = { border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' };
  const ist_err = { border: '1.5px solid #DC2626', backgroundColor: '#FFF5F5', color: '#0F172A' };
  const lbl = 'block text-xs font-medium mb-1.5';

  return (
    <Drawer open={open} onClose={onClose} title={editing ? 'Edit Ingredient' : 'Add Ingredient'}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ color: '#64748B', border: '1px solid #E2E8F0' }}>Cancel</button>
          <button onClick={() => formRef.current?.requestSubmit()} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#D95F0E', opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : editing ? 'Update' : 'Save Ingredient'}
          </button>
        </div>
      }>
      <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className={lbl} style={{ color: '#0F172A' }}>Name <span style={{ color: '#DC2626' }}>*</span></label>
          <input className={inp} style={fieldErrors.name ? ist_err : ist} required value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="e.g. Chicken"
            onFocus={e => { if (!fieldErrors.name) e.currentTarget.style.borderColor = '#D95F0E'; }}
            onBlur={e => { if (!fieldErrors.name) e.currentTarget.style.borderColor = '#E2E8F0'; }} />
          <FieldError msg={fieldErrors.name} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Category</label>
            <select className={inp} style={fieldErrors.category ? ist_err : ist} value={form.category}
              onChange={e => set('category', e.target.value)}>
              <option value="">Select</option>
              {ING_CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <FieldError msg={fieldErrors.category} />
          </div>
          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Unit of Measure</label>
            <select className={inp} style={fieldErrors.unit_of_measure ? ist_err : ist} value={form.unit_of_measure}
              onChange={e => set('unit_of_measure', e.target.value)}>
              {ING_UOM_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <FieldError msg={fieldErrors.unit_of_measure} />
          </div>
        </div>
        {fieldErrors.non_field_errors && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            {fieldErrors.non_field_errors}
          </div>
        )}
        {fieldErrors.detail && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            {fieldErrors.detail}
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => set('is_active', !form.is_active)}
            className="relative w-9 h-5 rounded-full transition-colors"
            style={{ backgroundColor: form.is_active ? '#0D9488' : '#CBD5E1' }}>
            <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
              style={{ transform: form.is_active ? 'translateX(18px)' : 'translateX(2px)' }} />
          </div>
          <span className="text-sm" style={{ color: '#0F172A' }}>Active</span>
        </label>
      </form>
    </Drawer>
  );
}

// ─── Dishes Tab ───────────────────────────────────────────────────────────────

function DishesTab() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [activeOnly, setActiveOnly] = useState(false);

  const [dishDrawer, setDishDrawer] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [deletingDish, setDeletingDish] = useState<Dish | null>(null);
  const [deleting, setDeleting] = useState(false);

  const qs = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(category !== 'All' ? { category } : {}),
    ...(activeOnly ? { is_active: 'true' } : {}),
    page_size: '50',
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['dishes', qs],
    queryFn: () => api.get(`/master/dishes/?${qs}`),
  });

  const dishes: Dish[] = data?.results ?? data ?? [];

  async function toggleActive(dish: Dish) {
    try {
      await api.patch(`/master/dishes/${dish.id}/`, { is_active: !dish.is_active });
      toast.success(dish.is_active ? 'Dish deactivated' : 'Dish activated');
      qc.invalidateQueries({ queryKey: ['dishes'] });
    } catch (err: any) {
      const msg = err?.data?.detail || Object.values(err?.data ?? {}).flat().join(', ') || 'Failed to update';
      toast.error(msg);
    }
  }

  async function confirmDelete() {
    if (!deletingDish) return;
    setDeleting(true);
    try {
      await api.delete(`/master/dishes/${deletingDish.id}/`);
      toast.success('Dish deleted');
      qc.invalidateQueries({ queryKey: ['dishes'] });
      setDeletingDish(null);
    } catch (err: any) {
      const msg = err?.data?.detail || 'Failed to delete dish';
      toast.error(msg);
      setDeletingDish(null);
    } finally { setDeleting(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[180px]"
          style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <Search size={14} style={{ color: '#94A3B8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes..."
            className="bg-transparent outline-none text-sm flex-1" style={{ color: '#0F172A' }} />
          {search && <button onClick={() => setSearch('')}><X size={12} style={{ color: '#94A3B8' }} /></button>}
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1.5px solid #E2E8F0', color: category !== 'All' ? '#0F172A' : '#94A3B8', backgroundColor: '#F8FAFC' }}>
          {DISH_CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
        </select>
        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg"
          style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div onClick={() => setActiveOnly(v => !v)}
            className="relative w-8 h-4 rounded-full transition-colors"
            style={{ backgroundColor: activeOnly ? '#0D9488' : '#CBD5E1' }}>
            <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
              style={{ transform: activeOnly ? 'translateX(17px)' : 'translateX(1px)' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: '#64748B' }}>Active only</span>
        </label>
        {/* <button onClick={() => router.push(`/app/${slug}/master/create`)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white ml-auto"
          style={{ backgroundColor: '#D95F0E' }}>
          <Plus size={15} /> Add Dish
        </button> */}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
        <table className="w-full text-sm ">
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['', 'Dish Name', 'Category', 'Type', 'Dish Type', 'Cost / Sell Price', 'Actions'].map((h, idx) => (
                <th key={h || 'icon-col'} className={`px-4 py-3 text-left text-xs font-semibold ${idx === 0 ? 'w-8' : ''}`} style={{ color: '#6B7280' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              ))
            ) : dishes.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-14 text-center">
                <ChefHat size={36} className="mx-auto mb-2 opacity-20" style={{ color: '#64748B' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>No dishes found</p>
              </td></tr>
            ) : dishes.map(dish => (
              <tr key={dish.id} onClick={() => router.push(`/app/${slug}/master/dishes/${dish.id}`)} className="hover:bg-slate-50 transition-colors cursor-pointer group" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-md" style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}>
                    <ChefHat size={12} />
                  </span>
                </td>
                <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{dish.name}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const label = dish.category_name || (isUuidLike(dish.category) ? '' : dish.category);
                    return label
                      ? <span className="text-sm" style={{ color: '#64748B' }}>{label}</span>
                      : <span style={{ color: '#94A3B8' }}>—</span>;
                  })()}
                </td>
                <td className="px-4 py-3">
                  <VegTypeBadge value={dish.veg_non_veg} />
                </td>
                <td className="px-4 py-3">
                  <DishTypeBadge value={dish.dish_type} />
                </td>
                <td className="px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase" style={{ color: '#94A3B8' }}>
                    {(dish.price_unit || '').replace('per_', 'PER ').replace('_', ' ').toUpperCase()}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: '#111827' }}>
                    ₹{Number(dish.base_price || 0).toLocaleString('en-IN')} <span style={{ color: '#94A3B8' }}>→</span>{' '}
                    <span style={{ color: '#16A34A' }}>₹{Number(dish.selling_price || 0).toLocaleString('en-IN')}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-400" onClick={e => e.stopPropagation()}>
                    {/* <button onClick={() => router.push(`/app/${slug}/master/dishes/${dish.id}`)}
                      className="p-1 rounded hover:bg-slate-100" title="Open">
                      <ChevronRight size={14} />
                    </button> */}
                    <button onClick={() => { setEditingDish(dish); setDishDrawer(true); }}
                      className="p-1 rounded hover:bg-slate-100" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeletingDish(dish)}
                      className="p-1 rounded hover:bg-red-50 hover:text-red-500" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DishDrawer open={dishDrawer} onClose={() => setDishDrawer(false)} editing={editingDish}
        onSaved={() => qc.invalidateQueries({ queryKey: ['dishes'] })} />
      <ConfirmDialog
        open={!!deletingDish}
        title="Delete Dish"
        message={`Delete "${deletingDish?.name}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingDish(null)}
        loading={deleting}
      />
    </div>
  );
}

// ─── Ingredients Tab ─────────────────────────────────────────────────────────

function IngredientsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [deletingIng, setDeletingIng] = useState<Ingredient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const qs = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(category ? { category } : {}),
    page_size: '100',
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['ingredients', qs],
    queryFn: () => api.get(`/master/ingredients/?${qs}`),
  });

  const ingredients: Ingredient[] = data?.results ?? data ?? [];

  async function toggleActive(ing: Ingredient) {
    try {
      await api.patch(`/master/ingredients/${ing.id}/`, { is_active: !ing.is_active });
      toast.success(ing.is_active ? 'Ingredient deactivated' : 'Ingredient activated');
      qc.invalidateQueries({ queryKey: ['ingredients'] });
    } catch { toast.error('Failed to update'); }
  }

  async function confirmDelete() {
    if (!deletingIng) return;
    setDeleting(true);
    try {
      await api.delete(`/master/ingredients/${deletingIng.id}/`);
      toast.success('Ingredient deleted');
      qc.invalidateQueries({ queryKey: ['ingredients'] });
      setDeletingIng(null);
    } catch (err: any) {
      toast.error(err?.data?.detail || 'Failed to delete ingredient');
    } finally { setDeleting(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[180px]"
          style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <Search size={14} style={{ color: '#94A3B8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ingredients…"
            className="bg-transparent outline-none text-sm flex-1" style={{ color: '#0F172A' }} />
          {search && <button onClick={() => setSearch('')}><X size={12} style={{ color: '#94A3B8' }} /></button>}
        </div>
        {/* Category filter uses UPPERCASE values to match backend exact filter */}
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1.5px solid #E2E8F0', color: category ? '#0F172A' : '#94A3B8', backgroundColor: '#F8FAFC' }}>
          <option value="">All Categories</option>
          {ING_CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button onClick={() => { setEditing(null); setDrawerOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white ml-auto"
          style={{ backgroundColor: 'black' }}>
          <Plus size={15} /> Add Ingredient
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Name', 'Category', 'Unit of Measure', 'Active', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#64748B' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              ))
            ) : ingredients.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-14 text-center">
                <Package size={36} className="mx-auto mb-2 opacity-20" style={{ color: '#64748B' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>No ingredients found</p>
              </td></tr>
            ) : ingredients.map(ing => (
              <tr key={ing.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{ing.name}</td>
                <td className="px-4 py-3">
                  {ing.category ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>{ing.category}</span>
                  ) : <span style={{ color: '#94A3B8' }}>—</span>}
                </td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: '#64748B' }}>{ing.unit_of_measure}</td>
                <td className="px-4 py-3"><ActiveBadge active={ing.is_active} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(ing); setDrawerOpen(true); }}
                      className="p-1.5 rounded-lg hover:bg-slate-100" title="Edit">
                      <Pencil size={13} style={{ color: '#64748B' }} />
                    </button>
                    <button onClick={() => toggleActive(ing)}
                      className="p-1.5 rounded-lg hover:bg-slate-100" title={ing.is_active ? 'Deactivate' : 'Activate'}>
                      {ing.is_active
                        ? <ToggleRight size={15} style={{ color: '#0D9488' }} />
                        : <ToggleLeft size={15} style={{ color: '#94A3B8' }} />}
                    </button>
                    <button onClick={() => setDeletingIng(ing)}
                      className="p-1.5 rounded-lg hover:bg-red-50" title="Delete">
                      <Trash2 size={13} style={{ color: '#DC2626' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <IngredientDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ['ingredients'] })} />
      <ConfirmDialog
        open={!!deletingIng}
        title="Delete Ingredient"
        message={`Delete "${deletingIng?.name}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingIng(null)}
        loading={deleting}
      />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'dishes' | 'ingredients';

export default function MasterPage() {
  const [tab, setTab] = useState<Tab>('dishes');
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#111827' }}>Dishes & Recipes</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage your culinary catalog and costs</p>
        </div>
        <div className="flex items-center gap-2">
          {/* <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
            style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff' }}
            onClick={() => toast('Bulk upload UI can be connected here')}>
            <FileSpreadsheet size={14} /> Bulk Upload
          </button> */}
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
            style={{ backgroundColor: '#111827' }}
            onClick={() => router.push(`/app/${slug}/master/create`)}>
            <Plus size={14} /> New Dish
          </button>
        </div>
      </div>

      <div className="flex border-b" style={{ borderColor: '#E2E8F0' }}>
        {([
          { key: 'dishes', label: 'Dishes', icon: ChefHat },
          { key: 'ingredients', label: 'Sub Items (Ingredients)', icon: Package },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors relative"
            style={{ color: tab === key ? 'black' : 'gray-500' }}>
            <Icon size={15} />
            {label}
            {tab === key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: 'black' }} />
            )}
          </button>
        ))}
      </div>

      {tab === 'dishes' ? <DishesTab /> : <IngredientsTab />}
    </div>
  );
}
