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

// ─── Pricing Panel (replaces EditModal) ──────────────────────────────────────

function PricingPanel({
  quotation,
  onClose,
  onSaved,
}: {
  quotation: Quotation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDraft     = quotation.status === 'DRAFT';
  const isFinalised = quotation.status === 'SENT' || quotation.status === 'ACCEPTED';

  // Fix float precision from DB values
  const internalCost = parseFloat(Number(quotation.subtotal).toFixed(2)) || 0;
  const svcCharge    = parseFloat(Number(quotation.service_charge).toFixed(2)) || 0;
  const menuTotal    = parseFloat((internalCost + svcCharge).toFixed(2));

  // Editable state — initialise from quotation total (precision-fixed)
  const [sellingPrice, setSellingPrice]     = useState(
    parseFloat(Number(quotation.total_amount || menuTotal).toFixed(2))
  );
  const [advanceAmount, setAdvanceAmount]   = useState('');
  const [paymentTerms, setPaymentTerms]     = useState(quotation.notes || '');
  const [finalising, setFinalising]         = useState(false);

  // Summary numbers
  const selling      = parseFloat(Number(sellingPrice).toFixed(2)) || 0;
  const marginNum    = internalCost > 0 ? ((selling - internalCost) / internalCost) * 100 : null;
  const marginPct    = marginNum !== null ? marginNum.toFixed(1) : null;
  const marginNeg    = marginPct !== null && parseFloat(marginPct) < 0;

  function fmtPrice(v: number) {
    return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleFinalise() {
    setFinalising(true);
    try {
      await api.patch(`/quotations/${quotation.id}/`, {
        status:       'SENT',
        sent_at:      new Date().toISOString(),
        total_amount: parseFloat(Number(sellingPrice).toFixed(2)),
        notes:        paymentTerms,
      });
      toast.success('Quotation finalised & sent!');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to finalise quotation');
    } finally {
      setFinalising(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col"
        style={{ maxWidth: 540, maxHeight: '92vh', border: '1px solid #E2E8F0' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Pricing</h3>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              {quotation.quote_number} · {quotation.client_name} · Rev. {quotation.version}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={quotation.status} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
              <X size={16} style={{ color: '#64748B' }} />
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Top info cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            {/* INTERNAL COST */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#64748B' }}>
                Internal Cost
              </p>
              <p className="text-xs mb-2" style={{ color: '#94A3B8' }}>Total from costing sheet</p>
              <p className="text-lg font-black" style={{ color: '#0F172A' }}>{fmtPrice(internalCost)}</p>
            </div>
            {/* CALCULATED FROM MENU */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#3B82F6' }}>
                Calculated From Menu
              </p>
              <p className="text-xs mb-2" style={{ color: '#60A5FA' }}>Dishes + services total</p>
              <p className="text-lg font-black" style={{ color: '#1E40AF' }}>{fmtPrice(menuTotal)}</p>
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: '#F1F5F9' }} />

          {/* ── Editable fields ─────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Final Selling Price */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#94A3B8' }}>
                Final Selling Price (₹)
              </label>
              {isDraft ? (
                <input
                  type="number"
                  value={Number(sellingPrice).toFixed(2)}
                  onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none font-semibold"
                  style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}
                />
              ) : (
                <p className="text-base font-bold" style={{ color: '#0F172A' }}>{fmtPrice(selling)}</p>
              )}
            </div>

            {/* Advance Amount */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#94A3B8' }}>
                Advance Amount (₹)
              </label>
              {isDraft ? (
                <input
                  type="number"
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value)}
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}
                />
              ) : (
                <p className="text-base font-semibold" style={{ color: '#0F172A' }}>
                  {advanceAmount
                    ? fmtPrice(parseFloat(Number(advanceAmount).toFixed(2)))
                    : <span style={{ color: '#94A3B8' }}>—</span>}
                </p>
              )}
            </div>

            {/* Payment Terms */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#94A3B8' }}>
                Payment Terms
              </label>
              {isDraft ? (
                <textarea
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  rows={3}
                  placeholder="e.g. 50% advance, balance on event day…"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}
                />
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>
                  {paymentTerms || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No payment terms specified.</span>}
                </p>
              )}
            </div>
          </div>

          {/* ── Summary cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            {/* SELLING */}
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#16A34A' }}>Selling</p>
              <p className="text-sm font-black" style={{ color: '#15803D' }}>
                ₹{selling.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            {/* COST */}
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#DC2626' }}>Cost</p>
              <p className="text-sm font-black" style={{ color: '#B91C1C' }}>
                ₹{internalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            {/* MARGIN */}
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#FEFCE8', border: '1px solid #FDE68A' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#CA8A04' }}>Margin</p>
              <p className="text-sm font-black" style={{ color: marginNeg ? '#DC2626' : '#A16207' }}>
                {marginPct !== null ? `${marginPct}%` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="px-6 pt-3 pb-5 shrink-0 space-y-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          {/* Finalise button — only visible when DRAFT */}
          {isDraft && (
            <button
              onClick={handleFinalise}
              disabled={finalising}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-opacity"
              style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)', opacity: finalising ? 0.7 : 1 }}
            >
              {finalising
                ? <Loader2 size={14} className="animate-spin" />
                : <span>✓</span>}
              Finalise &amp; Send Quotation (Rev. {quotation.version})
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}
          >
            {isFinalised ? 'Close' : 'Cancel'}
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

  const [pricingQuotation, setPricingQuotation] = useState<Quotation | null>(null);
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
                        onClick={() => setPricingQuotation(q)}
                        title="Pricing"
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
      {pricingQuotation && (
        <PricingPanel
          quotation={pricingQuotation}
          onClose={() => setPricingQuotation(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}
