'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, MoreHorizontal, Calendar, Phone, Users, IndianRupee,
  Plus, ShoppingCart, FileText, CheckCircle, XCircle, Eye, EyeOff,
  Loader2, Download, Clock, X, Search, ChevronDown, AlertTriangle,
  ChefHat, Calculator, Trash2, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { EVENT_TYPES, SERVICE_TYPES } from '@/lib/constants';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface EventDetail {
  id: string;
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
  payment_status?: string;
  status: string;
  notes?: string;
  created_at: string;
  created_by?: { full_name?: string; email?: string };
  grocery_generated?: boolean;
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
    const v = qty < 1 ? qty.toFixed(3) : qty % 1 === 0 ? String(qty) : qty.toFixed(1);
    return { value: v, unit: 'gram' };
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

const PMT_STYLE: Record<string, { bg: string; color: string }> = {
  ADVANCE_PAID: { bg: '#EFF6FF', color: '#3B82F6' },
  PARTIAL:      { bg: '#FFF7ED', color: '#F97316' },
  PENDING:      { bg: '#FEF2F2', color: '#DC2626' },
  FULLY_PAID:   { bg: '#ECFDF5', color: '#0D9488' },
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
  const [form, setForm] = useState({ ...event, guest_count: String(event.guest_count) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...event, guest_count: String(event.guest_count) });
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
        guest_count: parseInt(form.guest_count as unknown as string),
        notes: form.notes || '',
      });
      // Status change goes through the transition endpoint
      if (form.status !== event.status) {
        await api.post(`/events/${event.id}/transition/`, { status: form.status });
      }
      toast.success('Event updated');
      onSaved();
      onClose();
    } catch (err: any) {
      const msgs = Object.values(err?.data ?? {}).flat();
      toast.error(msgs.length ? msgs.join(', ') : err?.data?.detail ?? 'Failed to update');
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

// ─── Menu Tab ──────────────────────────────────────────────────────────────────

function MenuTab({ eventId }: { eventId: string }) {
  const qc = useQueryClient();

  // ── Add-dish inline panel state ──
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [qty, setQty] = useState('');
  const [adding, setAdding] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Edit-qty state ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState('');

  // ── Queries ──
  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ['event-menu', eventId],
    queryFn: () => api.get(`/events/${eventId}/menu-items/`),
  });

  const { data: dishData } = useQuery({
    queryKey: ['dishes-active'],
    queryFn: () => api.get('/master/dishes/?is_active=true&has_recipe=true&page_size=200'),
    // No staleTime — always fetch fresh so stale-deleted dishes can't be selected
    staleTime: 0,
  });

  const { data: ingData, isLoading: ingLoading } = useQuery({
    queryKey: ['menu-ingredients', eventId],
    queryFn: () => api.get(`/events/${eventId}/menu-items/ingredients/`),
    refetchInterval: false,
  });

  const menuDataTyped = menuData as { results?: MenuItem[] } | MenuItem[] | null;
  const items: MenuItem[] = Array.isArray(menuDataTyped) ? menuDataTyped : (menuDataTyped as { results?: MenuItem[] })?.results ?? [];
  const dishDataTyped = dishData as { results?: Dish[] } | Dish[] | null;
  const allDishes: Dish[] = (dishDataTyped as { results?: Dish[] })?.results ?? (dishDataTyped as Dish[]) ?? [];
  // Only show results when the user is actively typing — never flood with all dishes on focus
  const filteredDishes = search.trim()
    ? allDishes.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  const ingredients: IngredientRow[] = ingData?.ingredients ?? [];
  const calculatedAt: string | null = ingData?.calculated_at ?? null;

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function resetAddForm() {
    setSearch(''); setSelectedDish(null); setQty(''); setDropOpen(false);
  }

  async function handleAdd() {
    if (!selectedDish || !qty) return;
    setAdding(true);
    try {
      await api.post(`/events/${eventId}/menu-items/`, { dish: selectedDish.id, quantity: parseFloat(qty) });
      toast.success(`${selectedDish.name} added to menu`);
      resetAddForm();
      qc.invalidateQueries({ queryKey: ['event-menu', eventId] });
      qc.invalidateQueries({ queryKey: ['menu-ingredients', eventId] });
    } catch (err: any) {
      toast.error(Object.values(err?.data ?? {}).flat().join(', ') || 'Failed to add dish');
    } finally { setAdding(false); }
  }

  async function handleRemove(itemId: string, dishName: string) {
    if (!confirm(`Remove "${dishName}" from menu?`)) return;
    try {
      await api.delete(`/events/${eventId}/menu-items/${itemId}/`);
      toast.success('Dish removed');
      qc.invalidateQueries({ queryKey: ['event-menu', eventId] });
      qc.invalidateQueries({ queryKey: ['menu-ingredients', eventId] });
    } catch { toast.error('Failed to remove dish'); }
  }

  async function handleEditSave(itemId: string) {
    if (!editingQty) return;
    try {
      await api.patch(`/events/${eventId}/menu-items/${itemId}/`, { quantity: parseFloat(editingQty) });
      toast.success('Quantity updated');
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['event-menu', eventId] });
      qc.invalidateQueries({ queryKey: ['menu-ingredients', eventId] });
    } catch { toast.error('Failed to update quantity'); }
  }

  // ── Ingredients grouped by category ──
  const grouped = ingredients.reduce<Record<string, IngredientRow[]>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});
  const categoryOrder = ['MEAT', 'GROCERY', 'VEGETABLE', 'FRUIT', 'DISPOSABLE', 'RENTAL', 'OTHER'];
  const sortedCategories = [
    ...categoryOrder.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !categoryOrder.includes(c)),
  ];

  const qtyPlaceholder = selectedDish
    ? (selectedDish.unit_type === 'KG' ? 'e.g. 100' : selectedDish.unit_type === 'PLATE' ? 'e.g. 200' : 'e.g. 50')
    : 'Quantity';

  return (
    <div className="flex flex-col gap-6">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: '#64748B' }}>
          {items.length} dish{items.length !== 1 ? 'es' : ''} in menu
        </p>
        {!addOpen && (
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: '#D95F0E' }}>
            <Plus size={13} /> Add Dish
          </button>
        )}
      </div>

      {/* ── Inline Add Panel ── */}
      {addOpen && (
        <div className="rounded-xl p-4" style={{ backgroundColor: '#FFF7ED', border: '1.5px solid #FED7AA' }}>
          <div className="flex items-center gap-2 flex-wrap">

            {/* Search Dish */}
            <div ref={searchRef} className="relative flex-1" style={{ minWidth: 200 }}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white"
                style={{ border: '1.5px solid #E2E8F0' }}>
                <Search size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
                <input
                  value={selectedDish ? selectedDish.name : search}
                  onChange={e => { setSearch(e.target.value); setSelectedDish(null); setDropOpen(true); }}
                  onFocus={() => setDropOpen(true)}
                  placeholder="Search dish…"
                  className="bg-transparent outline-none text-sm flex-1"
                  style={{ color: '#0F172A', minWidth: 0 }}
                />
                {selectedDish && (
                  <button onClick={resetAddForm}><X size={12} style={{ color: '#94A3B8' }} /></button>
                )}
              </div>
              {dropOpen && filteredDishes.length > 0 && !selectedDish && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg overflow-hidden"
                  style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #E2E8F0', backgroundColor: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                  {filteredDishes.map((d) => {
                    const cs = CAT_BADGE[d.category] ?? CAT_BADGE.OTHER;
                    const us = UNIT_BADGE[d.unit_type] ?? { bg: '#F1F5F9', color: '#64748B' };
                    return (
                      <button key={d.id}
                        onClick={() => { setSelectedDish(d); setSearch(''); setDropOpen(false); }}
                        className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-slate-50 transition-colors text-left gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: '#0F172A' }}>{d.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: cs.bg, color: cs.color }}>{d.category}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: us.bg, color: us.color }}>{d.unit_type}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quantity input */}
            <div className="flex items-center gap-1.5" style={{ minWidth: 120 }}>
              <input
                type="number" min="0.5" step="0.5"
                value={qty} onChange={e => setQty(e.target.value)}
                placeholder={qtyPlaceholder}
                className="px-3 py-2 rounded-lg text-sm outline-none bg-white"
                style={{ border: '1.5px solid #E2E8F0', color: '#0F172A', width: 90 }}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
              />
              {/* Unit badge */}
              {selectedDish ? (
                <UnitPill unit={selectedDish.unit_type} />
              ) : (
                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#F1F5F9', color: '#94A3B8' }}>unit</span>
              )}
            </div>

            {/* Add + Cancel buttons */}
            <button
              onClick={handleAdd}
              disabled={!selectedDish || !qty || adding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#D95F0E', opacity: (!selectedDish || !qty || adding) ? 0.6 : 1 }}>
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add to Menu
            </button>
            <button onClick={() => { setAddOpen(false); resetAddForm(); }}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ color: '#64748B', border: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Menu Items Table ── */}
      {menuLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: '#94A3B8' }}>
          <ChefHat size={36} className="opacity-30" />
          <p className="text-sm font-medium">No dishes added yet</p>
          <p className="text-xs">Add dishes above to see ingredient calculations</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1.5px solid #E2E8F0' }}>
                {['Dish Name', 'Quantity', 'Unit', 'Est. Cost', ''].map(h => (
                  <th key={h} className="pb-2.5 text-left text-xs font-semibold pr-4" style={{ color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td className="py-3 font-semibold pr-4" style={{ color: '#0F172A' }}>{item.dish_name_snapshot}</td>
                  <td className="py-3 pr-4">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <input type="number" min="0.5" step="0.5" value={editingQty}
                          onChange={e => setEditingQty(e.target.value)}
                          className="px-2 py-1 rounded text-sm outline-none"
                          style={{ border: '1.5px solid #D95F0E', width: 72, color: '#0F172A' }}
                          autoFocus
                        />
                        <button onClick={() => handleEditSave(item.id)}
                          className="p-1 rounded hover:bg-green-50 transition-colors">
                          <Check size={13} style={{ color: '#16A34A' }} />
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1 rounded hover:bg-slate-100 transition-colors">
                          <X size={13} style={{ color: '#94A3B8' }} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#0F172A' }}>{item.quantity}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <UnitPill unit={item.unit_type_snapshot || 'PLATE'} />
                  </td>
                  <td className="py-3 pr-4 text-xs" style={{ color: '#94A3B8' }}>—</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(item.id); setEditingQty(String(item.quantity)); }}
                        className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                        title="Edit quantity">
                        <Pencil size={12} style={{ color: '#64748B' }} />
                      </button>
                      <button
                        onClick={() => handleRemove(item.id, item.dish_name_snapshot)}
                        className="p-1.5 rounded hover:bg-red-50 transition-colors"
                        title="Remove dish">
                        <Trash2 size={12} style={{ color: '#DC2626' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Live Ingredients Panel ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Auto-calculated Ingredients</p>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Updates instantly when menu changes</p>
          </div>
          {calculatedAt && (
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              {new Date(calculatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="px-4 py-3">
          {ingLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : ingredients.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2" style={{ color: '#94A3B8' }}>
              <Calculator size={32} className="opacity-30" />
              <p className="text-sm">Add dishes to see auto-calculated ingredients</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {sortedCategories.map(cat => {
                const cs = CAT_BADGE[cat] ?? CAT_BADGE.OTHER;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: cs.bg, color: cs.color }}>
                        {cat}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {grouped[cat].map(row => {
                        const fq = formatQty(parseFloat(String(row.total_quantity)), row.unit);
                        return (
                          <div key={row.ingredient_id}
                            className="flex items-center justify-between px-3 py-2 rounded-lg"
                            style={{ backgroundColor: '#F8FAFC' }}>
                            <span className="text-sm" style={{ color: '#0F172A' }}>{row.ingredient_name}</span>
                            <span className="text-sm font-semibold tabular-nums" style={{ color: '#0F172A' }}>
                              {fq.value}{' '}
                              <span className="text-xs font-normal" style={{ color: '#64748B' }}>{fq.unit}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="text-xs pt-2 border-t" style={{ color: '#94A3B8', borderColor: '#F1F5F9' }}>
                {ingData?.total_items ?? ingredients.length} ingredient{(ingData?.total_items ?? ingredients.length) !== 1 ? 's' : ''} total
              </p>
            </div>
          )}
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
    } catch (err: any) {
      toast.error(err?.data?.detail ?? 'Failed to generate quotation');
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

type Tab = 'menu' | 'notes' | 'quotation' | 'activity';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('menu');
  const [editOpen, setEditOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [quotationPdfLoading, setQuotationPdfLoading] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.get(`/events/${id}/`),
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleCancel() {
    try {
      await api.patch(`/events/${id}/`, { status: 'CANCELLED' });
      toast.success('Event cancelled');
      qc.invalidateQueries({ queryKey: ['event', id] });
      setCancelConfirm(false);
    } catch { toast.error('Failed to cancel event'); }
  }

  async function handleMarkComplete() {
    try {
      await api.patch(`/events/${id}/`, { status: 'COMPLETED' });
      toast.success('Event marked as completed');
      qc.invalidateQueries({ queryKey: ['event', id] });
    } catch { toast.error('Failed to update event'); }
  }

  async function handleViewQuotation() {
    if (!event) return;
    const ec = (event as EventDetail).event_code ?? (event as EventDetail).event_id ?? id;
    setQuotationPdfLoading(true);
    try {
      await api.download(
        `/events/${id}/quotations/latest/pdf/`,
        `Afsal-Catering-${ec}.pdf`,
      );
      toast.success('Quotation ready');
    } catch {
      toast.error('Failed to generate quotation');
    } finally { setQuotationPdfLoading(false); }
  }

  async function handleGenerateGrocery() {
    try {
      await api.post(`/events/${id}/generate-grocery/`, {});
      toast.success('Grocery list generated!');
      qc.invalidateQueries({ queryKey: ['event', id] });
      router.push('/grocery');
    } catch (err: any) {
      toast.error(err?.data?.detail ?? 'Failed to generate grocery list');
    }
  }

  if (isLoading) {
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
  const statusStyle = STATUS_STYLE[e.status] ?? STATUS_STYLE.DRAFT;

  // Payment progress
  const total = parseFloat(String(e.total_amount ?? 0)) || 0;
  const advance = parseFloat(String(e.advance_amount ?? 0)) || 0;
  const payPct = total > 0 ? Math.min(100, Math.round((advance / total) * 100)) : 0;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'menu', label: 'Menu' },
    { key: 'notes', label: 'Notes' },
    { key: 'quotation', label: 'Quotation' },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <div className="flex flex-col gap-5">

      {/* ── Top Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowLeft size={18} style={{ color: '#64748B' }} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold" style={{ color: '#0F172A' }}>
                {e.client_name }-{e.event_type || 'Event'}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                {e.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>{e.venue || 'No venue set'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: '1.5px solid #E2E8F0', color: '#0F172A', backgroundColor: '#fff' }}>
            <Pencil size={14} /> Edit Event
          </button>
          <div ref={moreRef} className="relative">
            <button onClick={() => setMoreOpen(v => !v)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1.5px solid #E2E8F0', color: '#64748B', backgroundColor: '#fff' }}>
              <MoreHorizontal size={16} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 rounded-lg py-1 min-w-[160px]"
                style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                <button onClick={() => { /* duplicate logic */ setMoreOpen(false); toast('Duplicate coming soon'); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                  style={{ color: '#64748B' }}>
                  Duplicate Event
                </button>
                <button onClick={() => { setCancelConfirm(true); setMoreOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-red-50 transition-colors"
                  style={{ color: '#DC2626' }}>
                  <XCircle size={13} /> Cancel Event
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Info Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Date & Time */}
        <div className="flex items-start gap-3 px-4 py-4 rounded-xl"
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
          <Calendar size={18} style={{ color: '#D95F0E', marginTop: 2 }} />
          <div>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>Date & Time</p>
            <p className="text-2xl font-semibold mt-0.5" style={{ color: '#0F172A' }}>{fmtDate(e.event_date)}</p>
            <p className="text-lg" style={{ color: '#94A3B8' }}>
              {e.event_time ? fmtTime(e.event_time) : ''}
              {e.event_time && e.event_end_time ? ' – ' : ''}
              {e.event_end_time ? fmtTime(e.event_end_time) : ''}
            </p>
          </div>
        </div>
        {/* Client */}
        <div className="flex items-start gap-3 px-4 py-4 rounded-xl"
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
          <Phone size={18} style={{ color: '#3B82F6', marginTop: 2 }} />
          <div>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>Client</p>
            <p className="text-2xl font-semibold mt-0.5" style={{ color: '#0F172A' }}>{e.client_name || '—'}</p>
            {e.contact_number && (
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-lg font-mono" style={{ color: '#64748B' }}>
                  {phoneRevealed ? e.contact_number : maskPhone(e.contact_number)}
                </p>
                <button onClick={() => setPhoneRevealed(v => !v)} className="p-0.5">
                  {phoneRevealed ? <EyeOff size={11} style={{ color: '#94A3B8' }} /> : <Eye size={11} style={{ color: '#94A3B8' }} />}
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Guests */}
        <div className="flex items-start gap-3 px-4 py-4 rounded-xl"
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
          <Users size={18} style={{ color: '#0D9488', marginTop: 2 }} />
          <div>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>Total Guests</p>
            <p className="text-3xl font-bold" style={{ color: '#0F172A' }}>{e.guest_count}</p>
            {/* <p className="text-xs" style={{ color: '#94A3B8' }}>Confirmed</p> */}
          </div>
        </div>
        {/* Amount */}
        <div className="flex items-start gap-3 px-4 py-4 rounded-xl"
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
          <IndianRupee size={18} style={{ color: '#16A34A', marginTop: 2 }} />
          <div>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>Total Amount</p>
            <p className="text-3xl font-bold" style={{ color: '#0F172A' }}>{fmtINR(e.total_amount)}</p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              {/* Advance: <span style={{ color: '#3B82F6' }}>{fmtINR(e.advance_amount)}</span> */}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main 60/40 Layout ── */}
      <div className="flex flex-col xl:flex-row gap-5">

        {/* LEFT — Tabbed Panel */}
        <div className="flex-1 rounded-xl overflow-hidden"
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', minWidth: 0 }}>
          {/* Tab Headers */}
          <div className="flex border-b" style={{ borderColor: '#E2E8F0' }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="px-5 py-3.5 text-sm font-medium transition-colors relative"
                style={{ color: activeTab === tab.key ? '#D95F0E' : '#64748B' }}>
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: '#D95F0E' }} />
                )}
              </button>
            ))}
          </div>
          {/* Tab Content */}
          <div className="p-5">
            {activeTab === 'menu' && <MenuTab eventId={id} />}
            {activeTab === 'notes' && <NotesTab event={e} onSaved={() => qc.invalidateQueries({ queryKey: ['event', id] })} />}
            {activeTab === 'quotation' && <QuotationTab eventId={id} eventCode={e.event_code ?? e.event_id ?? id} />}
            {activeTab === 'activity' && <ActivityTab eventId={id} />}
          </div>
        </div>

        {/* RIGHT — Status Panel */}
        <div className="xl:w-80 flex flex-col gap-4">

          {/* Event Status + Payment */}
          <div className="rounded-xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#0F172A' }}>Event Status</h3>
            {/* Payment progress */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs" style={{ color: '#64748B' }}>Payment Progress</span>
                <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>{payPct}% paid</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F1F5F9' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${payPct}%`, backgroundColor: payPct === 100 ? '#0D9488' : payPct >= 50 ? '#3B82F6' : '#F97316' }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs" style={{ color: '#94A3B8' }}>Paid: {fmtINR(e.advance_amount)}</span>
                <span className="text-xs" style={{ color: '#94A3B8' }}>Balance: {fmtINR(e.balance_amount)}</span>
              </div>
            </div>

            {/* Payment status badge */}
            {e.payment_status && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#64748B' }}>Payment Status</span>
                <StatusBadge value={e.payment_status} map={PMT_STYLE} />
              </div>
            )}

            {/* Grocery status */}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs" style={{ color: '#64748B' }}>Grocery List</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: e.grocery_generated ? '#ECFDF5' : '#F1F5F9',
                  color: e.grocery_generated ? '#0D9488' : '#64748B',
                }}>
                {e.grocery_generated ? 'Generated' : 'Not Generated'}
              </span>
            </div>
          </div>

          {/* Guest Count */}
          <div className="rounded-xl px-5 py-4 flex items-center gap-3"
            style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
            <Users size={20} style={{ color: '#0D9488' }} />
            <div>
              <p className="text-xs" style={{ color: '#64748B' }}>Confirmed Guests</p>
              <p className="text-2xl font-bold" style={{ color: '#0F172A' }}>{e.guest_count}</p>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: '#ECFDF5', color: '#0D9488' }}>Confirmed</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#0F172A' }}>Quick Actions</h3>
            <div className="flex flex-col gap-2">
              <button onClick={handleViewQuotation} disabled={quotationPdfLoading}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50"
                style={{ border: '1px solid #E2E8F0', color: '#0F172A', opacity: quotationPdfLoading ? 0.7 : 1 }}>
                {quotationPdfLoading
                  ? <Loader2 size={15} className="animate-spin" style={{ color: '#64748B' }} />
                  : <FileText size={15} style={{ color: '#64748B' }} />}
                {quotationPdfLoading ? 'Preparing quotation…' : 'View Quotation'}
                {!quotationPdfLoading && <span className="ml-auto" style={{ color: '#94A3B8' }}>→</span>}
              </button>
              <button onClick={handleGenerateGrocery}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-teal-50"
                style={{ border: '1px solid #E2E8F0', color: '#0D9488' }}>
                <ShoppingCart size={15} /> Generate Grocery
                <span className="ml-auto" style={{ color: '#94A3B8' }}>→</span>
              </button>
              {e.status !== 'COMPLETED' && e.status !== 'CANCELLED' && (
                <button onClick={handleMarkComplete}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-green-50"
                  style={{ border: '1px solid #E2E8F0', color: '#16A34A' }}>
                  <CheckCircle size={15} /> Mark as Completed
                  <span className="ml-auto" style={{ color: '#94A3B8' }}>→</span>
                </button>
              )}
              {e.status !== 'CANCELLED' && (
                <button onClick={() => setCancelConfirm(true)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-red-50"
                  style={{ border: '1px solid #E2E8F0', color: '#DC2626' }}>
                  <XCircle size={15} /> Cancel Event
                  <span className="ml-auto" style={{ color: '#94A3B8' }}>→</span>
                </button>
              )}
            </div>
          </div>

          {/* Created info */}
          <div className="rounded-xl px-5 py-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Created by <span style={{ color: '#64748B', fontWeight: 500 }}>
                {e.created_by?.full_name ?? e.created_by?.email ?? 'System'}
              </span>
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{fmtDate(e.created_at)}</p>
          </div>
        </div>
      </div>

      {/* ── Drawers & Modals ── */}
      <EditEventDrawer
        event={e} open={editOpen} onClose={() => setEditOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['event', id] })} />

      {/* Cancel Confirm Dialog */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ backgroundColor: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ backgroundColor: '#FEF2F2' }}>
                <AlertTriangle size={20} style={{ color: '#DC2626' }} />
              </div>
              <h3 className="font-semibold" style={{ color: '#0F172A' }}>Cancel Event?</h3>
            </div>
            <p className="text-sm mb-5" style={{ color: '#64748B' }}>
              This will mark the event as cancelled. This action cannot be easily undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid #E2E8F0', color: '#64748B' }}>
                Keep Event
              </button>
              <button onClick={handleCancel}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: '#DC2626' }}>
                Cancel Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
