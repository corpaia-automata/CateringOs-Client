'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Plus,
  Trash2,
  ChefHat,
  Zap,
  Package,
  Loader2,
  ChevronDown,
  Save,
  ArrowLeft,
} from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DishCategory { id: string; name: string; }

interface IngredientRow {
  ingredient_name: string;
  quantity: string;
  unit: string;
  price_per_unit: string;
}

interface DishFormState {
  dish_type: string;
  name: string;
  category: string;
  veg_non_veg: string;
  unit_type: string;
  description: string;
  price_unit: string;
  base_price: string;
  selling_price: string;
  labour_cost: string;
  image_url: string;
  ingredients: IngredientRow[];
}

// Exported so the edit page can type its useQuery response
export interface DishApiResponse {
  id: string;
  dish_type: string;
  name: string;
  category: string;
  veg_non_veg: string;
  unit_type: string;
  description: string;
  price_unit: string;
  base_price: string;
  selling_price: string;
  labour_cost: string;
  image_url: string;
  ingredients: Array<{
    id?: string;
    ingredient_name: string;
    quantity: string;
    unit: string;
    price_per_unit: string;
  }>;
}

function dataToForm(d: DishApiResponse): DishFormState {
  return {
    dish_type:     d.dish_type     ?? '',
    name:          d.name          ?? '',
    category:      d.category      ?? '',
    veg_non_veg:   d.veg_non_veg   ?? 'veg',
    unit_type:     d.unit_type     ?? '',
    description:   d.description   ?? '',
    price_unit:    d.price_unit    ?? 'per_plate',
    base_price:    d.base_price    ?? '',
    selling_price: d.selling_price ?? '',
    labour_cost:   d.labour_cost   ?? '',
    image_url:     d.image_url     ?? '',
    ingredients:   (d.ingredients ?? []).map(
      ({ ingredient_name, quantity, unit, price_per_unit }) => ({
        ingredient_name, quantity, unit, price_per_unit,
      }),
    ),
  };
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  initialData?: DishApiResponse;
  dishId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ── Design tokens (aligned with Create Lead / enquiries flow) ──────────────────

const NAVY = '#1a1a2e';
const BORDER = '#e0e0e0';
const MUTED_BG = '#f0f0f0';
const RED = '#e53935';

const DISH_TYPES = [
  {
    value: 'recipe',
    label: 'Recipe Dish',
    Icon: ChefHat,
    desc: 'Has ingredients with quantities. Cost is auto-calculated from ingredient prices + labour.',
  },
  {
    value: 'live_counter',
    label: 'Live Counter',
    Icon: Zap,
    desc: 'Live station (e.g. juice counter). No fixed price — price is entered per enquiry.',
  },
  {
    value: 'fixed_price',
    label: 'Fixed Price',
    Icon: Package,
    desc: 'Readymade / packaged item (e.g. water bottle). Has a fixed selling price, no recipe.',
  },
] as const;

const PRICE_UNITS = [
  { value: 'per_plate', label: 'Per Plate' },
  { value: 'per_kg',    label: 'Per KG' },
  { value: 'per_piece', label: 'Per Piece' },
];

const UNIT_OPTIONS = ['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'box'];

const UNIT_TYPES = [
  { value: 'PLATE',   label: 'Plate' },
  { value: 'KG',      label: 'Kilogram' },
  { value: 'PIECE',   label: 'Piece' },
  { value: 'LITRE',   label: 'Litre' },
  { value: 'PORTION', label: 'Portion' },
];

const BLANK_INGREDIENT: IngredientRow = {
  ingredient_name: '', quantity: '', unit: 'kg', price_per_unit: '',
};

const INITIAL: DishFormState = {
  dish_type: 'recipe',
  name: '',
  category: '',
  veg_non_veg: 'veg',
  unit_type: '',
  description: '',
  price_unit: 'per_plate',
  base_price: '',
  selling_price: '',
  labour_cost: '',
  image_url: '',
  ingredients: [],
};

const pill =
  'w-full rounded-[9999px] border bg-white px-4 py-3 text-[13px] text-[#1a1a2e] outline-none transition-colors placeholder:text-neutral-400 focus:border-[#1a1a2e] cursor-pointer';
const roundedBox =
  'w-full rounded-xl border bg-white px-4 py-3 text-[13px] text-[#1a1a2e] outline-none transition-colors placeholder:text-neutral-400 focus:border-[#1a1a2e]';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs" style={{ color: RED }}>{msg}</p>;
}

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block cursor-pointer text-[13px] text-neutral-600"
    >
      {children}
      {required ? <span style={{ color: RED }}> *</span> : null}
    </label>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-white p-6 md:p-8 font-sans"
      style={{ border: `1px solid ${BORDER}`, borderRadius: '12px' }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold leading-tight" style={{ color: NAVY }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SelectPill({
  error,
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <div className="relative">
      <select
        className={cn(pill, 'appearance-none pr-10', className)}
        style={{ borderColor: error ? RED : BORDER }}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 opacity-60"
        style={{ color: NAVY }}
        aria-hidden
      />
    </div>
  );
}

