'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, Trash2, Plus, Phone, Mail,
  ChevronDown, Loader2,
  X, Lock, RotateCcw, AlertTriangle,
  MessageSquare, UserPlus, Zap, Star, Clock, Bell, TrendingUp,
  PhoneCall, CheckCircle, ArrowRight, Activity, Flame,
  ChefHat, Calculator, ShoppingCart, IndianRupee, Download, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiError, api } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/constants';
import QuotationCard from './QuotationCard';
import LeadStatusStepper from './LeadStatusStepper';
import { LeadFormDrawer } from '@/components/leads/LeadFormDrawer';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LeadDetail {
  id: string;
  customer_name: string;
  contact_number?: string;
  email?: string;
  event_type: string;
  tentative_date?: string;
  guest_count?: number;
  estimated_budget?: string | number;
  status: string;
  source_channel?: string;
  notes?: string;
  venue?: string;
  event_id?: string | null;
  converted_event_id?: string | null;
  converted_event_status?: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadQuotationSummary {
  id: string;
  version_number?: number;
  is_locked?: boolean;
  status?: string;
  final_selling_price?: number | string | null;
  internal_cost?: number | string | null;
  advance_amount?: number | string | null;
  payment_terms?: string;
}

interface EventDetail {
  id: string;
  event_code?: string;
  event_id?: string;
  event_name?: string;
  client_name?: string;
  event_type?: string;
  event_date?: string;
  venue?: string;
  guest_count?: number;
  status?: string;
  total_amount?: string | number;
  advance_amount?: string | number;
  balance_amount?: string | number;
  food_cost?: string | number;
  labor_cost?: string | number;
  other_costs?: string | number;
  created_at?: string;
}

interface EventSnapshotResponse {
  event_details?: EventDetail;
  menu_snapshot?: unknown;
  services_snapshot?: unknown;
  costing_snapshot?: unknown;
  grocery_snapshot?: unknown;
  pricing_snapshot?: Record<string, unknown> | null;
}

type AnyRecord = Record<string, unknown>;

interface SnapshotMenuItem {
  id: string;
  name: string;
  category: string;
  qty: number | string;
  price: number | string | null;
  total: number | string | null;
}

interface SnapshotCostingItem {
  id: string;
  ingredient: string;
  dishName: string;
  category: string;
  qty: number | string;
  unit: string;
  rate: number | string | null;
  total: number | string | null;
}

interface SnapshotGroceryItem {
  id: string;
  ingredient: string;
  quantity: number | string;
  unit: string;
  category: string;
}

// ─── Design Tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:        '#F3F4F6',
  surface:   '#0F1629',
  card:      'white',
  cardHover: '#182040',
  border:    'rgba(255,255,255,0.07)',
  borderHi:  'rgba(255,255,255,0.14)',
  text:      'black',
  muted:     '#64748B',
  faint:     '#334155',
  orange:    '#F97316',
  orangeDim: 'rgba(249,115,22,0.15)',
  teal:      '#14B8A6',
  tealDim:   'rgba(20,184,166,0.15)',
  blue:      '#3B82F6',
  blueDim:   'rgba(59,130,246,0.15)',
  purple:    '#8B5CF6',
  purpleDim: 'rgba(139,92,246,0.15)',
  green:     '#22C55E',
  greenDim:  'rgba(34,197,94,0.15)',
  red:       '#EF4444',
  redDim:    'rgba(239,68,68,0.15)',
  yellow:    '#EAB308',
  yellowDim: 'rgba(234,179,8,0.15)',
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; glow: string }> = {
  PLANNING: { color: C.orange, bg: C.orangeDim, label: 'Planning', glow: 'rgba(249,115,22,0.25)' },
  SUCCESS:  { color: C.green,  bg: C.greenDim,  label: 'Success',  glow: 'rgba(34,197,94,0.25)' },
  LOST:     { color: C.red,    bg: C.redDim,    label: 'Lost',     glow: 'rgba(239,68,68,0.25)' },
};

const LEAD_TEMP: Record<string, { icon: typeof Flame; color: string; label: string }> = {
  PLANNING: { icon: Flame, color: C.orange, label: 'Planning' },
  SUCCESS:  { icon: CheckCircle, color: C.green, label: 'Success' },
  LOST:     { icon: X, color: C.red, label: 'Lost' },
};


const VALID_TRANSITIONS: Record<string, string[]> = {
  PLANNING: ['SUCCESS', 'LOST'],
  SUCCESS:  [],
  LOST:     ['PLANNING'],
};

const SOURCE_CHANNELS: Record<string, string> = {
  PHONE_CALL: 'Phone Call',
  WHATSAPP:   'WhatsApp',
  WALK_IN:    'Walk In',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' • ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
}

function fmtINR(v?: string | number | null) {
  if (v == null || v === '') return '₹0';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function initials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const data = error.data;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const detail = record.error ?? record.detail;
      if (typeof detail === 'string') return detail;
    }
  }
  return fallback;
}

