'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export interface EditableDish {
  id: string;
  name: string;
  dish_type: string;
  veg_non_veg: string;
  serving_unit: string;
  category: string;
  base_price: string | number;
  selling_price: string | number;
  labour_cost: string | number;
  description: string;
  image_url: string;
  is_active: boolean;
}

interface Props {
  dish: EditableDish;
  open: boolean;
  onClose: () => void;
}

interface DishCategory { id: string; name: string; }

const SERVING_UNITS = ['PLATE', 'KG', 'PIECE', 'LITRE', 'PORTION'] as const;

const DISH_TYPES = [
  { value: 'recipe',       label: 'Recipe' },
  { value: 'live_counter', label: 'Live Counter' },
  { value: 'fixed_price',  label: 'Fixed Price' },
] as const;

const VEG_OPTIONS = [
  { value: 'veg',     label: 'Veg' },
  { value: 'non_veg', label: 'Non-Veg' },
] as const;

type FormState = {
  name: string;
  dish_type: string;
  veg_non_veg: string;
  serving_unit: string;
  category: string;
  base_price: string;
  selling_price: string;
  labour_cost: string;
  description: string;
  image_url: string;
  is_active: boolean;
};

function dishToForm(dish: EditableDish): FormState {
  return {
    name:          dish.name,
    dish_type:     dish.dish_type,
    veg_non_veg:   dish.veg_non_veg,
    serving_unit:  dish.serving_unit,
    category:      dish.category,
    base_price:    String(dish.base_price ?? ''),
    selling_price: String(dish.selling_price ?? ''),
    labour_cost:   String(dish.labour_cost ?? '0'),
    description:   dish.description ?? '',
    image_url:     dish.image_url ?? '',
    is_active:     dish.is_active,
  };
}

export default function EditDishModal({ dish, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm]     = useState<FormState>(() => dishToForm(dish));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    setCategoriesLoading(true);
    api.get('/master/dish-categories/')
      .then((data: unknown) => {
        console.log('[EditDishModal] dish-categories response:', data);
        // Backend returns plain array (pagination_class = None on DishCategoryViewSet)
        const list = Array.isArray(data) ? (data as DishCategory[]) : [];
        setCategories(list);
      })
      .catch(() => { toast.error('Failed to load categories'); })
      .finally(() => setCategoriesLoading(false));
  }, []);

  const [lastDishId, setLastDishId] = useState(dish.id);
  if (dish.id !== lastDishId) {
    setForm(dishToForm(dish));
    setLastDishId(dish.id);
    setError(null);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/master/dishes/${dish.id}/`, {
        name:          form.name,
        dish_type:     form.dish_type,
        veg_non_veg:   form.veg_non_veg,
        serving_unit:  form.serving_unit,
        category:      form.category,
        base_price:    form.base_price,
        selling_price: form.selling_price,
        labour_cost:   form.labour_cost || '0',
        description:   form.description,
        image_url:     form.image_url,
        is_active:     form.is_active,
      });
      await queryClient.invalidateQueries({ queryKey: ['dish', dish.id] });
      toast.success('Dish updated');
      onClose();
    } catch (err: unknown) {
      const errObj = err as { data?: Record<string, unknown> };
      const data   = errObj?.data ?? {};
      const msg    =
        (data.detail as string) ||
        Object.values(data).flat().join(', ') ||
        'Failed to update dish';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Dish</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          {/* Dish type */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">Dish Type</p>
            <div className="flex gap-3">
              {DISH_TYPES.map(opt => (
                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dish_type"
                    value={opt.value}
                    checked={form.dish_type === opt.value}
                    onChange={() => set('dish_type', opt.value)}
                    className="accent-gray-800"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Veg / Non-Veg */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">Veg / Non-Veg</p>
            <div className="flex gap-4">
              {VEG_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="veg_non_veg"
                    value={opt.value}
                    checked={form.veg_non_veg === opt.value}
                    onChange={() => set('veg_non_veg', opt.value)}
                    className="accent-gray-800"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Serving unit + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Serving Unit</label>
              <select
                value={form.serving_unit}
                onChange={e => set('serving_unit', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                {SERVING_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="">{categoriesLoading ? 'Loading…' : 'Select category'}</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Base Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.base_price}
                onChange={e => set('base_price', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Selling Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.selling_price}
                onChange={e => set('selling_price', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Labour Cost</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.labour_cost}
                onChange={e => set('labour_cost', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Image URL</label>
            <input
              type="url"
              value={form.image_url}
              onChange={e => set('image_url', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Active</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_active}
              onClick={() => set('is_active', !form.is_active)}
              className={[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                form.is_active ? 'bg-gray-800' : 'bg-gray-300',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                  form.is_active ? 'translate-x-4.5' : 'translate-x-0.5',
                ].join(' ')}
              />
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
