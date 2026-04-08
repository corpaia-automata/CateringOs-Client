'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Pencil, BookOpen, Check, X, Loader2,
  Trash2, ToggleLeft, ToggleRight, ChefHat, Package, AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Dish {
  id: string;
  name: string;
  category: string;
  unit_type?: string;
  is_active: boolean;
  has_recipe?: boolean;
  batch_size?: string | number;
  batch_unit?: string;
  recipe_count?: number;
  cost_per_unit?: string | number;
}

interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit_of_measure: string;
  is_active: boolean;
}

interface RecipeLine {
  id?: string;
  ingredient: string;
  ingredient_name?: string;
  ingredient_unit?: string;
  ingredient_category?: string;
  quantity: string;
  unit?: string;
  rate?: string;
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
  { value: 'OTHER',      label: 'Other' },
];

// Dish.UnitType choices: PLATE KG PIECE LITRE PORTION
const DISH_UNIT_OPTIONS = [
  { value: 'PLATE', label: 'Plate' },
  { value: 'KG', label: 'Kilogram' },
  { value: 'PIECE', label: 'Piece' },
  { value: 'LITRE', label: 'Litre' },
  { value: 'PORTION', label: 'Portion' },
];

// Ingredient.UOM choices: kg g litre ml piece
const ING_UOM_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'litre', label: 'litre' },
  { value: 'ml', label: 'ml' },
  { value: 'piece', label: 'piece' },
];

// Extended UOM options for recipe editor (backend unit field is a free CharField)
const RECIPE_UOM_OPTIONS = [
  { value: 'KG', label: 'KG' },
  { value: 'GRAM', label: 'GRAM' },
  { value: 'LTR', label: 'LTR' },
  { value: 'ML', label: 'ML' },
  { value: 'PIECE', label: 'PIECE' },
  { value: 'PACKET', label: 'PACKET' },
  { value: 'BOX', label: 'BOX' },
  { value: 'UNIT', label: 'UNIT' },
];

const ING_CAT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  GROCERY:    { bg: '#DBEAFE', color: '#1D4ED8', label: 'Grocery' },
  VEGETABLE:  { bg: '#DCFCE7', color: '#15803D', label: 'Vegetable' },
  MEAT:       { bg: '#FEE2E2', color: '#B91C1C', label: 'Meat' },
  FRUIT:      { bg: '#FFEDD5', color: '#C2410C', label: 'Fruit' },
  DISPOSABLE: { bg: '#F1F5F9', color: '#475569', label: 'Disposable' },
  RENTAL:     { bg: '#EDE9FE', color: '#7C3AED', label: 'Rental' },
  OTHER:      { bg: '#F1F5F9', color: '#475569', label: 'Other' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: active ? '#ECFDF5' : '#F1F5F9', color: active ? '#0D9488' : '#94A3B8' }}>
      {active ? 'Active' : 'Inactive'}
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

const EMPTY_DISH = { name: '', category: '', unit_type: 'PLATE', is_active: true };

