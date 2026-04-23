'use client';

import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Utensils, X, UploadCloud, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { Recipe, RecipeLine } from '@/types/dish';

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkingLine {
  _key?:               string;
  id?:                 string;
  ingredient:          string;
  ingredient_name:     string;
  ingredient_category: string;
  qty_per_unit:        number | string;
  unit:                string;
  rate:                number | string;
}

interface IngredientResult {
  id:              string;
  name:            string;
  unit_of_measure: string;
  category:        string;
  unit_cost:       number;
}

interface BulkRow {
  raw_name:  string;
  fileCategory?: string;
  qty:       string;
  unit:      string;
  fileRate?: number;
  matched:   IngredientResult | null;
  status:    'ready' | 'not_found' | 'resolving';
}

type Tab = 'manual' | 'excel';

// ── Constants ──────────────────────────────────────────────────────────────────

const BATCH_UNIT_OPTIONS = ['KG', 'G', 'LITRE', 'ML', 'PIECE', 'PACKET', 'BOX', 'DOZEN'];
const LINE_UNIT_OPTIONS  = ['KG', 'G', 'LITRE', 'ML', 'PIECE', 'NOS', 'DOZEN', 'PACKET', 'BOX'];

const CATEGORY_COLORS: Record<string, string> = {
  GROCERY:    'bg-amber-50  text-amber-700',
  VEGETABLE:  'bg-green-50  text-green-700',
  FRUIT:      'bg-orange-50 text-orange-700',
  CHICKEN:    'bg-yellow-50 text-yellow-700',
  BEEF:       'bg-red-50    text-red-700',
  MUTTON:     'bg-red-50    text-red-700',
  FISH:       'bg-blue-50   text-blue-700',
  MEAT:       'bg-red-50    text-red-700',
  DISPOSABLE: 'bg-blue-50   text-blue-700',
  RENTAL:     'bg-purple-50 text-purple-700',
  OTHER:      'bg-gray-50   text-gray-600',
};

// Matches Ingredient.Category TextChoices on the backend
const INGREDIENT_CATEGORIES = Object.keys(CATEGORY_COLORS);
const CATEGORY_ORDER = ['GROCERY', 'DISPOSABLE', 'VEGETABLE', 'FRUIT', 'RENTAL', 'CHICKEN', 'BEEF', 'MUTTON', 'FISH', 'OTHER'];
const CATEGORY_RANK = new Map(CATEGORY_ORDER.map((category, index) => [category, index]));
const CATEGORY_LABELS: Record<string, string> = {
  GROCERY: 'GROCERY',
  DISPOSABLE: 'DISPOSABLE',
  VEGETABLE: 'VEG.',
  FRUIT: 'FRUITS',
  RENTAL: 'RENTALS',
  CHICKEN: 'CHICKEN',
  BEEF: 'BEEF',
  MUTTON: 'MUTTON',
  FISH: 'FISH',
  OTHER: 'OTHERS',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function toWorkingLine(l: RecipeLine): WorkingLine {
  return {
    id:                  l.id,
    ingredient:          l.ingredient,
    ingredient_name:     l.ingredient_name,
    ingredient_category: l.ingredient_category,
    qty_per_unit:        l.qty_per_unit,
    unit:                (l.unit ?? 'KG').toUpperCase(),
    rate:                l.unit_cost_snapshot,
  };
}

function lineAmount(l: WorkingLine): number {
  return (parseFloat(String(l.qty_per_unit)) || 0) * (parseFloat(String(l.rate)) || 0);
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '_');
}

function closestUnit(raw: string): string {
  const v = (raw ?? '').toString().trim().toUpperCase();
  return LINE_UNIT_OPTIONS.includes(v) ? v : 'KG';
}