export default function CreateDishForm({ initialData, dishId, onSuccess, onCancel }: Props = {}) {
  const router = useRouter();
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const listPath = `/app/${slug}/master`;

  const [form, setForm] = useState<DishFormState>(() =>
    initialData ? dataToForm(initialData) : INITIAL,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<DishCategory[]>([]);

  useEffect(() => {
    api.get('/categories/')
      .then((data: unknown) => {
        if (Array.isArray(data)) setCategories(data as DishCategory[]);
      })
      .catch(() => {});
  }, []);

  function set<K extends keyof DishFormState>(key: K, value: DishFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: '' }));
  }

  function addIngredient() {
    setForm(f => ({ ...f, ingredients: [...f.ingredients, { ...BLANK_INGREDIENT }] }));
  }

  function removeIngredient(idx: number) {
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
  }

  function setIngredient(idx: number, field: keyof IngredientRow, value: string) {
    setForm(f => {
      const rows = [...f.ingredients];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...f, ingredients: rows };
    });
  }

  const ingredientCost = useMemo(() =>
    form.ingredients.reduce((sum, r) => {
      return sum + (parseFloat(r.quantity) || 0) * (parseFloat(r.price_per_unit) || 0);
    }, 0),
    [form.ingredients],
  );

  const labourCost = parseFloat(form.labour_cost) || 0;
  const estimatedCost = ingredientCost + labourCost;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.dish_type) errs.dish_type = 'Please select a dish type';
    if (!form.name.trim()) errs.name = 'Dish name is required';
    if (categories.length > 0 && !form.category) errs.category = 'Category is required';
    if (!form.unit_type) errs.unit_type = 'Unit type is required';
    if (!form.price_unit) errs.price_unit = 'Price unit is required';
    if (!form.base_price) errs.base_price = 'Base price is required';
    if (!form.selling_price) errs.selling_price = 'Selling price is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    const payload = {
      dish_type:     form.dish_type,
      name:          form.name.trim(),
      ...(form.category ? { category: form.category } : {}),
      veg_non_veg:   form.veg_non_veg,
      unit_type:     form.unit_type,
      description:   form.description,
      price_unit:    form.price_unit,
      base_price:    form.base_price,
      selling_price: form.selling_price,
      labour_cost:   form.labour_cost || '0',
      image_url:     form.image_url,
      ingredients:   form.ingredients
        .filter(r => r.ingredient_name.trim() && r.quantity && r.price_per_unit)
        .map(r => ({
          ingredient_name: r.ingredient_name.trim(),
          quantity:        r.quantity,
          unit:            r.unit,
          price_per_unit:  r.price_per_unit,
        })),
    };

    try {
      dishId
        ? await api.put(`/master/dishes/${dishId}/`, payload)
        : await api.post('/master/dishes/', payload);
      toast.success(dishId ? 'Dish updated successfully' : 'Dish created successfully');
      if (onSuccess) { onSuccess(); } else { router.push(listPath); }
    } catch (err: unknown) {
      const data = (err as { data?: Record<string, unknown> })?.data ?? {};
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const fieldErrs: Record<string, string> = {};
        for (const [key, val] of Object.entries(data)) {
          fieldErrs[key] = Array.isArray(val) ? (val as string[]).join(' ') : String(val);
        }
        if (Object.keys(fieldErrs).length) { setErrors(fieldErrs); return; }
      }
      toast.error(
        (Object.values(data) as unknown[]).flat().map(String).join(', ') || 'Failed to save dish',
      );
    } finally {
      setSaving(false);
    }
  }

  function inpErr(field: string): boolean {
    return !!errors[field];
  }

  const pageTitle =
    dishId && initialData?.name
      ? `Edit — ${initialData.name}`
      : dishId
        ? 'Edit Dish'
        : 'Create New Dish';
  const pageSubtitle =
    dishId ? 'Update dish details and ingredients' : 'Add a new dish to your menu';

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: '#fafafa' }}>
      <header
        className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b bg-white px-6 py-4"
        style={{ borderColor: BORDER }}
      >
        <div className="min-w-0 flex-1 pr-4">
          <h1 className="truncate text-[18px] font-bold leading-tight" style={{ color: NAVY }}>
            {pageTitle}
          </h1>
          <p className="mt-0.5 text-[13px] text-neutral-400">{pageSubtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => (onCancel ? onCancel() : router.push(listPath))}
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[9999px] border bg-white px-5 py-2.5 text-sm font-semibold text-[#1a1a2e] outline-none transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: BORDER }}
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[9999px] border px-5 py-2.5 text-sm font-semibold text-white outline-none transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: NAVY, backgroundColor: NAVY }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} strokeWidth={2} aria-hidden />}
            {saving ? 'Saving…' : 'Save Dish'}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-6 pb-12 pt-8 font-sans">
      {/* ── Dish Type ───────────────────────────────────────────────────── */}
      <SectionCard title="Dish Type">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {DISH_TYPES.map(({ value, label, Icon, desc }) => {
            const active = form.dish_type === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => set('dish_type', value)}
                className={cn(
                  'flex cursor-pointer flex-col gap-2 rounded-xl border p-4 text-center outline-none transition-colors',
                  active ? 'border-transparent text-white' : 'bg-white',
                )}
                style={
                  active
                    ? { backgroundColor: NAVY }
                    : { borderColor: BORDER, color: NAVY }
                }
              >
                <Icon
                  size={24}
                  strokeWidth={2}
                  className="mx-auto shrink-0"
                  style={{ color: active ? '#fff' : '#64748B' }}
                />
                <span className="text-[13px] font-bold leading-snug">{label}</span>
                <span
                  className="text-[11px] leading-snug"
                  style={{ color: active ? 'rgba(255,255,255,0.85)' : '#64748B' }}
                >
                  {desc}
                </span>
              </button>
            );
          })}
        </div>
        <FieldError msg={errors.dish_type} />
      </SectionCard>

      {/* ── Basic Information ───────────────────────────────────────────── */}
      <SectionCard title="Basic Information">
        <div className="space-y-5">
          <div>
            <FieldLabel htmlFor="dish-name" required>Dish name</FieldLabel>
            <input
              id="dish-name"
              className={pill}
              style={{ borderColor: inpErr('name') ? RED : BORDER }}
              placeholder="e.g., Beef Biriyani"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
            <FieldError msg={errors.name} />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-start">
            <div>
              <FieldLabel required>Category</FieldLabel>
              <SelectPill
                error={inpErr('category')}
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                <option value="">Select category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </SelectPill>
              <FieldError msg={errors.category} />
            </div>

            <div>
              <FieldLabel>Veg / Non-Veg</FieldLabel>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { value: 'veg', label: 'Vegetarian', dot: '#22c55e' },
                  { value: 'non_veg', label: 'Non-Veg', dot: '#ef4444' },
                ].map(opt => {
                  const checked = form.veg_non_veg === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('veg_non_veg', opt.value)}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-2 rounded-[9999px] border px-4 py-2.5 text-[13px] font-semibold outline-none transition-colors',
                        checked ? 'text-white' : 'bg-white',
                      )}
                      style={
                        checked
                          ? { backgroundColor: NAVY, borderColor: NAVY }
                          : { borderColor: BORDER, color: NAVY }
                      }
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full ring-2 ring-white/30"
                        style={{ backgroundColor: opt.dot }}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <FieldLabel required>Unit type</FieldLabel>
            <SelectPill
              error={inpErr('unit_type')}
              value={form.unit_type}
              onChange={e => set('unit_type', e.target.value)}
            >
              <option value="">Select unit type</option>
              {UNIT_TYPES.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </SelectPill>
            <FieldError msg={errors.unit_type} />
          </div>

          <div>
            <FieldLabel htmlFor="dish-desc">
              Description{' '}
              <span className="font-normal text-neutral-400">(optional)</span>
            </FieldLabel>
            <textarea
              id="dish-desc"
              className={roundedBox}
              style={{ borderColor: BORDER, resize: 'none' }}
              rows={4}
              placeholder="Brief description"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <SectionCard title="Pricing">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <FieldLabel required>Price unit</FieldLabel>
            <SelectPill
              error={inpErr('price_unit')}
              value={form.price_unit}
              onChange={e => set('price_unit', e.target.value)}
            >
              {PRICE_UNITS.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </SelectPill>
            <FieldError msg={errors.price_unit} />
          </div>

          <div>
            <FieldLabel required>Base price (per plate)</FieldLabel>
            <input
              type="number"
              min="0"
              step="0.01"
              className={pill}
              style={{ borderColor: inpErr('base_price') ? RED : BORDER }}
              placeholder="₹ 0.00"
              value={form.base_price}
              onChange={e => set('base_price', e.target.value)}
            />
            <FieldError msg={errors.base_price} />
          </div>

          <div>
            <FieldLabel required>Selling price (per plate)</FieldLabel>
            <input
              type="number"
              min="0"
              step="0.01"
              className={pill}
              style={{ borderColor: inpErr('selling_price') ? RED : BORDER }}
              placeholder="₹ 0.00"
              value={form.selling_price}
              onChange={e => set('selling_price', e.target.value)}
            />
            <FieldError msg={errors.selling_price} />
          </div>
        </div>
      </SectionCard>

      {/* ── Ingredients ─────────────────────────────────────────────────── */}
      <SectionCard
        title={
          <>
            Ingredients{' '}
            <span className="text-[15px] font-normal text-neutral-400">(optional)</span>
          </>
        }
        action={
          <button
            type="button"
            onClick={addIngredient}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-3 py-2 text-[12px] font-semibold outline-none transition-colors hover:bg-neutral-50"
            style={{ borderColor: BORDER, color: NAVY }}
          >
            <Plus size={14} strokeWidth={2.25} />
            Add Ingredient
          </button>
        }
      >
        {form.ingredients.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-xl py-12 text-center"
            style={{ border: `1px dashed ${BORDER}`, backgroundColor: '#fafafa' }}
          >
            <p className="text-[13px]" style={{ color: '#94a3b8' }}>
              No ingredients added yet.
            </p>
            <p className="mt-1 max-w-sm text-[13px]" style={{ color: '#cbd5e1' }}>
              Click &quot;Add Ingredient&quot; to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="hidden gap-2 px-1 md:grid"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 40px' }}
            >
              {['Ingredient name', 'Quantity', 'Unit', '₹ / unit', ''].map((h, i) => (
                <span key={i} className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                  {h}
                </span>
              ))}
            </div>

            {form.ingredients.map((row, idx) => (
              <div
                key={idx}
                className="grid gap-2 md:items-center"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 40px' }}
              >
                <input
                  className={pill}
                  style={{ borderColor: BORDER }}
                  placeholder="e.g. Chicken"
                  value={row.ingredient_name}
                  onChange={e => setIngredient(idx, 'ingredient_name', e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={pill}
                  style={{ borderColor: BORDER }}
                  placeholder="0"
                  value={row.quantity}
                  onChange={e => setIngredient(idx, 'quantity', e.target.value)}
                />
                <SelectPill
                  value={row.unit}
                  onChange={e => setIngredient(idx, 'unit', e.target.value)}
                >
                  {UNIT_OPTIONS.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </SelectPill>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={pill}
                  style={{ borderColor: BORDER }}
                  placeholder="₹ 0.00"
                  value={row.price_per_unit}
                  onChange={e => setIngredient(idx, 'price_per_unit', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(idx)}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center self-center rounded-lg border-0 bg-transparent outline-none"
                  title="Remove row"
                >
                  <Trash2 size={16} style={{ color: RED }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Labour & Cost Preview ─────────────────────────────────────── */}
      <SectionCard title="Labour Cost & Cost Preview">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
          <div>
            <FieldLabel htmlFor="labour-cost">
              Labour cost (per plate){' '}
              <span className="font-normal text-neutral-400">(optional)</span>
            </FieldLabel>
            <input
              id="labour-cost"
              type="number"
              min="0"
              step="0.01"
              className={pill}
              style={{ borderColor: BORDER }}
              placeholder="₹ 0.00"
              value={form.labour_cost}
              onChange={e => set('labour_cost', e.target.value)}
            />
            <p className="mt-2 text-[12px] text-neutral-500">
              Chef / cooking labour cost per serving
            </p>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: MUTED_BG, border: `1px solid ${BORDER}` }}
          >
            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-4">
                <span style={{ color: NAVY }}>Ingredient cost</span>
                <span className="tabular-nums font-medium" style={{ color: NAVY }}>
                  ₹{ingredientCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: NAVY }}>Labour cost</span>
                <span className="tabular-nums font-medium" style={{ color: NAVY }}>
                  ₹{labourCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div
                className="flex justify-between gap-4 border-t pt-3 font-bold"
                style={{ borderColor: BORDER }}
              >
                <span style={{ color: NAVY }}>Estimated cost / serving</span>
                <span className="tabular-nums" style={{ color: NAVY }}>
                  ₹{estimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Image ─────────────────────────────────────────────────────── */}
      <SectionCard title="Image (Optional)">
        <div>
          <FieldLabel htmlFor="image-url">Image URL</FieldLabel>
          <input
            id="image-url"
            type="url"
            className={roundedBox}
            style={{ borderColor: BORDER }}
            placeholder="https://example.com/image.jpg"
            value={form.image_url}
            onChange={e => set('image_url', e.target.value)}
          />
        </div>
      </SectionCard>
      </div>
    </div>
  );
}
