'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Trash2, ChefHat, Flame, Tag, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

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
  base_price: string;       // DRF serialises Decimal as string
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

// Map API response → internal form state (strips ingredient IDs, fills defaults)
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
  initialData?: DishApiResponse;  // present → edit mode
  dishId?: string;                // present → PUT instead of POST
  onSuccess?: () => void;         // present → modal mode: called after save instead of routing
  onCancel?: () => void;          // present → modal mode: called when Cancel is clicked
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DISH_TYPES = [
  { value: 'recipe',       label: 'Recipe Dish',  Icon: ChefHat, desc: 'Made from a defined recipe' },
  { value: 'live_counter', label: 'Live Counter',  Icon: Flame,   desc: 'Prepared live at the event' },
  { value: 'fixed_price',  label: 'Fixed Price',   Icon: Tag,     desc: 'Flat rate, no recipe needed' },
] as const;

const PRICE_UNITS = [
  { value: 'per_plate', label: 'Per Plate' },
  { value: 'per_kg',    label: 'Per KG' },
  { value: 'per_piece', label: 'Per Piece' },
];

const UNIT_OPTIONS = ['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'box'];

// ── Style helpers (match existing codebase conventions) ────────────────────────

const inp = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors';
const ist     = { border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC' } as const;
const ist_err = { border: '1.5px solid #DC2626', backgroundColor: '#FFF5F5' } as const;
const lbl = 'block text-xs font-medium mb-1.5 text-[#374151]';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs" style={{ color: '#DC2626' }}>{msg}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold mb-3" style={{ color: '#0F172A' }}>
      {children}
    </h3>
  );
}

// ── Default state ──────────────────────────────────────────────────────────────

const BLANK_INGREDIENT: IngredientRow = {
  ingredient_name: '', quantity: '', unit: 'kg', price_per_unit: '',
};

const UNIT_TYPES = [
  { value: 'PLATE',   label: 'Plate' },
  { value: 'KG',      label: 'Kilogram' },
  { value: 'PIECE',   label: 'Piece' },
  { value: 'LITRE',   label: 'Litre' },
  { value: 'PORTION', label: 'Portion' },
];