function normalizeIngredientCategory(raw: string): string | undefined {
  const value = (raw ?? '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[.\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const aliases: Record<string, string> = {
    GROCERY: 'GROCERY',
    DISPOSABLE: 'DISPOSABLE',
    VEG: 'VEGETABLE',
    VEGETABLE: 'VEGETABLE',
    FRUIT: 'FRUIT',
    FRUITS: 'FRUIT',
    RENTAL: 'RENTAL',
    RENTALS: 'RENTAL',
    CHICKEN: 'CHICKEN',
    BEEF: 'BEEF',
    MUTTON: 'MUTTON',
    FISH: 'FISH',
    OTHER: 'OTHER',
    OTHERS: 'OTHER',
  };

  if (!value) return undefined;

  // Direct match first.
  const mapped = aliases[value] ?? value;
  if (INGREDIENT_CATEGORIES.includes(mapped)) return mapped;

  // Fuzzy/contains handling for noisy Excel values (e.g. "Veg Items", "Rental Items", "Disposable Plates").
  const compact = value.replace(/_/g, '');
  if (compact.startsWith('VEG')) return 'VEGETABLE';
  if (compact.startsWith('FRUIT')) return 'FRUIT';
  if (compact.startsWith('RENT')) return 'RENTAL';
  if (compact.startsWith('DISPOS')) return 'DISPOSABLE';
  if (compact.startsWith('CHICK')) return 'CHICKEN';
  if (compact.startsWith('MUTT')) return 'MUTTON';
  if (compact.startsWith('BEEF')) return 'BEEF';
  if (compact.startsWith('FISH')) return 'FISH';
  if (compact.startsWith('GROC')) return 'GROCERY';
  if (compact === 'OTHER' || compact === 'OTHERS') return 'OTHER';

  if (compact.includes('VEG')) return 'VEGETABLE';
  if (compact.includes('FRUIT')) return 'FRUIT';
  if (compact.includes('RENT')) return 'RENTAL';
  if (compact.includes('DISPOS')) return 'DISPOSABLE';
  if (compact.includes('CHICK')) return 'CHICKEN';
  if (compact.includes('MUTT')) return 'MUTTON';
  if (compact.includes('BEEF')) return 'BEEF';
  if (compact.includes('FISH')) return 'FISH';
  if (compact.includes('GROC')) return 'GROCERY';
  if (compact.includes('OTHER')) return 'OTHER';

  return INGREDIENT_CATEGORIES.includes(mapped) ? mapped : undefined;
}

