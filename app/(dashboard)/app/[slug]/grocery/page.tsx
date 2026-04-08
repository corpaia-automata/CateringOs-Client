'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart, FileSpreadsheet, Loader2,
  RefreshCw, Package, ChevronDown, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GroceryItem {
  id: string;
  ingredient_name: string;
  quantity: string | number;
  unit: string;
  category: string;
}

interface EventSummary {
  id: string;
  event_id?: string;
  event_name?: string;
  client_name?: string;
  guest_count: number;
}

interface GroceryResult {
  events: EventSummary[];
  ingredients: GroceryItem[];
  total_ingredients: number;
  total_events: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DISPLAY_ORDER = [
  'GROCERY',
  'DISPOSABLE',
  'VEGETABLE',
  'FRUIT',
  'RENTAL',
  'CHICKEN',
  'BEEF',
  'MUTTON',
  'FISH',
  'MEAT',
  'OTHER',
];

// Human-readable labels for filter checkboxes
const ALL_CATEGORIES = DISPLAY_ORDER;

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; headerBg: string }> = {
  GROCERY:    { label: 'Grocery',    color: '#185FA5', bg: '#E6F1FB', headerBg: '#D0E8FA' },
  DISPOSABLE: { label: 'Disposable', color: '#185FA5', bg: '#E6F1FB', headerBg: '#D0E8FA' },
  VEGETABLE:  { label: 'Veg.',       color: '#3B6D11', bg: '#EAF3DE', headerBg: '#D8ECC5' },
  FRUIT:      { label: 'Fruits',     color: '#854F0B', bg: '#FAEEDA', headerBg: '#F5DDB8' },
  RENTAL:     { label: 'Rentals',    color: '#5F5E5A', bg: '#F1EFE8', headerBg: '#E3E0D5' },
  CHICKEN:    { label: 'Chicken',    color: '#993C1D', bg: '#FAECE7', headerBg: '#F5D5CB' },
  BEEF:       { label: 'Beef',       color: '#993C1D', bg: '#FAECE7', headerBg: '#F5D5CB' },
  MUTTON:     { label: 'Mutton',     color: '#993C1D', bg: '#FAECE7', headerBg: '#F5D5CB' },
  FISH:       { label: 'Fish',       color: '#0F6E56', bg: '#E1F5EE', headerBg: '#C5EADA' },
  MEAT:       { label: 'Meat',       color: '#993C1D', bg: '#FAECE7', headerBg: '#F5D5CB' },
  OTHER:      { label: 'Others',     color: '#444441', bg: '#D3D1C7', headerBg: '#C0BEB3' },
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function eventIdDisplay(ev: EventSummary) {
  return ev.event_id ?? `#EVT-${String(ev.id).slice(-5).toUpperCase().padStart(5, '0')}`;
}

function formatQty(qty: number, unit: string): { value: string; unit: string } {
  if (qty === 0) return { value: '0', unit };
  if (unit === 'kg' && qty < 1) return { value: String(Math.round(qty * 1000)), unit: 'gram' };
  if (unit === 'litre' && qty < 1) return { value: String(Math.round(qty * 1000)), unit: 'ml' };
  if (unit === 'gram') {
    const v = qty < 1 ? qty.toFixed(3) : qty % 1 === 0 ? String(qty) : qty.toFixed(1);
    return { value: v, unit: 'gram' };
  }
  return { value: qty % 1 === 0 ? String(qty) : qty.toFixed(2), unit };
}

function groupByCategory(items: GroceryItem[]): Record<string, GroceryItem[]> {
  return items.reduce((acc, item) => {
    const cat = (item.category || 'OTHER').toUpperCase();
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>);
}

// ─── Category Section ─────────────────────────────────────────────────────────

function CategorySection({ category, items }: { category: string; items: GroceryItem[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.OTHER;
  const style = config;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
      {/* Category Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center justify-between w-full px-5 py-3 transition-colors"
        style={{ backgroundColor: style.headerBg }}>
        <div className="flex items-center gap-2">
          {collapsed
            ? <ChevronRight size={15} style={{ color: style.color }} />
            : <ChevronDown size={15} style={{ color: style.color }} />}
          <span className="text-sm font-bold uppercase tracking-wide" style={{ color: style.color }}>
            {config.label}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: style.bg, color: style.color }}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {/* Items */}
      {!collapsed && (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th className="px-5 py-2.5 text-left text-xs font-semibold w-10" style={{ color: '#94A3B8' }}>#</th>
              <th className="px-5 py-2.5 text-left text-xs font-semibold" style={{ color: '#64748B' }}>Ingredient</th>
              <th className="px-5 py-2.5 text-right text-xs font-semibold" style={{ color: '#64748B' }}>Quantity</th>
              <th className="px-5 py-2.5 text-left text-xs font-semibold w-24" style={{ color: '#64748B' }}>Unit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const fq = formatQty(parseFloat(String(item.quantity)), item.unit);
              return (
                <tr key={item.id}
                  className="transition-colors hover:bg-slate-50"
                  style={{ borderBottom: idx < items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <td className="px-5 py-3 text-xs" style={{ color: '#94A3B8' }}>{idx + 1}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: '#0F172A' }}>{item.ingredient_name}</td>
                  <td className="px-5 py-3 text-right font-semibold" style={{ color: '#0F172A' }}>{fq.value}</td>
                  <td className="px-5 py-3 text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>{fq.unit}</td>
                </tr>
              );
            })}
          </tbody>
          {/* Category subtotal */}
          <tfoot>
            <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
              <td colSpan={2} className="px-5 py-2 text-xs font-semibold" style={{ color: style.color }}>
                {category} Total
              </td>
              <td colSpan={2} className="px-5 py-2 text-right text-xs font-semibold" style={{ color: style.color }}>
                {items.length} ingredients
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function GroceryPage() {
  const [date, setDate] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(ALL_CATEGORIES));
  const [submitted, setSubmitted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null);

  // Only fetch when date is selected and submitted
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['grocery', date, [...selectedCategories].sort().join(',')],
    queryFn: () => {
      const params = new URLSearchParams({ date });
      [...selectedCategories].forEach(c => params.append('category', c.toUpperCase()));
      return api.get(`/grocery/?${params.toString()}`);
    },
    enabled: submitted && !!date,
  });

  const result = data as GroceryResult | undefined;
  const allItems: GroceryItem[] = result?.ingredients ?? [];
  const events: EventSummary[] = result?.events ?? [];

  // Filter by selected categories (client-side fallback) — compare uppercase
  const filteredItems = allItems.filter(item =>
    selectedCategories.has((item.category || 'OTHER').toUpperCase())
  );

  const grouped = groupByCategory(filteredItems);
  // Preserve DISPLAY_ORDER, append any unknown categories at the end
  const orderedCategories = DISPLAY_ORDER.filter(c => grouped[c]?.length)
    .concat(Object.keys(grouped).filter(c => !DISPLAY_ORDER.includes(c) && grouped[c]?.length));

  function toggleCategory(cat: string) {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  function toggleAll() {
    if (selectedCategories.size === ALL_CATEGORIES.length) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(ALL_CATEGORIES));
    }
  }

  function handleGenerate() {
    if (!date) { toast.error('Please select a date'); return; }
    setSubmitted(true);
  }

  async function handleDownloadExcel() {
    if (!date) return;
    setDownloading('excel');
    try {
      const params = new URLSearchParams({ date });
      [...selectedCategories].forEach(c => params.append('category', c.toUpperCase()));
      await api.download(`/grocery/export/excel/?${params.toString()}`, `grocery-${date}.xlsx`);
    } catch { toast.error('Failed to download Excel'); }
    finally { setDownloading(null); }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
            Generate consolidated ingredient lists by date
          </p>
        </div>
        {submitted && filteredItems.length > 0 && (
          <button onClick={handleDownloadExcel} disabled={downloading === 'excel'}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ border: '1.5px solid #E2E8F0', color: '#64748B', backgroundColor: '#fff' }}>
            {downloading === 'excel'
              ? <Loader2 size={14} className="animate-spin" />
              : <FileSpreadsheet size={14} />}
            Excel
          </button>
        )}
      </div>

      {/* Filter Panel */}
      <div className="rounded-xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
        <div className="flex flex-wrap items-end gap-6">
          {/* Date Picker */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#0F172A' }}>
              Event Date <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setSubmitted(false); }}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: date ? '#0F172A' : '#94A3B8', backgroundColor: '#F8FAFC', minWidth: 160 }}
              onFocus={e => (e.currentTarget.style.borderColor = '#0D9488')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
          </div>

          {/* Category Checkboxes */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs font-medium" style={{ color: '#0F172A' }}>Categories</label>
              <button onClick={toggleAll}
                className="text-xs underline" style={{ color: '#64748B' }}>
                {selectedCategories.size === ALL_CATEGORIES.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map(cat => {
                const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.OTHER;
                const checked = selectedCategories.has(cat);
                return (
                  <label key={cat}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-colors text-xs font-medium"
                    style={{
                      backgroundColor: checked ? cfg.bg : '#F8FAFC',
                      color: checked ? cfg.color : '#94A3B8',
                      border: `1.5px solid ${checked ? cfg.color + '60' : '#E2E8F0'}`,
                    }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCategory(cat)}
                      className="sr-only" />
                    <span className="w-2.5 h-2.5 rounded-sm border flex items-center justify-center"
                      style={{ borderColor: checked ? cfg.color : '#CBD5E1', backgroundColor: checked ? cfg.color : 'transparent' }}>
                      {checked && <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                        <path d="M1 2L2.5 3.5L6 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>}
                    </span>
                    {cfg.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <div className="ml-auto flex items-end">
            <button onClick={handleGenerate} disabled={!date || isFetching}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{ backgroundColor: '#0D9488', opacity: (!date || isFetching) ? 0.7 : 1 }}>
              {isFetching
                ? <Loader2 size={15} className="animate-spin" />
                : <ShoppingCart size={15} />}
              {isFetching ? 'Generating…' : 'Generate List'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {submitted && (
        <>
          {isLoading || isFetching ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-12 w-full" />
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                    <Skeleton className="h-10 w-full" />
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-11 w-full mx-0 rounded-none" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-xl"
              style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
              <ShoppingCart size={48} className="mb-3 opacity-20" style={{ color: '#64748B' }} />
              <p className="font-semibold" style={{ color: '#0F172A' }}>No ingredients found</p>
              <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
                {events.length === 0
                  ? `No confirmed events on ${fmtDate(date)}`
                  : 'No ingredients match the selected categories'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Summary Bar */}
              <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 rounded-xl"
                style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                    {events.length} confirmed event{events.length !== 1 ? 's' : ''} on {fmtDate(date)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                    {filteredItems.length} ingredients · {orderedCategories.length} categories
                  </p>
                </div>
                {/* Event Pills */}
                <div className="flex flex-wrap gap-2">
                  {events.map(ev => (
                    <a key={ev.id} href={`/events/${ev.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:shadow-sm"
                      style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                      <span style={{ color: '#0D9488', fontFamily: 'monospace' }}>{eventIdDisplay(ev)}</span>
                      {ev.client_name && <span style={{ color: '#64748B' }}>{ev.client_name}</span>}
                      <span className="flex items-center gap-0.5" style={{ color: '#94A3B8' }}>
                        · {ev.guest_count} guests
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Category Tables */}
              <div className="flex flex-col gap-3">
                {orderedCategories.map(cat => (
                  <CategorySection key={cat} category={cat} items={grouped[cat]} />
                ))}
              </div>

              {/* Footer Totals */}
              <div className="flex items-center justify-between px-5 py-3 rounded-xl"
                style={{ backgroundColor: '#1C3355' }}>
                <div className="flex items-center gap-2">
                  <Package size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  <span className="text-sm font-semibold text-white">
                    {filteredItems.length} ingredient{filteredItems.length !== 1 ? 's' : ''} across{' '}
                    {events.length} event{events.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {orderedCategories.map(cat => {
                    const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.OTHER;
                    return (
                      <span key={cat} className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.label}: {grouped[cat].length}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Regenerate hint */}
              <button onClick={() => refetch()}
                className="flex items-center gap-1.5 self-center text-xs"
                style={{ color: '#94A3B8' }}>
                <RefreshCw size={12} /> Regenerate list
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty state before first generation */}
      {!submitted && (
        <div className="flex flex-col items-center justify-center py-24 rounded-xl"
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderStyle: 'dashed' }}>
          <ShoppingCart size={48} className="mb-4 opacity-20" style={{ color: '#0D9488' }} />
          <p className="font-semibold" style={{ color: '#0F172A' }}>Select a date to generate grocery list</p>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            All confirmed events on that date will be consolidated
          </p>
        </div>
      )}
    </div>
  );
}
