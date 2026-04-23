'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WorkingLine {
  id?: string;
  ingredient: string;
  ingredient_name: string;
  qty_per_unit: number | string;
  unit: string;
  ingredient_category: string;
  unit_cost_snapshot: number;
}

export interface Recipe {
  batch_size: number | string;
  batch_unit: string;
  lines: WorkingLine[];
}

interface IngredientResult {
  id: string;
  name: string;
  unit_of_measure: string;
  category: string;
}

interface BulkRow {
  raw_name: string;
  qty: string;
  unit: string;
  matched: IngredientResult | null;
  status: 'ready' | 'not_found' | 'resolving';
}

interface Props {
  dishId: string;
  initialRecipe: Recipe;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = 'manual' | 'bulk';

const UNIT_OPTIONS = ['kg', 'g', 'litre', 'ml', 'piece', 'nos', 'dozen', 'packet', 'box'] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcTotal(lines: WorkingLine[]): number {
  return lines.reduce((sum, l) => {
    const qty  = parseFloat(String(l.qty_per_unit)) || 0;
    const cost = l.unit_cost_snapshot || 0;
    return sum + qty * cost;
  }, 0);
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '_');
}

function closestUnit(raw: string): string {
  const v = (raw ?? '').toString().trim().toLowerCase();
  return (UNIT_OPTIONS as readonly string[]).includes(v) ? v : 'kg';
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ManageRecipeModal({ dishId, initialRecipe, onClose, onSaved }: Props) {
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [lines, setLines]   = useState<WorkingLine[]>(initialRecipe.lines);
  const [saving, setSaving] = useState(false);

  // ── Manual tab: add-new state ──
  const [searchQuery, setSearchQuery]               = useState('');
  const [searchResults, setSearchResults]           = useState<IngredientResult[]>([]);
  const [searchLoading, setSearchLoading]           = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientResult | null>(null);
  const [addQty, setAddQty]   = useState('');
  const [addUnit, setAddUnit] = useState('kg');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Bulk tab state ──
  const [bulkRows, setBulkRows]         = useState<BulkRow[]>([]);
  const [bulkParsing, setBulkParsing]   = useState(false);
  const [bulkResolving, setBulkResolving] = useState(false);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Debounced ingredient search (manual tab) ──
  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    setSearchLoading(true);
    api.get(`/master/ingredients/?search=${encodeURIComponent(q)}&is_active=true`)
      .then((data) => {
        const results: IngredientResult[] = data?.results ?? data ?? [];
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      })
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, []);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setSelectedIngredient(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 300);
  }

  function pickIngredient(ing: IngredientResult) {
    setSelectedIngredient(ing);
    setSearchQuery(ing.name);
    setAddUnit(ing.unit_of_measure || 'kg');
    setShowDropdown(false);
  }

  function handleAddLine() {
    if (!selectedIngredient || !addQty) return;
    if (lines.some(l => l.ingredient === selectedIngredient.id)) {
      toast.error(`${selectedIngredient.name} is already in the recipe`);
      return;
    }
    setLines(prev => [...prev, {
      ingredient:          selectedIngredient.id,
      ingredient_name:     selectedIngredient.name,
      qty_per_unit:        addQty,
      unit:                addUnit,
      ingredient_category: selectedIngredient.category,
      unit_cost_snapshot:  0,
    }]);
    setSearchQuery(''); setSelectedIngredient(null);
    setAddQty(''); setAddUnit('kg'); setSearchResults([]);
  }

  function updateLine(index: number, key: 'qty_per_unit' | 'unit', value: string) {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [key]: value } : l));
  }

  function removeLine(index: number) {
    setLines(prev => prev.filter((_, i) => i !== index));
  }

  // ── Bulk: parse file ──────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset so same file can be re-selected
    e.target.value = '';

    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Only .xlsx, .xls or .csv files accepted');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large — max 5 MB');
      return;
    }

    setBulkParsing(true);
    setBulkRows([]);
    try {
      const XLSX = await import('xlsx');
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

      if (raw.length < 2) { toast.error('File is empty or has no data rows'); return; }

      const headerRow = (raw[0] as string[]).map(normalizeHeader);
      const nameIdx = headerRow.findIndex(h => h === 'ingredient_name' || h === 'name' || h === 'ingredient');
      const qtyIdx  = headerRow.findIndex(h => h === 'quantity' || h === 'qty');
      const unitIdx = headerRow.findIndex(h => h === 'unit');

      if (nameIdx === -1 || qtyIdx === -1) {
        toast.error('Missing required columns: ingredient_name, quantity');
        return;
      }

      const parsed: BulkRow[] = raw.slice(1)
        .filter(row => String((row as string[])[nameIdx] ?? '').trim())
        .map(row => ({
          raw_name: String((row as string[])[nameIdx]).trim(),
          qty:      String((row as string[])[qtyIdx] ?? '').trim(),
          unit:     unitIdx !== -1 ? closestUnit(String((row as string[])[unitIdx])) : 'kg',
          matched:  null,
          status:   'resolving' as const,
        }));

      setBulkRows(parsed);
      await resolveIngredients(parsed);
    } catch {
      toast.error('Failed to parse file');
    } finally {
      setBulkParsing(false);
    }
  }

  async function resolveIngredients(rows: BulkRow[]) {
    setBulkResolving(true);
    const resolved = [...rows];

    for (let i = 0; i < resolved.length; i++) {
      const name = resolved[i].raw_name;
      try {
        const data = await api.get(
          `/master/ingredients/?search=${encodeURIComponent(name)}&is_active=true`
        );
        const results: IngredientResult[] = data?.results ?? data ?? [];
        const match = results.find(
          r => r.name.toLowerCase() === name.toLowerCase()
        ) ?? results[0] ?? null;

        resolved[i] = { ...resolved[i], matched: match, status: match ? 'ready' : 'not_found' };
      } catch {
        resolved[i] = { ...resolved[i], matched: null, status: 'not_found' };
      }
      // update progressively so user sees rows resolving
      setBulkRows([...resolved]);
    }
    setBulkResolving(false);
  }

  function bulkToWorkingLines(rows: BulkRow[]): WorkingLine[] {
    return rows
      .filter(r => r.status === 'ready' && r.matched)
      .map(r => ({
        ingredient:          r.matched!.id,
        ingredient_name:     r.matched!.name,
        qty_per_unit:        r.qty,
        unit:                r.unit,
        ingredient_category: r.matched!.category,
        unit_cost_snapshot:  0,
      }));
  }

  function handleAppend() {
    const newLines = bulkToWorkingLines(bulkRows);
    if (newLines.length === 0) { toast.error('No valid rows to append'); return; }
    setLines(prev => {
      const existingIds = new Set(prev.map(l => l.ingredient));
      const unique = newLines.filter(l => !existingIds.has(l.ingredient));
      const skipped = newLines.length - unique.length;
      if (skipped > 0) toast(`Skipped ${skipped} duplicate${skipped > 1 ? 's' : ''}`, { icon: 'ℹ️' });
      toast.success(`${unique.length} ingredient${unique.length !== 1 ? 's' : ''} added to draft`);
      return [...prev, ...unique];
    });
    setActiveTab('manual');
  }

  function handleReplaceAll() {
    const newLines = bulkToWorkingLines(bulkRows);
    if (newLines.length === 0) { toast.error('No valid rows to apply'); return; }
    setLines(newLines);
    toast.success(`Replaced recipe with ${newLines.length} ingredient${newLines.length !== 1 ? 's' : ''}`);
    setActiveTab('manual');
  }

  // ── Save ──────────────────────────────────────────────────────────────────