function parseCellNumber(raw: unknown): number | undefined {
  const cleaned = String(raw ?? '').replace(/[,\s₹]/g, '');
  if (!cleaned) return undefined;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

function displayCategory(category?: string): string {
  const key = (category ?? '').toUpperCase();
  return CATEGORY_LABELS[key] || key || 'OTHER';
}

function formatQtyValue(value: number | string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function formatMoneyValue(value: number | string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const UOM_TO_MODEL: Record<string, string> = {
  KG: 'kg', G: 'g', LITRE: 'litre', ML: 'ml',
  PIECE: 'piece', NOS: 'piece', DOZEN: 'dozen', PACKET: 'packet', BOX: 'box',
};
function toModelUom(unit: string): string {
  return UOM_TO_MODEL[unit.toUpperCase()] ?? 'kg';
}

// ── IngredientTableRow ─────────────────────────────────────────────────────────

interface RowProps {
  line:                  WorkingLine;
  index:                 number;
  isFirst:               boolean;
  isEditMode:            boolean;
  occupiedIngredientIds: Set<string>;
  onPatch:               (index: number, patch: Partial<WorkingLine>) => void;
  onRemove:              (index: number) => void;
}

function IngredientTableRow({
  line, index, isFirst, isEditMode, occupiedIngredientIds, onPatch, onRemove,
}: RowProps) {
  const [query,    setQuery]    = useState(line.ingredient_name || '');
  const [results,  setResults]  = useState<IngredientResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const debRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropRef    = useRef<HTMLDivElement>(null);
  const justPicked = useRef(false);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val);
    if (debRef.current) clearTimeout(debRef.current);
    if (!val.trim()) {
      onPatch(index, { ingredient: '', ingredient_name: '', ingredient_category: '', rate: '' });
      setResults([]);
      setShowDrop(false);
      return;
    }
    debRef.current = setTimeout(() => {
      setLoading(true);
      api.get(`/master/ingredients/?search=${encodeURIComponent(val)}&is_active=true`)
        .then(data => {
          const r: IngredientResult[] = data?.results ?? data ?? [];
          setResults(r);
          setShowDrop(r.length > 0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
  }

  function handleBlur() {
    if (justPicked.current) { justPicked.current = false; return; }
    setQuery(line.ingredient_name || '');
    setShowDrop(false);
  }

  function pick(ing: IngredientResult) {
    if (occupiedIngredientIds.has(ing.id)) return;
    justPicked.current = true;
    setQuery(ing.name);
    setShowDrop(false);
    setResults([]);
    const unit = LINE_UNIT_OPTIONS.includes((ing.unit_of_measure ?? '').toUpperCase())
      ? (ing.unit_of_measure ?? '').toUpperCase()
      : line.unit;
    onPatch(index, {
      ingredient:          ing.id,
      ingredient_name:     ing.name,
      ingredient_category: ing.category,
      unit,
      rate:                ing.unit_cost,
    });
  }

  const catColor = CATEGORY_COLORS[line.ingredient_category?.toUpperCase()] ?? 'bg-gray-50 text-gray-600';
  const trClass  = !isFirst ? 'border-t border-gray-100' : '';

  // ── View mode: read-only text ──────────────────────────────────────────────
  if (!isEditMode) {
    return (
      <tr className={trClass}>
        <td className="py-2.5 pr-2">
          {line.ingredient_category ? (
            <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${catColor}`}>
              {displayCategory(line.ingredient_category)}
            </span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>
        <td className="py-2.5 pr-3 text-sm text-gray-800">{line.ingredient_name || '—'}</td>
        <td className="py-2.5 pr-2 text-sm text-gray-700 text-right tabular-nums">
          {formatQtyValue(line.qty_per_unit)}
        </td>
        <td className="py-2.5 pr-2 text-sm text-gray-500">{line.unit || '—'}</td>
        <td className="py-2.5 pr-2 text-sm text-gray-700 text-right tabular-nums">
          {formatMoneyValue(line.rate)}
        </td>
        <td className="py-2.5 text-sm font-medium text-gray-700 text-right tabular-nums">
          {line.ingredient ? formatMoneyValue(lineAmount(line)) : '—'}
        </td>
      </tr>
    );
  }

  // ── Edit mode: inputs ──────────────────────────────────────────────────────
  return (
    <tr className={trClass}>
      {/* Category dropdown */}
      <td className="py-2 pr-2">
        <select
          value={line.ingredient_category?.toUpperCase() || ''}
          onChange={e => onPatch(index, { ingredient_category: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <option value="">Category</option>
          {INGREDIENT_CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </td>
      {/* Ingredient search */}
      <td className="py-2 pr-3">
        <div className="relative" ref={dropRef}>
          <input
            type="text"
            placeholder="Search ingredient…"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            onBlur={handleBlur}
            className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          {showDrop && (
            <ul className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {loading ? (
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
      </td>
      {/* Qty */}
      <td className="py-2 pr-2">
        <input
          type="number"
          step="0.0001"
          min="0.0001"
          value={line.qty_per_unit || ''}
          onChange={e => {
            const val = e.target.value;
            if (val === '' || Number(val) > 0) onPatch(index, { qty_per_unit: val });
          }}
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </td>
      {/* Unit */}
      <td className="py-2 pr-2">
        <select
          value={line.unit}
          onChange={e => onPatch(index, { unit: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          {LINE_UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      {/* Rate */}
      <td className="py-2 pr-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={line.rate}
          onChange={e => onPatch(index, { rate: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </td>
      {/* Amount — always calculated, never editable */}
      <td className="py-2 pr-2 text-sm font-medium text-gray-700 text-right tabular-nums">
        {line.ingredient ? `₹${lineAmount(line).toFixed(2)}` : '—'}
      </td>
      {/* Delete */}
      <td className="py-2 text-right">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Remove ingredient"
        >
          <X size={14} />
        </button>
      </td>
    </tr>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  dishId:   string;
  dishName: string;
  recipe:   Recipe;
  slug:     string;
}

export default function IngredientsCard({ dishId, dishName, recipe }: Props) {
  const qc           = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSyncing    = useRef(false);
  const nextKey      = useRef(0);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [snapshot,   setSnapshot]   = useState<{
    lines: WorkingLine[]; batchSize: string; batchUnit: string;
  }>({ lines: [], batchSize: '', batchUnit: '' });

  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [batchSize, setBatchSize] = useState<string>(String(recipe.batch_size || 10));
  const [batchUnit, setBatchUnit] = useState<string>(recipe.batch_unit || 'KG');
  const [lines,     setLines]     = useState<WorkingLine[]>(recipe.lines.map(toWorkingLine));
  const [saving,    setSaving]    = useState(false);

  const isValid = lines.some(l => l.ingredient && Number(l.qty_per_unit) > 0);

  // Bulk upload state
  const [bulkRows,      setBulkRows]      = useState<BulkRow[]>([]);
  const [bulkParsing,   setBulkParsing]   = useState(false);
  const [bulkResolving, setBulkResolving] = useState(false);

  // Re-sync local state after a successful save (recipe prop updated by parent refetch)
  useEffect(() => {
    if (isSyncing.current) {
      isSyncing.current = false;
      setLines(recipe.lines.map(toWorkingLine));
      setBatchSize(String(recipe.batch_size || 1));
      setBatchUnit(recipe.batch_unit || 'KG');
    }
  }, [recipe]);

  // ── Edit mode control ──────────────────────────────────────────────────────

  function handleEditStart() {
    setSnapshot({
      lines:     lines.map(l => ({ ...l })),
      batchSize,
      batchUnit,
    });
    setIsEditMode(true);
  }

  function handleCancel() {
    setLines(snapshot.lines);
    setBatchSize(snapshot.batchSize);
    setBatchUnit(snapshot.batchUnit);
    setIsEditMode(false);
    setActiveTab('manual');
    setBulkRows([]);
  }

  // ── Line management ────────────────────────────────────────────────────────

  function patchLine(index: number, patch: Partial<WorkingLine>) {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, ...patch } : l));
  }

  function removeLine(index: number) {
    setLines(prev => prev.filter((_, i) => i !== index));
  }

  function handleAddRow() {
    setLines(prev => [...prev, {
      _key:                `draft-${nextKey.current++}`,
      ingredient:          '',
      ingredient_name:     '',
      ingredient_category: '',
      qty_per_unit:        '0',
      unit:                'KG',
      rate:                '',
    }]);
  }

  // ── Bulk upload ────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
      const nameIdx   = headerRow.findIndex(h =>
        ['particular_names', 'particular_name', 'particulars', 'particular',
         'ingredient_name', 'name', 'ingredient'].includes(h)
      );
      const qtyIdx    = headerRow.findIndex(h => ['quantity', 'qty'].includes(h));
      const catIdx    = headerRow.findIndex(h => ['category', 'cat', 'ingredient_category', 'item_category', 'ingredient_cat'].includes(h));
      const unitIdx   = headerRow.findIndex(h => h === 'unit');
      const rateIdx   = headerRow.findIndex(h => ['rate', 'unit_rate', 'price'].includes(h));
      const amtIdx    = headerRow.findIndex(h => ['amount', 'total', 'line_total', 'total_amount'].includes(h));

      if (nameIdx === -1 || qtyIdx === -1) {
        toast.error('Missing required columns: Particular Names, Quantity');
        return;
      }

      const parsed: BulkRow[] = (raw.slice(1) as string[][])
        .filter(row => String(row[nameIdx] ?? '').trim())
        .map(row => {
          const qtyRaw = String(row[qtyIdx] ?? '').trim();
          const qtyNum = parseCellNumber(qtyRaw);
          const rateNum = rateIdx !== -1 ? parseCellNumber(row[rateIdx]) : undefined;
          const amountNum = amtIdx !== -1 ? parseCellNumber(row[amtIdx]) : undefined;
          const derivedRate = rateNum !== undefined && rateNum >= 0
            ? rateNum
            : amountNum !== undefined && amountNum >= 0 && qtyNum !== undefined && qtyNum > 0
              ? amountNum / qtyNum
              : undefined;
          return {
            raw_name: String(row[nameIdx]).trim(),
            fileCategory: catIdx !== -1 ? normalizeIngredientCategory(String(row[catIdx] ?? '')) : undefined,
            qty: qtyRaw,
            unit: unitIdx !== -1 ? closestUnit(String(row[unitIdx])) : 'KG',
            fileRate: derivedRate,
            matched: null,
            status: 'resolving' as const,
          };
        });

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
        const data = await api.get(`/master/ingredients/?search=${encodeURIComponent(name)}&is_active=true`);
        const results: IngredientResult[] = data?.results ?? data ?? [];
        const match = results.find(r => r.name.toLowerCase() === name.toLowerCase()) ?? results[0] ?? null;

        if (match) {
          resolved[i] = { ...resolved[i], matched: match, status: 'ready' };
        } else {
          try {
            const created: IngredientResult = await api.post('/master/ingredients/', {
              name,
              category:        resolved[i].fileCategory ?? 'OTHER',
              unit_of_measure: toModelUom(resolved[i].unit),
              unit_cost:       0,
            });
            resolved[i] = { ...resolved[i], matched: created, status: 'ready' };
          } catch {
            try {
              const data2 = await api.get(`/master/ingredients/?search=${encodeURIComponent(name)}&is_active=true`);
              const results2: IngredientResult[] = data2?.results ?? data2 ?? [];
              const match2 = results2.find(r => r.name.toLowerCase() === name.toLowerCase()) ?? null;
              resolved[i] = { ...resolved[i], matched: match2, status: match2 ? 'ready' : 'not_found' };
            } catch {
              resolved[i] = { ...resolved[i], matched: null, status: 'not_found' };
            }
          }
        }
      } catch {
        resolved[i] = { ...resolved[i], matched: null, status: 'not_found' };
      }
      setBulkRows([...resolved]);
    }
    setBulkResolving(false);
  }

  function applyBulkRows(mode: 'append' | 'replace') {
    const newLines: WorkingLine[] = bulkRows
      .filter(r => r.status === 'ready' && r.matched)
      .map(r => ({
        ingredient:          r.matched!.id,
        ingredient_name:     r.matched!.name,
        ingredient_category: r.fileCategory ?? r.matched!.category,
        qty_per_unit:        r.qty,
        unit:                r.unit,
        rate:                r.fileRate !== undefined ? r.fileRate : r.matched!.unit_cost,
      }));

    if (newLines.length === 0) { toast.error('No valid rows to apply'); return; }

    if (mode === 'replace') {
      setLines(newLines);
      toast.success(`Replaced recipe with ${newLines.length} ingredient${newLines.length !== 1 ? 's' : ''}`);
    } else {
      setLines(prev => {
        const existingIds = new Set(prev.map(l => l.ingredient).filter(Boolean));
        const unique = newLines.filter(l => !existingIds.has(l.ingredient));
        toast.success(`${unique.length} ingredient${unique.length !== 1 ? 's' : ''} added`);
        return [...prev, ...unique];
      });
    }
    setActiveTab('manual');
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      // PATCH any ingredient categories/rates changed in the recipe editor.
      const origByIngredient = new Map(
        snapshot.lines
          .filter(l => l.ingredient)
          .map(l => [l.ingredient, {
            category: l.ingredient_category?.toUpperCase(),
            rate: Number.parseFloat(String(l.rate)),
          }])
      );
      const changedByIngredient = new Map<string, { category?: string; unit_cost?: number }>();
      for (const line of lines) {
        if (!line.ingredient) continue;
        const original = origByIngredient.get(line.ingredient);
        const nextCategory = line.ingredient_category?.toUpperCase();
        const nextRate = Number.parseFloat(String(line.rate));
        const nextPatch = changedByIngredient.get(line.ingredient) ?? {};

        if (nextCategory && original?.category !== nextCategory) {
          nextPatch.category = nextCategory;
        }
        if (Number.isFinite(nextRate) && nextRate >= 0) {
          if (!Number.isFinite(original?.rate) || Math.abs((original?.rate ?? 0) - nextRate) > 1e-9) {
            nextPatch.unit_cost = nextRate;
          }
        }
        if (Object.keys(nextPatch).length > 0) {
          changedByIngredient.set(line.ingredient, nextPatch);
        }
      }
      await Promise.allSettled(
        [...changedByIngredient.entries()].map(([ingredientId, patch]) =>
          api.patch(`/master/ingredients/${ingredientId}/`, patch)
        )
      );

      const payload = {
        batch_size: Number(batchSize) > 0 ? Number(batchSize) : 1,
        batch_unit: batchUnit,
        lines: lines
          .filter(l => l.ingredient && Number(l.qty_per_unit) > 0)
          .map(l => ({
            ingredient:   l.ingredient,
            qty_per_unit: Number(l.qty_per_unit),
            unit:         toModelUom(l.unit || 'KG'),
          })),
      };

      if (payload.lines.length === 0) {
        toast.error('Add at least one ingredient');
        setSaving(false);
        return;
      }

      await api.put(`/master/dishes/${dishId}/recipe/`, payload);

      isSyncing.current = true;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['recipe', dishId] }),
        qc.invalidateQueries({ queryKey: ['dish',   dishId] }),
      ]);
      toast.success('Recipe saved');
      setIsEditMode(false);
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
      isSyncing.current = false;
    } finally {
      setSaving(false);
    }
  }

  const filledLines    = lines.filter(l => l.ingredient);
  const runningTotal   = filledLines.reduce((sum, l) => sum + lineAmount(l), 0);
  const validBulkCount = bulkRows.filter(r => r.status === 'ready').length;
  const linesForTable = isEditMode
    ? lines
    : [...lines].sort((a, b) => {
        const aCat = (a.ingredient_category ?? '').toUpperCase();
        const bCat = (b.ingredient_category ?? '').toUpperCase();
        const aRank = CATEGORY_RANK.get(aCat) ?? Number.MAX_SAFE_INTEGER;
        const bRank = CATEGORY_RANK.get(bCat) ?? Number.MAX_SAFE_INTEGER;
        if (aRank !== bRank) return aRank - bRank;
        return (a.ingredient_name ?? '').localeCompare(b.ingredient_name ?? '');
      });
  const amountFromBulkRow = (row: BulkRow): number => {
    const qty = parseCellNumber(row.qty) ?? 0;
    const rate = row.fileRate ?? 0;
    return qty * rate;
  };
  function patchBulkRow(index: number, patch: Partial<BulkRow>) {
    setBulkRows(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Utensils size={16} className="text-gray-400" />
          <span className="text-base font-semibold text-gray-800">Recipe</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
            {filledLines.length} item{filledLines.length !== 1 ? 's' : ''}
          </span>
        </div>
        {!isEditMode && (
          <button
            type="button"
            onClick={handleEditStart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={12} />
            Edit Recipe
          </button>
        )}
      </div>

      {/* ── Recipe yield line ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-5 pb-5 border-b border-gray-100">
        <span className="text-sm text-gray-500 shrink-0">This recipe makes</span>
        {isEditMode ? (
          <>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={batchSize}
              onChange={e => setBatchSize(e.target.value)}
              className="w-20 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
            <select
              value={batchUnit}
              onChange={e => setBatchUnit(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {BATCH_UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <span className="text-xs text-gray-400 shrink-0">(quantities scale with orders)</span>
          </>
        ) : (
          <span className="text-sm font-semibold text-gray-800 tabular-nums">
            {batchSize} {batchUnit}
          </span>
        )}
        <span className="text-sm text-gray-500">of</span>
        <span className="text-sm font-medium text-gray-800 truncate max-w-xs">{dishName}</span>
      </div>

      {/* ── Tabs — only visible in edit mode ──────────────────────────────── */}
      {isEditMode && (
        <div className="flex gap-0 border-b border-gray-200 mb-4">
          {(['manual', 'excel'] as Tab[]).map(tab => (
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
              {tab === 'manual' ? 'Add Manually' : 'Upload Excel'}
            </button>
          ))}
        </div>
      )}

      {/* ── Ingredient table (view mode OR manual tab) ─────────────────────── */}
      {(!isEditMode || activeTab === 'manual') && (
        <div className="space-y-5">

          {lines.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <Utensils size={28} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No ingredients in this recipe yet.</p>
              {!isEditMode && (
                <button
                  type="button"
                  onClick={handleEditStart}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil size={12} />
                  Edit Recipe
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-155">
                <thead>
                  <tr>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-28">Category</th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left">Ingredient</th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-right w-24">Qty</th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-24">Unit</th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-right w-28">Rate (₹)</th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-right w-28">Amount (₹)</th>
                    {isEditMode && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {linesForTable.map((line, i) => {
                    const occupied = new Set(
                      linesForTable.filter((_, j) => j !== i).map(l => l.ingredient).filter(Boolean)
                    );
                    return (
                      <IngredientTableRow
                        key={`${line._key ?? line.id ?? `line-${i}`}-${isEditMode}`}
                        line={line}
                        index={isEditMode ? i : lines.findIndex(source => source === line)}
                        isFirst={i === 0}
                        isEditMode={isEditMode}
                        occupiedIngredientIds={occupied}
                        onPatch={patchLine}
                        onRemove={removeLine}
                      />
                    );
                  })}
                </tbody>
                {!isEditMode && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td colSpan={5} className="py-3 pr-3 text-sm font-semibold text-gray-700 text-right">
                        Total
                      </td>
                      <td className="py-3 text-sm font-bold text-gray-900 text-right tabular-nums">
                        {formatMoneyValue(runningTotal)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Running total */}
          {filledLines.length > 0 && (
            <div className="text-right text-sm text-gray-500">
              Est. ingredient cost:{' '}
              <span className="font-semibold text-gray-800 tabular-nums">₹{runningTotal.toFixed(2)}</span>
            </div>
          )}

          {/* Edit mode footer: Add row + Cancel + Save */}
          {isEditMode && (
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={handleAddRow}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                + Add row
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isValid || saving}
                  title={!isValid ? 'Add at least one valid ingredient' : ''}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !isValid
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {saving ? 'Saving…' : 'Save Recipe'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Upload Excel tab — only in edit mode ──────────────────────────── */}
      {isEditMode && activeTab === 'excel' && (
        <div className="space-y-5">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <UploadCloud size={28} className="text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              {bulkParsing ? 'Parsing file…' : 'Click to upload .xlsx or .csv'}
            </p>
            <p className="text-xs text-gray-400">
              Required columns:{' '}
              <span className="font-mono">ingredient_name</span>,{' '}
              <span className="font-mono">quantity</span>
              {' '}| Optional:{' '}
              <span className="font-mono">category</span>,{' '}
              <span className="font-mono">unit</span>,{' '}
              <span className="font-mono">rate</span>,{' '}
              <span className="font-mono">amount</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {bulkRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
                  Preview — {bulkRows.length} row{bulkRows.length !== 1 ? 's' : ''}
                </p>
                {bulkResolving && <span className="text-xs text-gray-400">Resolving ingredients…</span>}
              </div>

              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left">Ingredient</th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-28">Category</th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-right w-20">Qty</th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-left w-20">Unit</th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-right w-24">Rate (₹)</th>
                    <th className="text-xs font-medium uppercase tracking-wide text-amber-600 pb-2 text-right w-28">Amount (₹)</th>
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
                      <td className="py-2 pr-3">
                        <select
                          value={row.fileCategory ?? row.matched?.category ?? 'OTHER'}
                          onChange={e => patchBulkRow(i, { fileCategory: e.target.value })}
                          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                        >
                          {INGREDIENT_CATEGORIES.map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={0}
                          step="0.001"
                          value={row.qty}
                          onChange={e => patchBulkRow(i, { qty: e.target.value })}
                          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-right text-sm text-gray-700 tabular-nums"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={row.unit}
                          onChange={e => patchBulkRow(i, { unit: e.target.value })}
                          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                        >
                          {LINE_UNIT_OPTIONS.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3 text-sm text-gray-700 text-right tabular-nums">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.fileRate ?? ''}
                          onChange={e => {
                            const next = e.target.value.trim();
                            patchBulkRow(i, { fileRate: next === '' ? undefined : Number.parseFloat(next) });
                          }}
                          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-right text-sm text-gray-700 tabular-nums"
                        />
                      </td>
                      <td className="py-2 pr-3 text-sm text-gray-700 text-right tabular-nums">
                        {row.fileRate !== undefined ? formatMoneyValue(amountFromBulkRow(row)).replace('₹', '') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-3 text-right text-sm text-gray-500">
                Upload total:{' '}
                <span className="font-semibold text-gray-800 tabular-nums">
                  {formatMoneyValue(bulkRows
                    .filter(r => r.status === 'ready')
                    .reduce((sum, r) => sum + amountFromBulkRow(r), 0)
                  )}
                </span>
              </div>

              <div className="flex gap-2 mt-4 justify-end">
                <button
                  type="button"
                  onClick={() => applyBulkRows('append')}
                  disabled={bulkResolving || validBulkCount === 0}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  Append ({validBulkCount})
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkRows('replace')}
                  disabled={bulkResolving || validBulkCount === 0}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-40"
                >
                  Replace all ({validBulkCount})
                </button>
              </div>

              {/* Cancel / Save also accessible from the excel tab */}
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isValid || saving}
                  title={!isValid ? 'Add at least one valid ingredient' : ''}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !isValid
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {saving ? 'Saving…' : 'Save Recipe'}
                </button>
              </div>
            </div>
          )}

          {/* Show Cancel even when no bulk rows are loaded yet */}
          {bulkRows.length === 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
