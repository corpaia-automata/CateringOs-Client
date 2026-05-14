'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChefHat,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AddDishInlinePanel } from '@/components/dishes/AddDishInlinePanel';

type PricingType = 'per plate' | 'per item' | 'per kg';
type StatusBadge = 'LIVE' | 'FIXED' | 'DRAFT';

export interface PlanningLineItem {
  id: string;
  dishId?: string;
  name: string;
  category: string;
  qty: number | string;
  unit: string;
  price: number | string | null;
  total: number | string | null;
}

const SERVING_UNIT_MAP: Record<string, { pricingType: PricingType; unit: string }> = {
  PLATE: { pricingType: 'per plate', unit: 'plates' },
  KG: { pricingType: 'per kg', unit: 'kg' },
  PIECE: { pricingType: 'per item', unit: 'pieces' },
  LITRE: { pricingType: 'per item', unit: 'litres' },
  PORTION: { pricingType: 'per item', unit: 'portions' },
};

const PRICING_TYPE_STYLES: Record<PricingType, string> = {
  'per plate': 'bg-blue-50 text-blue-700 border-blue-200',
  'per item': 'bg-purple-50 text-purple-700 border-purple-200',
  'per kg': 'bg-teal-50 text-teal-700 border-teal-200',
};

const STATUS_BADGE_STYLES: Record<StatusBadge, string> = {
  LIVE: 'bg-green-50 text-green-700 border-green-200',
  FIXED: 'bg-orange-50 text-orange-700 border-orange-200',
  DRAFT: 'bg-slate-50 text-slate-600 border-slate-200',
};

function toNumber(value: number | string | null | undefined) {
  if (value == null || value === '') return 0;
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtINR(value: number | string | null | undefined) {
  return `₹${toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function PricingBadge({ type }: { type: PricingType }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border ${PRICING_TYPE_STYLES[type]}`}>
      {type}
    </span>
  );
}

