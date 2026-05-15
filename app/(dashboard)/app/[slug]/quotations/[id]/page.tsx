'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { authStorage } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';

const NAVY = '#1a1a2e';
const BORDER = '#e0e0e0';

interface QuotationDetail {
  id: string;
  quote_number: string;
  client_name: string | null;
  event_type: string | null;
  event_date: string | null;
  status: string;
  total_amount: string;
  version?: number;
  notes?: string;
  payment_terms?: string;
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtAmount(v?: string | number | null) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatQuoteId(quoteNumber?: string) {
  if (!quoteNumber) return '#QT—';
  const t = quoteNumber.trim();
  if (/^QT-/i.test(t)) return `#${t.toUpperCase()}`;
  return `#QT-${t}`;
}

function statusLabel(status: string) {
  if (status === 'ACCEPTED') return 'APPROVED';
  return status;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    DRAFT:    { bg: '#f0f0f0', color: '#424242' },
    SENT:     { bg: '#e3f2fd', color: '#1565c0' },
    ACCEPTED: { bg: '#e8f5e9', color: '#2e7d32' },
    REJECTED: { bg: '#ffebee', color: '#c62828' },
  };
  const s = map[status] ?? { bg: '#f0f0f0', color: '#424242' };
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {statusLabel(status)}
    </span>
  );
}

export default function QuotationDetailPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; id: string }>();
  const slug = params?.slug ?? '';
  const id = params?.id ?? '';

  const { data: q, isLoading, isError } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => api.get(`/quotations/${id}/`) as Promise<QuotationDetail>,
    enabled: Boolean(id),
  });

  function openPdf() {
    const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const s = authStorage.getSlug() ?? slug ?? '';
    window.open(`${BASE}/api/app/${s}/quotations/${id}/pdf/`, '_blank');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 font-sans">
      <button
        type="button"
        onClick={() => router.push(`/app/${slug}/quotations`)}
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors"
        style={{ color: NAVY }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <ArrowLeft size={18} />
        Back to quotations
      </button>

      {isLoading && (
        <div className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <Skeleton className="mb-4 h-6 w-40 rounded-full" />
          <Skeleton className="mb-2 h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border bg-white p-5 text-sm" style={{ borderColor: BORDER, color: '#c62828' }}>
          Could not load this quotation.
        </div>
      )}

      {!isLoading && q && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5 md:p-6" style={{ borderColor: BORDER }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#757575' }}>
                  {formatQuoteId(q.quote_number)}
                </p>
                <h1 className="text-xl font-bold" style={{ color: NAVY }}>
                  {q.client_name || 'Quotation'}
                </h1>
                <p className="text-sm" style={{ color: '#757575' }}>
                  {fmtDate(q.event_date)}
                  {q.event_type ? ` • ${q.event_type}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                <StatusBadge status={q.status} />
                <p className="text-lg font-bold" style={{ color: NAVY }}>{fmtAmount(q.total_amount)}</p>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={openPdf}
                className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors"
                style={{ borderColor: BORDER, color: NAVY }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
              >
                <ExternalLink size={16} />
                View PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !isError && !q && id && (
        <div
          className="flex flex-col items-center gap-3 rounded-xl border bg-white py-14"
          style={{ borderColor: BORDER }}
        >
          <FileText size={40} style={{ color: '#94a3b8' }} strokeWidth={1.25} />
          <p className="text-sm font-medium" style={{ color: '#64748b' }}>Quotation not found</p>
        </div>
      )}
    </div>
  );
}
