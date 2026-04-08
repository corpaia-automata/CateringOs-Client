'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Plus, Search, Pencil, Mail, ChevronLeft, ChevronRight,
  Download, X, Loader2, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Quotation {
  id: string;
  quote_number: string;
  event: string;
  event_code: string;
  client_name: string;
  event_type: string;
  event_date: string | null;
  version: number;
  status: string;
  subtotal: string;
  service_charge: string;
  total_amount: string;
  notes: string;
  created_at: string;
}

interface EventOption {
  id: string;
  event_code: string;
  customer_name: string;
  event_type: string;
  event_date: string | null;
}

interface PaginatedResponse {
  count: number;
  results: Quotation[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = ['All', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT:    { bg: '#F1F5F9', color: '#64748B' },
  SENT:     { bg: '#EFF6FF', color: '#3B82F6' },
  ACCEPTED: { bg: '#ECFDF5', color: '#0D9488' },
  REJECTED: { bg: '#FEF2F2', color: '#DC2626' },
};

const PAGE_SIZES = [10, 25, 50];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmount(v?: string | number | null) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  quotation,
  onClose,
  onSaved,
}: {
  quotation: Quotation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus]         = useState(quotation.status);
  const [subtotal, setSubtotal]     = useState(quotation.subtotal);
  const [svcCharge, setSvcCharge]   = useState(quotation.service_charge);
  const [notes, setNotes]           = useState(quotation.notes);
  const [saving, setSaving]         = useState(false);

