'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  MoreHorizontal,
  PencilLine,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NewQuotationModal } from '@/components/quotations/QuotationsPricingModals';
import {
  type QuotationRecord,
  type QuotationUiStatus,
  matchesSearchRow,
  deleteQuotationGroup,
  getPreviousRevisionsDesc,
  getRevisionsTimelineDesc,
  getGroupRevisions,
} from '@/lib/quotationsRevisions';
import {
  apiQuotationToRecord,
  apiHistoryToRecords,
  type ApiQuotationRow,
} from '@/lib/mapQuotationApi';
import { authStorage } from '@/lib/auth';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { groupQuotationsByClient } from '@/lib/groupQuotationsByClient';

const NAVY = '#1a1a2e';
const BORDER = '#e0e0e0';

const TEMPLATE_NAMES = [
  'All templates',
  'Corporate Lunch',
  'Wedding Buffet',
  'Standard Banquet',
  'Evening Gala',
];

const PAGE_SIZES = [10, 25, 50] as const;

function rupee(n: number) {
  const s = '\u20B9 ' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return s;
}

function formatEventDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCreatedOn(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toUpperCase();
  return { date, time };
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function tableStatusBadge(status: QuotationUiStatus) {
  const map: Record<QuotationUiStatus, {
    dot: string;
    text: string;
    bg: string;
    border: string;
    label: string;
  }> = {
    Sent: {
      dot: '#1565c0',
      text: '#1565c0',
      bg: '#e3f2fd',
      border: '#e3f2fd',
      label: 'Sent',
    },
    Draft: {
      dot: '#f59e0b',
      text: '#f59e0b',
      bg: '#fff8e1',
      border: '#fff8e1',
      label: 'Draft',
    },
    Accepted: {
      dot: '#2e7d32',
      text: '#2e7d32',
      bg: '#e8f5e9',
      border: '#e8f5e9',
      label: 'Accepted',
    },
    Declined: {
      dot: '#c62828',
      text: '#c62828',
      bg: '#ffebee',
      border: '#ffebee',
      label: 'Declined',
    },
  };
  const c = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        borderColor: c.border,
        backgroundColor: c.bg,
        color: c.text,
      }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

function buildPaginationItems(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | 'ellipsis')[] = [];
  const win = new Set<number>([1, totalPages]);
  for (let p = currentPage - 1; p <= currentPage + 1; p++) {
    if (p >= 1 && p <= totalPages) win.add(p);
  }
  const sorted = [...win].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (i > 0 && p - sorted[i - 1] > 1) items.push('ellipsis');
    items.push(p);
  }
  return items;
}

function normalizeListPayload(data: unknown): ApiQuotationRow[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as ApiQuotationRow[];
  if (typeof data === 'object' && 'results' in data && Array.isArray((data as { results: unknown }).results)) {
    return (data as { results: ApiQuotationRow[] }).results;
  }
  return [];
}

function QuotationTableSkeletonRow({ zebra }: { zebra: boolean }) {
  return (
    <tr style={{ backgroundColor: zebra ? '#fafafa' : '#fff' }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="border-b px-3 py-3" style={{ borderColor: BORDER }}>
          <Skeleton className="h-[14px] w-full max-w-[10rem] animate-pulse rounded-md bg-[#e8e8e8]" />
        </td>
      ))}
    </tr>
  );
}

