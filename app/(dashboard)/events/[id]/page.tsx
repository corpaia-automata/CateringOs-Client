'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, IndianRupee,
  Plus, ShoppingCart, FileText, CheckCircle, XCircle, Eye, EyeOff,
  Loader2, Download, Clock, X, Search, ChevronDown, AlertTriangle,
  ChefHat, Calculator, Trash2, Check, CalendarDays, MapPin, ClipboardList, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { EventPlanningLineEditor, type PlanningLineItem } from '@/components/planning/EventPlanningLineEditor';
import { EVENT_TYPES, SERVICE_TYPES } from '@/lib/constants';
import { parseGuestCount } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface EventDetail {
  id: string;
  lead_id?: string;
  quotation_id?: string;
  event_id?: string;
  event_code?: string;
  event_name: string;
  client_name?: string;
  contact_number?: string;
  event_type: string;
  service_type: string;
  service_type_narration?: string;
  event_date: string;
  event_time?: string;
  event_end_time?: string;
  venue?: string;
  guest_count: number;
  total_amount?: string | number;
  advance_amount?: string | number;
  balance_amount?: string | number;
  extra_charges?: string | number;
  total_cost?: string | number;
  payment_status?: string;
  status: string;
  notes?: string;
  created_at: string;
  created_by?: { full_name?: string; email?: string };
  grocery_generated?: boolean;
  food_cost?: string | number;
  labor_cost?: string | number;
  other_costs?: string | number;
  suggested_price?: string | number;
}

interface MenuItem {
  id: string;
  dish: string;
  dish_name_snapshot: string;
  unit_type_snapshot?: string;
  quantity: number;
  sort_order?: number;
}

interface Quotation {
  id: string;
  version: number;
  created_at: string;
  total_amount: string | number;
  status: string;
}

