/**
 * Pure transformation: flat QuotationRecord[] → ClientQuotationGroup[].
 *
 * Groups by client_name (no client_id exists in the API yet).
 * Revisions inside each group are sorted oldest-first; latest = last element.
 * Client list is sorted by latest revision's updatedISO (falling back to
 * createdISO) descending — most recently touched client first.
 */

import type { QuotationRecord, QuotationUiStatus } from '@/lib/quotationsRevisions';

export type GroupedRevision = {
  quotation_id: string;
  revision_number: number;
  amount: number;
  status: QuotationUiStatus;
  created_at: string;
};

export type ClientQuotationGroup = {
  /** Stable grouping key. Uses clientName until a real client_id exists in the API. */
  client_id: string;
  client_name: string;
  /** Event name taken from the latest revision in this group. */
  event_name: string;
  /** Event date (YYYY-MM-DD) taken from the latest revision. */
  event_date: string;
  latest_status: QuotationUiStatus;
  latest_amount: number;
  revision_count: number;
  revisions: GroupedRevision[];
};

function latestTimestamp(r: QuotationRecord): string {
  return r.updatedISO ?? r.createdISO;
}

export function groupQuotationsByClient(records: QuotationRecord[]): ClientQuotationGroup[] {
  // Accumulate all records per client name.
  const byClient = new Map<string, QuotationRecord[]>();

  for (const record of records) {
    const key = record.clientName;
    const bucket = byClient.get(key);
    if (bucket) {
      bucket.push(record);
    } else {
      byClient.set(key, [record]);
    }
  }

  // Build groups and track the sort key alongside each group.
  const withKey: Array<{ group: ClientQuotationGroup; sortKey: number }> = [];

  for (const [clientName, clientRecords] of byClient) {
    // Sort oldest-first so last element is the latest revision.
    const sorted = [...clientRecords].sort(
      (a, b) => new Date(a.createdISO).getTime() - new Date(b.createdISO).getTime(),
    );

    const latest = sorted[sorted.length - 1];

    withKey.push({
      group: {
        client_id: clientName,
        client_name: clientName,
        event_name: latest.event,
        event_date: latest.eventDateISO,
        latest_status: latest.status,
        latest_amount: latest.amount,
        revision_count: sorted.length,
        revisions: sorted.map((r) => ({
          quotation_id: r.recordId,
          revision_number: r.revisionNumber,
          amount: r.amount,
          status: r.status,
          created_at: r.createdISO,
        })),
      },
      // Use the latest record's updatedISO → createdISO as sort key.
      sortKey: new Date(latestTimestamp(latest)).getTime(),
    });
  }

  // Most recently updated client first.
  withKey.sort((a, b) => b.sortKey - a.sortKey);

  return withKey.map(({ group }) => group);
}
