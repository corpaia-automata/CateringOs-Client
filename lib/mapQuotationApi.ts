/**
 * Map Django Quotation API payloads to QuotationRecord for the list UI.
 */

import type { QuotationRecord, QuotationUiStatus } from '@/lib/quotationsRevisions';

export type ApiQuotationRow = {
  id: string;
  quote_number?: string;
  inquiry: string | null;
  version_number: number;
  status: string;
  client_name?: string | null;
  event_type?: string | null;
  event_date?: string | null;
  final_selling_price?: string | number | null;
  total_amount?: string | number | null;
  created_at: string;
};

const STATUS_MAP: Record<string, QuotationUiStatus> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Declined',
};

function toUiStatus(s: string): QuotationUiStatus {
  const u = (s || '').toUpperCase();
  return STATUS_MAP[u] ?? 'Draft';
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function isoDateFromEventOrCreated(q: ApiQuotationRow): string {
  if (q.event_date && typeof q.event_date === 'string') {
    return q.event_date.length >= 10 ? q.event_date.slice(0, 10) : q.created_at.slice(0, 10);
  }
  return q.created_at.slice(0, 10);
}

/** Single row from API (list or detail). */
export function apiQuotationToRecord(
  q: ApiQuotationRow,
  opts: { isLatestRevision: boolean },
): QuotationRecord {
  const inquiryId = q.inquiry ?? null;
  const baseId = inquiryId ?? String(q.id);

  return {
    recordId: String(q.id),
    baseId,
    revisionNumber: Number(q.version_number) || 1,
    displayId: (q.quote_number || '').trim() || String(q.id),
    clientName: q.client_name ?? '—',
    phone: '',
    event: q.event_type ?? '—',
    eventDateISO: isoDateFromEventOrCreated(q),
    amount: num(q.final_selling_price) || num(q.total_amount),
    status: toUiStatus(q.status || 'DRAFT'),
    template: '',
    createdISO: q.created_at,
    parentId:
      inquiryId && (Number(q.version_number) || 1) > 1 ? inquiryId : null,
    isLatestRevision: opts.isLatestRevision,
    inquiryId,
  };
}

/** Full revision chain for one inquiry (same inquiry id, multiple rows). */
export function apiHistoryToRecords(items: ApiQuotationRow[]): QuotationRecord[] {
  if (!items.length) return [];
  const maxV = Math.max(...items.map((i) => Number(i.version_number) || 0));
  return items.map((q) =>
    apiQuotationToRecord(q, {
      isLatestRevision: (Number(q.version_number) || 0) === maxV && maxV > 0,
    }),
  );
}