interface ActivityLog {
  id: string;
  action: string;
  description?: string;
  created_at: string;
  user?: { full_name?: string; email?: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:       ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:   ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
};

const SERVICE_LABELS: Record<string, string> = {
  BUFFET:        'Buffet',
  BOX_COUNTER:   'Box Counter',
  TABLE_SERVICE: 'Table Service',
  OTHER:         'Other',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtTime(t?: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function fmtINR(v?: string | number) {
  if (v == null || v === '') return '₹0';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function toNumber(v?: string | number | null) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function apiErrorData(err: unknown): { detail?: string; [key: string]: unknown } {
  return (err as { data?: { detail?: string; [key: string]: unknown } })?.data ?? {};
}

function maskPhone(phone?: string) {
  if (!phone) return '—';
  if (phone.length < 7) return phone;
  return phone.slice(0, 4) + '*****' + phone.slice(-2);
}

function eventIdDisplay(event: EventDetail) {
  return event.event_id ?? `#EVT-${String(event.id).slice(-5).toUpperCase().padStart(5, '0')}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return fmtDate(dateStr);
}

function formatQty(qty: number, unit: string): { value: string; unit: string } {
  if (qty === 0) return { value: '0', unit };
  if (unit === 'kg' && qty < 1) return { value: String(Math.round(qty * 1000)), unit: 'gram' };
  if (unit === 'litre' && qty < 1) return { value: String(Math.round(qty * 1000)), unit: 'ml' };
  if (unit === 'gram') {
    if (qty % 1 === 0) return { value: String(qty), unit: 'gram' };
    return { value: qty.toFixed(2), unit: 'gram' };
  }
  return { value: qty % 1 === 0 ? String(qty) : qty.toFixed(2), unit };
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT:       { bg: '#F1F5F9', color: '#64748B' },
  CONFIRMED:   { bg: '#ECFDF5', color: '#0D9488' },
  IN_PROGRESS: { bg: '#FFF7ED', color: '#F97316' },
  COMPLETED:   { bg: '#F0FDF4', color: '#16A34A' },
  CANCELLED:   { bg: '#FEF2F2', color: '#DC2626' },
};


function StatusBadge({ value, map }: { value: string; map: Record<string, { bg: string; color: string }> }) {
  const s = map[value] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Edit Event Drawer ─────────────────────────────────────────────────────────

function EditEventDrawer({ event, open, onClose, onSaved }: {
  event: EventDetail; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...event, guest_count: String(parseGuestCount(event.guest_count)) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...event, guest_count: String(parseGuestCount(event.guest_count)) });
  }, [event, open]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.client_name?.trim()) { toast.error('Client name is required'); return; }
    setSaving(true);
    try {
      await api.patch(`/events/${event.id}/`, {
        client_name: form.client_name,
        contact_number: form.contact_number || '',
        event_type: form.event_type || '',
        service_type: form.service_type,
        service_type_narration: form.service_type === 'OTHER' ? form.service_type_narration : '',
        event_date: form.event_date || null,
        event_time: form.event_time || null,
        venue: form.venue || '',
        guest_count: parseGuestCount(form.guest_count as unknown as string),
        notes: form.notes || '',
      });
      // Status change goes through the transition endpoint
      if (form.status !== event.status) {
        await api.post(`/events/${event.id}/transition/`, { status: form.status });
      }
      toast.success('Event updated');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const data = apiErrorData(err);
      const msgs = Object.values(data).flat();
      toast.error(msgs.length ? msgs.join(', ') : data.detail ?? 'Failed to update');
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors';
  const ist = { border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' };
  const lbl = 'block text-xs font-medium mb-1';

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(15,23,42,0.4)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.2s' }} />
      <div className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width: 460, backgroundColor: '#fff', transform: open ? 'translateX(0)' : 'translateX(100%)', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', transition: 'transform 0.25s ease' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E2E8F0' }}>
          <h2 className="font-semibold text-base" style={{ color: '#0F172A' }}>Edit Event</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X size={18} style={{ color: '#64748B' }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Client Name */}
          <div><label className={lbl} style={{ color: '#0F172A' }}>Client Name <span style={{ color: '#DC2626' }}>*</span></label>
            <input className={inp} style={ist} value={form.client_name ?? ''} onChange={e => set('client_name', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>

          {/* Contact */}
          <div><label className={lbl} style={{ color: '#0F172A' }}>Contact</label>
            <input className={inp} style={ist} value={form.contact_number ?? ''} onChange={e => set('contact_number', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>

          {/* Service Type */}
          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Service Type</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {SERVICE_TYPES.map(svc => (
                <label key={svc} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
                  style={{ border: `1.5px solid ${form.service_type === svc ? '#D95F0E' : '#E2E8F0'}`, backgroundColor: form.service_type === svc ? '#FFF7ED' : '#F8FAFC' }}>
                  <input type="radio" name="svc_type" value={svc} checked={form.service_type === svc}
                    onChange={() => set('service_type', svc)} className="accent-[#D95F0E]" />
                  <span className="text-xs font-medium" style={{ color: form.service_type === svc ? '#D95F0E' : '#64748B' }}>
                    {SERVICE_LABELS[svc]}
                  </span>
                </label>
              ))}
            </div>
            {form.service_type === 'OTHER' && (
              <div className="mt-2">
                <label className={lbl} style={{ color: '#0F172A' }}>Narration <span style={{ color: '#DC2626' }}>*</span></label>
                <input className={inp} style={ist} value={form.service_type_narration ?? ''} onChange={e => set('service_type_narration', e.target.value)}
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
              </div>
            )}
          </div>

          {/* Event Type */}
          <div><label className={lbl} style={{ color: '#0F172A' }}>Event Type</label>
            <select className={inp} style={ist} value={form.event_type ?? ''} onChange={e => set('event_type', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
              <option value="">Select</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl} style={{ color: '#0F172A' }}>Event Date</label>
              <input type="date" className={inp} style={ist} value={form.event_date ?? ''} onChange={e => set('event_date', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>
            <div><label className={lbl} style={{ color: '#0F172A' }}>Event Time</label>
              <input type="time" className={inp} style={ist} value={form.event_time ?? ''} onChange={e => set('event_time', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>
          </div>

          {/* Venue + Guest Count */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl} style={{ color: '#0F172A' }}>Venue</label>
              <input className={inp} style={ist} value={form.venue ?? ''} onChange={e => set('venue', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>
            <div><label className={lbl} style={{ color: '#0F172A' }}>Guest Count <span style={{ color: '#DC2626' }}>*</span></label>
              <input type="number" min="1" className={inp} style={ist} value={form.guest_count ?? ''} onChange={e => set('guest_count', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>
          </div>

          {/* Status — only show valid transitions */}
          {(VALID_TRANSITIONS[event.status] ?? []).length > 0 && (
            <div>
              <label className={lbl} style={{ color: '#0F172A' }}>Status</label>
              <select className={inp} style={ist} value={form.status ?? event.status} onChange={e => set('status', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                <option value={event.status}>{event.status.replace(/_/g, ' ')} (current)</option>
                {(VALID_TRANSITIONS[event.status] ?? []).map(ns => (
                  <option key={ns} value={ns}>{ns.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div><label className={lbl} style={{ color: '#0F172A' }}>Notes</label>
            <textarea className={inp} style={{ ...ist, resize: 'vertical' }} rows={3} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#64748B', border: '1px solid #E2E8F0' }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#D95F0E', opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Saving…' : 'Update Event'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Dish type ────────────────────────────────────────────────────────────────

interface Dish {
  id: string;
  name: string;
  category: string;
  unit_type: string;
  has_recipe: boolean;
}

interface IngredientRow {
  ingredient_id: string;
  ingredient_name: string;
  category: string;
  total_quantity: string | number;
  unit: string;
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
  dishId?: string;
  name: string;
  category: string;
  qty: number | string;
  unit: string;
  price: number | string | null;
  total: number | string | null;
}

interface SnapshotCostingItem {
  id: string;
  ingredient: string;
  qty: number | string;
  unit?: string;
  rate: number | string | null;
  total: number | string | null;
  category?: string;
  source?: 'derived' | 'manual';
}

interface SnapshotGroceryItem {
  id: string;
  ingredient: string;
  quantity: number | string;
  unit: string;
  category: string;
}

// ─── Badge maps ───────────────────────────────────────────────────────────────

const CAT_BADGE: Record<string, { bg: string; color: string }> = {
  MEAT:       { bg: '#FEF2F2', color: '#DC2626' },
  GROCERY:    { bg: '#EFF6FF', color: '#3B82F6' },
  VEGETABLE:  { bg: '#F0FDF4', color: '#16A34A' },
  FRUIT:      { bg: '#FFF7ED', color: '#F97316' },
  DISPOSABLE: { bg: '#F5F3FF', color: '#7C3AED' },
  RENTAL:     { bg: '#ECFDF5', color: '#0D9488' },
  OTHER:      { bg: '#F1F5F9', color: '#64748B' },
};

const UNIT_BADGE: Record<string, { bg: string; color: string }> = {
  KG:      { bg: '#FFF7ED', color: '#D95F0E' },
  PLATE:   { bg: '#EFF6FF', color: '#3B82F6' },
  PIECE:   { bg: '#F5F3FF', color: '#7C3AED' },
  LITRE:   { bg: '#ECFDF5', color: '#0D9488' },
  PORTION: { bg: '#F0FDF4', color: '#16A34A' },
};

function UnitPill({ unit }: { unit: string }) {
  const s = UNIT_BADGE[unit] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
      style={{ backgroundColor: s.bg, color: s.color, letterSpacing: '0.04em' }}>
      {unit}
    </span>
  );
}

function normalizeMenuSnapshot(snapshot: unknown): SnapshotMenuItem[] {
  if (!snapshot) return [];
  const rows = Array.isArray(snapshot)
    ? snapshot
    : typeof snapshot === 'object' && snapshot && 'items' in (snapshot as Record<string, unknown>)
      ? ((snapshot as { items?: unknown[] }).items ?? [])
      : [];
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id ?? `menu-${index}`),
      dishId: item.dish_id != null ? String(item.dish_id) : undefined,
      name: String(item.dish_name_snapshot ?? item.dish_name ?? item.dish ?? item.name ?? 'Dish'),
      category: String(item.category ?? item.dish_category ?? 'Other'),
      qty: (item.quantity ?? item.qty ?? item.pax ?? 0) as number | string,
      unit: String(item.unit ?? item.unit_type_snapshot ?? 'plate'),
      price: (item.price_per_plate ?? item.selling_price ?? item.rate ?? item.price ?? null) as number | string | null,
      total: (item.total ?? item.line_total ?? item.total_price ?? item.subtotal ?? item.amount ?? null) as number | string | null,
    };
  });
}

function normalizeServicesSnapshot(snapshot: unknown): SnapshotMenuItem[] {
  if (!snapshot) return [];
  const rows = Array.isArray(snapshot)
    ? snapshot
    : typeof snapshot === 'object' && snapshot && 'items' in (snapshot as Record<string, unknown>)
      ? ((snapshot as { items?: unknown[] }).items ?? [])
      : [];
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id ?? `service-${index}`),
      name: String(item.name ?? item.service_name ?? 'Service'),
      category: 'Services',
      qty: (item.qty ?? item.quantity ?? 1) as number | string,
      unit: String(item.unit ?? 'unit'),
      price: (item.rate ?? item.price ?? null) as number | string | null,
      total: (item.subtotal ?? item.total ?? null) as number | string | null,
    };
  });
}

function normalizeCostingSnapshot(snapshot: unknown): SnapshotCostingItem[] {
  if (!snapshot) return [];
  const rows = Array.isArray(snapshot)
    ? snapshot
    : typeof snapshot === 'object' && snapshot && 'items' in (snapshot as Record<string, unknown>)
      ? ((snapshot as { items?: unknown[] }).items ?? [])
      : [];
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    const qty = (item.quantity ?? item.qty ?? 0) as number | string;
    const rate = (item.rate ?? item.unit_rate ?? item.price ?? null) as number | string | null;
    return {
      id: String(item.id ?? `cost-${index}`),
      ingredient: String(item.ingredient_name ?? item.name ?? 'Ingredient'),
      qty,
      unit: String(item.unit ?? 'unit'),
      rate,
      total: (item.total_cost ?? item.total ?? item.line_total ?? item.amount ?? null) as number | string | null,
      category: String(item.category ?? 'OTHER'),
      source: item.source === 'derived' ? 'derived' : 'manual',
    };
  });
}

function normalizeGrocerySnapshot(snapshot: unknown): SnapshotGroceryItem[] {
  if (!snapshot) return [];
  const rows = Array.isArray(snapshot)
    ? snapshot
    : typeof snapshot === 'object' && snapshot && 'items' in (snapshot as Record<string, unknown>)
      ? ((snapshot as { items?: unknown[] }).items ?? [])
      : [];
  return rows.map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id ?? `grocery-${index}`),
      ingredient: String(item.ingredient_name ?? item.name ?? 'Item'),
      quantity: (item.total_quantity ?? item.quantity ?? item.qty ?? 0) as number | string,
      unit: String(item.unit ?? ''),
      category: String(item.category ?? '—'),
    };
  });
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

function resolveEventPayload(raw: unknown): {
  event: EventDetail | null;
  menuSnapshot: unknown;
  servicesSnapshot: unknown;
  costingSnapshot: unknown;
  grocerySnapshot: unknown;
  pricingSnapshot: AnyRecord | null;
} {
  const root = asRecord(raw) ?? {};
  const nested =
    asRecord(root.data) ??
    asRecord(root.result) ??
    asRecord(root.payload) ??
    root;
  const snapshots = asRecord(nested.snapshots) ?? {};

  const event =
    (nested.event_details as EventDetail | undefined) ??
    (nested.event as EventDetail | undefined) ??
    (nested.event_data as EventDetail | undefined) ??
    (nested.id ? (nested as unknown as EventDetail) : null);

  const menuSnapshot =
    parseSnapshot(nested.menu_snapshot ?? snapshots.menu_snapshot ?? snapshots.menu ?? nested.menu ?? nested.menu_items ?? null);
  const servicesSnapshot =
    parseSnapshot(nested.services_snapshot ?? snapshots.services_snapshot ?? nested.services ?? null);
  const costingSnapshot =
    parseSnapshot(nested.costing_snapshot ?? snapshots.costing_snapshot ?? snapshots.costing ?? nested.costing ?? nested.cost_items ?? null);
  const grocerySnapshot =
    parseSnapshot(nested.grocery_snapshot ?? snapshots.grocery_snapshot ?? snapshots.grocery ?? nested.grocery ?? nested.grocery_items ?? null);
  const pricingSnapshot =
    (parseSnapshot(
      nested.pricing_snapshot ??
      snapshots.pricing_snapshot ??
      snapshots.pricing ??
      nested.payment_snapshot ??
      nested.pricing ??
      null,
    ) as AnyRecord | null);

  return { event, menuSnapshot, servicesSnapshot, costingSnapshot, grocerySnapshot, pricingSnapshot };
}

function resolveLeadId(raw: unknown): string | null {
  const root = asRecord(raw) ?? {};
  const nested =
    asRecord(root.data) ??
    asRecord(root.result) ??
    asRecord(root.payload) ??
    root;
  const event = asRecord(nested.event_details) ?? asRecord(nested.event) ?? nested;
  const leadId = event?.lead_id ?? event?.lead ?? nested.lead_id;
  return leadId != null ? String(leadId) : null;
}

function normalizeLeadMenuPayload(leadRaw: unknown): SnapshotMenuItem[] {
  const root = asRecord(leadRaw) ?? {};
  const nested = asRecord(root.data) ?? asRecord(root.result) ?? asRecord(root.payload) ?? root;
  const menuRaw = parseSnapshot(nested.menu ?? nested.menu_snapshot ?? nested.menu_items ?? null);
  const directMenu = normalizeMenuSnapshot(menuRaw);
  if (directMenu.length > 0) return directMenu;

  const dishesRaw = nested.menu_dishes;
  const servicesRaw = nested.menu_services;
  const dishes = Array.isArray(dishesRaw) ? dishesRaw : [];
  const services = Array.isArray(servicesRaw) ? servicesRaw : [];

  if (dishes.length === 0 && services.length === 0) return [];

  const dishRows = dishes.map((row, idx) => {
    const dish = row as AnyRecord;
    return {
      id: String(dish.id ?? `lead-dish-${idx}`),
      name: String(dish.name ?? dish.dish_name ?? 'Dish'),
      category: String(dish.category ?? 'Dishes'),
      qty: (dish.qty ?? dish.quantity ?? 0) as number | string,
      unit: String(dish.unit ?? 'plate'),
      price: (dish.rate ?? dish.price ?? null) as number | string | null,
      total: (dish.subtotal ?? dish.total ?? null) as number | string | null,
    } satisfies SnapshotMenuItem;
  });

  const serviceRows = services.map((row, idx) => {
    const service = row as AnyRecord;
    return {
      id: String(service.id ?? `lead-service-${idx}`),
      name: String(service.name ?? 'Service'),
      category: 'Services',
      qty: (service.qty ?? service.quantity ?? 1) as number | string,
      unit: String(service.unit ?? 'unit'),
      price: (service.rate ?? service.price ?? null) as number | string | null,
      total: (service.subtotal ?? service.total ?? null) as number | string | null,
    } satisfies SnapshotMenuItem;
  });

  return [...dishRows, ...serviceRows];
}

function EditableCostingTab({
  eventId,
  rows,
  internalCost,
  disabled,
  onUpdated,
}: {
  eventId: string;
  rows: SnapshotCostingItem[];
  internalCost: number;
  disabled: boolean;
  onUpdated: (data: EventSnapshotResponse) => void;
}) {
  const derivedRows = useMemo(() => rows.filter(row => row.source === 'derived'), [rows]);
  const manualRows = useMemo(() => rows.filter(row => row.source !== 'derived'), [rows]);
  const [draftRows, setDraftRows] = useState(manualRows);
  const combinedRows = useMemo(() => [...derivedRows, ...draftRows], [derivedRows, draftRows]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraftRows(manualRows); }, [manualRows]);

  function updateRow(id: string, key: keyof SnapshotCostingItem, value: string) {
    setDraftRows(items => items.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, [key]: value };
      return next;
    }));
  }

  function addRow() {
    setDraftRows(items => [...items, { id: `manual-cost-${Date.now()}`, ingredient: '', qty: 1, unit: 'unit', rate: 0, total: null, source: 'manual' }]);
  }

  async function saveRows(nextRows = draftRows) {
    if (disabled) return;
    setSaving(true);
    try {
      const data = await api.patch(`/events/${eventId}/costing/`, {
        items: nextRows.map(row => ({
          id: row.id,
          name: row.ingredient,
          quantity: toNumber(row.qty),
          rate: toNumber(row.rate),
          unit: row.unit || 'unit',
        })),
      }) as EventSnapshotResponse;
      onUpdated(data);
      toast.success('Costing updated');
    } catch (err: unknown) {
      toast.error(apiErrorData(err).detail ?? 'Failed to update costing');
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: string) {
    const nextRows = draftRows.filter(row => row.id !== id);
    setDraftRows(nextRows);
    await saveRows(nextRows);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E2E8F0', backgroundColor: '#fff' }}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: '#E2E8F0' }}>
          <div>
            <h3 className="text-xl font-semibold text-slate-800">Cost Breakdown</h3>
            <p className="mt-1 text-xs text-slate-500">Recipe ingredients are auto-merged from dishes. Add manual costs in the same table.</p>
          </div>
          <button type="button" onClick={addRow} disabled={disabled}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Plus size={15} /> Add Manual Cost
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50" style={{ borderColor: '#E2E8F0' }}>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">Item</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">Category</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Qty</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Rate</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Total</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {combinedRows.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">No costing rows yet. Add dishes with recipes or add a manual cost.</td></tr>
              ) : combinedRows.map(row => {
                const isDerived = row.source === 'derived';
                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      {isDerived ? (
                        <span className="font-medium text-slate-800">{row.ingredient}</span>
                      ) : (
                        <input disabled={disabled} value={row.ingredient} onChange={e => updateRow(row.id, 'ingredient', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${isDerived ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
                        {isDerived ? 'Recipe' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.category ?? 'OTHER'}</td>
                    <td className="px-4 py-3 text-right">
                      {isDerived ? (
                        <span className="text-slate-600">{row.qty} {row.unit ?? ''}</span>
                      ) : (
                        <input disabled={disabled} type="number" min={0} value={row.qty} onChange={e => updateRow(row.id, 'qty', e.target.value)}
                          className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isDerived ? (
                        <span className="text-slate-600">{row.rate != null ? fmtINR(row.rate) : '—'}</span>
                      ) : (
                        <input disabled={disabled} type="number" min={0} value={row.rate ?? 0} onChange={e => updateRow(row.id, 'rate', e.target.value)}
                          className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{row.total != null ? fmtINR(row.total) : '—'}</td>
                    <td className="px-4 py-3">
                      {isDerived ? (
                        <span className="block text-right text-xs text-slate-400">Auto</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={disabled || saving} onClick={() => void saveRows()}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          </button>
                          <button type="button" disabled={disabled || saving} onClick={() => void removeRow(row.id)}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-2xl bg-slate-950 px-6 py-4 flex items-center justify-between">
        <span className="text-white text-xl font-semibold">API Internal Cost</span>
        <span className="text-white text-2xl font-bold">{fmtINR(internalCost)}</span>
      </div>
    </div>
  );
}

function PricingTab({
  event,
  pricing,
  disabled,
  onUpdated,
}: {
  event: EventDetail;
  pricing: Record<string, unknown>;
  disabled: boolean;
  onUpdated: (data: EventSnapshotResponse) => void;
}) {
  const [advance, setAdvance] = useState(toNumber((pricing.advance_amount as string | number | undefined) ?? event.advance_amount));
  const [finalPrice, setFinalPrice] = useState(toNumber((pricing.final_total as string | number | undefined) ?? event.total_amount));
  const [extraAmount, setExtraAmount] = useState('');
  const [extraDescription, setExtraDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAdvance(toNumber((pricing.advance_amount as string | number | undefined) ?? event.advance_amount));
    setFinalPrice(toNumber((pricing.final_total as string | number | undefined) ?? event.total_amount));
  }, [event.advance_amount, event.total_amount, pricing.advance_amount, pricing.final_total]);

  const originalQuote = toNumber((pricing.original_quote as string | number | undefined) ?? event.total_amount);
  const addOns = toNumber((pricing.extra_charges as string | number | undefined) ?? event.extra_charges);
  const finalTotal = toNumber((pricing.final_total as string | number | undefined) ?? (pricing.final_selling_price as string | number | undefined) ?? event.total_amount);
  const balance = toNumber((pricing.balance_amount as string | number | undefined) ?? event.balance_amount);
  const margin = toNumber(pricing.margin_percentage as string | number | undefined);

  async function savePricing() {
    if (disabled) return;
    setSaving(true);
    try {
      const data = await api.patch(`/events/${event.id}/pricing/`, {
        final_selling_price: finalPrice,
        advance_amount: advance,
      }) as EventSnapshotResponse;
      onUpdated(data);
      toast.success('Pricing updated');
    } catch (err: unknown) {
      toast.error(apiErrorData(err).detail ?? 'Failed to update pricing');
    } finally {
      setSaving(false);
    }
  }

  async function addExtraCharge() {
    if (disabled || toNumber(extraAmount) <= 0) return;
    setSaving(true);
    try {
      const data = await api.post(`/events/${event.id}/extra-charge/`, {
        amount: toNumber(extraAmount),
        description: extraDescription || 'Additional charge',
      }) as EventSnapshotResponse;
      onUpdated(data);
      setExtraAmount('');
      setExtraDescription('');
      toast.success('Extra charge added');
    } catch (err: unknown) {
      toast.error(apiErrorData(err).detail ?? 'Failed to add extra charge');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-sm font-medium text-slate-500">Original Quote</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{fmtINR(originalQuote)}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-medium text-amber-700">Add-ons</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{fmtINR(addOns)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="text-sm font-medium text-emerald-700">Final Total</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{fmtINR(finalTotal)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-semibold text-slate-800">Pricing</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-600">
            Final Selling Price
            <input disabled={disabled} type="number" min={0} value={finalPrice} onChange={e => setFinalPrice(toNumber(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50" />
          </label>
          <label className="text-sm font-medium text-slate-600">
            Advance Amount
            <input disabled={disabled} type="number" min={0} value={advance} onChange={e => setAdvance(toNumber(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50" />
          </label>
          <div>
            <p className="text-sm font-medium text-slate-500">Balance</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{fmtINR(balance)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Margin</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{margin.toFixed(1)}%</p>
          </div>
        </div>
        <button type="button" disabled={disabled || saving} onClick={() => void savePricing()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save Pricing
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-semibold text-slate-800">Extra Charges</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <input disabled={disabled} value={extraDescription} onChange={e => setExtraDescription(e.target.value)}
            placeholder="Reason, e.g. Last-minute dish addition"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50" />
          <input disabled={disabled} type="number" min={0} value={extraAmount} onChange={e => setExtraAmount(e.target.value)}
            placeholder="Amount"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50" />
          <button type="button" disabled={disabled || saving || toNumber(extraAmount) <= 0} onClick={() => void addExtraCharge()}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Add Charge
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({ event, onSaved }: { event: EventDetail; onSaved: () => void }) {
  const [notes, setNotes] = useState(event.notes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNotes(event.notes ?? ''); }, [event.notes]);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/events/${event.id}/`, { notes });
      toast.success('Notes saved');
      onSaved();
    } catch { toast.error('Failed to save notes'); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Add internal notes about this event…"
        className="w-full px-3 py-3 rounded-lg text-sm outline-none resize-none"
        style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A', minHeight: 180 }}
        onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
        onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: '#D95F0E', opacity: saving ? 0.7 : 1 }}>
          {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Saving…' : 'Save Notes'}
        </button>
      </div>
    </div>
  );
}

// ─── Quotation Tab ─────────────────────────────────────────────────────────────

function QuotationTab({ eventId, eventCode }: { eventId: string; eventCode: string }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', eventId],
    queryFn: () => api.get(`/events/${eventId}/quotations/`),
  });

  const quotes: Quotation[] = data?.results ?? data ?? [];

  async function generate() {
    setGenerating(true);
    try {
      await api.post(`/events/${eventId}/quotations/`, {});
      toast.success('Quotation generated');
      qc.invalidateQueries({ queryKey: ['quotations', eventId] });
    } catch (err: unknown) {
      toast.error(apiErrorData(err).detail ?? 'Failed to generate quotation');
    } finally { setGenerating(false); }
  }

  async function downloadLatestPdf() {
    setPdfLoading(true);
    try {
      await api.download(
        `/events/${eventId}/quotations/latest/pdf/`,
        `Afsal-Catering-${eventCode}.pdf`,
      );
      toast.success('Quotation ready');
    } catch {
      toast.error('Failed to generate quotation');
    } finally { setPdfLoading(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: '#64748B' }}>{quotes.length} version{quotes.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          <button onClick={downloadLatestPdf} disabled={pdfLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ border: '1px solid #E2E8F0', color: '#64748B', backgroundColor: '#fff', opacity: pdfLoading ? 0.7 : 1 }}>
            {pdfLoading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {pdfLoading ? 'Preparing…' : 'Download PDF'}
          </button>
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: '#1C3355', opacity: generating ? 0.7 : 1 }}>
            {generating ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            Generate Quotation
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center py-10" style={{ color: '#94A3B8' }}>
          <FileText size={36} className="mb-2 opacity-30" />
          <p className="text-sm">No quotations yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {quotes.map(q => (
            <div key={q.id} className="flex items-center justify-between px-4 py-3 rounded-lg"
              style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Version {q.version}</p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{fmtDate(q.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{fmtINR(q.total_amount)}</span>
                <StatusBadge value={q.status} map={STATUS_STYLE} />
                <button onClick={downloadLatestPdf} disabled={pdfLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ border: '1px solid #E2E8F0', color: '#64748B', backgroundColor: '#fff', opacity: pdfLoading ? 0.7 : 1 }}>
                  {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

function ActivityTab({ eventId }: { eventId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['event-activity', eventId],
    queryFn: () => api.get(`/events/${eventId}/activity/`),
  });

  const logs: ActivityLog[] = data?.results ?? data ?? [];

  if (isLoading) return (
    <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
  );

  if (logs.length === 0) return (
    <div className="flex flex-col items-center py-10" style={{ color: '#94A3B8' }}>
      <Clock size={36} className="mb-2 opacity-30" />
      <p className="text-sm">No activity recorded</p>
    </div>
  );

  return (
    <div className="relative pl-5">
      <div className="absolute left-2 top-2 bottom-2 w-px" style={{ backgroundColor: '#E2E8F0' }} />
      <div className="flex flex-col gap-5">
        {logs.map((log, i) => (
          <div key={log.id} className="relative flex gap-3">
            <div className="absolute -left-3 top-0.5 w-2.5 h-2.5 rounded-full border-2"
              style={{ backgroundColor: i === 0 ? '#D95F0E' : '#E2E8F0', borderColor: i === 0 ? '#D95F0E' : '#CBD5E1' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{log.action}</p>
              {log.description && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{log.description}</p>}
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                {log.user?.full_name ?? log.user?.email ?? 'System'} · {timeAgo(log.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'menu' | 'costing' | 'grocery' | 'pricing' | 'status';

export default function EventDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const router = useRouter();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [eventData, setEventData] = useState<EventSnapshotResponse | null>(null);
  const [eventDataLoading, setEventDataLoading] = useState(true);
  const [menuData, setMenuData] = useState<SnapshotMenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [exportingGrocery, setExportingGrocery] = useState(false);

  const loadEventData = useCallback(async () => {
    setEventDataLoading(true);
    setMenuLoading(true);
    try {
      const response = await api.get(`/events/${id}/`);
      setEventData(response as EventSnapshotResponse);
      console.log('eventData', response);

      let resolved = resolveEventPayload(response);
      let rows = normalizeMenuSnapshot(resolved.menuSnapshot);
      if (rows.length === 0) {
        const evFlat = response as EventDetail & { quotation_id?: string };
        const qid = resolved.event?.quotation_id ?? evFlat.quotation_id;
        if (qid) {
          try {
            const qRaw = await api.get(`/quotations/${qid}/`);
            rows = normalizeLeadMenuPayload(qRaw);
          } catch {
            /* quotation fetch is best-effort fallback for legacy converted events */
          }
        }
      }
      setMenuData(rows);
    } catch (err: unknown) {
      toast.error(apiErrorData(err).detail ?? 'Failed to load event details');
      setEventData(null);
      setMenuData([]);
    } finally {
      setEventDataLoading(false);
      setMenuLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    async function run() {
      if (!active || !id) return;
      await loadEventData();
    }
    run();
    return () => { active = false; };
  }, [id, loadEventData]);

  async function handleCancel() {
    try {
      await api.post(`/events/${id}/transition/`, { status: 'CANCELLED' });
      toast.success('Event cancelled');
      await loadEventData();
      setCancelConfirm(false);
    } catch (err) { toast.error((err as { data?: { detail?: string } })?.data?.detail ?? 'Failed to cancel event'); }
  }

  async function handleMarkComplete() {
    try {
      await api.post(`/events/${id}/transition/`, { status: 'COMPLETED' });
      toast.success('Event marked as completed');
      await loadEventData();
    } catch (err) { toast.error((err as { data?: { detail?: string } })?.data?.detail ?? 'Failed to update event'); }
  }


  async function handleGenerateGrocery() {
    try {
      await api.post(`/events/${id}/generate-grocery/`, {});
      toast.success('Grocery list generated!');
      await loadEventData();
      router.push('/grocery');
    } catch (err: unknown) {
      toast.error(apiErrorData(err).detail ?? 'Failed to generate grocery list');
    }
  }

  async function handleGenerateQuotation() {
    try {
      await api.post(`/events/${id}/quotations/`, {});
      toast.success('Quotation generated');
      qc.invalidateQueries({ queryKey: ['quotations', id] });
    } catch (err: unknown) {
      toast.error(apiErrorData(err).detail ?? 'Failed to generate quotation');
    }
  }

  async function handleMarkConfirmed() {
    try {
      await api.post(`/events/${id}/transition/`, { status: 'CONFIRMED' });
      toast.success('Event confirmed');
      await loadEventData();
    } catch (err: unknown) {
      toast.error(apiErrorData(err).detail ?? 'Failed to confirm event');
    }
  }

  const resolved = resolveEventPayload(eventData);
  const event = resolved.event;
  const menuItems = menuData;
  const serviceItems = normalizeServicesSnapshot(resolved.servicesSnapshot);
  const costingRows = normalizeCostingSnapshot(resolved.costingSnapshot);
  const groceryRows = normalizeGrocerySnapshot(resolved.grocerySnapshot);
  const pricing = (resolved.pricingSnapshot ?? {}) as Record<string, unknown>;

  if (eventDataLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-lg font-semibold" style={{ color: '#0F172A' }}>Event not found</p>
        <button onClick={() => router.back()} className="mt-3 text-sm" style={{ color: '#D95F0E' }}>← Go back</button>
      </div>
    );
  }

  const e = event as EventDetail;
  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'menu', label: 'Menu' },
    { key: 'costing', label: 'Costing' },
    { key: 'grocery', label: 'Grocery' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'status', label: 'Status' },
  ];

  const isEventLocked = e.status === 'COMPLETED';

  function handleExecutionUpdated(data: EventSnapshotResponse) {
    setEventData(data);
    const next = resolveEventPayload(data);
    setMenuData(normalizeMenuSnapshot(next.menuSnapshot));
    void qc.invalidateQueries({ queryKey: ['event-activity', id] });
  }

  async function savePlanningRows(kind: 'dishes' | 'services', rows: PlanningLineItem[]) {
    const endpoint = kind === 'dishes' ? `/events/${id}/menu/` : `/events/${id}/services/`;
    const payloadRows = rows.map(row => ({
      id: row.id,
      ...(kind === 'dishes' ? { dish_id: row.dishId ?? row.id } : {}),
      name: row.name,
      category: row.category,
      quantity: toNumber(row.qty),
      unit: row.unit || (kind === 'dishes' ? 'plate' : 'unit'),
      price_per_unit: toNumber(row.price),
    }));
    const data = await api.patch(endpoint, {
      [kind]: payloadRows,
    }) as EventSnapshotResponse;
    handleExecutionUpdated(data);
  }

  const totalAmount = toNumber((pricing.final_total as string | number | undefined) ?? (pricing.final_selling_price as string | number | undefined) ?? (pricing.selling_price as string | number | undefined) ?? e.total_amount);
  const menuTotal = toNumber(pricing.menu_total as string | number | undefined);
  const serviceTotal = toNumber(pricing.service_total as string | number | undefined);
  const advanceAmount = toNumber((pricing.advance_amount as string | number | undefined) ?? e.advance_amount);
  const paidAmount = advanceAmount;
  const balanceAmount = toNumber((pricing.balance_amount as string | number | undefined) ?? e.balance_amount);
  const internalCost =
    toNumber((pricing.internal_cost as string | number | undefined) ?? (pricing.total_cost as string | number | undefined) ?? (pricing.cost as string | number | undefined) ?? e.total_cost);
  const marginPct = toNumber(pricing.margin_percentage as string | number | undefined);
  const eventTitle = e.event_name || `${e.client_name || 'Client'}'s Event`;

  async function exportGroceryXlsx() {
    setExportingGrocery(true);
    let exportRows = groceryRows;
    try {
      const data = await api.post(`/events/${id}/generate-grocery/`, {}) as EventSnapshotResponse;
      handleExecutionUpdated(data);
      exportRows = normalizeGrocerySnapshot(data.grocery_snapshot);
      if (exportRows.length === 0) {
        toast.error('No grocery items available. Add dishes with recipes first.');
        return;
      }
    } catch (err: unknown) {
      toast.error(apiErrorData(err).detail ?? 'Failed to refresh grocery before export');
      return;
    } finally {
      setExportingGrocery(false);
    }

    const title = `${e.client_name || eventTitle} - ${fmtDate(e.event_date)}`;
    const rows = [
      [title],
      [],
      ['Item', 'Category', 'Quantity', 'Unit'],
      ...exportRows.map(row => [row.ingredient, row.category, row.quantity, row.unit]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    ws['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 14 }, { wch: 12 }];
    if (ws.A1) {
      (ws.A1 as XLSX.CellObject & { s?: unknown }).s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 16 },
        fill: { fgColor: { rgb: '000000' } },
        alignment: { horizontal: 'center' },
      };
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Grocery');
    const safeName = (e.client_name || eventTitle || 'event').replace(/[\\/:*?"<>|]/g, '').trim() || 'event';
    XLSX.writeFile(wb, `${safeName}-grocery.xlsx`);
    toast.success('Grocery exported from latest menu');
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <button
        onClick={() => router.push('/events')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors w-fit"
      >
        <ArrowLeft size={14} /> Back to Events
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] px-2 py-0.5 rounded bg-violet-50 text-violet-600 font-semibold">Main Event</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">Upcoming</span>
            </div>
            <h1 className="text-3xl font-semibold text-slate-900 leading-tight">{eventTitle}</h1>
            <p className="text-sm text-slate-500 mt-1">Created on {fmtDate(e.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Pencil size={14} /> Edit
            </button>
          </div>
        </div>

        <div className="mt-5 border-b border-slate-200">
          <div className="flex items-center gap-6 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative pb-3 text-sm font-medium whitespace-nowrap ${activeTab === tab.key ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-indigo-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Command Center: 2-column grid ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">

        {/* ════ LEFT COLUMN ════ */}
        <div className="flex flex-col gap-5 min-w-0">

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-5">
              {activeTab === 'overview' && (
                <div className="grid gap-5 lg:grid-cols-[1fr_320px] items-start">
                  <div className="flex flex-col gap-5">
                    <div className="rounded-xl border border-slate-200">
                      <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Event Details</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4">
                        <div className="flex items-start gap-2">
                          <CalendarDays size={16} className="text-violet-500 mt-0.5" />
                          <div><p className="text-xs text-slate-500">Date</p><p className="font-medium text-slate-800">{fmtDate(e.event_date)}</p></div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock size={16} className="text-violet-500 mt-0.5" />
                          <div><p className="text-xs text-slate-500">Time</p><p className="font-medium text-slate-800">{fmtTime(e.event_time) || '—'}</p></div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle size={16} className="text-violet-500 mt-0.5" />
                          <div><p className="text-xs text-slate-500">Guests</p><p className="font-medium text-slate-800">{e.guest_count || 0} people</p></div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin size={16} className="text-violet-500 mt-0.5" />
                          <div><p className="text-xs text-slate-500">Venue</p><p className="font-medium text-slate-800">{e.venue || '—'}</p></div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200">
                      <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Client Information</div>
                      <div className="p-4">
                        <p className="font-semibold text-slate-800">{e.client_name || 'Client'}</p>
                        <p className="text-sm text-slate-500 mt-0.5">{e.contact_number || '—'}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-slate-600">
                      Converted from enquiry <span className="font-semibold text-indigo-700">{eventIdDisplay(e)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="rounded-xl border border-slate-200">
                      <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Payment Status</div>
                      <div className="p-4 space-y-2">
                        <div className="flex justify-between text-slate-600"><span>Total</span><span className="font-bold text-slate-900">{fmtINR(totalAmount)}</span></div>
                        <div className="flex justify-between text-slate-600"><span>Advance</span><span>{fmtINR(advanceAmount)}</span></div>
                        <div className="flex justify-between text-slate-600"><span>Paid</span><span className="text-emerald-600 font-semibold">{fmtINR(paidAmount)}</span></div>
                        <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between"><span className="font-semibold text-slate-800">Balance</span><span className="font-bold text-amber-600">{fmtINR(balanceAmount)}</span></div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200">
                      <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Cost Summary</div>
                      <div className="p-4 space-y-2">
                        <div className="flex justify-between text-slate-600"><span>Internal Cost</span><span className="font-bold text-slate-900">{fmtINR(internalCost)}</span></div>
                        <div className="flex justify-between text-slate-600"><span>Revenue</span><span>{fmtINR(totalAmount)}</span></div>
                        <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between"><span className="font-semibold text-slate-800">Margin</span><span className="font-bold text-emerald-600">{marginPct.toFixed(1)}%</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'menu' && (
                <div className="flex flex-col gap-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                      <p className="text-sm font-medium text-slate-500">Menu Total</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{fmtINR(menuTotal)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                      <p className="text-sm font-medium text-slate-500">Service Total</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{fmtINR(serviceTotal)}</p>
                    </div>
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
                      <p className="text-sm font-medium text-indigo-700">Event Total</p>
                      <p className="mt-2 text-2xl font-bold text-indigo-900">{fmtINR(totalAmount)}</p>
                    </div>
                  </div>

                  <EventPlanningLineEditor
                    title="Menu"
                    rows={menuItems}
                    kind="dishes"
                    disabled={isEventLocked || menuLoading}
                    guestCount={e.guest_count}
                    onSaveRows={(rows) => savePlanningRows('dishes', rows)}
                  />

                  <EventPlanningLineEditor
                    title="Services"
                    rows={serviceItems}
                    kind="services"
                    disabled={isEventLocked}
                    onSaveRows={(rows) => savePlanningRows('services', rows)}
                  />
                </div>
              )}
              {activeTab === 'costing' && (
                <EditableCostingTab
                  eventId={id}
                  rows={costingRows}
                  internalCost={internalCost}
                  disabled={isEventLocked}
                  onUpdated={handleExecutionUpdated}
                />
              )}
              {activeTab === 'grocery' && (
                <div className="rounded-2xl border overflow-hidden">
                  <div className="py-4 border-b flex items-start justify-between" style={{ borderColor: '#E2E8F0' }}>
                    <div className="rounded-xl px-4 py-3 text-black">
                      <h3 className="text-xl font-semibold leading-none">Auto Grocery Sheet</h3>
                      <p className="mt-2 text-sm text-black">
                        Derived from the saved menu for {e.client_name || eventTitle} - {fmtDate(e.event_date)}
                      </p>
                    </div>
                    <button
                      onClick={() => void exportGroceryXlsx()}
                      disabled={exportingGrocery}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border hover:bg-slate-50 transition-colors"
                      style={{ borderColor: '#E2E8F0', color: '#334155', opacity: exportingGrocery ? 0.7 : 1 }}
                    >
                      {exportingGrocery ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      {exportingGrocery ? 'Refreshing...' : 'Export XLSX'}
                    </button>
                  </div>

                  {eventDataLoading ? (
                    <div className="p-6"><Skeleton className="h-32 w-full" /></div>
                  ) : resolved.grocerySnapshot == null || groceryRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center px-6 py-14" style={{ minHeight: 170 }}>
                      <ShoppingCart size={30} style={{ color: '#CBD5E1' }} />
                      <p className="mt-3 text-xl font-medium text-slate-500">No grocery items yet.</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Add recipe-backed dishes in the Menu tab and save. Grocery is generated automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="px-6 py-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b" style={{ borderColor: '#E2E8F0' }}>
                            <th className="py-2 text-left font-semibold text-slate-500">Item</th>
                            <th className="py-2 text-left font-semibold text-slate-500">Category</th>
                            <th className="py-2 text-right font-semibold text-slate-500">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groceryRows.map((row) => (
                            <tr key={row.id} className="border-b" style={{ borderColor: '#F1F5F9' }}>
                              <td className="py-2 text-slate-800 font-medium">{row.ingredient}</td>
                              <td className="py-2 text-slate-500">{row.category}</td>
                              <td className="py-2 text-right text-slate-800">
                                {row.quantity} {row.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'pricing' && (
                <PricingTab
                  event={e}
                  pricing={pricing}
                  disabled={isEventLocked}
                  onUpdated={handleExecutionUpdated}
                />
              )}
              {activeTab === 'status' && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
                    <div className="px-6 py-5 border-b" style={{ borderColor: '#E2E8F0' }}>
                      <h3 className="text-xl font-semibold leading-none text-slate-800">Pre-Event Checklist</h3>
                      <p className="mt-2 text-sm text-slate-500">Mark items as done once arranged</p>
                    </div>
                    <div className="p-5 flex flex-col gap-3">
                      {[
                        { label: 'Grocery Purchased', icon: ShoppingCart },
                        { label: 'Rentals Arranged', icon: ClipboardList },
                        { label: 'Staff Assigned', icon: Users },
                        { label: 'Transport Scheduled', icon: MapPin },
                      ].map((item) => (
                        <label
                          key={item.label}
                          className="flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer"
                          style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}
                        >
                          <input type="checkbox" className="h-5 w-5 rounded accent-[#4F46E5]" />
                          <item.icon size={17} style={{ color: '#94A3B8' }} />
                          <span className="text-xl font-semibold text-slate-700">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
                    <div className="px-6 py-5 border-b" style={{ borderColor: '#E2E8F0' }}>
                      <h3 className="text-lg font-semibold leading-none text-slate-800">Event Status</h3>
                      <p className="mt-2 text-sm text-slate-500">
                        Current: <span className="font-semibold text-slate-700">{e.status.replace(/_/g, ' ')}</span>
                      </p>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: 'Upcoming', key: 'CONFIRMED' },
                        { label: 'In Progress', key: 'IN_PROGRESS' },
                        { label: 'Completed', key: 'COMPLETED' },
                        { label: 'Cancelled', key: 'CANCELLED' },
                      ].map((status) => {
                        const isActive = e.status === status.key;
                        return (
                          <button
                            key={status.key}
                            onClick={
                              status.key === 'CONFIRMED'
                                ? handleMarkConfirmed
                                : status.key === 'COMPLETED'
                                  ? handleMarkComplete
                                  : status.key === 'CANCELLED'
                                    ? () => setCancelConfirm(true)
                                    : undefined
                            }
                            className="rounded-xl border px-4 py-3 text-xl font-semibold transition-colors"
                            style={{
                              borderColor: isActive ? '#A7F3D0' : '#E2E8F0',
                              backgroundColor: isActive ? '#ECFDF5' : '#FFFFFF',
                              color: isActive ? '#047857' : '#475569',
                            }}
                          >
                            {status.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ════ RIGHT COLUMN (sticky) ════ */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">

          {/* [4] Menu & Costing */}
          <div className="rounded-2xl border border-slate-200 shadow-[0_16px_36px_rgba(15,23,42,0.12)] p-5 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Menu & Costing</h3>
              <button
                onClick={() => setActiveTab('menu')}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Edit Menu
              </button>
            </div>

            {menuLoading ? (
              <div className="py-3"><Skeleton className="h-24 w-full" /></div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Name', 'Qty', 'Cost', 'Total'].map(h => (
                        <th
                          key={h}
                          className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide pb-2"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {menuItems.slice(0, 4).map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-2">
                          <p className="text-xs font-medium text-gray-900 truncate max-w-[90px]">
                            {item.name}
                          </p>
                        </td>
                        <td className="py-2 pr-2 text-xs text-gray-500">{item.qty}</td>
                        <td className="py-2 pr-2 text-xs text-gray-400">{item.price != null ? fmtINR(item.price) : '—'}</td>
                        <td className="py-2 text-xs text-gray-400">{item.total != null ? fmtINR(item.total) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {menuItems.length > 4 && (
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    +{menuItems.length - 4} more dishes
                  </p>
                )}

                {/* Cost breakdown */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Food Cost</span>
                    <span className="text-xs font-semibold text-gray-900">{fmtINR(internalCost)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Margin</span>
                    <span className="text-xs font-semibold text-green-600">{marginPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-900">Total</span>
                    <span className="text-sm font-bold text-gray-900">{fmtINR(totalAmount)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* [5] Grocery Status */}
          {/* <div className="rounded-xl border border-gray-200 shadow-sm p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Grocery Status</h3>
              <MoreHorizontal size={15} className="text-gray-400" />
            </div>

            {e.grocery_generated ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-xs font-semibold text-green-600">Generated</span>
                </div>
                {ingredients.slice(0, 2).map((ing, i) => {
                  const qty = Number(ing.quantity ?? ing.total_quantity ?? 0);
                  const fmt = formatQty(qty, ing.unit ?? '');
                  return (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-600 capitalize">
                        {ing.ingredient_name ?? ing.name}
                      </span>
                      <span className="text-xs text-gray-500">{fmt.value} {fmt.unit}</span>
                    </div>
                  );
                })}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleGenerateGrocery}
                    className="flex-1 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Generate List
                  </button>
                  <button className="flex-1 py-2 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                    Send Reminder
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                  <span className="text-xs text-gray-400">Not generated yet</span>
                </div>
                <button
                  onClick={handleGenerateGrocery}
                  className="w-full py-2.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  Generate List
                </button>
              </>
            )}
          </div> */}

          {/* [6] Quick Actions */}
          <div className="rounded-2xl border border-slate-200 shadow-[0_16px_36px_rgba(15,23,42,0.12)] p-5 bg-white">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2.5">

              {/* Generate Quotation */}
              <button
                onClick={handleGenerateQuotation}
                className="flex flex-col items-center gap-2 rounded-xl py-4 px-2 transition-all hover:opacity-90 active:scale-95"
                style={{ backgroundColor: '#0F172A' }}
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20">
                  <FileText size={17} color="#fff" />
                </div>
                <span className="text-xs font-semibold text-center leading-tight text-white">
                  Generate Quotation
                </span>
              </button>

              {/* Generate Grocery */}
              <button
                onClick={handleGenerateGrocery}
                className="flex flex-col items-center gap-2 rounded-xl py-4 px-2 border border-gray-200 hover:bg-gray-50 transition-all active:scale-95"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100">
                  <ShoppingCart size={17} className="text-slate-800" />
                </div>
                <span className="text-xs font-semibold text-center leading-tight text-gray-700">
                  Generate Grocery
                </span>
              </button>

              {/* Payment */}
              <button className="flex flex-col items-center gap-2 rounded-xl py-4 px-2 border border-gray-200 hover:bg-gray-50 transition-all active:scale-95">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100">
                  <IndianRupee size={17} className="text-slate-800" />
                </div>
                <span className="text-xs font-semibold text-center leading-tight text-gray-700">
                  Payment
                </span>
              </button>

              {/* Mark as Completed */}
              <button
                onClick={e.status !== 'COMPLETED' && e.status !== 'CANCELLED' ? handleMarkComplete : undefined}
                className="flex flex-col items-center gap-2 rounded-xl py-4 px-2 border border-gray-200 hover:bg-gray-50 transition-all active:scale-95"
                style={{
                  opacity: e.status === 'COMPLETED' || e.status === 'CANCELLED' ? 0.4 : 1,
                  cursor: e.status === 'COMPLETED' || e.status === 'CANCELLED' ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100">
                  <CheckCircle size={17} className="text-slate-800" />
                </div>
                <span className="text-xs font-semibold text-center leading-tight text-gray-700">
                  Mark as Completed
                </span>
              </button>
            </div>

            {/* Cancel Event */}
            {e.status !== 'CANCELLED' && (
              <button
                onClick={() => setCancelConfirm(true)}
                className="mt-2.5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                <XCircle size={14} /> Cancel Event
              </button>
            )}
          </div>

          {/* Created info */}
          <div className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-200">
            <p className="text-xs text-gray-400">
              Created by{' '}
              <span className="text-gray-600 font-medium">
                {e.created_by?.full_name ?? e.created_by?.email ?? 'System'}
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(e.created_at)}</p>
          </div>
        </div>
      </div>

      {/* ── Overlays ── */}
      <EditEventDrawer
        event={e}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={loadEventData}
      />

      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="rounded-xl p-6 max-w-sm w-full bg-white shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Cancel Event?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              This will mark the event as cancelled. This action cannot be easily undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Keep Event
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Cancel Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
