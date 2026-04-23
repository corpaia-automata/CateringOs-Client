'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Pencil, Trash2,
  ChevronLeft, ChevronRight, X, Loader2, FileSpreadsheet, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';


interface Lead {
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
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = ['All', 'NEW', 'QUALIFIED', 'FOLLOW_UP', 'REJECTED'];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  NEW:        { bg: '#EFF6FF', color: '#3B82F6' },
  QUALIFIED:  { bg: '#F5F3FF', color: '#7C3AED' },
  FOLLOW_UP:  { bg: '#FFF7ED', color: '#F97316' },
  REJECTED:   { bg: '#FEF2F2', color: '#DC2626' },
};

const SOURCE_CHANNELS = [
  { label: 'Phone Call', value: 'PHONE_CALL' },
  { label: 'WhatsApp',   value: 'WHATSAPP'   },
  { label: 'Walk In',    value: 'WALK_IN'    },
];
const PAGE_SIZES = [10, 25, 50];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtBudget(v?: string | number) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtChannel(v?: string) {
  const ch = SOURCE_CHANNELS.find(c => c.value === v);
  return ch ? ch.label : v || '—';
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteModal({
  lead,
  onConfirm,
  onCancel,
  loading,
}: {
  lead: Lead;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" style={{ border: '1px solid #E2E8F0' }}>
        <div className="flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto"
          style={{ backgroundColor: '#FEF2F2' }}>
          <Trash2 size={22} style={{ color: '#DC2626' }} />
        </div>
        <h3 className="text-base font-semibold text-center mb-1" style={{ color: '#0F172A' }}>Delete Lead</h3>
        <p className="text-sm text-center mb-6" style={{ color: '#64748B' }}>
          Are you sure you want to delete <span className="font-medium" style={{ color: '#0F172A' }}>"{lead.customer_name}"</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
            style={{ backgroundColor: '#DC2626', opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Detail Modal ────────────────────────────────────────────────────────

function LeadDetailModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden" style={{ maxWidth: 680, border: '1px solid #E2E8F0' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-8 py-5 border-b" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg text-white shrink-0"
              style={{ backgroundColor: '#D95F0E' }}>
              {lead.customer_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight" style={{ color: '#0F172A' }}>{lead.customer_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={lead.status} />
                {lead.source_channel && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                    {fmtChannel(lead.source_channel)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors mt-0.5">
            <X size={18} style={{ color: '#64748B' }} />
          </button>
        </div>

        {/* Body — 2-column grid */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Phone</p>
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{lead.contact_number || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Email</p>
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{lead.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Event Type</p>
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{lead.event_type || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Tentative Date</p>
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{fmtDate(lead.tentative_date)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Expected Guests</p>
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{lead.guest_count ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Estimated Budget</p>
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{fmtBudget(lead.estimated_budget)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Created</p>
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{fmtDate(lead.created_at)}</p>
            </div>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="mt-5 pt-5 border-t" style={{ borderColor: '#F1F5F9' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#94A3B8' }}>Notes</p>
              <p className="text-sm leading-relaxed p-3 rounded-lg" style={{ color: '#334155', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                {lead.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-8 py-4 border-t" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: '#1C3355', color: '#fff' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Form ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  customer_name: '',
  contact_number: '',
  email: '',
  source_channel: 'PHONE_CALL',
  event_type: '',
  tentative_date: '',
  guest_count: '',
  estimated_budget: '',
  status: 'NEW',
  notes: '',
};

function LeadDrawer({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Lead | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        customer_name:    editing.customer_name ?? '',
        contact_number:   editing.contact_number ?? '',
        email:            editing.email ?? '',
        source_channel:   editing.source_channel ?? 'PHONE_CALL',
        event_type:       editing.event_type ?? '',
        tentative_date:   editing.tentative_date ?? '',
        guest_count:      editing.guest_count?.toString() ?? '',
        estimated_budget: editing.estimated_budget?.toString() ?? '',
        status:           editing.status ?? 'NEW',
        notes:            editing.notes ?? '',
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
  }, [editing, open]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        customer_name:    form.customer_name,
        contact_number:   form.contact_number || '',
        email:            form.email || '',
        source_channel:   form.source_channel,
        event_type:       form.event_type || '',
        tentative_date:   form.tentative_date || null,
        guest_count:      form.guest_count ? parseInt(form.guest_count) : 1,
        estimated_budget: form.estimated_budget ? form.estimated_budget : null,
        status:           form.status,
        notes:            form.notes || '',
      };
      if (editing) {
        await api.patch(`/inquiries/${editing.id}/`, payload);
        toast.success('Lead updated');
      } else {
        await api.post('/inquiries/', payload);
        toast.success('Lead created');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown[]> };
      const msg = e?.data ? Object.values(e.data).flat().join(', ') : 'Failed to save';
      toast.error(msg as string);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors";
  const inputStyle = { border: '1.5px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' };
  const labelCls = "block text-xs font-semibold mb-1.5";

  return (
    <>
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{
          backgroundColor: 'rgba(15,23,42,0.4)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform"
        style={{
          width: 480,
          backgroundColor: '#fff',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          transition: 'transform 0.25s ease',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div>
            <h2 className="font-semibold text-base" style={{ color: '#0F172A' }}>
              {editing ? 'Edit Lead' : 'Create New Lead'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              Fill the details clearly to avoid follow-up confusion.
            </p>
          </div>
          <h2 className="font-semibold text-base hidden" style={{ color: '#0F172A' }}>
            {editing ? 'Edit Lead' : 'New Lead'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} style={{ color: '#64748B' }} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div className="rounded-xl p-4 border" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#475569' }}>Primary Contact</p>

            <div>
              <label className={labelCls} style={{ color: '#0F172A' }}>Customer Name <span style={{ color: '#DC2626' }}>*</span></label>
              <input className={inputCls} style={inputStyle} required
                value={form.customer_name} onChange={e => set('customer_name', e.target.value)}
                placeholder="Full name"
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#CBD5E1')} />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className={labelCls} style={{ color: '#0F172A' }}>Contact Number</label>
                <input className={inputCls} style={inputStyle} type="tel"
                  value={form.contact_number} onChange={e => set('contact_number', e.target.value)}
                  placeholder="+91 9XXXXXXXXX"
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#CBD5E1')} />
              </div>
              <div>
                <label className={labelCls} style={{ color: '#0F172A' }}>Email</label>
                <input className={inputCls} style={inputStyle} type="email"
                  value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="email@example.com"
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#CBD5E1')} />
              </div>
            </div>
          </div>

          <div className="rounded-xl p-4 border" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#475569' }}>Event Details</p>
            <div>
              <label className={labelCls} style={{ color: '#0F172A' }}>Source Channel</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
              {SOURCE_CHANNELS.map(ch => (
                <label key={ch.value} className="flex items-center gap-1.5 cursor-pointer rounded-lg px-2.5 py-2 border"
                  style={{ borderColor: form.source_channel === ch.value ? '#FDBA74' : '#E2E8F0', backgroundColor: form.source_channel === ch.value ? '#FFF7ED' : '#F8FAFC' }}>
                  <input type="radio" name="source_channel" value={ch.value}
                    checked={form.source_channel === ch.value}
                    onChange={() => set('source_channel', ch.value)}
                    className="accent-[#D95F0E]" />
                  <span className="text-xs font-medium" style={{ color: '#0F172A' }}>{ch.label}</span>
                </label>
              ))}
              </div>
            </div>

            <div className="mt-3">
              <label className={labelCls} style={{ color: '#0F172A' }}>Event Type</label>
              <select className={inputCls} style={inputStyle}
                value={form.event_type} onChange={e => set('event_type', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#CBD5E1')}>
                <option value="">Select event type</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className={labelCls} style={{ color: '#0F172A' }}>Tentative Date</label>
                <input className={inputCls} style={inputStyle} type="date"
                  value={form.tentative_date} onChange={e => set('tentative_date', e.target.value)}
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#CBD5E1')} />
              </div>
              <div>
                <label className={labelCls} style={{ color: '#0F172A' }}>Expected Guests</label>
                <input className={inputCls} style={inputStyle} type="number" min="1"
                  value={form.guest_count} onChange={e => set('guest_count', e.target.value)}
                  placeholder="e.g. 200"
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#CBD5E1')} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: '#0F172A' }}>Estimated Budget (₹)</label>
              <input className={inputCls} style={inputStyle} type="number" min="0" step="100"
                value={form.estimated_budget} onChange={e => set('estimated_budget', e.target.value)}
                placeholder="e.g. 50000"
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#CBD5E1')} />
            </div>
            <div>
              <label className={labelCls} style={{ color: '#0F172A' }}>Status</label>
              <select className={inputCls} style={inputStyle}
                value={form.status} onChange={e => set('status', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#CBD5E1')}>
                {['NEW', 'QUALIFIED', 'FOLLOW_UP', 'REJECTED'].map(s =>
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls} style={{ color: '#0F172A' }}>Notes</label>
            <textarea className={inputCls} style={{ ...inputStyle, resize: 'vertical' }}
              rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Additional notes..."
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#CBD5E1')} />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: '#64748B', border: '1px solid #E2E8F0' }}>
            Cancel
          </button>
          <button
            onClick={() => { formRef.current?.requestSubmit(); }}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
            style={{ backgroundColor: '#D95F0E', opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : editing ? 'Update Lead' : 'Save Lead'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const router = useRouter();
  const qc = useQueryClient();

  // Filter state
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [eventType, setEventType] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detail modal state
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const queryString = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(dateFrom ? { tentative_date_after: dateFrom } : {}),
    ...(dateTo ? { tentative_date_before: dateTo } : {}),
    ...(eventType ? { event_type: eventType } : {}),
    ...(statusFilter !== 'All' ? { status: statusFilter } : {}),
    page: String(page),
    page_size: String(pageSize),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['leads', queryString],
    queryFn: () => api.get(`/inquiries/?${queryString}`),
  });

  const leads: Lead[] = data?.results ?? data ?? [];
  const totalCount: number = data?.count ?? leads.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, eventType, statusFilter, pageSize]);

  const hasFilters = !!(search || dateFrom || dateTo || eventType || statusFilter !== 'All');

  function clearFilters() {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setEventType('');
    setStatusFilter('All');
  }

  function openNew() { setEditing(null); setDrawerOpen(true); }
  function openEdit(lead: Lead) { setEditing(lead); setDrawerOpen(true); }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/inquiries/${deleteTarget.id}/`);
      toast.success('Lead deleted');
      qc.invalidateQueries({ queryKey: ['leads'] });
    } catch {
      toast.error('Failed to delete lead');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function handleExport() {
    api.download(`/inquiries/export/?${queryString}`, 'leads.xlsx');
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
         <p className="text-2xl px-3 font-bold tracking-tight text-slate-900">
          Your Leads
        </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: '#D95F0E' }}>
          <Plus size={16} /> New Lead
        </button>
      </div>

      {/* Filter Bar */}
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl"
        style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-50"
          style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <Search size={14} style={{ color: '#94A3B8' }} />
          <input
            type="text" placeholder="Search name, phone…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent outline-none text-sm flex-1"
            style={{ color: '#0F172A' }} />
          {search && (
            <button onClick={() => setSearch('')}><X size={12} style={{ color: '#94A3B8' }} /></button>
          )}
        </div>

        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1.5px solid #E2E8F0', color: '#0F172A', backgroundColor: '#F8FAFC' }} />
        <span className="text-xs" style={{ color: '#94A3B8' }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1.5px solid #E2E8F0', color: '#0F172A', backgroundColor: '#F8FAFC' }} />

        <select value={eventType} onChange={e => setEventType(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1.5px solid #E2E8F0', color: eventType ? '#0F172A' : '#94A3B8', backgroundColor: '#F8FAFC' }}>
          <option value="">All Event Types</option>
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <button onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ border: '1.5px solid #E2E8F0', color: '#64748B', backgroundColor: '#F8FAFC' }}>
          <FileSpreadsheet size={14} /> Export
        </button>

        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ border: '1.5px solid #FCA5A5', color: '#DC2626', backgroundColor: '#FEF2F2' }}>
            <X size={13} /> Clear Filters
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUSES.map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: statusFilter === s ? '#1C3355' : '#fff',
              color: statusFilter === s ? '#fff' : '#64748B',
              border: '1px solid',
              borderColor: statusFilter === s ? '#1C3355' : '#E2E8F0',
            }}>
            {s === 'All' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['#', 'Lead Name', 'Contact', 'Event Type', 'Tentative Date', 'Guests', 'Budget', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap"
                    style={{ color: '#64748B' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <Users size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#64748B' }} />
                    <p className="text-sm" style={{ color: '#94A3B8' }}>No leads found</p>
                    <button onClick={openNew}
                      className="mt-3 text-sm font-medium"
                      style={{ color: '#D95F0E' }}>
                      + Create your first lead
                    </button>
                  </td>
                </tr>
              ) : (
                leads.map((lead, idx) => (
                  <tr key={lead.id}
                    className="transition-colors hover:bg-slate-50"
                     onClick={() => router.push(`/leads/${lead.id}`)}
                    style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>
                      {from + idx}
                    </td>
                    <td className="px-4 py-3">
                      <button
                       
                        className="font-medium text-left hover:underline"
                        style={{ color: '#1C3355' }}>
                        {lead.customer_name}
                      </button>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#64748B' }}>
                      <div>{lead.contact_number || '—'}</div>
                      {lead.email && <div className="text-xs" style={{ color: '#94A3B8' }}>{lead.email}</div>}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#64748B' }}>{lead.event_type || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#64748B' }}>
                      {fmtDate(lead.tentative_date)}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#64748B' }}>{lead.guest_count ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#64748B' }}>
                      {fmtBudget(lead.estimated_budget)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: '#94A3B8' }}>
                      {fmtDate(lead.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(lead)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-slate-100"
                          title="Edit">
                          <Pencil size={14} style={{ color: '#64748B' }} />
                        </button>
                        <button onClick={() => setDeleteTarget(lead)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                          title="Delete">
                          <Trash2 size={14} style={{ color: '#DC2626' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#E2E8F0' }}>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: '#64748B' }}>
                Showing {from}–{to} of {totalCount} leads
              </span>
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded text-xs outline-none"
                style={{ border: '1px solid #E2E8F0', color: '#64748B' }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-slate-100">
                <ChevronLeft size={16} style={{ color: '#64748B' }} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className="w-7 h-7 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: page === pg ? '#1C3355' : 'transparent',
                      color: page === pg ? '#fff' : '#64748B',
                    }}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:bg-slate-100">
                <ChevronRight size={16} style={{ color: '#64748B' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lead Drawer */}
      <LeadDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ['leads'] })}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteModal
          lead={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Lead Detail Modal */}
      {detailLead && (
        <LeadDetailModal
          lead={detailLead}
          onClose={() => setDetailLead(null)}
        />
      )}
    </div>
  );
}