const EXISTING_EVENT_SENTINEL = 'event-already-created';

// ─── Activity Timeline Builder ─────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: 'converted' | 'created' | 'enquiry' | 'updated';
  title: string;
  subtitle?: string;
  date: string;
  by: string;
}

function buildTimeline(lead: LeadDetail): ActivityItem[] {
  const items: ActivityItem[] = [];
  items.push({
    id: 'enquiry', type: 'enquiry',
    title: `Initial enquiry via ${SOURCE_CHANNELS[lead.source_channel ?? ''] ?? 'Unknown'}`,
    date: lead.created_at, by: 'System',
  });
  const createdDate = new Date(lead.created_at);
  createdDate.setMinutes(createdDate.getMinutes() + 1);
  items.push({ id: 'created', type: 'created', title: 'Lead created in system', date: createdDate.toISOString(), by: 'Staff' });
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' ? (value as AnyRecord) : null;
}

function parseSnapshot(snapshot: unknown): unknown {
  if (typeof snapshot !== 'string') return snapshot;
  try {
    return JSON.parse(snapshot);
  } catch {
    return snapshot;
  }
}

function snapshotRows(snapshot: unknown): AnyRecord[] {
  const parsed = parseSnapshot(snapshot);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'items' in parsed
      ? ((parsed as { items?: unknown[] }).items ?? [])
      : [];
  return rows.filter((row): row is AnyRecord => Boolean(row && typeof row === 'object'));
}

function normalizeMenuSnapshot(snapshot: unknown): SnapshotMenuItem[] {
  return snapshotRows(snapshot).map((item, index) => ({
    id: String(item.id ?? `menu-${index}`),
    name: String(item.dish_name_snapshot ?? item.dish_name ?? item.dish ?? item.name ?? 'Dish'),
    category: String(item.category ?? item.dish_category ?? 'Other'),
    qty: (item.quantity ?? item.qty ?? item.pax ?? 0) as number | string,
    price: (item.price_per_plate ?? item.selling_price ?? item.rate ?? item.price ?? null) as number | string | null,
    total: (item.total ?? item.line_total ?? item.total_price ?? item.subtotal ?? item.amount ?? null) as number | string | null,
  }));
}

function normalizeCostingSnapshot(snapshot: unknown): SnapshotCostingItem[] {
  return snapshotRows(snapshot).map((item, index) => {
    const qty = (item.quantity ?? item.qty ?? 0) as number | string;
    const rate = (item.rate ?? item.unit_rate ?? item.price ?? null) as number | string | null;
    const computedTotal = Number(qty) * Number(rate ?? 0);
    return {
      id: String(item.id ?? `cost-${index}`),
      ingredient: String(item.ingredient_name ?? item.name ?? 'Ingredient'),
      dishName: String(item.dish_name ?? item.dishName ?? item.dish ?? 'General'),
      category: String(item.category ?? 'Other'),
      qty,
      unit: String(item.unit ?? ''),
      rate,
      total: (item.total ?? item.line_total ?? item.amount ?? (Number.isFinite(computedTotal) ? computedTotal : null)) as number | string | null,
    };
  });
}

function normalizeGrocerySnapshot(snapshot: unknown): SnapshotGroceryItem[] {
  return snapshotRows(snapshot).map((item, index) => ({
    id: String(item.id ?? item.ingredientId ?? `grocery-${index}`),
    ingredient: String(item.ingredient_name ?? item.name ?? 'Item'),
    quantity: (item.total_quantity ?? item.quantity ?? item.qty ?? 0) as number | string,
    unit: String(item.unit ?? ''),
    category: String(item.category ?? 'Other'),
  }));
}