function DishDrawer({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void; editing: Dish | null; onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_DISH });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setForm(editing ? {
      name: editing.name, category: editing.category ?? '',
      unit_type: editing.unit_type ?? 'PLATE', is_active: editing.is_active,
    } : { ...EMPTY_DISH });
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
        ? await api.patch(`/master/dishes/${editing.id}/`, form)
        : await api.post('/master/dishes/', form);
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
        <div>
          <label className={lbl} style={{ color: '#0F172A' }}>Dish Name <span style={{ color: '#DC2626' }}>*</span></label>
          <input className={inp} style={fieldErrors.name ? ist_err : ist} required value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="e.g. Chicken Biryani"
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
              {DISH_CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
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

// ─── Recipe Editor Drawer ─────────────────────────────────────────────────────

function RecipeEditorDrawer({ dish, open, onClose, onSaved }: {
  dish: Dish | null; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual');
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [batchSize, setBatchSize] = useState('1');
  const [batchUnit, setBatchUnit] = useState('KG');
  const [saving, setSaving] = useState(false);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [rowSearch, setRowSearch] = useState<Record<number, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [xlsxParsing, setXlsxParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: recipe, isLoading: recipeLoading } = useQuery({
    queryKey: ['dish-recipe', dish?.id],
    queryFn: () => api.get(`/master/dishes/${dish!.id}/recipe/`),
    enabled: open && !!dish,
  });

  const { data: ingData, isLoading: ingLoading } = useQuery({
    queryKey: ['ingredients-all-active'],
    queryFn: () => api.get('/master/ingredients/?is_active=true&page_size=500'),
    enabled: open,
    staleTime: 60_000,
  });
  const allIngredients: Ingredient[] = ingData?.results ?? ingData ?? [];

  // Normalise backend lowercase UOM values → display uppercase
  function normalizeUnit(u?: string): string {
    const map: Record<string, string> = {
      kg: 'KG', g: 'GRAM', gram: 'GRAM', grams: 'GRAM',
      litre: 'LTR', liter: 'LTR', ltr: 'LTR',
      ml: 'ML', piece: 'PIECE', pieces: 'PIECE', pcs: 'PIECE',
      packet: 'PACKET', box: 'BOX', unit: 'UNIT',
    };
    return map[(u || '').toLowerCase()] ?? (u?.toUpperCase() || 'KG');
  }

  // Map display UOM → valid backend Ingredient.UOM choices
  function toBackendUOM(u: string): string {
    const map: Record<string, string> = {
      KG: 'kg', GRAM: 'g', LTR: 'litre', ML: 'ml',
      PIECE: 'piece', PACKET: 'piece', BOX: 'piece', UNIT: 'piece',
    };
    return map[u.toUpperCase()] ?? 'kg';
  }

  useEffect(() => {
    if (!open) {
      setLines([]); setActiveRow(null); setRowSearch({}); setActiveTab('manual');
      setBatchSize('1'); setBatchUnit(dish?.unit_type || 'KG');
      return;
    }
    // Recipe GET now returns {batch_size, batch_unit, lines: [...]}
    // Fall back to old plain-array format for compatibility
    const raw: any[] = recipe?.lines ?? recipe?.results ?? (Array.isArray(recipe) ? recipe : []);
    setBatchSize(String(recipe?.batch_size ?? 1));
    setBatchUnit(recipe?.batch_unit || dish?.unit_type || 'KG');
    setLines(raw.map((r: any) => {
      const ingId = r.ingredient ?? r.ingredient_id ?? '';
      const ingMaster = allIngredients.find(ing => ing.id === ingId);
      return {
        id: r.id,
        ingredient: ingId,
        ingredient_name: r.ingredient_name ?? r.ingredient_display ?? '',
        ingredient_unit: normalizeUnit(r.ingredient_uom ?? r.ingredient_unit ?? r.unit),
        ingredient_category: r.ingredient_category ?? ingMaster?.category ?? '',
        quantity: String(r.qty_per_unit ?? r.quantity ?? ''),
        unit: normalizeUnit(r.unit ?? r.ingredient_uom ?? ''),
        rate: '',
      };
    }));
  }, [recipe, open]);

  function addLine() {
    setLines(l => [...l, { ingredient: '', ingredient_name: '', quantity: '', unit: 'KG', rate: '', ingredient_category: '' }]);
  }

  function removeLine(i: number) {
    setLines(l => l.filter((_, j) => j !== i));
  }

  function setLine(i: number, k: keyof RecipeLine, v: string) {
    setLines(l => l.map((line, j) => j === i ? { ...line, [k]: v } : line));
  }

  function selectIngredient(idx: number, ing: Ingredient) {
    setLines(l => l.map((line, j) => j === idx ? {
      ...line,
      ingredient: ing.id,
      ingredient_name: ing.name,
      ingredient_unit: normalizeUnit(ing.unit_of_measure),
      ingredient_category: ing.category,
      unit: normalizeUnit(ing.unit_of_measure),
    } : line));
    setActiveRow(null);
    setRowSearch(s => ({ ...s, [idx]: '' }));
  }

  function getFilteredIngs(idx: number) {
    const q = (rowSearch[idx] || '').toLowerCase();
    if (!q) return allIngredients.slice(0, 20);
    return allIngredients.filter(i => i.name.toLowerCase().includes(q)).slice(0, 20);
  }

  function getAmount(line: RecipeLine): number {
    const q = parseFloat(line.quantity || '0');
    const r = parseFloat(line.rate || '0');
    return isNaN(q) || isNaN(r) ? 0 : q * r;
  }

  const total = lines.reduce((sum, l) => sum + getAmount(l), 0);
  const unitLabel = dish?.unit_type
    ? dish.unit_type.charAt(0) + dish.unit_type.slice(1).toLowerCase()
    : 'unit';

  async function handleSave() {
    if (!dish) return;
    setSaving(true);
    try {
      // 1. Resolve / auto-create ingredients for rows with a name but no UUID
      const withIds = lines.map(l => ({ ...l }));
      let newIngCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.ingredient_name?.trim()) continue;
        if (!line.ingredient) {
          const existing = allIngredients.find(
            ing => ing.name.toLowerCase() === line.ingredient_name!.trim().toLowerCase()
          );
          if (existing) {
            withIds[i] = { ...withIds[i], ingredient: existing.id };
          } else {
            try {
              const created: Ingredient = await api.post('/master/ingredients/', {
                name: line.ingredient_name.trim(),
                category: line.ingredient_category || 'GROCERY',
                unit_of_measure: toBackendUOM(line.unit || 'KG'),
                is_active: true,
              });
              withIds[i] = { ...withIds[i], ingredient: created.id };
              newIngCount++;
            } catch { /* skip — may conflict */ }
          }
        }
      }
      if (newIngCount > 0) {
        qc.invalidateQueries({ queryKey: ['ingredients'] });
        toast.success(`${newIngCount} new ingredient${newIngCount > 1 ? 's' : ''} added to master list`);
      }
      // 2. Send recipe lines (rate is frontend-only, not sent to backend)
      const lines_payload = withIds
        .filter(l => l.ingredient)
        .map(l => ({
          ingredient: l.ingredient,
          // Use 0 as fallback — never send null (qty_per_unit is non-nullable on backend)
          qty_per_unit: l.quantity !== '' && l.quantity != null ? parseFloat(String(l.quantity)) : 0,
          unit: l.unit || 'KG',
        }));
      await api.put(`/master/dishes/${dish.id}/recipe/`, {
        batch_size: parseFloat(batchSize) || 1,
        batch_unit: batchUnit,
        lines: lines_payload,
      } as any);
      toast.success(`Recipe saved for ${dish.name}`);
      qc.invalidateQueries({ queryKey: ['dishes'] });
      onSaved(); onClose();
    } catch (err: any) {
      // err.data can be an array (DRF many=True validation errors) or an object
      const raw = err?.data;
      let msg = '';
      if (Array.isArray(raw)) {
        // e.g. [{qty_per_unit: ["..."]}, {}] — flatten non-empty error objects
        msg = raw
          .flatMap((item: any) => Object.values(item ?? {}))
          .flat()
          .filter(Boolean)
          .join(', ');
      } else if (raw && typeof raw === 'object') {
        msg = Object.values(raw).flat().filter(Boolean).join(', ');
      }
      toast.error(msg || 'Failed to save recipe');
    } finally { setSaving(false); }
  }

  // ── Excel helpers ──────────────────────────────────────────────────────────

  async function parseExcelFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { toast.error('Only .xlsx and .xls files accepted'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large — max 5 MB'); return; }
    setXlsxParsing(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const dataRows = rows.slice(1).filter(r => r[0] || r[1]);
      const parsed: RecipeLine[] = dataRows.map(r => {
        // A=Category, B=Ingredient Name, C=Quantity, D=Unit, E=Rate, F=Amount(ignore)
        const rawCat = String(r[0] ?? '').trim().toUpperCase();
        const rawName = String(r[1] ?? '').trim();
        const qty = String(r[2] ?? '').trim();
        const unitRaw = String(r[3] ?? '').trim();
        const rate = String(r[4] ?? '').trim();
        const category = ING_CATEGORY_OPTIONS.find(c => c.value === rawCat)?.value ?? (rawCat || 'GROCERY');
        const unit = normalizeUnit(unitRaw) || 'KG';
        const matchedIng =
          allIngredients.find(i => i.name.toLowerCase() === rawName.toLowerCase()) ??
          allIngredients.find(i =>
            i.name.toLowerCase().includes(rawName.toLowerCase()) ||
            rawName.toLowerCase().includes(i.name.toLowerCase())
          ) ?? null;
        return {
          ingredient: matchedIng?.id ?? '',
          ingredient_name: rawName,
          ingredient_unit: matchedIng ? normalizeUnit(matchedIng.unit_of_measure) : unit,
          ingredient_category: matchedIng?.category ?? category,
          quantity: qty,
          unit: matchedIng ? normalizeUnit(matchedIng.unit_of_measure) : unit,
          rate,
        };
      }).filter(r => r.ingredient_name);
      setLines(parsed);
      setActiveTab('manual');
      toast.success(`${parsed.length} row${parsed.length !== 1 ? 's' : ''} imported — review and save`);
    } catch { toast.error('Failed to parse Excel file'); }
    finally { setXlsxParsing(false); }
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Category', 'Ingredient Name', 'Quantity', 'Unit', 'Rate', 'Amount'],
      ['GROCERY', 'Basmati Rice', 0.25, 'KG', 80, ''],
      ['VEGETABLE', 'Onion', 0.1, 'KG', 30, ''],
      ['MEAT', 'Chicken', 0.3, 'KG', 250, ''],
    ]);
    ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recipe');
    XLSX.writeFile(wb, 'recipe_template.xlsx');
  }

  const inp = 'px-2 py-1.5 text-sm outline-none transition-colors w-full';
  const ist = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A', borderRadius: 6 };
  const td: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 transition-opacity"
        style={{ backgroundColor: 'rgba(15,23,42,0.4)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.2s' }} />

      {/* Drawer panel — wider to fit the 7-column table */}
      <div className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width: 'max(820px, 55vw)', backgroundColor: '#fff', transform: open ? 'translateX(0)' : 'translateX(100%)', boxShadow: '-4px 0 32px rgba(0,0,0,0.14)', transition: 'transform 0.25s ease' }}>

        {/* Header */}
        <div className="px-6 pt-5 pb-0 border-b shrink-0" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>{dish?.name ?? 'Recipe'}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                {dish?.unit_type && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#FFF7ED', color: '#C2410C' }}>{dish.unit_type}</span>
                )}
                {dish?.category && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}>{dish.category}</span>
                )}
              </div>
              <p className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>
                All quantities are per {batchSize || '1'} {batchUnit.toLowerCase()}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 mt-0.5">
              <X size={18} style={{ color: '#64748B' }} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {(['manual', 'excel'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-4 py-2 text-sm font-medium relative transition-colors"
                style={{ color: activeTab === tab ? '#D95F0E' : '#64748B' }}>
                {tab === 'manual' ? 'Add Manually' : 'Upload Excel'}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: '#D95F0E' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Tab 1: Manual Entry ── */}
          {activeTab === 'manual' && (
            <div className="py-4">

              {/* ── Batch Size Banner ── */}
              <div className="mx-4 mb-4 px-3 py-3 rounded-lg"
                style={{ backgroundColor: '#FFF5EF', border: '1px solid #D95F0E' }}>
                <p className="text-xs font-medium mb-2" style={{ color: '#D95F0E' }}>This recipe makes</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number" min="0.001" step="0.5"
                    value={batchSize}
                    onChange={e => setBatchSize(e.target.value)}
                    className="outline-none text-center font-bold rounded"
                    style={{ width: 80, fontSize: 18, border: '1.5px solid #D95F0E', padding: '4px 6px', color: '#0F172A', backgroundColor: '#fff' }}
                  />
                  <select
                    value={batchUnit}
                    onChange={e => setBatchUnit(e.target.value)}
                    className="outline-none rounded text-sm font-medium"
                    style={{ border: '1.5px solid #D95F0E', padding: '6px 8px', color: '#D95F0E', backgroundColor: '#FFF5EF' }}>
                    {['KG', 'PLATE', 'PIECE', 'LITRE', 'PORTION'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <span className="text-sm" style={{ color: '#64748B' }}>of {dish?.name}</span>
                </div>
                <p className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>
                  When client orders more, quantities scale automatically
                </p>
              </div>

              {recipeLoading ? (
                <div className="flex flex-col gap-3 px-6">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto px-4">
                    <table style={{ minWidth: 720, width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0' }}>
                          {[
                            { label: 'Category', w: 130 },
                            { label: 'Ingredient Name', w: 180 },
                            { label: 'Qty', w: 90 },
                            { label: 'Unit', w: 90 },
                            { label: 'Rate (₹)', w: 90 },
                            { label: 'Amount (₹)', w: 100, right: true },
                            { label: '', w: 40 },
                          ].map(({ label, w, right }) => (
                            <th key={label || '__del'} style={{ width: w, padding: '8px', textAlign: right ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lines.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ padding: '48px 12px', textAlign: 'center' }}>
                              <div className="flex flex-col items-center gap-2" style={{ color: '#94A3B8' }}>
                                <BookOpen size={32} className="opacity-30" />
                                <p className="text-sm">No ingredients yet — click "+ Add Row" below</p>
                              </div>
                            </td>
                          </tr>
                        )}

                        {lines.map((line, i) => {
                          const amt = getAmount(line);
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>

                              {/* Category */}
                              <td style={td}>
                                <select value={line.ingredient_category || ''}
                                  onChange={e => setLine(i, 'ingredient_category', e.target.value)}
                                  className={inp} style={ist}>
                                  <option value="">—</option>
                                  {ING_CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                              </td>

                              {/* Ingredient Name with autocomplete */}
                              <td style={td}>
                                <div className="relative">
                                  <input
                                    value={activeRow === i ? (rowSearch[i] ?? line.ingredient_name ?? '') : (line.ingredient_name || '')}
                                    onFocus={() => { setActiveRow(i); setRowSearch(s => ({ ...s, [i]: line.ingredient_name || '' })); }}
                                    onChange={e => { setRowSearch(s => ({ ...s, [i]: e.target.value })); setLine(i, 'ingredient_name', e.target.value); }}
                                    placeholder={ingLoading ? 'Loading…' : 'Type name…'}
                                    className={inp} style={ist}
                                    onBlurCapture={() => setTimeout(() => setActiveRow(null), 150)}
                                  />
                                  {activeRow === i && (
                                    <div className="absolute left-0 right-0 top-full mt-0.5 z-30 rounded-lg overflow-y-auto"
                                      style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: 200 }}>
                                      {getFilteredIngs(i).length === 0
                                        ? <div className="px-3 py-2.5 text-xs" style={{ color: '#94A3B8' }}>No match — will be created on save</div>
                                        : getFilteredIngs(i).map(ing => {
                                          const cs = ING_CAT_STYLE[ing.category] ?? ING_CAT_STYLE.OTHER;
                                          return (
                                            <button key={ing.id} onMouseDown={() => selectIngredient(i, ing)}
                                              className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-slate-50 text-left gap-2">
                                              <span style={{ color: '#0F172A' }}>{ing.name}</span>
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                                                  style={{ backgroundColor: cs.bg, color: cs.color }}>{cs.label}</span>
                                                <span className="text-xs" style={{ color: '#94A3B8' }}>{ing.unit_of_measure}</span>
                                              </div>
                                            </button>
                                          );
                                        })}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Qty */}
                              <td style={td}>
                                <input type="number" min="0" step="0.001" value={line.quantity}
                                  onChange={e => setLine(i, 'quantity', e.target.value)}
                                  placeholder="0.000" className={inp} style={ist} />
                              </td>

                              {/* Unit */}
                              <td style={td}>
                                <select value={line.unit || 'KG'}
                                  onChange={e => setLine(i, 'unit', e.target.value)}
                                  className={inp} style={ist}>
                                  {RECIPE_UOM_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                </select>
                              </td>

                              {/* Rate */}
                              <td style={td}>
                                <input type="number" min="0" step="0.01" value={line.rate || ''}
                                  onChange={e => setLine(i, 'rate', e.target.value)}
                                  placeholder="0.00" className={inp} style={ist} />
                              </td>

                              {/* Amount (read-only, calculated) */}
                              <td style={{ ...td, textAlign: 'right', backgroundColor: '#F8FAFC', fontVariantNumeric: 'tabular-nums' }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: amt > 0 ? '#0F172A' : '#CBD5E1' }}>
                                  {amt > 0 ? `₹${amt.toFixed(2)}` : '—'}
                                </span>
                              </td>

                              {/* Delete */}
                              <td style={{ ...td, textAlign: 'center' }}>
                                <button onClick={() => removeLine(i)}
                                  className="flex items-center justify-center w-7 h-7 rounded-full mx-auto transition-colors"
                                  style={{ color: '#94A3B8' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#FEE2E2'; (e.currentTarget as HTMLElement).style.color = '#DC2626'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}>
                                  <X size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Total row */}
                        {lines.length > 0 && (
                          <tr style={{ borderTop: '2px solid #E2E8F0' }}>
                            <td colSpan={5} style={{ padding: '8px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                              Total
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#D95F0E', backgroundColor: '#FFF7ED', fontVariantNumeric: 'tabular-nums' }}>
                              ₹{total.toFixed(2)}
                            </td>
                            <td style={{ backgroundColor: '#FFF7ED' }} />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Row */}
                  <div className="px-4 mt-3">
                    <button onClick={addLine}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
                      style={{ border: '1.5px dashed #FED7AA', color: '#D95F0E' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#FFF7ED'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                      <Plus size={14} /> Add Row
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Tab 2: Upload Excel ── */}
          {activeTab === 'excel' && (
            <div className="px-6 py-5 flex flex-col gap-5">

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseExcelFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center py-10 rounded-xl cursor-pointer transition-all"
                style={{ border: `2px dashed ${dragOver ? '#D95F0E' : '#CBD5E1'}`, backgroundColor: dragOver ? '#FFF7ED' : '#FAFAFA' }}>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) parseExcelFile(f); e.target.value = ''; }} />
                {xlsxParsing
                  ? <Loader2 size={36} className="animate-spin mb-3" style={{ color: '#D95F0E' }} />
                  : <FileSpreadsheet size={40} className="mb-3" style={{ color: dragOver ? '#D95F0E' : '#94A3B8' }} />}
                <p className="text-sm font-medium" style={{ color: '#0F172A' }}>
                  {xlsxParsing ? 'Parsing…' : 'Drag & drop your Excel file here'}
                </p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>or</p>
                <button type="button"
                  className="mt-2 px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: '#D95F0E' }}
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  Browse File
                </button>
                <p className="text-xs mt-3" style={{ color: '#94A3B8' }}>Accepted: .xlsx, .xls · Max 5 MB</p>
              </div>

              {/* Column guide */}
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Expected columns (row 1 = header, skipped):</p>
                <div className="flex flex-wrap gap-2">
                  {['A: Category', 'B: Ingredient Name', 'C: Quantity', 'D: Unit', 'E: Rate', 'F: Amount (ignored)'].map(col => (
                    <span key={col} className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: '#E2E8F0', color: '#475569' }}>{col}</span>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>After upload, rows are loaded into "Add Manually" so you can review before saving.</p>
              </div>

              {/* Template download */}
              <div className="flex items-center justify-between px-4 py-3 rounded-lg"
                style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#15803D' }}>Need a template?</p>
                  <p className="text-xs mt-0.5" style={{ color: '#16A34A' }}>Download a pre-filled .xlsx with all 6 columns</p>
                </div>
                <button onClick={downloadTemplate}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0"
                  style={{ backgroundColor: '#16A34A' }}>
                  Download Template
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer — shared by both tabs */}
        <div className="border-t px-6 py-4 shrink-0" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: '#64748B', border: '1px solid #E2E8F0' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#D95F0E', opacity: saving ? 0.7 : 1 }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save Recipe'}
            </button>
          </div>
        </div>
      </div>
    </>
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
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [activeOnly, setActiveOnly] = useState(false);

  const [dishDrawer, setDishDrawer] = useState(false);
  const [recipeDrawer, setRecipeDrawer] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [recipeDish, setRecipeDish] = useState<Dish | null>(null);
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes…"
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
        <button onClick={() => { setEditingDish(null); setDishDrawer(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white ml-auto"
          style={{ backgroundColor: '#D95F0E' }}>
          <Plus size={15} /> Add Dish
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Dish Name', 'Category', 'Unit Type', 'Has Recipe', 'Active', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#64748B' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              ))
            ) : dishes.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-14 text-center">
                <ChefHat size={36} className="mx-auto mb-2 opacity-20" style={{ color: '#64748B' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>No dishes found</p>
              </td></tr>
            ) : dishes.map(dish => (
              <tr key={dish.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{dish.name}</td>
                <td className="px-4 py-3">
                  {dish.category ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>{dish.category}</span>
                  ) : <span style={{ color: '#94A3B8' }}>—</span>}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{dish.unit_type || '—'}</td>
                <td className="px-4 py-3">
                  {dish.has_recipe
                    ? <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0D9488' }}>
                        <Check size={13} />
                        per {dish.batch_size ?? 1} {dish.batch_unit ?? dish.unit_type ?? 'KG'}
                      </span>
                    : <span className="flex items-center gap-1 text-xs" style={{ color: '#DC2626' }}>
                        <X size={13} /> No recipe
                      </span>}
                </td>
                <td className="px-4 py-3"><ActiveBadge active={dish.is_active} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingDish(dish); setDishDrawer(true); }}
                      className="p-1.5 rounded-lg hover:bg-slate-100" title="Edit">
                      <Pencil size={13} style={{ color: '#64748B' }} />
                    </button>
                    <button onClick={() => { setRecipeDish(dish); setRecipeDrawer(true); }}
                      className="p-1.5 rounded-lg hover:bg-teal-50" title="Edit Recipe">
                      <BookOpen size={14} style={{ color: '#0D9488' }} />
                    </button>
                    <button onClick={() => toggleActive(dish)}
                      className="p-1.5 rounded-lg hover:bg-slate-100" title={dish.is_active ? 'Deactivate' : 'Activate'}>
                      {dish.is_active
                        ? <ToggleRight size={15} style={{ color: '#0D9488' }} />
                        : <ToggleLeft size={15} style={{ color: '#94A3B8' }} />}
                    </button>
                    <button onClick={() => setDeletingDish(dish)}
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

      <DishDrawer open={dishDrawer} onClose={() => setDishDrawer(false)} editing={editingDish}
        onSaved={() => qc.invalidateQueries({ queryKey: ['dishes'] })} />
      <RecipeEditorDrawer dish={recipeDish} open={recipeDrawer} onClose={() => setRecipeDrawer(false)}
        onSaved={() => {}} />
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
          style={{ backgroundColor: '#D95F0E' }}>
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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Manage dishes, recipes, and ingredients</p>
      </div>

      <div className="flex border-b" style={{ borderColor: '#E2E8F0' }}>
        {([
          { key: 'dishes', label: 'Dishes', icon: ChefHat },
          { key: 'ingredients', label: 'Ingredients', icon: Package },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors relative"
            style={{ color: tab === key ? '#D95F0E' : '#64748B' }}>
            <Icon size={15} />
            {label}
            {tab === key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: '#D95F0E' }} />
            )}
          </button>
        ))}
      </div>

      {tab === 'dishes' ? <DishesTab /> : <IngredientsTab />}
    </div>
  );
}
