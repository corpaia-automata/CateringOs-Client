'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  Plus, Search, Trash2,
  ChevronLeft, ChevronRight, X, Loader2, FileSpreadsheet, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  venue?: string;
  has_quotation?: boolean;
  latest_quotation_status?: string | null;
  converted_event_id?: string | null;
  converted_event_status?: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = ['All', 'PLANNING', 'SUCCESS', 'LOST'];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PLANNING: { bg: '#EFF6FF', color: '#2563EB' },
  SUCCESS:  { bg: '#ECFDF5', color: '#16A34A' },
  LOST:     { bg: '#FEF2F2', color: '#DC2626' },
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

function OrbitNode({
  state,
  style,
  isLost,
  isFinal,
}: {
  state: 'done' | 'active' | 'pending';
  style: { border: string; color: string };
  isLost: boolean;
  isFinal?: boolean;
}) {
  const symbol = isLost && isFinal ? '×' : state === 'done' ? '✓' : state === 'active' ? '•' : '◌';
  return (
    <span
      className="relative w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold bg-white"
      style={{ borderColor: style.border, color: style.color }}
    >
      <span
        className="absolute inset-[5px] rounded-full border"
        style={{ borderColor: style.border, opacity: state === 'pending' ? 0.5 : 0.9 }}
      />
      {state === 'active' && (
        <span
          className="absolute inset-[2px] rounded-full border border-dashed animate-spin"
          style={{ borderColor: style.border, opacity: 0.9, animationDuration: '2.2s' }}
        />
      )}
      <span className="relative z-10">{symbol}</span>
    </span>
  );
}