const INITIAL: DishFormState = {
  dish_type: '', name: '', category: '', veg_non_veg: 'veg',
  unit_type: '', description: '', price_unit: 'per_plate', base_price: '',
  selling_price: '', labour_cost: '', image_url: '', ingredients: [],
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateDishForm({ initialData, dishId, onSuccess, onCancel }: Props = {}) {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const listPath = `/app/${slug}/master`;

  const [form, setForm] = useState<DishFormState>(() =>
    initialData ? dataToForm(initialData) : INITIAL
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

  // ── Field helpers ──────────────────────────────────────────────────────────

  function set<K extends keyof DishFormState>(key: K, value: DishFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: '' }));
  }

  // ── Ingredient row helpers ─────────────────────────────────────────────────

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

  // ── Cost calculation ──────────────────────────────────────────────────────

  const ingredientCost = useMemo(() =>
    form.ingredients.reduce((sum, r) => {
      return sum + (parseFloat(r.quantity) || 0) * (parseFloat(r.price_per_unit) || 0);
    }, 0),
    [form.ingredients],
  );

  const labourCost    = parseFloat(form.labour_cost) || 0;
  const estimatedCost = ingredientCost + labourCost;

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.dish_type)      errs.dish_type     = 'Please select a dish type';
    if (!form.name.trim())    errs.name          = 'Dish name is required';
    if (categories.length > 0 && !form.category) errs.category = 'Category is required';
    if (!form.unit_type)      errs.unit_type     = 'Unit type is required';
    if (!form.price_unit)     errs.price_unit    = 'Price unit is required';
    if (!form.base_price)     errs.base_price    = 'Base price is required';
    if (!form.selling_price)  errs.selling_price = 'Selling price is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

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
    } catch (err: any) {
      const data = err?.data ?? {};
      if (typeof data === 'object' && !Array.isArray(data)) {
        const fieldErrs: Record<string, string> = {};
        for (const [key, val] of Object.entries(data)) {
          fieldErrs[key] = Array.isArray(val) ? (val as string[]).join(' ') : String(val);
        }
        if (Object.keys(fieldErrs).length) { setErrors(fieldErrs); return; }
      }
      toast.error(
        (Object.values(data) as string[][]).flat().join(', ') || 'Failed to save dish',
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-8">

      {/* ── 1. Dish Type ─────────────────────────────────────────────────── */}
      <section className='max-w-7xl'>
        <SectionTitle>Dish Type</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {DISH_TYPES.map(({ value, label, Icon, desc }) => {
            const active = form.dish_type === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => set('dish_type', value)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all"
                style={{
                  borderColor:     active ? '#D95F0E' : '#E2E8F0',
                  backgroundColor: active ? '#FFF7F0' : '#FAFAFA',
                }}
              >
                <Icon size={22} style={{ color: active ? '#D95F0E' : '#94A3B8' }} />
                <span
                  className="text-xs font-semibold"
                  style={{ color: active ? '#D95F0E' : '#374151' }}
                >
                  {label}
                </span>
                <span className="text-[10px] leading-tight" style={{ color: '#94A3B8' }}>
                  {desc}
                </span>
              </button>
            );
          })}
        </div>
        <FieldError msg={errors.dish_type} />
      </section>

      {/* ── 2. Basic Information ─────────────────────────────────────────── */}
      <section>
        <SectionTitle>Basic Information</SectionTitle>
        <div className="space-y-4">

          {/* Dish Name */}
          <div>
            <label className={lbl}>
              Dish Name <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              className={inp}
              style={errors.name ? ist_err : ist}
              placeholder="e.g. Chicken Biryani"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
            <FieldError msg={errors.name} />
          </div>

          {/* Category + Unit Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>
                Category <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                className={inp}
                style={errors.category ? ist_err : ist}
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                <option value="">Select category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <FieldError msg={errors.category} />
            </div>

            <div>
              <label className={lbl}>
                Unit Type <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                className={inp}
                style={errors.unit_type ? ist_err : ist}
                value={form.unit_type}
                onChange={e => set('unit_type', e.target.value)}
              >
                <option value="">Select unit type</option>
                {UNIT_TYPES.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
              <FieldError msg={errors.unit_type} />
            </div>
          </div>

          {/* Veg/Non-Veg */}
          <div className="grid grid-cols-2 gap-3">
            <div /> {/* spacer */}
            <div>
              <label className={lbl}>Veg / Non-Veg</label>
              <div className="flex gap-4 mt-2.5">
                {[
                  { value: 'veg',     label: 'Veg',     color: '#16A34A' },
                  { value: 'non_veg', label: 'Non-Veg', color: '#DC2626' },
                ].map(opt => {
                  const checked = form.veg_non_veg === opt.value;
                  return (
                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="veg_non_veg"
                        value={opt.value}
                        checked={checked}
                        onChange={() => set('veg_non_veg', opt.value)}
                        style={{ accentColor: opt.color }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: checked ? opt.color : '#64748B' }}
                      >
                        {opt.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>
              Description{' '}
              <span className="font-normal" style={{ color: '#94A3B8' }}>(optional)</span>
            </label>
            <textarea
              className={inp}
              style={{ ...ist, resize: 'none' }}
              rows={3}
              placeholder="Brief description of the dish..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── 3. Pricing ───────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Pricing</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>
              Price Unit <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              className={inp}
              style={errors.price_unit ? ist_err : ist}
              value={form.price_unit}
              onChange={e => set('price_unit', e.target.value)}
            >
              {PRICE_UNITS.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            <FieldError msg={errors.price_unit} />
          </div>

          <div>
            <label className={lbl}>
              Base Price (₹) <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inp}
              style={errors.base_price ? ist_err : ist}
              placeholder="0.00"
              value={form.base_price}
              onChange={e => set('base_price', e.target.value)}
            />
            <FieldError msg={errors.base_price} />
          </div>

          <div>
            <label className={lbl}>
              Selling Price (₹) <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inp}
              style={errors.selling_price ? ist_err : ist}
              placeholder="0.00"
              value={form.selling_price}
              onChange={e => set('selling_price', e.target.value)}
            />
            <FieldError msg={errors.selling_price} />
          </div>
        </div>
      </section>

      {/* ── 4. Ingredients ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>
            Ingredients{' '}
            <span className="font-normal text-xs" style={{ color: '#94A3B8' }}>(optional)</span>
          </h3>
          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              color: '#D95F0E',
              backgroundColor: '#FFF7F0',
              border: '1px solid #FDBA74',
            }}
          >
            <Plus size={13} />
            Add Ingredient
          </button>
        </div>

        {form.ingredients.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-8 rounded-xl text-center"
            style={{ border: '1.5px dashed #E2E8F0', backgroundColor: '#FAFAFA' }}
          >
            <p className="text-xs" style={{ color: '#94A3B8' }}>No ingredients added yet.</p>
            <p className="text-xs mt-0.5" style={{ color: '#CBD5E1' }}>
              Click "Add Ingredient" to start building the ingredient list.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Column headers */}
            <div
              className="grid gap-2 px-1"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 32px' }}
            >
              {['Ingredient Name', 'Quantity', 'Unit', '₹ / Unit', ''].map((h, i) => (
                <span
                  key={i}
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: '#94A3B8' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Ingredient rows */}
            {form.ingredients.map((row, idx) => (
              <div
                key={idx}
                className="grid gap-2 items-center"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 32px' }}
              >
                <input
                  className={inp}
                  style={ist}
                  placeholder="e.g. Chicken"
                  value={row.ingredient_name}
                  onChange={e => setIngredient(idx, 'ingredient_name', e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inp}
                  style={ist}
                  placeholder="0"
                  value={row.quantity}
                  onChange={e => setIngredient(idx, 'quantity', e.target.value)}
                />
                <select
                  className={inp}
                  style={ist}
                  value={row.unit}
                  onChange={e => setIngredient(idx, 'unit', e.target.value)}
                >
                  {UNIT_OPTIONS.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inp}
                  style={ist}
                  placeholder="0.00"
                  value={row.price_per_unit}
                  onChange={e => setIngredient(idx, 'price_per_unit', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(idx)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-red-50"
                  title="Remove row"
                >
                  <Trash2 size={14} style={{ color: '#F87171' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Labour Cost + Cost Preview ────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 items-start">

        {/* Labour Cost */}
        <div>
          <label className={lbl}>
            Labour Cost (₹){' '}
            <span className="font-normal" style={{ color: '#94A3B8' }}>(optional)</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inp}
            style={ist}
            placeholder="0.00"
            value={form.labour_cost}
            onChange={e => set('labour_cost', e.target.value)}
          />
        </div>

        {/* Cost Preview */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #BBF7D0' }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: '#15803D' }}>
            Cost Preview
          </p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span style={{ color: '#374151' }}>Ingredient Cost</span>
              <span className="font-medium tabular-nums" style={{ color: '#0F172A' }}>
                ₹{ingredientCost.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#374151' }}>Labour Cost</span>
              <span className="font-medium tabular-nums" style={{ color: '#0F172A' }}>
                ₹{labourCost.toFixed(2)}
              </span>
            </div>
            <div
              className="flex justify-between pt-2 mt-1 font-semibold"
              style={{ borderTop: '1px solid #BBF7D0' }}
            >
              <span style={{ color: '#15803D' }}>Est. Cost / Serving</span>
              <span className="tabular-nums" style={{ color: '#15803D' }}>
                ₹{estimatedCost.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Image URL ─────────────────────────────────────────────────── */}
      <section>
        <label className={lbl}>
          Image URL{' '}
          <span className="font-normal" style={{ color: '#94A3B8' }}>(optional)</span>
        </label>
        <input
          type="url"
          className={inp}
          style={ist}
          placeholder="https://example.com/dish-image.jpg"
          value={form.image_url}
          onChange={e => set('image_url', e.target.value)}
        />
      </section>

      {/* ── Footer: Actions ──────────────────────────────────────────────── */}
      <div
        className="flex justify-end gap-3 pt-4"
        style={{ borderTop: '1px solid #F1F5F9' }}
      >
        <button
          type="button"
          onClick={() => onCancel ? onCancel() : router.push(listPath)}
          disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{ border: '1.5px solid #E2E8F0', color: '#475569', backgroundColor: '#fff' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: '#D95F0E' }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Dish'}
        </button>
      </div>
    </div>
  );
}