function resolveEventPayload(raw: unknown) {
  const root = asRecord(raw) ?? {};
  const nested = asRecord(root.data) ?? asRecord(root.result) ?? asRecord(root.payload) ?? root;
  const snapshots = asRecord(nested.snapshots) ?? {};
  const event =
    (nested.event_details as EventDetail | undefined) ??
    (nested.event as EventDetail | undefined) ??
    (nested.event_data as EventDetail | undefined) ??
    (nested.id ? (nested as unknown as EventDetail) : null);

  const menuSnapshot = parseSnapshot(nested.menu_snapshot ?? snapshots.menu_snapshot ?? snapshots.menu ?? nested.menu ?? nested.menu_items ?? null);
  const servicesSnapshot = parseSnapshot(nested.services_snapshot ?? snapshots.services_snapshot ?? nested.services ?? null);
  const costingSnapshot = parseSnapshot(nested.costing_snapshot ?? snapshots.costing_snapshot ?? snapshots.costing ?? nested.costing ?? nested.cost_items ?? null);
  const grocerySnapshot = parseSnapshot(nested.grocery_snapshot ?? snapshots.grocery_snapshot ?? snapshots.grocery ?? nested.grocery ?? nested.grocery_items ?? null);
  const pricingSnapshot = parseSnapshot(
    nested.pricing_snapshot ??
    snapshots.pricing_snapshot ??
    snapshots.pricing ??
    nested.payment_snapshot ??
    nested.pricing ??
    null,
  ) as AnyRecord | null;

  return { event, menuSnapshot, servicesSnapshot, costingSnapshot, grocerySnapshot, pricingSnapshot };
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function LeadDetailSkeleton() {
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: C.bg }}>
      <div className="flex items-center gap-2 mb-6">
        <div className="h-4 w-20 rounded-lg animate-pulse" style={{ backgroundColor: C.card }} />
        <div className="h-4 w-4 rounded animate-pulse" style={{ backgroundColor: C.card }} />
        <div className="h-4 w-32 rounded-lg animate-pulse" style={{ backgroundColor: C.card }} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {[160, 260, 300].map(h => (
            <div key={h} className="rounded-2xl animate-pulse" style={{ height: h, backgroundColor: C.card, border: `1px solid ${C.border}` }} />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {[280, 180, 160].map(h => (
            <div key={h} className="rounded-2xl animate-pulse" style={{ height: h, backgroundColor: C.card, border: `1px solid ${C.border}` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Components ────────────────────────────────────────────────────────

function Card({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`}
      style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

function EmptySnapshot({ label }: { label: string }) {
  return <p className="text-sm text-slate-500 py-6 text-center">No {label} found for this confirmed event.</p>;
}

function SnapshotTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

function ConfirmedEventDetails({
  rawEventData,
  loading,
  eventId,
  onOpenEvent,
  onDownloadQuotation,
}: {
  rawEventData?: EventSnapshotResponse;
  loading: boolean;
  eventId: string;
  onOpenEvent: () => void;
  onDownloadQuotation: () => void;
}) {
  const resolved = resolveEventPayload(rawEventData);
  const event = resolved.event;
  const menuRows = [
    ...normalizeMenuSnapshot(resolved.menuSnapshot),
    ...normalizeMenuSnapshot(resolved.servicesSnapshot),
  ];
  const costingRows = normalizeCostingSnapshot(resolved.costingSnapshot);
  const groceryRows = normalizeGrocerySnapshot(resolved.grocerySnapshot);
  const pricing = resolved.pricingSnapshot ?? {};
  const totalAmount = Number(pricing.final_selling_price ?? pricing.selling_price ?? event?.total_amount ?? 0);
  const paidAmount = Number(pricing.advance_amount ?? event?.advance_amount ?? 0);
  const balanceAmount = Number(pricing.balance_amount ?? event?.balance_amount ?? Math.max(0, totalAmount - paidAmount));
  const internalCost = Number(
    pricing.total_cost ??
    pricing.cost ??
    (Number(event?.food_cost ?? 0) + Number(event?.labor_cost ?? 0) + Number(event?.other_costs ?? 0)),
  );

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden">
      <div className="flex items-start justify-between gap-4 flex-wrap px-5 py-4 border-b border-emerald-100 bg-emerald-50">
        <div>
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Converted Event Details</p>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">{event?.event_name || event?.client_name || 'Confirmed Event'}</h2>
          <p className="text-sm text-slate-600 mt-1">
            {event?.event_code ?? event?.event_id ?? eventId} • {event?.status ?? 'Confirmed'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDownloadQuotation}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
            <Download size={15} /> Quotation
          </button>
          <button type="button" onClick={onOpenEvent}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            <ExternalLink size={15} /> Open Event
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-5 flex flex-col gap-3">
          <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-40 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      ) : (
        <div className="p-5 flex flex-col gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: 'Event Value', value: fmtINR(totalAmount), icon: IndianRupee },
              { label: 'Internal Cost', value: fmtINR(internalCost), icon: Calculator },
              { label: 'Paid', value: fmtINR(paidAmount), icon: CheckCircle },
              { label: 'Balance', value: fmtINR(balanceAmount), icon: Clock },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                  <Icon size={16} /> {label}
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><ChefHat size={18} /> Event Menu List</h3>
            {menuRows.length === 0 ? <EmptySnapshot label="menu items" /> : (
              <SnapshotTable>
                <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
                <tbody>{menuRows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td><td className="px-4 py-3 text-slate-600">{row.category}</td><td className="px-4 py-3 text-right text-slate-700">{row.qty}</td><td className="px-4 py-3 text-right font-semibold">{row.total != null ? fmtINR(row.total) : '—'}</td></tr>)}</tbody>
              </SnapshotTable>
            )}
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><Calculator size={18} /> Internal Cost</h3>
            {costingRows.length === 0 ? <EmptySnapshot label="costing rows" /> : (
              <SnapshotTable>
                <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-left">Dish</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
                <tbody>{costingRows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-900">{row.ingredient}</td><td className="px-4 py-3 text-slate-600">{row.dishName}</td><td className="px-4 py-3 text-right text-slate-700">{row.qty} {row.unit}</td><td className="px-4 py-3 text-right">{row.rate != null ? fmtINR(row.rate) : '—'}</td><td className="px-4 py-3 text-right font-semibold">{row.total != null ? fmtINR(row.total) : '—'}</td></tr>)}</tbody>
              </SnapshotTable>
            )}
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><ShoppingCart size={18} /> Full Grocery List</h3>
            {groceryRows.length === 0 ? <EmptySnapshot label="grocery items" /> : (
              <SnapshotTable>
                <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Quantity</th></tr></thead>
                <tbody>{groceryRows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-900">{row.ingredient}</td><td className="px-4 py-3 text-slate-600">{row.category}</td><td className="px-4 py-3 text-right font-semibold">{row.quantity} {row.unit}</td></tr>)}</tbody>
              </SnapshotTable>
            )}
          </section>
        </div>
      )}
    </div>
  );
}


function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-xl
        text-sm font-medium
        bg-white text-black border border-gray-500
        hover:bg-gray-100 active:scale-[0.98]
        transition-all duration-200
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function TimelineItem({ item, isFirst, isLast }: { item: ActivityItem; isFirst: boolean; isLast: boolean }) {
  const iconMap = {
    converted: { bg: C.tealDim,   color: C.teal,   Icon: CheckCircle },
    created:   { bg: C.blueDim,   color: C.blue,   Icon: UserPlus },
    enquiry:   { bg: C.purpleDim, color: C.purple, Icon: MessageSquare },
    updated:   { bg: C.orangeDim, color: C.orange, Icon: Pencil },
  };
  const { bg, color, Icon } = iconMap[item.type];

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 z-10"
          style={{ backgroundColor: bg, border: `1px solid ${color}30`, boxShadow: isFirst ? `0 0 12px ${color}30` : 'none' }}>
          <Icon size={15} style={{ color }} />
        </div>
        {!isLast && <div className="w-px flex-1 mt-1" style={{ background: `linear-gradient(to bottom, ${color}40, transparent)`, minHeight: 28 }} />}
      </div>
      <div className={`pb-5 flex-1 min-w-0 ${isFirst ? 'opacity-100' : 'opacity-70'}`}>
        <p className="text-xs mb-1" style={{ color: C.muted }}>{fmtDateTime(item.date)}</p>
        <p className="text-sm font-semibold" style={{ color: isFirst ? C.text : C.muted }}>{item.title}</p>
        {item.subtitle && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1"
            style={{ backgroundColor: C.tealDim, color: C.teal }}>{item.subtitle}</span>
        )}
        <p className="text-xs mt-1" style={{ color: C.faint }}>by {item.by}</p>
      </div>
      {isFirst && (
        <div className="flex items-start pt-1">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: C.orangeDim, color: C.orange }}>LATEST</span>
        </div>
      )}
    </div>
  );
}

// ─── Delete Modal ───────────────────────────────────────────────────────────────

function DeleteModal({ name, onConfirm, onCancel, loading }: {
  name: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(9,14,26,0.8)' }}>
      <div className="rounded-2xl shadow-2xl p-6 w-full max-w-sm"
        style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl mb-4 mx-auto"
          style={{ backgroundColor: C.redDim, border: `1px solid ${C.red}30` }}>
          <Trash2 size={22} style={{ color: C.red }} />
        </div>
        <h3 className="text-base font-bold text-center mb-1" style={{ color: C.text }}>Delete Lead</h3>
        <p className="text-sm text-center mb-6" style={{ color: C.muted }}>
          Delete <span className="font-semibold" style={{ color: C.text }}>&ldquo;{name}&rdquo;</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: C.red, opacity: loading ? 0.7 : 1, boxShadow: `0 4px 16px ${C.redDim}` }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Dropdown ────────────────────────────────────────────────────────────

function StatusDropdown({ lead, onStatusChange }: { lead: LeadDetail; onStatusChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const transitions = VALID_TRANSITIONS[lead.status] ?? [];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const s = STATUS_CONFIG[lead.status] ?? { color: C.muted, bg: C.surface, glow: 'transparent' };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => transitions.length > 0 && setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold transition-all"
        style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.color}30`, cursor: transitions.length > 0 ? 'pointer' : 'default' }}>
        {lead.status.replace(/_/g, ' ')}
        {transitions.length > 0 && <ChevronDown size={14} />}
      </button>
      {open && transitions.length > 0 && (
        <div className="absolute top-full left-0 mt-2 z-20 rounded-xl overflow-hidden shadow-2xl"
          style={{ minWidth: 180, backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          {transitions.map(ns => {
            const ns_s = STATUS_CONFIG[ns] ?? { color: C.muted, bg: C.surface };
            return (
              <button key={ns}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors"
                style={{ color: C.text }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.surface; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                onClick={() => { onStatusChange(ns); setOpen(false); }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ns_s.color }} />
                {ns.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConvertToEventDialog({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-event-title"
        aria-describedby="convert-event-description"
        className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="convert-event-title" className="text-xl font-bold text-slate-900">
              Convert to Event?
            </h2>
            <p id="convert-event-description" className="mt-2 text-base leading-6 text-slate-600">
              This will confirm the enquiry and create a new event with all dishes, services, and pricing. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Confirm &amp; Convert
          </button>
        </div>
      </div>
    </div>
  );
}

function StartRevisionDialog({
  open,
  loading,
  nextRevisionNumber,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  nextRevisionNumber: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-revision-title"
        aria-describedby="start-revision-description"
        className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="start-revision-title" className="text-xl font-bold text-slate-900">
              Start Revision {nextRevisionNumber}?
            </h2>
            <p id="start-revision-description" className="mt-2 text-base leading-6 text-slate-600">
              The quotation will revert to Planning state, pricing will be cleared, and you can update menu and services.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Confirm → Rev {nextRevisionNumber}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertedEventId, setConvertedEventId] = useState<string | null>(null);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [currentRevisionNumber, setCurrentRevisionNumber] = useState(1);
  const [noteDraft, setNoteDraft] = useState('');
  const quotationSectionRef = useRef<HTMLDivElement | null>(null);
  const { data: lead, isLoading, isError } = useQuery<LeadDetail>({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/inquiries/${id}/`),
    enabled: !!id,
  });
  const { data: latestQuotation } = useQuery<LeadQuotationSummary | null>({
    queryKey: ['lead-quotation-summary', id],
    queryFn: async () => {
      const raw = await api.get(`/quotations/?inquiry=${id}`);
      const quotes: LeadQuotationSummary[] = Array.isArray(raw) ? raw : (raw?.results ?? []);
      return quotes[0] ?? null;
    },
    enabled: !!id,
  });
  const leadConvertedEventId = lead?.converted_event_id ?? lead?.event_id ?? null;

  useEffect(() => {
    if (leadConvertedEventId) setConvertedEventId(leadConvertedEventId);
  }, [leadConvertedEventId]);

  useEffect(() => {
    if (latestQuotation?.version_number) {
      setCurrentRevisionNumber(latestQuotation.version_number);
    }
  }, [latestQuotation?.version_number]);

  const canFetchConvertedEvent = Boolean(convertedEventId && convertedEventId !== EXISTING_EVENT_SENTINEL);
  const { data: convertedEventData, isLoading: isConvertedEventLoading } = useQuery<EventSnapshotResponse>({
    queryKey: ['converted-event', convertedEventId],
    queryFn: () => api.get(`/events/${convertedEventId}/`),
    enabled: canFetchConvertedEvent,
  });
  const hasEvent = Boolean(convertedEventId);

  async function handleStatusChange(newStatus: string) {
    if (!lead) return;
    try {
      await api.patch(`/inquiries/${lead.id}/`, { status: newStatus });
      toast.success(`Status → ${newStatus.replace(/_/g, ' ')}`);
      qc.invalidateQueries({ queryKey: ['lead', id] });
    } catch { toast.error('Failed to update status'); }
  }

  async function handleDelete() {
    if (!lead) return;
    setDeleting(true);
    try {
      await api.delete(`/inquiries/${lead.id}/`);
      toast.success('Lead deleted');
      router.push('/leads');
    } catch { toast.error('Failed to delete lead'); }
    finally { setDeleting(false); }
  }

  async function handleAddNote() {
    const next = noteDraft.trim();
    if (!next) return;
    try {
      await api.patch(`/inquiries/${id}/`, { notes: next });
      setNoteDraft('');
      toast.success('Note added');
      await qc.invalidateQueries({ queryKey: ['lead', id] });
    } catch {
      toast.error('Failed to add note');
    }
  }

  async function handleReviseQuotation() {
    if (!latestQuotation?.id) {
      toast.error('No quotation available to revise');
      return;
    }
    if (revisionLoading) return;

    setRevisionLoading(true);
    const toastId = toast.loading(`Creating revision ${nextRevisionNumber}...`);
    try {
      const revised = await api.post(`/quotations/${latestQuotation.id}/revise/`, {}) as {
        rev_number?: number;
        version_number?: number;
        version?: number;
      };
      const createdRevisionNumber = Number(
        revised.rev_number ?? revised.version_number ?? revised.version ?? nextRevisionNumber
      );
      setCurrentRevisionNumber(createdRevisionNumber);
      setRevisionModalOpen(false);
      toast.success(`Revision ${createdRevisionNumber} created`, { id: toastId });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['lead-quotation-summary', id] }),
        qc.invalidateQueries({ queryKey: ['quotation-menu', id] }),
        qc.invalidateQueries({ queryKey: ['lead', id] }),
      ]);
      quotationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to revise quotation'), { id: toastId });
    } finally {
      setRevisionLoading(false);
    }
  }

  async function handleConfirmAndConvert() {
    if (!lead) return;
    if (hasEvent) {
      toast.error('Event already created');
      setConvertModalOpen(false);
      return;
    }
    if (convertLoading) return;

    setConvertLoading(true);
    const toastId = toast.loading('Converting lead to event...');
    try {
      const result = await api.post(`/inquiries/${lead.id}/convert/`, {}) as { event_id?: string; id?: string };
      const eventId = result.event_id ?? result.id;
      if (eventId) setConvertedEventId(eventId);
      setConvertModalOpen(false);
      toast.success('Lead confirmed and converted to event', { id: toastId });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['lead', id] }),
        eventId ? qc.invalidateQueries({ queryKey: ['converted-event', eventId] }) : Promise.resolve(),
      ]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConvertedEventId(leadConvertedEventId ?? EXISTING_EVENT_SENTINEL);
        setConvertModalOpen(false);
        toast.error('Event already created', { id: toastId });
        await qc.invalidateQueries({ queryKey: ['lead', id] });
      } else {
        toast.error(getApiErrorMessage(error, 'Failed to confirm and convert'), { id: toastId });
      }
    } finally {
      setConvertLoading(false);
    }
  }

  async function handleDownloadQuotation() {
    if (!latestQuotation?.id) {
      toast.error('No quotation available to download yet');
      return;
    }
    try {
      const safeName = (lead?.customer_name || 'client').replace(/[\\/:*?"<>|]/g, '').trim() || 'client';
      await api.download(`/quotations/${latestQuotation.id}/export-pdf/`, `${quoteId} — ${safeName}.pdf`);
    } catch {
      toast.error('Failed to download quotation');
    }
  }


  if (isLoading) return <LeadDetailSkeleton />;
  if (isError || !lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" style={{ backgroundColor: C.bg }}>
        <p className="text-base font-medium" style={{ color: C.muted }}>Lead not found.</p>
        <button onClick={() => router.push('/leads')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ backgroundColor: C.orange, color: '#fff' }}>
          <ArrowLeft size={16} /> Back to Leads
        </button>
      </div>
    );
  }

  const timeline = buildTimeline(lead);
  const leadTemp = LEAD_TEMP[lead.status];
  const TempIcon = leadTemp?.icon ?? Flame;
  const quoteId = `QT-${new Date().getFullYear()}-${id.slice(-4).toUpperCase().padStart(4, '0')}`;
  const sourceChannelLabel = SOURCE_CHANNELS[lead.source_channel ?? ''] ?? 'General';
  const leadStatus = lead.status;
  const latestQuotationStatus = String(latestQuotation?.status ?? 'DRAFT').toUpperCase();
  const quotationVersion = currentRevisionNumber;
  const nextRevisionNumber = currentRevisionNumber + 1;
  const isQuotationFinalized = Boolean(latestQuotation?.is_locked)
    || ['SENT', 'ACCEPTED'].includes(latestQuotationStatus);
  const isQuotationDraft = !isQuotationFinalized;
  const planningLabel = quotationVersion > 1 ? `Planning - Rev. ${quotationVersion}` : 'Planning';
  const quotedPrice = Number(latestQuotation?.final_selling_price ?? 0);
  const internalCost = Number(latestQuotation?.internal_cost ?? 0);
  const advance = Number(latestQuotation?.advance_amount ?? 0);
  const menuTotal = quotedPrice;
  const fmtMoney = (value: number) => `₹${(Number.isFinite(value) ? value : 0).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen max-w-7xl mx-auto" style={{ backgroundColor: C.bg }}>
      {/* Overlays / Drawers */}
      {editOpen && (
        <LeadFormDrawer editing={lead} open={editOpen} onClose={() => setEditOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['lead', id] })} />
      )}
      {deleteOpen && (
        <DeleteModal name={lead.customer_name} onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)} loading={deleting} />
      )}
      <ConvertToEventDialog
        open={convertModalOpen}
        loading={convertLoading}
        onCancel={() => {
          if (!convertLoading) setConvertModalOpen(false);
        }}
        onConfirm={() => void handleConfirmAndConvert()}
      />
      <StartRevisionDialog
        open={revisionModalOpen}
        loading={revisionLoading}
        nextRevisionNumber={nextRevisionNumber}
        onCancel={() => {
          if (!revisionLoading) setRevisionModalOpen(false);
        }}
        onConfirm={() => void handleReviseQuotation()}
      />
      <div className="max-w-screen-2xl mx-auto px-4 py-5">

        {/* Lead Detail Header */}
        <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={() => router.push('/leads')}
                className="mt-1 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-black/10 hover:bg-black/5 transition-colors"
                aria-label="Back to leads"
              >
                <ArrowLeft size={15} style={{ color: C.muted }} />
              </button>
              <div className="min-w-0">
                <h1 className="text-3xl font-black tracking-tight truncate" style={{ color: C.text }}>
                  {lead.customer_name}
                  {lead.event_type && (
                    <span className="font-normal text-2xl" style={{ color: C.muted }}> · {lead.event_type}</span>
                  )}
                </h1>
                <p className="text-sm mt-1" style={{ color: C.muted }}>
                  Created {fmtDate(lead.created_at)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void handleDownloadQuotation()}
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border border-black/10 text-black hover:bg-black/5 transition-colors"
              >
                Download Quotation
              </button>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border"
                style={{
                  color: STATUS_CONFIG[lead.status]?.color ?? C.blue,
                  backgroundColor: STATUS_CONFIG[lead.status]?.bg ?? C.blueDim,
                  borderColor: `${STATUS_CONFIG[lead.status]?.color ?? C.blue}33`,
                }}
              >
                {STATUS_CONFIG[lead.status]?.label ?? lead.status}
              </span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border border-black/10 text-black">
                {lead.event_type || 'Event'}
              </span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border border-black/10 text-black">
                {sourceChannelLabel}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Client', value: lead.customer_name },
              { label: 'Venue', value: lead.venue?.trim() ? lead.venue : '—' },
              { label: 'Date & Time', value: lead.tentative_date ? fmtDateTime(lead.tentative_date) : '—' },
              { label: 'Guests', value: lead.guest_count ? `${lead.guest_count} people` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-black/10 px-3 py-2.5">
                <p className="text-xs font-medium" style={{ color: C.muted }}>{label}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: C.text }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <LeadStatusStepper
            status={lead.status}
            isQuotationLocked={isQuotationFinalized}
            convertedEventId={
              convertedEventId && convertedEventId !== EXISTING_EVENT_SENTINEL
                ? convertedEventId
                : leadConvertedEventId
            }
            convertedEventStatus={lead.converted_event_status}
          />
        </div>

        {/* Main Grid */}
        <div className="grid gap-5 lg:grid-cols-[1fr_320px] items-start">

          {/* ══════════════════════ LEFT MAIN CONTENT ══════════════════════ */}
          <div className="flex flex-col gap-5 min-w-0">

            {/* ── Hero Header Card ── */}
          

            {/* ── Quotation Card ── */}
            <div ref={quotationSectionRef}>
              <QuotationCard
                leadId={id}
                clientName={lead.customer_name}
                eventDate={lead.tentative_date}
                guestCount={lead.guest_count}
                eventType={lead.event_type}
              />
            </div>

            {canFetchConvertedEvent && convertedEventId && (
              <ConfirmedEventDetails
                rawEventData={convertedEventData}
                loading={isConvertedEventLoading}
                eventId={convertedEventId}
                onOpenEvent={() => router.push(`/events/${convertedEventId}`)}
                onDownloadQuotation={() => void handleDownloadQuotation()}
              />
            )}

            {/* ── Activity Timeline ── */}
            {/* <Card> */}
              {/* <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.purpleDim }}>
                    <Activity size={16} style={{ color: C.purple }} />
                  </div>
                  <h2 className="text-base font-bold" style={{ color: C.text }}>Activity Timeline</h2>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: C.surface, color: C.muted, border: `1px solid ${C.border}` }}>
                  {timeline.length} events
                </span>
              </div>
              <div className="flex flex-col">
                {timeline.map((item, idx) => (
                  <TimelineItem key={item.id} item={item} isFirst={idx === 0} isLast={idx === timeline.length - 1} />
                ))}
              </div>
            </Card> */}

            {/* ── Notes ── */}
            {/* <Card>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl p-4" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface }}>
                  <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Lead Notes</p>
                  {lead.notes ? (
                    <p className="text-sm leading-relaxed" style={{ color: C.text }}>{lead.notes}</p>
                  ) : (
                    <p className="text-sm italic" style={{ color: C.faint }}>No notes added yet. Edit the lead to add notes.</p>
                  )}
                </div>
                <button onClick={() => setEditOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 w-fit"
                  style={{ backgroundColor: C.surface, color: C.text, border: `1px solid ${C.border}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderHi; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; }}>
                  <Pencil size={14} /> {lead.notes ? 'Edit Notes' : 'Add Notes'}
                </button>
              </div>
            </Card> */}
          </div>

          {/* ══════════════════════ RIGHT SIDEBAR ══════════════════════ */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-5 self-start">
            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-md font-semibold tracking-wide text-slate-600 mb-4">ACTIONS</p>
              {leadStatus === 'PLANNING' && (
                <>
                  {isQuotationDraft ? (
                    <>
                    <div className="rounded-2xl border px-4 py-2 mb-4" style={{ borderColor: '#F4CD53', backgroundColor: '#FFF8E5' }}>
                      <p className="text-orange-600 font-semibold text-md">{planningLabel}</p>
                      <p className="text-orange-500 text-sm mt-0.5">
                        Edit menu, costing & pricing freely
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => quotationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="w-full rounded-2xl px-4 py-2 text-white text-md font-semibold mb-3 inline-flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(180deg, #5F4BFF 0%, #4338CA 100%)' }}
                    >
                      <IndianRupee size={20} />
                      Go to Pricing &amp; Quote
                    </button>
                    </>
                  ) : (
                    <>
                      <div className="rounded-2xl border px-4 py-2 mb-3" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                        <p className="text-blue-700 font-semibold text-md inline-flex items-center gap-2">
                          <Lock size={16} />
                          {hasEvent ? 'Event Already Created' : 'Quotation Sent'}
                        </p>
                        <p className="text-blue-600 text-sm mt-0.5">
                          {hasEvent ? 'Event already created. Revisions create a new draft quote only.' : `Awaiting client decision • Rev ${quotationVersion}`}
                        </p>
                      </div>
                      {!hasEvent && (
                        <button
                          type="button"
                          onClick={() => setConvertModalOpen(true)}
                          className="w-full rounded-2xl px-4 py-2 text-white text-md font-semibold mb-2 bg-emerald-600 hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={20} />
                          Confirm &amp; Convert to Event
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRevisionModalOpen(true)}
                        className="w-full rounded-2xl px-4 py-2 text-indigo-700 text-md font-semibold mb-3 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors inline-flex items-center justify-between"
                      >
                        <span className="inline-flex items-center gap-2">
                          <RotateCcw size={18} />
                          Revise Quotation
                        </span>
                        <span className="text-sm font-semibold">→ Rev {nextRevisionNumber}</span>
                      </button>
                    </>
                  )}
                </>
              )}

              {leadStatus === 'SUCCESS' && (
                <>
                  <div className="rounded-2xl border px-4 py-2 mb-4" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                    <p className="text-blue-700 font-semibold text-md inline-flex items-center gap-2">
                      <Lock size={16} />
                      {hasEvent ? 'Event Already Created' : 'Quotation Sent'}
                    </p>
                    <p className="text-blue-600 text-sm mt-0.5">
                      {hasEvent ? 'Event already created. Revisions create a new draft quote only.' : `Awaiting client decision • Rev ${quotationVersion}`}
                    </p>
                  </div>
                  {canFetchConvertedEvent && convertedEventId ? (
                    <button
                      type="button"
                      onClick={() => router.push(`/events/${convertedEventId}`)}
                      className="w-full rounded-2xl px-4 py-2 text-white text-md font-semibold mb-2 bg-emerald-600 hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={18} />
                      Open Event
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConvertModalOpen(true)}
                      className="w-full rounded-2xl px-4 py-2 text-white text-md font-semibold mb-2 bg-emerald-600 hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={20} />
                      Confirm &amp; Convert to Event
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRevisionModalOpen(true)}
                    className="w-full rounded-2xl px-4 py-2 text-indigo-700 text-md font-semibold mb-3 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors inline-flex items-center justify-between"
                  >
                    <span className="inline-flex items-center gap-2">
                      <RotateCcw size={18} />
                      Revise Quotation
                    </span>
                    <span className="text-sm font-semibold">→ Rev {nextRevisionNumber}</span>
                  </button>
                </>
              )}

              {leadStatus === 'SUCCESS' && (
                <div className="rounded-2xl border px-4 py-2 mb-4" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                  <p className="text-emerald-700 font-semibold text-md">Lead Success</p>
                  <p className="text-emerald-600 text-sm mt-0.5">Use event workflow actions only.</p>
                </div>
              )}

              {(leadStatus === 'PLANNING' || leadStatus === 'SUCCESS') && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('LOST')}
                  className="w-full rounded-2xl border px-4 py-2 text-red-600 text-md font-semibold hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-2"
                  style={{ borderColor: '#F4B4B4' }}
                >
                  <X size={18} />
                  Mark as Lost
                </button>
              )}
            </div>

            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-lg font-semibold tracking-wide text-slate-600 mb-4">SUMMARY</p>
              <div className="space-y-2 text-md leading-tight">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Menu Total</span>
                  <span className="font-semibold text-black">{fmtMoney(menuTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Internal Cost</span>
                  <span className="font-semibold text-black">{fmtMoney(internalCost)}</span>
                </div>
                <div className="border-t border-black/10 pt-2 mt-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Quoted Price</span>
                  <span className="font-bold text-indigo-600">{fmtMoney(quotedPrice)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Advance</span>
                  <span className="font-semibold text-emerald-600">{fmtMoney(advance)}</span>
                </div>
                <div className="text-xs text-slate-500 pt-1">Rev {quotationVersion} {isQuotationFinalized ? '• Locked' : '• Editable'}</div>
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-lg font-semibold tracking-wide text-slate-600 mb-4">ADD NOTE</p>
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                rows={4}
                placeholder="Add a note or update..."
                className="w-full rounded-2xl border border-slate-300 px-4 py-2 text-lg text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                type="button"
                onClick={() => void handleAddNote()}
                className="w-full mt-4 rounded-2xl px-4 py-2 text-lg font-semibold text-white transition-colors"
                style={{ backgroundColor: '#8D96A2' }}
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
