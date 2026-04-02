'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Search, Eye, Pencil, ChevronLeft, ChevronRight, ChevronDown,
  X, Loader2, FileSpreadsheet, ShoppingCart, CheckCircle, FilterX, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { exportEventsToExcel } from '@/lib/exportExcel';
import { EVENT_TYPES, SERVICE_TYPES } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangeDropdown, type DatePreset } from '@/components/filters/DateRangeDropdown';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Event {
  id: string;
  client_name?: string;
  contact_number?: string;
  event_type: string;
  service_type: string;
  service_type_narration?: string;
  event_date: string;
  event_time?: string;
  venue?: string;
  guest_count: number;
  total_amount?: string | number;
  advance_amount?: string | number;
  payment_status?: string;
  status: string;
  notes?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_STATUSES = ['All', 'DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const PAGE_SIZES = [10, 25, 50];

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:       ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:   ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
};

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

const SERVICE_LABELS: Record<string, string> = {
  BUFFET:        'Buffet',
  BOX_COUNTER:   'Box Counter',
  TABLE_SERVICE: 'Table Service',
  OTHER:         'Other',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(t?: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function fmtINR(v?: string | number | null) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  if (isNaN(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function calcPending(ev: Event): number | null {
  const total = ev.total_amount != null ? parseFloat(String(ev.total_amount)) : null;
  if (total == null) return null;
  const paid = ev.advance_amount != null ? parseFloat(String(ev.advance_amount)) : 0;
  return total - paid;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ value, map }: { value: string; map: Record<string, { bg: string; color: string }> }) {
  const s = map[value] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

// ─── StatusSelector ───────────────────────────────────────────────────────────

function StatusSelector({ event, onTransition, transitioning }: {
  event: Event;
  onTransition: (id: string, status: string) => void;
  transitioning: string | null;
}) {
  const [open, setOpen]     = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref    = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const nextStates = VALID_TRANSITIONS[event.status] ?? [];
  const isLoading  = transitioning === event.id;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleOpen() {
    if (btnRef.current) {
      const rect       = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 120);
    }
    setOpen(v => !v);
  }

  // Terminal state — plain badge, no interaction
  if (nextStates.length === 0) {
    return <StatusBadge value={event.status} map={STATUS_STYLE} />;
  }

  const s = STATUS_STYLE[event.status] ?? { bg: '#F1F5F9', color: '#64748B' };

  return (
    <div ref={ref} className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        disabled={isLoading}
        onClick={handleOpen}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-opacity"
        style={{ backgroundColor: s.bg, color: s.color, opacity: isLoading ? 0.7 : 1 }}>
        {isLoading
          ? <Loader2 size={10} className="animate-spin" />
          : <>{event.status.replace(/_/g, ' ')}<ChevronDown size={10} /></>
        }
      </button>

      {open && (
        <div
          className={`absolute left-0 z-[999] rounded-lg py-1 min-w-[150px] ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {nextStates.map(ns => {
            const ns_style = STATUS_STYLE[ns] ?? { bg: '#F1F5F9', color: '#64748B' };
            return (
              <button key={ns}
                onClick={e => { e.stopPropagation(); onTransition(event.id, ns); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-slate-50 transition-colors">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: ns_style.bg, color: ns_style.color }}>
                  {ns.replace(/_/g, ' ')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ─── Event Drawer ─────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  client_name: '', contact_number: '', service_type: 'BUFFET',
  service_type_narration: '', event_type: '', event_date: '',
  event_time: '', venue: '', guest_count: '', notes: '', status: '',
};

function EventDrawer({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void; editing: Event | null; onSaved: () => void;
}) {
  const [form, setForm]     = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        client_name:            editing.client_name ?? '',
        contact_number:         editing.contact_number ?? '',
        service_type:           editing.service_type ?? 'BUFFET',
        service_type_narration: editing.service_type_narration ?? '',
        event_type:             editing.event_type ?? '',
        event_date:             editing.event_date ?? '',
        event_time:             editing.event_time ?? '',
        venue:                  editing.venue ?? '',
        guest_count:            editing.guest_count?.toString() ?? '',
        notes:                  editing.notes ?? '',
        status:                 editing.status ?? '',
      } : { ...EMPTY_FORM });
    }
  }, [editing, open]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.client_name.trim()) { toast.error('Client name is required'); return; }
    if (!form.guest_count)        { toast.error('Guest count is required'); return; }
    if (form.service_type === 'OTHER' && !form.service_type_narration.trim()) {
      toast.error('Narration is required for Other service type'); return;
    }
    setSaving(true);
    try {
      const payload = {
        client_name:    form.client_name.trim(),
        contact_number: form.contact_number || '',
        service_type:   form.service_type,
        ...(form.service_type === 'OTHER' ? { service_type_narration: form.service_type_narration } : {}),
        event_type:  form.event_type  || '',
        event_date:  form.event_date  || null,
        event_time:  form.event_time  || null,
        venue:       form.venue       || '',
        guest_count: parseInt(form.guest_count, 10),
        notes:       form.notes       || '',
      };
      if (editing) {
        await api.patch(`/events/${editing.id}/`, payload);
        if (form.status && form.status !== editing.status) {
          await api.post(`/events/${editing.id}/transition/`, { status: form.status });
        }
        toast.success('Event updated');
      } else {
        await api.post('/events/', payload);
        toast.success('Event created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      const errObj = err?.data ?? {};
      const msgs = Object.values(errObj as Record<string, unknown[]>).flat();
      toast.error(msgs.length ? msgs.join(', ') : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  }

  const inp  = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors';
  const inpS = { border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' };
  const lbl  = 'block text-xs font-medium mb-1';

  return (
    <>
      <div className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(15,23,42,0.4)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.25s' }} />
      <div ref={drawerRef} className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: 460, backgroundColor: '#fff',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          transition: 'transform 0.25s ease',
        }}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E2E8F0' }}>
          <h2 className="font-semibold text-base" style={{ color: '#0F172A' }}>
            {editing ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={18} style={{ color: '#64748B' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl} style={{ color: '#0F172A' }}>Client Name <span style={{ color: '#DC2626' }}>*</span></label>
              <input className={inp} style={inpS} value={form.client_name}
                onChange={e => set('client_name', e.target.value)} placeholder="Full name"
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
            <div className="col-span-2">
              <label className={lbl} style={{ color: '#0F172A' }}>Contact Number</label>
              <input className={inp} style={inpS} type="tel" value={form.contact_number}
                onChange={e => set('contact_number', e.target.value)} placeholder="+91 9XXXXXXXXX"
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
          </div>

          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Service Type</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {SERVICE_TYPES.map(svc => (
                <label key={svc} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
                  style={{ border: `1.5px solid ${form.service_type === svc ? '#D95F0E' : '#E2E8F0'}`, backgroundColor: form.service_type === svc ? '#FFF7ED' : '#F8FAFC' }}>
                  <input type="radio" name="service_type" value={svc}
                    checked={form.service_type === svc} onChange={() => set('service_type', svc)} className="accent-[#D95F0E]" />
                  <span className="text-xs font-medium" style={{ color: form.service_type === svc ? '#D95F0E' : '#64748B' }}>
                    {SERVICE_LABELS[svc]}
                  </span>
                </label>
              ))}
            </div>
            {form.service_type === 'OTHER' && (
              <div className="mt-2">
                <label className={lbl} style={{ color: '#0F172A' }}>Service Narration <span style={{ color: '#DC2626' }}>*</span></label>
                <input className={inp} style={inpS} value={form.service_type_narration}
                  onChange={e => set('service_type_narration', e.target.value)} placeholder="Describe the service type"
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')} />
              </div>
            )}
          </div>

          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Event Type</label>
            <select className={inp} style={inpS} value={form.event_type}
              onChange={e => set('event_type', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')}>
              <option value="">Select event type</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={{ color: '#0F172A' }}>Event Date</label>
              <input className={inp} style={inpS} type="date" value={form.event_date}
                onChange={e => set('event_date', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
            <div>
              <label className={lbl} style={{ color: '#0F172A' }}>Event Time</label>
              <input className={inp} style={inpS} type="time" value={form.event_time}
                onChange={e => set('event_time', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={{ color: '#0F172A' }}>Venue</label>
              <input className={inp} style={inpS} value={form.venue}
                onChange={e => set('venue', e.target.value)} placeholder="Venue / Hall name"
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
            <div>
              <label className={lbl} style={{ color: '#0F172A' }}>Guest Count <span style={{ color: '#DC2626' }}>*</span></label>
              <input className={inp} style={inpS} type="number" min="1" value={form.guest_count}
                onChange={e => set('guest_count', e.target.value)} placeholder="e.g. 300"
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
          </div>

          {/* Status — only when editing and non-terminal */}
          {editing && (VALID_TRANSITIONS[editing.status] ?? []).length > 0 && (
            <div>
              <label className={lbl} style={{ color: '#0F172A' }}>Status</label>
              <select className={inp} style={inpS} value={form.status}
                onChange={e => set('status', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                <option value={editing.status}>{editing.status.replace(/_/g, ' ')} (current)</option>
                {(VALID_TRANSITIONS[editing.status] ?? []).map(ns => (
                  <option key={ns} value={ns}>{ns.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={lbl} style={{ color: '#0F172A' }}>Notes</label>
            <textarea className={inp} style={{ ...inpS, resize: 'vertical' }} rows={3}
              value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes..."
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ color: '#64748B', border: '1px solid #E2E8F0' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#D95F0E', opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : editing ? 'Update Event' : 'Save Event'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function EventsPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const qc           = useQueryClient();

  const [search,        setSearch]        = useState('');
  const [datePreset,    setDatePreset]    = useState<DatePreset>('');
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState(searchParams.get('status') ?? 'All');
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get('payment_status') ?? 'All');
  const [serviceFilter, setServiceFilter] = useState('All');
  const [page,          setPage]          = useState(1);
  const [pageSize,      setPageSize]      = useState(10);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [editing,       setEditing]       = useState<Event | null>(null);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [exportOpen,    setExportOpen]    = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasFilters = !!(search || datePreset
    || statusFilter !== 'All' || paymentFilter !== 'All' || serviceFilter !== 'All');

  function clearFilters() {
    setSearch(''); setDatePreset(''); setDateFrom(''); setDateTo('');
    setStatusFilter('All'); setPaymentFilter('All'); setServiceFilter('All');
  }

  // Query string for the table (with pagination)
  const qs = new URLSearchParams({
    ...(search    ? { search }                               : {}),
    ...(dateFrom  ? { event_date_after:  dateFrom }          : {}),
    ...(dateTo    ? { event_date_before: dateTo }            : {}),
    ...(statusFilter  !== 'All' ? { status:         statusFilter  } : {}),
    ...(paymentFilter !== 'All' ? { payment_status: paymentFilter } : {}),
    ...(serviceFilter !== 'All' ? { service_type:   serviceFilter } : {}),
    page: String(page),
    page_size: String(pageSize),
  }).toString();

  // Filter-only query string (no pagination) for export
  const filterQs = new URLSearchParams({
    ...(search    ? { search }                               : {}),
    ...(dateFrom  ? { event_date_after:  dateFrom }          : {}),
    ...(dateTo    ? { event_date_before: dateTo }            : {}),
    ...(statusFilter  !== 'All' ? { status:         statusFilter  } : {}),
    ...(paymentFilter !== 'All' ? { payment_status: paymentFilter } : {}),
    ...(serviceFilter !== 'All' ? { service_type:   serviceFilter } : {}),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['events', qs],
    queryFn:  () => api.get(`/events/?${qs}`),
  });

  const events: Event[]    = data?.results ?? (Array.isArray(data) ? data : []);
  const totalCount: number = data?.count ?? events.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalCount);

  useEffect(() => { setPage(1); }, [search, datePreset, statusFilter, paymentFilter, serviceFilter, pageSize]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelectedIds(selectedIds.size === events.length ? new Set() : new Set(events.map(e => e.id)));
  }

  // ── Status transition ──────────────────────────────────────────────────────

  async function handleTransition(id: string, newStatus: string) {
    setTransitioning(id);
    try {
      await api.post(`/events/${id}/transition/`, { status: newStatus });
      toast.success(`Status → ${newStatus.replace(/_/g, ' ')}`);
      qc.invalidateQueries({ queryKey: ['events'] });
    } catch (err: any) {
      toast.error(err?.data?.detail ?? 'Failed to update status');
    } finally {
      setTransitioning(null);
    }
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────

  async function handleBulkComplete() {
    if (!selectedIds.size) return;
    if (!confirm(`Mark ${selectedIds.size} event(s) as completed?`)) return;
    const results = await Promise.allSettled(
      [...selectedIds].map(id => api.post(`/events/${id}/transition/`, { status: 'COMPLETED' }))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed    = results.filter(r => r.status === 'rejected').length;
    if (succeeded > 0) toast.success(`${succeeded} event(s) marked as completed`);
    if (failed > 0)    toast.error(`${failed} event(s) could not transition (invalid state)`);
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ['events'] });
  }

  async function handleGenerateGrocery() {
    if (!selectedIds.size) { toast.error('Select at least one event'); return; }
    try {
      await Promise.all([...selectedIds].map(id => api.post(`/events/${id}/generate-grocery/`, {})));
      toast.success('Grocery list generated!');
      router.push('/grocery');
    } catch { toast.error('Failed to generate grocery list'); }
  }

  // ── Export handlers ────────────────────────────────────────────────────────

  function handleExportAll() {
    api.download('/events/export/', 'events-all.xlsx');
    setExportOpen(false);
  }

  function handleExportFiltered() {
    const suffix = filterQs ? `?${filterQs}` : '';
    api.download(`/events/export/${suffix}`, 'events-filtered.xlsx');
    setExportOpen(false);
  }

  function handleExportSelected() {
    if (!selectedIds.size) return;
    setExportOpen(false);
    const selected = events.filter(ev => selectedIds.has(ev.id));
    const headers = ['Client Name', 'Event Date', 'Venue', 'Service Type', 'Guests',
                     'Total', 'Paid', 'Pending', 'Status', 'Payment Status'];
    const rows = selected.map(ev => {
      const pending = calcPending(ev);
      return [
        ev.client_name ?? '',
        ev.event_date ?? '',
        ev.venue ?? '',
        SERVICE_LABELS[ev.service_type] ?? ev.service_type,
        ev.guest_count,
        ev.total_amount ?? '',
        ev.advance_amount ?? '',
        pending ?? '',
        ev.status,
        ev.payment_status ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'events-selected.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Table headers ──────────────────────────────────────────────────────────

  const TABLE_HEADERS = [
    'Client Name', 'Event Date', 'Venue', 'Service Type',
    'Guests', 'Total', 'Paid', 'Pending', 'Status', 'Payment', 'Actions',
  ];

  return (
    <div className="flex flex-col gap-5">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
            {totalCount > 0 ? `${totalCount} total events` : 'No events found'}
          </p>
        </div>
        <button onClick={() => { setEditing(null); setDrawerOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: '#D95F0E' }}>
          <Plus size={16} /> New Event
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl"
        style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px]"
          style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <Search size={14} style={{ color: '#94A3B8' }} />
          <input type="text" placeholder="Search client, venue…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent outline-none text-sm flex-1" style={{ color: '#0F172A' }} />
          {search && <button onClick={() => setSearch('')}><X size={12} style={{ color: '#94A3B8' }} /></button>}
        </div>

        {/* Date Range dropdown */}
        <DateRangeDropdown
          value={datePreset}
          onChange={(key, startDate, endDate) => {
            setDatePreset(key);
            setDateFrom(startDate);
            setDateTo(endDate);
          }}
        />

        {/* Payment filter */}
        <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1.5px solid #E2E8F0', color: paymentFilter !== 'All' ? '#0F172A' : '#94A3B8', backgroundColor: '#F8FAFC' }}>
          <option value="All">All Payments</option>
          <option value="ADVANCE_PAID">Advance Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PENDING">Pending</option>
          <option value="FULLY_PAID">Fully Paid</option>
        </select>

        {/* Service filter */}
        <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1.5px solid #E2E8F0', color: serviceFilter !== 'All' ? '#0F172A' : '#94A3B8', backgroundColor: '#F8FAFC' }}>
          <option value="All">All Services</option>
          {SERVICE_TYPES.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
        </select>

        {/* Clear Filters */}
        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ border: '1.5px solid #FCA5A5', color: '#DC2626', backgroundColor: '#FEF2F2' }}>
            <FilterX size={13} /> Clear Filters
          </button>
        )}

        {/* Export dropdown */}
        <div ref={exportRef} className="relative">
          <button onClick={() => setExportOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ border: '1.5px solid #E2E8F0', color: '#64748B', backgroundColor: '#F8FAFC' }}>
            <FileSpreadsheet size={14} /> Export <ChevronDown size={12} />
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 rounded-lg py-1 min-w-[200px]"
              style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
              <button onClick={handleExportAll}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors"
                style={{ color: '#0F172A' }}>
                <FileSpreadsheet size={13} style={{ color: '#64748B' }} />
                Export All Events
              </button>
              <button onClick={handleExportFiltered}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors"
                style={{ color: '#0F172A' }}>
                <FileSpreadsheet size={13} style={{ color: hasFilters ? '#D95F0E' : '#64748B' }} />
                Export Filtered {hasFilters && <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#FFF7ED', color: '#D95F0E' }}>filtered</span>}
              </button>
              <div style={{ borderTop: '1px solid #F1F5F9', margin: '2px 0' }} />
              <button onClick={handleExportSelected}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: '#0F172A' }}>
                <FileSpreadsheet size={13} style={{ color: '#64748B' }} />
                Export Selected ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {EVENT_STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: statusFilter === s ? '#1C3355' : '#fff',
              color:           statusFilter === s ? '#fff'    : '#64748B',
              border: '1px solid',
              borderColor:     statusFilter === s ? '#1C3355' : '#E2E8F0',
            }}>
            {s === 'All' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <span className="text-sm font-medium" style={{ color: '#3B82F6' }}>
            {selectedIds.size} event{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-2">
            <button onClick={handleGenerateGrocery}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: '#0D9488' }}>
              <ShoppingCart size={13} /> Generate Grocery
            </button>
            <button onClick={handleBulkComplete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: '#16A34A' }}>
              <CheckCircle size={13} /> Mark Completed
            </button>
          </div>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto p-1 rounded hover:bg-blue-100">
            <X size={14} style={{ color: '#64748B' }} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl" style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff', overflow: 'visible' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={events.length > 0 && selectedIds.size === events.length}
                    onChange={toggleAll} className="accent-[#1C3355] rounded" />
                </th>
                {TABLE_HEADERS.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap"
                    style={{ color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: pageSize }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      {Array.from({ length: TABLE_HEADERS.length + 1 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : events.length === 0
                ? (
                    <tr>
                      <td colSpan={TABLE_HEADERS.length + 1} className="px-4 py-16 text-center">
                        <Calendar size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#64748B' }} />
                        <p className="text-sm" style={{ color: '#94A3B8' }}>No events found</p>
                        {hasFilters && (
                          <button onClick={clearFilters} className="mt-2 text-xs underline" style={{ color: '#D95F0E' }}>
                            Clear filters
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                : events.map(event => {
                    const pending = calcPending(event);
                    return (
                      <tr key={event.id}
                        onClick={() => router.push(`/events/${event.id}`)}
                        className="transition-colors hover:bg-slate-50"
                        style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}>

                        {/* Checkbox — stops row navigation */}
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(event.id)}
                            onChange={() => toggleSelect(event.id)} className="accent-[#1C3355] rounded" />
                        </td>

                        {/* Client Name */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm" style={{ color: '#0F172A' }}>
                            {event.client_name || '—'}
                          </div>
                          {event.contact_number && (
                            <div className="text-xs" style={{ color: '#94A3B8' }}>{event.contact_number}</div>
                          )}
                        </td>

                        {/* Event Date */}
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#64748B' }}>
                          <div>{fmtDate(event.event_date)}</div>
                          {event.event_time && (
                            <div className="text-xs" style={{ color: '#94A3B8' }}>{fmtTime(event.event_time)}</div>
                          )}
                        </td>

                        {/* Venue */}
                        <td className="px-4 py-3 max-w-[120px] truncate" style={{ color: '#64748B' }}>
                          {event.venue || '—'}
                        </td>

                        {/* Service Type */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: '#64748B' }}>
                          {SERVICE_LABELS[event.service_type] ?? event.service_type}
                        </td>

                        {/* Guests */}
                        <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#64748B' }}>
                          {event.guest_count}
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums" style={{ color: '#0F172A' }}>
                          {fmtINR(event.total_amount)}
                        </td>

                        {/* Paid */}
                        <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums" style={{ color: '#16A34A' }}>
                          {fmtINR(event.advance_amount)}
                        </td>

                        {/* Pending */}
                        <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums"
                          style={{ color: pending != null && pending > 0 ? '#DC2626' : '#94A3B8' }}>
                          {pending != null ? fmtINR(pending) : '—'}
                        </td>

                        {/* Status — inline dropdown, stops row navigation internally */}
                        <td className="px-4 py-3">
                          <StatusSelector
                            event={event}
                            onTransition={handleTransition}
                            transitioning={transitioning}
                          />
                        </td>

                        {/* Payment */}
                        <td className="px-4 py-3">
                          {event.payment_status
                            ? <StatusBadge value={event.payment_status} map={PMT_STYLE} />
                            : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>

                        {/* Actions — stops row navigation */}
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => router.push(`/events/${event.id}`)}
                              className="p-1.5 rounded-lg hover:bg-slate-100" title="View">
                              <Eye size={14} style={{ color: '#64748B' }} />
                            </button>
                            <button onClick={() => { setEditing(event); setDrawerOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-slate-100" title="Edit">
                              <Pencil size={14} style={{ color: '#64748B' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#E2E8F0' }}>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: '#64748B' }}>
                Showing {from}–{to} of {totalCount} events
              </span>
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded text-xs outline-none"
                style={{ border: '1px solid #E2E8F0', color: '#64748B' }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-100">
                <ChevronLeft size={16} style={{ color: '#64748B' }} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className="w-7 h-7 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: page === pg ? '#1C3355' : 'transparent', color: page === pg ? '#fff' : '#64748B' }}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-100">
                <ChevronRight size={16} style={{ color: '#64748B' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      <EventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ['events'] })}
      />
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense>
      <EventsPageContent />
    </Suspense>
  );
}