async function handleSave() {
  setSaving(true);
  try {
    const lines_payload = lines
      .filter(l => l.ingredient && Number(l.qty_per_unit) > 0)
      .map(l => ({
        ingredient: l.ingredient,
        qty_per_unit: Number(l.qty_per_unit),
        unit: l.unit || 'KG',
      }));

    if (lines_payload.length === 0) {
      toast.error("Add at least one valid ingredient with quantity > 0");
      setSaving(false);
      return;
    }

    await api.put(`/master/dishes/${dishId}/recipe/`, {
      batch_size: initialRecipe.batch_size,
      batch_unit: initialRecipe.batch_unit,
      lines: lines_payload,
    });

    await Promise.all([
      qc.invalidateQueries({ queryKey: ['recipe', dishId] }),
      qc.invalidateQueries({ queryKey: ['dish', dishId] }),
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

  const runningTotal = calcTotal(lines);
  const validBulkCount = bulkRows.filter(r => r.status === 'ready').length;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Manage Recipe</DialogTitle>
        </DialogHeader>

        {/* ── Tab bar ── */}
        <div className="flex gap-0 border-b border-gray-200 mt-1">
          {(['manual', 'bulk'] as Tab[]).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab === 'manual' ? 'Manual edit' : 'Bulk upload'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto mt-4 pr-1">

          {/* ═══════════════════════════════════════════════════════════════
              MANUAL TAB
          ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'manual' && (
            <div className="space-y-6">

              {/* SECTION A: existing lines */}
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-amber-600 mb-3">
                  Recipe Lines
                </h3>

                {lines.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No ingredients added yet</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left">Ingredient</th>
                        <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-32">Qty / unit</th>
                        <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-28">Unit</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => (
                        <tr key={line.id ?? `${line.ingredient}-${i}`} className={i !== 0 ? 'border-t border-gray-100' : ''}>
                          <td className="py-2 pr-3 text-sm font-medium text-gray-800">{line.ingredient_name}</td>
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

                <div className="mt-3 text-right text-sm text-gray-500">
                  Est. cost:{' '}
                  <span className="font-semibold text-gray-800">₹{runningTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* SECTION B: add ingredient */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-amber-600 mb-3">
                  Add Ingredient
                </h3>
                <div className="flex gap-2 items-start">
                  <div className="relative flex-1" ref={dropdownRef}>
                    <input
                      type="text"
                      placeholder="Search ingredient…"
                      value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                    {showDropdown && (
                      <ul className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {searchLoading ? (
                          <li className="px-3 py-2 text-xs text-gray-400">Searching…</li>
                        ) : (
                          searchResults.map(ing => (
                            <li
                              key={ing.id}
                              onMouseDown={() => pickIngredient(ing)}
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
                    onClick={handleAddLine}
                    disabled={!selectedIngredient || !addQty}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              BULK UPLOAD TAB
          ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'bulk' && (
            <div className="space-y-5">

              {/* Drop zone / file picker */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <UploadCloud size={28} className="text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  {bulkParsing ? 'Parsing file…' : 'Click to upload .xlsx or .csv'}
                </p>
                <p className="text-xs text-gray-400">
                  Required columns: <span className="font-mono">ingredient_name</span>,{' '}
                  <span className="font-mono">quantity</span>,{' '}
                  <span className="font-mono">unit</span>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Preview table */}
              {bulkRows.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-amber-600">
                      Preview — {bulkRows.length} row{bulkRows.length !== 1 ? 's' : ''}
                    </h3>
                    {bulkResolving && (
                      <span className="text-xs text-gray-400">Resolving ingredients…</span>
                    )}
                  </div>

                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left">Ingredient</th>
                        <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-20">Qty</th>
                        <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-20">Unit</th>
                        <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, i) => (
                        <tr key={i} className={i !== 0 ? 'border-t border-gray-100' : ''}>
                          <td className="py-2 pr-3 text-sm text-gray-800">
                            {row.matched ? row.matched.name : row.raw_name}
                            {row.matched && row.matched.name.toLowerCase() !== row.raw_name.toLowerCase() && (
                              <span className="ml-1 text-xs text-gray-400">({row.raw_name})</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-sm text-gray-600">{row.qty}</td>
                          <td className="py-2 pr-3 text-sm text-gray-500">{row.unit}</td>
                          <td className="py-2">
                            {row.status === 'resolving' && (
                              <span className="inline-flex items-center rounded-full border border-gray-200 text-xs px-3 py-0.5 text-gray-400">
                                …
                              </span>
                            )}
                            {row.status === 'ready' && (
                              <span className="inline-flex items-center rounded-full border border-green-500 bg-green-50 text-xs px-3 py-0.5 font-medium text-green-600">
                                Ready
                              </span>
                            )}
                            {row.status === 'not_found' && (
                              <span className="inline-flex items-center rounded-full border border-red-400 bg-red-50 text-xs px-3 py-0.5 font-medium text-red-500">
                                Not found
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Apply buttons */}
                  <div className="flex gap-2 mt-4 justify-end">
                    <button
                      type="button"
                      onClick={handleAppend}
                      disabled={bulkResolving || validBulkCount === 0}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                      Append ({validBulkCount})
                    </button>
                    <button
                      type="button"
                      onClick={handleReplaceAll}
                      disabled={bulkResolving || validBulkCount === 0}
                      className="px-4 py-2 rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-40"
                    >
                      Replace all ({validBulkCount})
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
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
            {saving ? 'Saving…' : 'Save recipe'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