  const totalAmount = (parseFloat(subtotal) || 0) + (parseFloat(svcCharge) || 0);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/quotations/${quotation.id}/`, {
        status,
        subtotal: parseFloat(subtotal) || 0,
        service_charge: parseFloat(svcCharge) || 0,
        total_amount: totalAmount,
        notes,
      });
      toast.success('Quotation updated');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to update quotation');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden" style={{ maxWidth: 480, border: '1px solid #E2E8F0' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Edit Quotation</h3>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{quotation.quote_number} · {quotation.client_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X size={16} style={{ color: '#64748B' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#94A3B8' }}>Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}
            >
              {STATUSES.filter(s => s !== 'All').map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Subtotal */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#94A3B8' }}>Subtotal (₹)</label>
            <input
              type="number"
              value={subtotal}
              onChange={e => setSubtotal(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}
              placeholder="0"
            />
          </div>

          {/* Service Charge */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#94A3B8' }}>Service Charge (₹)</label>
            <input
              type="number"
              value={svcCharge}
              onChange={e => setSvcCharge(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}
              placeholder="0"
            />
          </div>

          {/* Total (read-only) */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <span className="text-sm font-medium" style={{ color: '#64748B' }}>Total Amount</span>
            <span className="text-sm font-bold" style={{ color: '#0F172A' }}>₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#94A3B8' }}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#16a34a', opacity: saving ? 0.7 : 1 }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Quotation Modal ───────────────────────────────────────────────────────

function NewQuotationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<EventOption | null>(null);
  const [creating, setCreating]   = useState(false);

  const { data: events, isLoading } = useQuery<EventOption[]>({
    queryKey: ['events-for-quotation', search],
    queryFn: () => api.get(`/events/?search=${encodeURIComponent(search)}&page_size=20`).then((r) => r.results ?? r),
    staleTime: 30_000,
  });

  async function handleCreate() {
    if (!selected) return;
    setCreating(true);
    try {
      await api.post('/quotations/', { event: selected.id });
      toast.success('Quotation created');
      onCreated();
      onClose();
    } catch {
      toast.error('Failed to create quotation');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden" style={{ maxWidth: 500, border: '1px solid #E2E8F0' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>New Quotation</h3>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Select an event to generate a quotation</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X size={16} style={{ color: '#64748B' }} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ border: '1.5px solid #E2E8F0' }}>
            <Search size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null); }}
              placeholder="Search event or client name..."
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: '#0F172A' }}
              autoFocus
            />
          </div>
        </div>

        {/* Event list */}
        <div className="px-6 pb-3 max-h-60 overflow-y-auto space-y-1.5">
          {isLoading && (
            <div className="space-y-2 py-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg w-full" />)}
            </div>
          )}
          {!isLoading && (!events || events.length === 0) && (
            <p className="text-center text-sm py-6" style={{ color: '#94A3B8' }}>No events found</p>
          )}
          {events?.map(ev => (
            <button
              key={ev.id}
              onClick={() => setSelected(ev)}
              className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
              style={{
                border: `1.5px solid ${selected?.id === ev.id ? '#16a34a' : '#E2E8F0'}`,
                background: selected?.id === ev.id ? '#F0FDF4' : '#FAFAFA',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{ev.customer_name}</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {ev.event_code} · {ev.event_type || '—'} · {fmtDate(ev.event_date)}
              </p>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: '#E2E8F0' }}>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected || creating}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#D97706', opacity: (!selected || creating) ? 0.6 : 1 }}
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            Create Quotation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuotationsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDSrch] = useState('');
  const [statusFilter, setStatus]   = useState('All');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);

  const [editQuotation, setEditQuotation]   = useState<Quotation | null>(null);
  const [showNewModal, setShowNewModal]     = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDSrch(search); setPage(1); }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => { setPage(1); }, [statusFilter, dateFrom, dateTo]);

  const queryParams = new URLSearchParams({
    page:      String(page),
    page_size: String(pageSize),
    ...(debouncedSearch         ? { search:    debouncedSearch }       : {}),
    ...(statusFilter !== 'All'  ? { status:    statusFilter }          : {}),
    ...(dateFrom                ? { date_from: dateFrom }              : {}),
    ...(dateTo                  ? { date_to:   dateTo }                : {}),
  });

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse>({
    queryKey: ['quotations', page, pageSize, debouncedSearch, statusFilter, dateFrom, dateTo],
    queryFn: () => api.get(`/quotations/?${queryParams}`),
    staleTime: 30_000,
  });

  const quotations = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  function handleViewPdf(q: Quotation) {
    import('@/lib/auth').then(({ authStorage }) => {
      const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const slug = authStorage.getSlug() ?? '';
      window.open(`${BASE}/api/app/${slug}/quotations/${q.id}/pdf/`, '_blank');
    });
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
  }

  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo   = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Quotations</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{today}</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
          style={{ background: '#D97706' }}
        >
          <Plus size={16} />
          New Quotation
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: '#fff', border: '1px solid #E2E8F0' }}
      >
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-48 px-3 py-2 rounded-lg" style={{ border: '1px solid #E2E8F0' }}>
          <Search size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client name, event..."
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: '#0F172A' }}
          />
        </div>

        {/* Date from */}
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid #E2E8F0', color: dateFrom ? '#0F172A' : '#94A3B8' }}
        />

        <span className="text-sm" style={{ color: '#94A3B8' }}>to</span>

        {/* Date to */}
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid #E2E8F0', color: dateTo ? '#0F172A' : '#94A3B8' }}
        />

        {/* Status */}
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid #E2E8F0', color: '#0F172A', minWidth: 130 }}
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s === 'All' ? 'All Status' : s}</option>
          ))}
        </select>

        {/* Export */}
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ border: '1px solid #E2E8F0', color: '#64748B' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Download size={14} />
          Export
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', background: '#fff' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                {['# Quote No.', 'Client Name', 'Event Type', 'Event Date', 'Total Amount', 'Status', 'Created', 'Actions'].map(col => (
                  <th
                    key={col}
                    className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: '#64748B' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-5 py-4">
                      <Skeleton className="h-4 rounded w-24" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && quotations.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#F1F5F9' }}>
                        <FileText size={22} style={{ color: '#94A3B8' }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: '#64748B' }}>No quotations found</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>Create a new quotation to get started</p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && quotations.map((q, idx) => (
                <tr
                  key={q.id}
                  style={{
                    borderBottom: idx < quotations.length - 1 ? '1px solid #F1F5F9' : 'none',
                    opacity: isFetching ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-5 py-4 font-medium text-xs" style={{ color: '#64748B' }}>
                    #{q.quote_number}
                  </td>
                  <td className="px-5 py-4 font-semibold" style={{ color: '#0F172A' }}>
                    {q.client_name || '—'}
                  </td>
                  <td className="px-5 py-4" style={{ color: '#64748B' }}>
                    {q.event_type || '—'}
                  </td>
                  <td className="px-5 py-4" style={{ color: '#64748B' }}>
                    {fmtDate(q.event_date)}
                  </td>
                  <td className="px-5 py-4 font-semibold" style={{ color: '#0F172A' }}>
                    {fmtAmount(q.total_amount)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="px-5 py-4" style={{ color: '#94A3B8' }}>
                    {fmtDate(q.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewPdf(q)}
                        title="View / Send PDF"
                        className="p-1.5 rounded-lg transition-colors"
                        onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Mail size={15} style={{ color: '#64748B' }} />
                      </button>
                      <button
                        onClick={() => setEditQuotation(q)}
                        title="Edit Quotation"
                        className="p-1.5 rounded-lg transition-colors"
                        onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Pencil size={15} style={{ color: '#64748B' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        {totalCount > 0 && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
            style={{ borderTop: '1px solid #E2E8F0' }}
          >
            <p className="text-xs" style={{ color: '#64748B' }}>
              Showing {showingFrom}–{showingTo} of {totalCount} quotations
            </p>

            <div className="flex items-center gap-3">
              {/* Page size */}
              <div className="flex items-center gap-1.5">
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="text-xs px-2 py-1 rounded-lg outline-none"
                  style={{ border: '1px solid #E2E8F0', color: '#64748B' }}
                >
                  {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
                </select>
              </div>

              {/* Prev / Next */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                  style={{
                    border: '1px solid #E2E8F0',
                    color: page === 1 ? '#CBD5E1' : '#64748B',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronLeft size={14} />
                </button>

                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors"
                      style={{
                        border: '1px solid #E2E8F0',
                        background: page === p ? '#0F172A' : 'transparent',
                        color: page === p ? '#fff' : '#64748B',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                  style={{
                    border: '1px solid #E2E8F0',
                    color: (page === totalPages || totalPages === 0) ? '#CBD5E1' : '#64748B',
                    cursor: (page === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {showNewModal && (
        <NewQuotationModal
          onClose={() => setShowNewModal(false)}
          onCreated={invalidate}
        />
      )}
      {editQuotation && (
        <EditModal
          quotation={editQuotation}
          onClose={() => setEditQuotation(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}