export default function QuotationsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const raw = useParams();
  const rawSlug = raw?.slug;
  const slug =
    typeof rawSlug === 'string'
      ? rawSlug
      : Array.isArray(rawSlug)
        ? String(rawSlug[0] ?? '')
        : '';

  const [quotationRecords, setQuotationRecords] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);
  const [revisionHistoryFetched, setRevisionHistoryFetched] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'All status' | 'Draft' | 'Sent' | 'Accepted' | 'Declined'
  >('All status');
  const [templateFilter, setTemplateFilter] = useState<string>('All templates');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewModal, setShowNewModal] = useState(false);

  const [expandedBaseIds, setExpandedBaseIds] = useState<Set<string>>(new Set());
  const [drawerBaseId, setDrawerBaseId] = useState<string | null>(null);

  const loadRevisionHistory = useCallback(async (inquiryId: string) => {
    const raw = await api.get(
      `/quotations/?inquiry=${encodeURIComponent(inquiryId)}&page_size=100`,
    );
    const list = normalizeListPayload(raw);
    const mapped = apiHistoryToRecords(list);
    setQuotationRecords((prev) => {
      const rest = prev.filter((r) => r.baseId !== inquiryId);
      return [...rest, ...mapped];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadQuotationsFromApi() {
      if (!slug) {
        setLoading(false);
        setFetchError('Workspace unavailable');
        setQuotationRecords([]);
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        const token = authStorage.getAccess();
        const qs = new URLSearchParams({
          slug,
          latestOnly: 'true',
          page_size: '100',
        });
        const res = await fetch(`/api/quotations?${qs.toString()}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof payload === 'object' && payload && 'detail' in payload
              ? String((payload as { detail?: string }).detail)
              : `Request failed (${res.status})`;
          throw new Error(msg);
        }
        if (cancelled) return;
        const list = normalizeListPayload(payload);
        const mapped = list.map((q) =>
          apiQuotationToRecord(q, { isLatestRevision: true }),
        );
        setQuotationRecords(mapped);
        setRevisionHistoryFetched(new Set());
        setExpandedBaseIds(new Set());
        setSelectedIds(new Set());
      } catch (e: unknown) {
        if (cancelled) return;
        console.error(e);
        setFetchError(
          e instanceof Error ? e.message : 'Failed to load quotations',
        );
        setQuotationRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadQuotationsFromApi();
    return () => {
      cancelled = true;
    };
  }, [slug, refetchKey]);

  const handleExpansionToggle = useCallback(
    async (row: QuotationRecord) => {
      const willOpen = !expandedBaseIds.has(row.baseId);
      setExpandedBaseIds((prev) => {
        const next = new Set(prev);
        if (willOpen) next.add(row.baseId);
        else next.delete(row.baseId);
        return next;
      });
      if (!willOpen || !row.inquiryId) return;
      if (revisionHistoryFetched.has(row.inquiryId)) return;
      try {
        await loadRevisionHistory(row.inquiryId);
        setRevisionHistoryFetched((s) => new Set(s).add(row.inquiryId!));
      } catch (e) {
        console.error(e);
        toast.error('Could not load revision history');
      }
    },
    [expandedBaseIds, revisionHistoryFetched, loadRevisionHistory],
  );

  const handleCreateRevisionApi = useCallback(
    async (baseId: string) => {
      const latest = quotationRecords.find(
        (r) => r.baseId === baseId && r.isLatestRevision,
      );
      if (!latest) return;
      try {
        await api.post(`/quotations/${latest.recordId}/revise/`, {});
        toast.success('New draft revision created');
        setRefetchKey((k) => k + 1);
      } catch (e: unknown) {
        console.error(e);
        toast.error(
          e instanceof Error ? e.message : 'Could not create revision',
        );
      }
    },
    [quotationRecords],
  );

  const handleDeleteGroupApi = useCallback(
    async (baseId: string) => {
      const clientLabel =
        quotationRecords.find((r) => r.baseId === baseId)?.clientName ?? 'this quotation';
      if (
        !window.confirm(
          `Delete all quotations for "${clientLabel}"? This cannot be undone.`,
        )
      ) {
        return;
      }
      const group = quotationRecords.filter((r) => r.baseId === baseId);
      const toRemove = new Set(group.map((r) => r.recordId));
      try {
        await Promise.all(
          group.map((r) => api.delete(`/quotations/${r.recordId}/`)),
        );
        setQuotationRecords((all) => deleteQuotationGroup(all, baseId));
        setSelectedIds((prev) =>
          new Set([...prev].filter((id) => !toRemove.has(id))),
        );
        setExpandedBaseIds((prev) => {
          const next = new Set(prev);
          next.delete(baseId);
          return next;
        });
        setDrawerBaseId((d) => (d === baseId ? null : d));
        setRevisionHistoryFetched((prev) => {
          const next = new Set(prev);
          const g = group.find((x) => x.inquiryId);
          if (g?.inquiryId) next.delete(g.inquiryId);
          return next;
        });
        toast.success('Quotation group deleted');
        setRefetchKey((k) => k + 1);
      } catch (e: unknown) {
        console.error(e);
        toast.error(
          e instanceof Error ? e.message : 'Failed to delete quotations',
        );
      }
    },
    [quotationRecords],
  );

  const latestRows = useMemo(
    () => quotationRecords.filter((r) => r.isLatestRevision === true),
    [quotationRecords],
  );

  const stats = useMemo(() => {
    const acceptedRows = latestRows.filter((r) => r.status === 'Accepted');
    return {
      total: latestRows.length,
      sent: latestRows.filter((r) => r.status === 'Sent').length,
      accepted: acceptedRows.length,
      acceptedAmount: acceptedRows.reduce((sum, r) => sum + r.amount, 0),
      declined: latestRows.filter((r) => r.status === 'Declined').length,
    };
  }, [latestRows]);

  // Groups used by the client-card view (not yet rendered — wired in next step).
  const clientGroups = useMemo(
    () => groupQuotationsByClient(latestRows),
    [latestRows],
  );

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return clientGroups.filter((g) => {
      if (
        needle &&
        !g.client_name.toLowerCase().includes(needle) &&
        !g.event_name.toLowerCase().includes(needle)
      ) {
        return false;
      }
      if (statusFilter !== 'All status' && g.latest_status !== statusFilter) return false;
      return true;
    });
  }, [clientGroups, search, statusFilter]);

  // Suppress unused-variable warnings until the card view is wired in.
  void filteredGroups;

  const filtered = useMemo(
    () =>
      latestRows.filter((row) => {
        if (!matchesSearchRow(row, search)) return false;
        if (statusFilter !== 'All status' && row.status !== statusFilter) return false;
        if (templateFilter !== 'All templates' && row.template !== templateFilter) return false;
        return true;
      }),
    [latestRows, search, statusFilter, templateFilter],
  );

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const displayPage = Math.min(Math.max(page, 1), totalPages);

  const pageRows = useMemo(() => {
    const start = (displayPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, displayPage, pageSize]);

  const showingFrom = totalFiltered === 0 ? 0 : (displayPage - 1) * pageSize + 1;
  const showingTo = Math.min(displayPage * pageSize, totalFiltered);

  const paginationItems = buildPaginationItems(displayPage, totalPages);

  const toggleRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.recordId));
  const someOnPage = pageRows.some((r) => selectedIds.has(r.recordId));

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = selectAllRef.current;
    if (!el || pageRows.length === 0) return;
    el.indeterminate = someOnPage && !allOnPageSelected;
  }, [someOnPage, allOnPageSelected, pageRows.length]);

  const toggleSelectAllPage = () => {
    const pageIds = pageRows.map((r) => r.recordId);
    const allSel = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!allSel) pageIds.forEach((id) => next.add(id));
      else pageIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const copyTxt = useCallback((t: string) => {
    void navigator.clipboard.writeText(t).then(() => toast.success('Copied'));
  }, []);

  const invalidateQuotationsList = () => {
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
    setRefetchKey((k) => k + 1);
  };

  const drawerTimeline = useMemo(() => {
    if (!drawerBaseId) return [];
    return getRevisionsTimelineDesc(quotationRecords, drawerBaseId);
  }, [drawerBaseId, quotationRecords]);

  return (
    <div className="min-h-0 space-y-4 font-sans" style={{ color: NAVY }}>
      {fetchError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[13px]"
          style={{
            borderColor: '#fecaca',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
          }}
        >
          <span>Failed to load quotations. {fetchError}</span>
          <button
            type="button"
            className="font-semibold underline decoration-red-800/50 underline-offset-2 hover:decoration-red-800"
            onClick={() => setRefetchKey((k) => k + 1)}
          >
            Retry →
          </button>
        </div>
      )}

      {/* Header: breadcrumb + user / bell */}
      <div className="flex flex-col gap-3">

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 font-medium"
            style={{ borderColor: BORDER, color: NAVY, fontSize: 13 }}
            onClick={() => toast('Import quotations (demo)')}
          >
            <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden />
            Import Quotations
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-bold text-white"
            style={{ backgroundColor: NAVY, fontSize: 13 }}
            onClick={() => router.push(`/app/${slug}/quotations/create`)}
          >
            + Create Quotation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Total */}
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px' }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, color: '#737373', marginBottom: 6 }}>Total</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: NAVY, lineHeight: 1.2 }}>{stats.total}</p>
        </div>

        {/* Sent */}
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px' }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, color: '#737373', marginBottom: 6 }}>Sent</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#1565c0', lineHeight: 1.2 }}>{stats.sent}</p>
        </div>

        {/* Accepted */}
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px' }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, color: '#737373', marginBottom: 6 }}>Accepted</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#2e7d32', lineHeight: 1.2 }}>{stats.accepted}</p>
          <p style={{ fontSize: 11, color: '#737373', marginTop: 3 }}>{rupee(stats.acceptedAmount)}</p>
        </div>

        {/* Declined */}
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px' }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, color: '#737373', marginBottom: 6 }}>Declined</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#c62828', lineHeight: 1.2 }}>{stats.declined}</p>
        </div>
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search clients or events…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="min-w-0 flex-1 outline-none"
          style={{
            padding: '8px 12px',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 13,
            background: 'var(--color-background-primary)',
            color: NAVY,
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
          style={{
            padding: '8px 12px',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 13,
            background: 'var(--color-background-primary)',
            color: NAVY,
          }}
        >
          <option value="All status">All status</option>
          <option value="Sent">Sent</option>
          <option value="Accepted">Accepted</option>
          <option value="Draft">Draft</option>
          <option value="Declined">Declined</option>
        </select>
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 13,
            background: 'var(--color-background-primary)',
            color: NAVY,
          }}
        >
          {TEMPLATE_NAMES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-xl border bg-white"
        style={{ borderColor: BORDER }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#f9f9f9' }}>
                <th className="w-11 border-b px-3 py-3 text-left" style={{ borderColor: BORDER }}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllPage}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-[#1a1a2e]"
                    aria-label="Select all on page"
                  />
                </th>
                {(
                  ['Quotation No.', 'Client', 'Event', 'Event Date', 'Amount', 'Status', 'Created On', 'Actions'] as const
                ).map((lab) => (
                  <th
                    key={lab}
                    className="border-b px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide"
                    style={{
                      borderColor: BORDER,
                      color: '#737373',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {lab}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <QuotationTableSkeletonRow key={`sk-${i}`} zebra={i % 2 === 1} />
                ))
              ) : fetchError ? null : latestRows.length === 0 ? (
                <tr>
                  <td className="border-0 p-0" colSpan={9}>
                    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
                      <div
                        className="flex h-24 w-24 items-center justify-center rounded-2xl border"
                        style={{ borderColor: BORDER, backgroundColor: '#f9fafb' }}
                      >
                        <FileText className="h-12 w-12 text-[#9ca3af]" strokeWidth={1.25} aria-hidden />
                      </div>
                      <p className="text-[15px] font-semibold" style={{ color: NAVY }}>
                        No quotations found
                      </p>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-bold text-white"
                        style={{ backgroundColor: NAVY, fontSize: 13 }}
                        onClick={() => router.push(`/app/${slug}/quotations/create`)}
                      >
                        + Create Quotation
                      </button>
                    </div>
                  </td>
                </tr>
              ) : totalFiltered === 0 ? (
                <tr>
                  <td className="border-0 px-6 py-12 text-center text-[13px]" colSpan={9} style={{ color: '#737373' }}>
                    No quotations match your filters.
                  </td>
                </tr>
              ) : (
              pageRows.map((row, idx) => {
                const zebra = idx % 2 === 1;
                const co = formatCreatedOn(row.createdISO);
                const prevRevs = getPreviousRevisionsDesc(quotationRecords, row.baseId);
                const hasHistory = getGroupRevisions(quotationRecords, row.baseId).length > 1;
                const hasExpandableChevron =
                  hasHistory || (row.inquiryId != null && row.inquiryId !== '');
                const expanded = expandedBaseIds.has(row.baseId);
                const viewHref = `/app/${slug}/quotations/${row.recordId}`;
                return (
                  <Fragment key={row.recordId}>
                  <tr
                    className="group cursor-default transition-colors"
                    style={{
                      backgroundColor: zebra ? '#fafafa' : '#fff',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0f7ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = zebra ? '#fafafa' : '#fff';
                    }}
                  >
                    <td className="border-b px-3 py-3 align-middle" style={{ borderColor: BORDER }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.recordId)}
                        onChange={(e) => toggleRow(row.recordId, e.target.checked)}
                        className="h-4 w-4 cursor-pointer accent-[#1a1a2e]"
                        aria-label={`Select ${row.displayId}`}
                      />
                    </td>
                    <td className="border-b px-3 py-3 align-middle" style={{ borderColor: BORDER }}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          className="text-[13px] font-semibold hover:underline"
                          style={{ color: '#0d9488' }}
                          onClick={() => router.push(viewHref)}
                        >
                          {row.displayId}
                        </button>
                        <button
                          type="button"
                          className="inline-flex shrink-0 text-[#9ca3af] hover:text-[#525252]"
                          aria-label={`Copy ${row.displayId}`}
                          onClick={() => copyTxt(row.displayId)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {row.revisionNumber > 1 && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: '#fff8e1', color: '#f59e0b' }}
                          >
                            Rev {row.revisionNumber}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={expanded ? 'Collapse revisions' : 'Expand revisions'}
                          disabled={!hasExpandableChevron}
                          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#737373] transition-colors hover:bg-black/[0.06] ${hasExpandableChevron ? '' : 'invisible pointer-events-none'}`}
                          onClick={() => void handleExpansionToggle(row)}
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${expanded ? '-rotate-180' : ''}`}
                            aria-hidden
                          />
                        </button>
                      </div>
                    </td>
                    <td className="border-b px-3 py-3 align-top" style={{ borderColor: BORDER }}>
                      <p className="text-[13px] font-bold leading-snug" style={{ color: NAVY }}>
                        {row.clientName}
                      </p>
                      <p className="text-[11px] leading-snug" style={{ color: '#737373' }}>
                        {row.phone}
                      </p>
                    </td>
                    <td
                      className="border-b px-3 py-3 align-middle text-[13px]"
                      style={{ borderColor: BORDER, color: NAVY }}
                    >
                      {row.event}
                    </td>
                    <td className="border-b px-3 py-3 align-middle" style={{ borderColor: BORDER }}>
                      <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: NAVY }}>
                        <Calendar className="h-4 w-4 shrink-0 text-[#9ca3af]" aria-hidden />
                        {formatEventDay(row.eventDateISO)}
                      </span>
                    </td>
                    <td
                      className="border-b px-3 py-3 align-middle text-[13px] font-bold"
                      style={{ color: NAVY }}
                    >
                      {rupee(row.amount)}
                    </td>
                    <td className="border-b px-3 py-3 align-middle" style={{ borderColor: BORDER }}>
                      {tableStatusBadge(row.status)}
                    </td>
                    <td className="border-b px-3 py-3 align-top" style={{ borderColor: BORDER }}>
                      <p className="text-[13px] font-bold" style={{ color: NAVY }}>
                        {co.date}
                      </p>
                      <p className="text-[11px]" style={{ color: '#737373' }}>
                        {co.time}
                      </p>
                    </td>
                    <td className="border-b px-3 py-2 align-middle" style={{ borderColor: BORDER }}>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-[#737373] transition-colors hover:bg-black/[0.04]"
                          title="View"
                          aria-label="View quotation"
                          onClick={() => router.push(viewHref)}
                        >
                          <Eye className="h-[18px] w-[18px]" strokeWidth={1.85} />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-[#737373] transition-colors hover:bg-black/[0.04]"
                          title="Edit — creates new revision"
                          aria-label="Edit quotation — new revision"
                          onClick={() => void handleCreateRevisionApi(row.baseId)}
                        >
                          <PencilLine className="h-[18px] w-[18px]" strokeWidth={1.85} />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-md text-[#737373] outline-none transition-colors hover:bg-black/[0.04]"
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            sideOffset={4}
                            className="min-w-[14rem] border border-[#e0e0e0] bg-white shadow-none"
                          >
                            <DropdownMenuItem className="gap-2" onClick={() => router.push(viewHref)}>
                              <Eye className="h-4 w-4 shrink-0" aria-hidden />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onClick={() => void handleCreateRevisionApi(row.baseId)}>
                              <PencilLine className="h-4 w-4 shrink-0" aria-hidden />
                              Edit (new revision)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => {
                                setDrawerBaseId(row.baseId);
                                if (
                                  row.inquiryId &&
                                  !revisionHistoryFetched.has(row.inquiryId)
                                ) {
                                  void loadRevisionHistory(row.inquiryId)
                                    .then(() => {
                                      setRevisionHistoryFetched((s) =>
                                        new Set(s).add(row.inquiryId!),
                                      );
                                    })
                                    .catch((e) => {
                                      console.error(e);
                                      toast.error('Could not load revision history');
                                    });
                                }
                              }}
                            >
                              <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                              View all revisions
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              className="gap-2"
                              onClick={() => void handleDeleteGroupApi(row.baseId)}
                            >
                              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                              Delete quotation group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                  {expanded &&
                    prevRevs.map((rev) => (
                      <tr key={rev.recordId} style={{ backgroundColor: '#fafafa', color: '#737373' }}>
                        <td className="border-b px-3 py-2 align-middle" style={{ borderColor: BORDER }} aria-hidden />
                        <td className="border-b px-3 py-2 align-middle" style={{ borderColor: BORDER }} colSpan={8}>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pl-6 text-[12px] md:pl-10">
                            <span className="select-none text-[#9ca3af]" aria-hidden>
                              └
                            </span>
                            <Link
                              href={`/app/${slug}/quotations/${rev.recordId}`}
                              className="font-semibold hover:underline"
                              style={{ color: '#0f766e' }}
                            >
                              {rev.displayId}
                            </Link>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: '#fff8e1', color: '#f59e0b' }}
                            >
                              Rev {rev.revisionNumber}
                            </span>
                            {tableStatusBadge(rev.status)}
                            <span>{shortDate(rev.createdISO)}</span>
                            <span className="font-semibold" style={{ color: NAVY }}>
                              {rupee(rev.amount)}
                            </span>
                            <button
                              type="button"
                              title="View"
                              aria-label={`View ${rev.displayId}`}
                              className="inline-flex items-center rounded-md p-1.5 text-[#737373] hover:bg-black/[0.06]"
                              onClick={() => router.push(`/app/${slug}/quotations/${rev.recordId}`)}
                            >
                              <Eye className="h-[17px] w-[17px]" strokeWidth={1.85} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div
        className="flex flex-col gap-4 rounded-xl border bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
        style={{ borderColor: BORDER }}
      >
        <p className="text-center text-[12px] lg:text-left" style={{ color: '#737373' }}>
          Showing {showingFrom} to {showingTo} of {totalFiltered} results
        </p>

        <div className="flex justify-center lg:flex-1 lg:justify-center">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: '#737373' }}>
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border bg-white px-2 py-1.5"
              style={{ borderColor: BORDER, color: NAVY }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-1 lg:justify-end" aria-label="Pagination">
          <button
            type="button"
            onClick={() => setPage(displayPage - 1)}
            disabled={displayPage <= 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border disabled:pointer-events-none"
            style={{
              borderColor: BORDER,
              color: displayPage <= 1 ? '#d1d5db' : '#737373',
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {paginationItems.map((item, i) =>
            item === 'ellipsis'
              ? (
                  <span key={`e-${i}`} className="px-2 text-[13px]" style={{ color: '#737373' }}>
                  …
                </span>
                )
              : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-full border text-[13px] font-semibold transition-colors"
                    style={
                      displayPage === item
                        ? {
                            borderColor: NAVY,
                            backgroundColor: NAVY,
                            color: '#fff',
                          }
                        : {
                            borderColor: BORDER,
                            backgroundColor: '#fff',
                            color: NAVY,
                          }
                    }
                  >
                    {item}
                  </button>
                ),
          )}

          <button
            type="button"
            onClick={() => setPage(displayPage + 1)}
            disabled={displayPage >= totalPages}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border disabled:pointer-events-none"
            style={{
              borderColor: BORDER,
              color: displayPage >= totalPages ? '#d1d5db' : '#737373',
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>

      {drawerBaseId !== null && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/25"
            aria-label="Close revisions panel"
            tabIndex={-1}
            onClick={() => setDrawerBaseId(null)}
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[400px] flex-col bg-white"
            style={{ borderLeft: `1px solid ${BORDER}`, boxShadow: 'none' }}
          >
            <header
              className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
              style={{ borderColor: BORDER }}
            >
              <h2 className="truncate text-base font-bold" style={{ color: NAVY }}>
                {drawerTimeline[0]?.clientName ?? 'Revisions'}
              </h2>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#737373] hover:bg-[#f5f5f5]"
                aria-label="Close"
                onClick={() => setDrawerBaseId(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <ul className="space-y-0">
                {drawerTimeline.map((rev) => {
                  const cur = rev.isLatestRevision;
                  return (
                    <li
                      key={rev.recordId}
                      className="flex gap-3 border-b pb-4 pt-4 first:pt-1 last:border-0"
                      style={{ borderColor: BORDER }}
                    >
                      <div
                        className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                        style={
                          cur
                            ? { backgroundColor: '#16a34a' }
                            : {
                                borderWidth: 2,
                                borderStyle: 'solid',
                                borderColor: '#d4d4d4',
                                backgroundColor: '#fff',
                              }
                        }
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold" style={{ color: NAVY }}>
                            Rev {rev.revisionNumber}
                          </span>
                          {cur && (
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                              style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}
                            >
                              Current
                            </span>
                          )}
                          <span className="font-mono text-[12px] text-[#525252]">{rev.displayId}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#737373]">
                          {tableStatusBadge(rev.status)}
                          <span aria-hidden className="text-[#d4d4d4]">
                            •
                          </span>
                          <span>{rupee(rev.amount)}</span>
                          <span aria-hidden className="text-[#d4d4d4]">
                            •
                          </span>
                          <span>{shortDate(rev.createdISO)}</span>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-[13px] font-semibold"
                          style={{ borderColor: BORDER, color: NAVY }}
                          onClick={() => {
                            router.push(`/app/${slug}/quotations/${rev.recordId}`);
                            setDrawerBaseId(null);
                          }}
                        >
                          View
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        </>
      )}

      {showNewModal && (
        <NewQuotationModal
          onClose={() => setShowNewModal(false)}
          onCreated={invalidateQuotationsList}
        />
      )}
    </div>
  );
}