function LeadStatusInfographic({
  status,
  hasQuotation,
  convertedEventId,
  convertedEventStatus,
}: {
  status: string;
  hasQuotation: boolean;
  convertedEventId?: string | null;
  convertedEventStatus?: string | null;
}) {
  const isSuccess = status === 'SUCCESS' || convertedEventStatus === 'CONFIRMED' || Boolean(convertedEventId);
  const isLost = status === 'LOST';
  const isQuotedStage = !isSuccess && !isLost && hasQuotation;
  const isCreatedStage = !isSuccess && !isLost && !hasQuotation;

  const createdState: 'done' | 'active' | 'pending' = isCreatedStage ? 'active' : 'done';
  const quotedState: 'done' | 'active' | 'pending' = isQuotedStage ? 'active' : (isSuccess || isLost ? 'done' : 'pending');
  const finalState: 'done' | 'active' | 'pending' = isSuccess || isLost ? 'done' : 'pending';
  const finalLabel = isSuccess ? 'WON' : isLost ? 'LOST' : 'DECISION';

  function stepStyles(stepState: 'done' | 'active' | 'pending', isFinal = false) {
    if (stepState === 'done') {
      if (isFinal && isLost) return { border: '#EF4444', color: '#EF4444', text: '#DC2626' };
      return { border: '#10B981', color: '#10B981', text: '#0F172A' };
    }
    if (stepState === 'active') return { border: '#3B82F6', color: '#3B82F6', text: '#0F172A' };
    return { border: '#CBD5E1', color: '#CBD5E1', text: '#94A3B8' };
  }

  const s1 = stepStyles(createdState);
  const s2 = stepStyles(quotedState);
  const s3 = stepStyles(finalState, true);
  const connector12 = isQuotedStage || isSuccess || isLost ? '#10B981' : '#CBD5E1';
  const connector23 = isSuccess ? '#10B981' : isLost ? '#9CA3AF' : '#CBD5E1';

  return (
    <div className="w-[225px] shrink-0">
      <div className="relative px-2 pt-1">
        <div className="absolute left-[28px] right-[28px] top-[14px] h-[2px] rounded-full" style={{ backgroundColor: '#E2E8F0' }} />
        <div className="absolute left-[28px] top-[14px] h-[2px] rounded-full" style={{ width: 'calc(50% - 28px)', backgroundColor: connector12 }} />
        <div className="absolute left-1/2 top-[14px] h-[2px] rounded-full" style={{ width: 'calc(50% - 28px)', backgroundColor: connector23 }} />
        <div className="relative grid grid-cols-3">
          <div className="flex justify-center"><OrbitNode state={createdState} style={s1} isLost={isLost} /></div>
          <div className="flex justify-center"><OrbitNode state={quotedState} style={s2} isLost={isLost} /></div>
          <div className="flex justify-center"><OrbitNode state={finalState} style={s3} isLost={isLost} isFinal /></div>
        </div>
      </div>
      <div className="grid grid-cols-3 mt-1 text-[11px] font-semibold tracking-wide text-center">
        <span style={{ color: s1.text }}>CREATED</span>
        <span style={{ color: s2.text }}>QUOTED</span>
        <span style={{ color: s3.text }}>{finalLabel}</span>
      </div>
    </div>
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
              style={{ backgroundColor: '#000000' }}>
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
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Venue</p>
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{lead.venue?.trim() || '—'}</p>
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const qc = useQueryClient();

  // Filter state
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [eventType, setEventType] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detail modal state
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  // Convert loading
  const [convertingId, setConvertingId] = useState<string | null>(null);

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

  function openNew() { router.push(`/app/${slug}/enquiries/create`); }

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

  async function handleConvert(lead: Lead) {
    setConvertingId(lead.id);
    try {
      const res = await api.post(`/inquiries/${lead.id}/convert/`, {});
      toast.success('Lead converted to event!');
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      const eventId = res?.event_id ?? res?.id;
      if (eventId) router.push(`/events/${eventId}`);
      else router.push('/events');
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string; error?: string } };
      toast.error(e?.data?.detail ?? e?.data?.error ?? 'Failed to convert lead');
    } finally {
      setConvertingId(null);
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
          style={{ backgroundColor: '#000000' }}>
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
      <div className="flex items-center gap-1 flex-wrap px-2">
        {STATUSES.map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className="px-4 py-2.5 rounded-lg text-xs font-bold transition-colors"
            style={{
              backgroundColor: statusFilter === s ? '#000000' : '#fff',
              color: statusFilter === s ? '#fff' : '#64748B',
              border: '1px solid',
              borderColor: statusFilter === s ? '#000000' : '#E2E8F0',
            }}>
            {s === 'All' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {Array.from({ length: pageSize }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div
          className="rounded-2xl min-h-[280px] flex items-center justify-center text-center px-6"
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}
        >
          <div className="max-w-sm">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
            >
              <Users size={24} style={{ color: '#94A3B8' }} />
            </div>
            <p className="text-base font-semibold text-slate-900">No leads found</p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              {hasFilters ? 'No leads match the selected filters.' : 'Start by adding your first lead to track opportunities.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ border: '1px solid #E2E8F0', color: '#64748B', backgroundColor: '#fff' }}
                >
                  Clear Filters
                </button>
              )}
              <button
                onClick={openNew}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: '#000000' }}
              >
                + Create New Lead
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {leads.map((lead) => (
            <article
              key={lead.id}
              onClick={() => router.push(`/leads/${lead.id}`)}
              className="rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.10)]"
              style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-slate-900 truncate">{lead.customer_name}</h3>
                  <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                    {lead.contact_number || '—'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={lead.status} />
                  <LeadStatusInfographic
                    status={lead.status}
                    hasQuotation={Boolean(lead.has_quotation)}
                    convertedEventId={lead.converted_event_id}
                    convertedEventStatus={lead.converted_event_status}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-3 mt-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase" style={{ color: '#94A3B8' }}>Event Date</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{fmtDate(lead.tentative_date)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase" style={{ color: '#94A3B8' }}>Event Type</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{lead.event_type || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase" style={{ color: '#94A3B8' }}>Guests</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{lead.guest_count ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase" style={{ color: '#94A3B8' }}>Est. Value</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: '#059669' }}>{fmtBudget(lead.estimated_budget)}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid #F1F5F9' }}>
                <p className="text-xs" style={{ color: '#94A3B8' }}>Created {fmtDate(lead.created_at)}</p>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ border: '1px solid #E2E8F0', color: '#1E293B', backgroundColor: '#fff' }}
                    title="Open Quote"
                  >
                    Open Quote
                    <ChevronRight size={13} style={{ color: '#64748B' }} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
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
