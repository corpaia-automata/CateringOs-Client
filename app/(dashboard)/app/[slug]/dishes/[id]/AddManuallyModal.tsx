'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Recipe, RecipeLine } from '@/types/dish';

const UNIT_OPTIONS = ['kg', 'g', 'litre', 'ml', 'piece', 'nos', 'dozen', 'packet', 'box'] as const;

interface WorkingLine {
  id?: string;
  ingredient: string;
  ingredient_name: string;
  qty_per_unit: number | string;
  unit: string;
}

interface IngredientResult {
  id: string;
  name: string;
  unit_of_measure: string;
  category: string;
}

interface Props {
  dishId: string;
  initialRecipe: Recipe;
  onClose: () => void;
  onSaved: () => void;
}

function toWorking(lines: RecipeLine[]): WorkingLine[] {
  return lines.map(l => ({
    id: l.id,
    ingredient: l.ingredient,
    ingredient_name: l.ingredient_name,
    qty_per_unit: l.qty_per_unit,
    unit: l.unit,
  }));
}

export default function AddManuallyModal({ dishId, initialRecipe, onClose, onSaved }: Props) {
  const qc = useQueryClient();

  const [lines, setLines]   = useState<WorkingLine[]>(() => toWorking(initialRecipe.lines));
  const [saving, setSaving] = useState(false);

  // Add-ingredient fields
  const [search, setSearch]       = useState('');
  const [results, setResults]     = useState<IngredientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected]   = useState<IngredientResult | null>(null);
  const [addQty, setAddQty]       = useState('');
  const [addUnit, setAddUnit]     = useState('kg');
  const [showDrop, setShowDrop]   = useState(false);

  const dropRef   = useRef<HTMLDivElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setShowDrop(false); return; }
    setSearching(true);
    api.get(`/master/ingredients/?search=${encodeURIComponent(q)}&is_active=true`)
      .then(data => {
        const r: IngredientResult[] = data?.results ?? data ?? [];
        setResults(r);
        setShowDrop(r.length > 0);
      })
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, []);

  function handleSearchChange(v: string) {
    setSearch(v);
    setSelected(null);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(v), 300);
  }

  function pick(ing: IngredientResult) {
    setSelected(ing);
    setSearch(ing.name);
    setAddUnit(ing.unit_of_measure || 'kg');
    setShowDrop(false);
  }

  function addLine() {
    if (!selected || !addQty) return;
    if (lines.some(l => l.ingredient === selected.id)) {
      toast.error(`${selected.name} is already in the recipe`);
      return;
    }
    setLines(prev => [...prev, {
      ingredient:      selected.id,
      ingredient_name: selected.name,
      qty_per_unit:    addQty,
      unit:            addUnit,
    }]);
    setSearch(''); setSelected(null); setAddQty(''); setAddUnit('kg'); setResults([]);
  }

  function updateLine(i: number, key: 'qty_per_unit' | 'unit', value: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: value } : l));
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/master/dishes/${dishId}/recipe/`, {
        batch_size: initialRecipe.batch_size,
        batch_unit: initialRecipe.batch_unit,
        lines: lines.map(l => ({
          ingredient:   l.ingredient,
          qty_per_unit: +l.qty_per_unit,
          unit:         l.unit,
        })),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['recipe', dishId] }),
        qc.invalidateQueries({ queryKey: ['dish',   dishId] }),
      ]);
      toast.success('Recipe saved');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const raw = (err as { data?: unknown })?.data;
      let msg = '';
      if (Array.isArray(raw)) {
        msg = raw
          .flatMap((item: unknown) => Object.values((item as Record<string, unknown>) ?? {}))
          .flat().filter(Boolean).join(', ');
      } else if (raw && typeof raw === 'object') {
        msg = Object.values(raw as Record<string, unknown>).flat().filter(Boolean).join(', ');
      }
      toast.error(msg || 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Ingredients</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1 mt-3">

          {/* ── Add row ── */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-amber-600 mb-3">
              Add Ingredient
            </h3>
            <div className="flex gap-2 items-start">
              <div className="relative flex-1" ref={dropRef}>
                <input
                  type="text"
                  placeholder="Search ingredient…"
                  value={search}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => results.length > 0 && setShowDrop(true)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                {showDrop && (
                  <ul className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searching ? (
                      <li className="px-3 py-2 text-xs text-gray-400">Searching…</li>
                    ) : (
                      results.map(ing => (
                        <li
                          key={ing.id}
                          onMouseDown={() => pick(ing)}
                          className="px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 cursor-pointer flex justify-between"
                        >
                          <span>{ing.name}</span>
                          <span className="text-xs text-gray-400">{ing.unit_of_measure}</span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              <input
                type="number"
                step="0.0001"
                min="0.0001"
                placeholder="Qty"
                value={addQty}
                onChange={e => setAddQty(e.target.value)}
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />

              <select
                value={addUnit}
                onChange={e => setAddUnit(e.target.value)}
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>

              <button
                type="button"
                onClick={addLine}
                disabled={!selected || !addQty}
                className="px-4 py-2 rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          {/* ── Recipe lines ── */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-amber-600 mb-3">
              Recipe Lines
            </h3>

            {lines.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No ingredients added yet</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left">
                      Ingredient
                    </th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-32">
                      Quantity
                    </th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-28">
                      Unit
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr
                      key={line.id ?? `${line.ingredient}-${i}`}
                      className={i !== 0 ? 'border-t border-gray-100' : ''}
                    >
                      <td className="py-2 pr-3 text-sm font-medium text-gray-800">
                        {line.ingredient_name}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          value={line.qty_per_unit}
                          onChange={e => updateLine(i, 'qty_per_unit', e.target.value)}
                          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={line.unit}
                          onChange={e => updateLine(i, 'unit', e.target.value)}
                          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                        >
                          {UNIT_OPTIONS.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          aria-label="Remove ingredient"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Recipe'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