function StatusBadgeChip({ status }: { status: StatusBadge }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide border ${STATUS_BADGE_STYLES[status]}`}>
      {status}
    </span>
  );
}

function linePricingType(row: PlanningLineItem): PricingType {
  const unit = row.unit.toLowerCase();
  if (unit.includes('kg')) return 'per kg';
  if (unit.includes('plate')) return 'per plate';
  return 'per item';
}

function ServiceAddPanel({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: (row: PlanningLineItem) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [rate, setRate] = useState(0);

  async function save() {
    if (!name.trim() || qty < 1 || rate <= 0) return;
    const ok = await onSave({
      id: `service-${Date.now()}`,
      name: name.trim(),
      category: 'Services',
      qty,
      unit: 'unit',
      price: rate,
      total: null,
    });
    if (!ok) return;
    setName('');
    setQty(1);
    setRate(0);
  }

  return (
    <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_120px_140px_auto] items-end">
        <label className="text-xs font-semibold text-slate-600">
          Service Name
          <input value={name} onChange={event => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Qty
          <input type="number" min={1} value={qty} onChange={event => setQty(Math.max(1, Number.parseInt(event.target.value, 10) || 1))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-right outline-none focus:border-indigo-400" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Rate
          <input type="number" min={0} value={rate || ''} onChange={event => setRate(Math.max(0, Number.parseFloat(event.target.value) || 0))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-right outline-none focus:border-indigo-400" />
        </label>
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={onCancel} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={saving || !name.trim() || qty < 1 || rate <= 0} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {saving && <Loader2 size={13} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPanel({
  kind,
  row,
  saving,
  onSave,
  onCancel,
}: {
  kind: 'dishes' | 'services';
  row: PlanningLineItem;
  saving: boolean;
  onSave: (row: PlanningLineItem) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(row);

  const qty = toNumber(draft.qty);
  const price = toNumber(draft.price);
  const canSave = draft.name.trim() && qty > 0 && price >= 0 && (kind === 'services' || price > 0);

  function setField(key: keyof PlanningLineItem, value: string | number) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  return (
    <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
            {kind === 'dishes' ? 'Dish' : 'Service'}
          </label>
          {kind === 'dishes' ? (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900">{draft.name}</p>
          ) : (
            <input value={draft.name} onChange={event => setField('name', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-400" />
          )}
        </div>
        <label>
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Qty</span>
          <input type="number" min={1} value={draft.qty} onChange={event => setField('qty', Math.max(1, Number.parseInt(event.target.value, 10) || 1))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-right outline-none focus:border-blue-400" />
        </label>
        <label>
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Rate</span>
          <input type="number" min={0} value={draft.price ?? 0} onChange={event => setField('price', Math.max(0, Number.parseFloat(event.target.value) || 0))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-right outline-none focus:border-blue-400" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onCancel} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={saving || !canSave} onClick={() => void onSave(draft)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function EventPlanningLineEditor({
  title,
  kind,
  rows,
  disabled,
  onSaveRows,
  guestCount,
}: {
  title: string;
  kind: 'dishes' | 'services';
  rows: PlanningLineItem[];
  disabled: boolean;
  onSaveRows: (rows: PlanningLineItem[]) => Promise<void>;
  /** Used as default quantity when adding dishes from master list */
  guestCount?: number;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const Icon = kind === 'dishes' ? ChefHat : ClipboardList;
  const existingIds = useMemo(() => new Set(rows.map(row => row.id)), [rows]);

  useEffect(() => {
    setEditingId(null);
    setShowAdd(false);
  }, [rows]);

  async function saveRows(nextRows: PlanningLineItem[], successMessage: string): Promise<boolean> {
    if (disabled || saving) return false;
    setSaving(true);
    try {
      await onSaveRows(nextRows);
      toast.success(successMessage);
      setEditingId(null);
      setShowAdd(false);
      return true;
    } catch (error) {
      const detail = (error as { data?: { detail?: string } })?.data?.detail;
      toast.error(detail ?? `Failed to update ${title.toLowerCase()}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addRow(row: PlanningLineItem): Promise<boolean> {
    return saveRows([...rows, row], `${kind === 'dishes' ? 'Dish' : 'Service'} added`);
  }

  async function updateRow(updated: PlanningLineItem): Promise<boolean> {
    return saveRows(rows.map(row => row.id === updated.id ? updated : row), `${kind === 'dishes' ? 'Dish' : 'Service'} updated`);
  }

  async function removeRow(id: string): Promise<boolean> {
    return saveRows(rows.filter(row => row.id !== id), `${kind === 'dishes' ? 'Dish' : 'Service'} removed`);
  }

  const emptyText = kind === 'dishes' ? 'No dishes added yet.' : 'No services added yet.';

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
      <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: '#E2E8F0' }}>
        <div>
          <h3 className="flex items-center gap-2 text-xl font-semibold text-slate-800 leading-none">
            <Icon size={20} />
            {title}
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{rows.length}</span>
          </h3>
          <p className="mt-1 text-sm text-slate-500">Rows stay read-only until you choose Add or Edit.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAdd(value => !value); setEditingId(null); }}
          disabled={disabled || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showAdd ? <X size={15} /> : <Plus size={15} />}
          {showAdd ? 'Cancel' : `Add ${kind === 'dishes' ? 'Dish' : 'Service'}`}
        </button>
      </div>

      {disabled && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm font-medium text-amber-700">
          Completed or locked events cannot be edited.
        </div>
      )}

      <div className="p-5">
        {showAdd && kind === 'dishes' && (
          <AddDishInlinePanel
            existingIds={existingIds}
            submitting={saving}
            onClose={() => setShowAdd(false)}
            defaultGuestQty={guestCount != null && guestCount > 0 ? guestCount : undefined}
            onConfirmAdd={async (dish, qty, price) => {
              const map = SERVING_UNIT_MAP[dish.serving_unit]
                ?? { pricingType: 'per plate' as PricingType, unit: 'plates' };
              const ok = await addRow({
                id: dish.id,
                dishId: dish.id,
                name: dish.name,
                category: dish.category_name ?? 'Uncategorized',
                qty,
                unit: map.unit,
                price,
                total: null,
              });
              if (!ok) throw new Error('SAVE_FAILED');
            }}
          />
        )}
        {showAdd && kind === 'services' && (
          <ServiceAddPanel saving={saving} onSave={addRow} onCancel={() => setShowAdd(false)} />
        )}

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-slate-200">
            <Icon size={28} className="text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 font-medium">{emptyText}</p>
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => setShowAdd(true)}
              className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors disabled:opacity-50"
            >
              Add your first {kind === 'dishes' ? 'dish' : 'service'}
            </button>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-500">{kind === 'dishes' ? 'Dish' : 'Service'}</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500">Type</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Qty x Rate</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Backend Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 group hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 pl-4 pr-3">
                      <p className="text-sm font-semibold text-slate-900 leading-snug">{row.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{row.category || '-'}</p>
                    </td>
                    <td className="py-3 px-3">
                      {kind === 'dishes' ? <PricingBadge type={linePricingType(row)} /> : <StatusBadgeChip status="FIXED" />}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-sm text-slate-900 tabular-nums">
                        {toNumber(row.qty).toLocaleString('en-IN')} <span className="text-slate-500 text-xs">{row.unit}</span> x {fmtINR(row.price)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">{row.total != null ? fmtINR(row.total) : '—'}</span>
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={disabled || saving}
                          onClick={() => { setEditingId(row.id); setShowAdd(false); }}
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={disabled || saving}
                          onClick={() => void removeRow(row.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Remove"
                        >
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

        {editingId && (() => {
          const current = rows.find(row => row.id === editingId);
          if (!current) return null;
          return <EditPanel key={current.id} kind={kind} row={current} saving={saving} onSave={updateRow} onCancel={() => setEditingId(null)} />;
        })()}
      </div>
    </div>
  );
}
