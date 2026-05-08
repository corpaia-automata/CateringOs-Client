/**
 * Quotation revision model & helpers.
 * List shows one row per base ID (latest revision only); full history held in memory for UI.
 */

export type QuotationUiStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined';

export type QuotationRecord = {
  /** Unique row id (DB primary key surrogate) */
  recordId: string;
  /** Base quotation id — shared by all revisions in a group */
  baseId: string;
  revisionNumber: number;
  displayId: string;
  clientName: string;
  phone: string;
  event: string;
  eventDateISO: string;
  amount: number;
  status: QuotationUiStatus;
  template: string;
  createdISO: string;
  updatedISO?: string;
  isLatestRevision: boolean;
  /** null for rev 1; otherwise base id */
  parentId: string | null;
  /** When sourced from Django, linked inquiry id — used to fetch revision history */
  inquiryId?: string | null;
};

export function formatDisplayId(baseId: string, revisionNumber: number): string {
  return `${baseId}-${String(revisionNumber).padStart(3, '0')}`;
}

export function getGroupRevisions(all: QuotationRecord[], baseId: string): QuotationRecord[] {
  return all
    .filter((r) => r.baseId === baseId)
    .sort((a, b) => a.revisionNumber - b.revisionNumber);
}

export function getLatestRevision(all: QuotationRecord[], baseId: string): QuotationRecord | undefined {
  return all.find((r) => r.baseId === baseId && r.isLatestRevision);
}

/** Previous revisions only (exclude current latest), descending by revision number — for inline expand */
export function getPreviousRevisionsDesc(all: QuotationRecord[], baseId: string): QuotationRecord[] {
  const latest = getLatestRevision(all, baseId);
  return all
    .filter((r) => r.baseId === baseId && latest && r.recordId !== latest.recordId)
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
}

/** Timeline: latest first — for drawer */
export function getRevisionsTimelineDesc(all: QuotationRecord[], baseId: string): QuotationRecord[] {
  return getGroupRevisions(all, baseId).sort((a, b) => b.revisionNumber - a.revisionNumber);
}

export function matchesSearchRow(
  latest: QuotationRecord,
  q: string,
): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return (
    latest.baseId.toLowerCase().includes(needle) ||
    latest.displayId.toLowerCase().includes(needle) ||
    latest.clientName.toLowerCase().includes(needle) ||
    latest.event.toLowerCase().includes(needle)
  );
}

/**
 * Edit always forks a new revision (Draft) from current latest.
 * Wire to API: PATCH old latest { isLatestRevision: false }; POST new row.
 */
export function createRevisionFromLatest(all: QuotationRecord[], baseId: string): QuotationRecord[] {
  const latest = getLatestRevision(all, baseId);
  if (!latest) return all;

  const nextN = latest.revisionNumber + 1;
  const newDisplayId = formatDisplayId(baseId, nextN);
  const newRecordId = `rev-${baseId}-${nextN}-${Date.now()}`;

  const cleared: QuotationRecord = {
    ...latest,
    recordId: newRecordId,
    revisionNumber: nextN,
    displayId: newDisplayId,
    status: 'Draft',
    isLatestRevision: true,
    parentId: baseId,
    createdISO: new Date().toISOString(),
    updatedISO: new Date().toISOString(),
  };

  return all
    .map((r) => (r.recordId === latest.recordId ? { ...r, isLatestRevision: false, updatedISO: new Date().toISOString() } : r))
    .concat([cleared]);
}

export function deleteQuotationGroup(all: QuotationRecord[], baseId: string): QuotationRecord[] {
  return all.filter((r) => r.baseId !== baseId);
}

/** Initial mock: mix of single-revision and multi-revision groups */
export const INITIAL_QUOTATION_REVISIONS: QuotationRecord[] = [
  // Group: QT-2026-0429 — 3 revisions (example from spec)
  {
    recordId: 'rec-0429-1',
    baseId: 'QT-2026-0429',
    revisionNumber: 1,
    displayId: 'QT-2026-0429-001',
    clientName: 'Shahana & Rizwan',
    phone: '+91 98765 43210',
    event: 'Wedding Celebration',
    eventDateISO: '2026-05-24',
    amount: 160000,
    status: 'Draft',
    template: 'Wedding Buffet',
    createdISO: '2026-04-26T10:00:00+05:30',
    isLatestRevision: false,
    parentId: null,
  },
  {
    recordId: 'rec-0429-2',
    baseId: 'QT-2026-0429',
    revisionNumber: 2,
    displayId: 'QT-2026-0429-002',
    clientName: 'Shahana & Rizwan',
    phone: '+91 98765 43210',
    event: 'Wedding Celebration',
    eventDateISO: '2026-05-24',
    amount: 185000,
    status: 'Sent',
    template: 'Wedding Buffet',
    createdISO: '2026-04-28T14:00:00+05:30',
    isLatestRevision: false,
    parentId: 'QT-2026-0429',
  },
  {
    recordId: 'rec-0429-3',
    baseId: 'QT-2026-0429',
    revisionNumber: 3,
    displayId: 'QT-2026-0429-003',
    clientName: 'Shahana & Rizwan',
    phone: '+91 98765 43210',
    event: 'Wedding Celebration',
    eventDateISO: '2026-05-24',
    amount: 230000,
    status: 'Sent',
    template: 'Wedding Buffet',
    createdISO: '2026-04-29T09:30:00+05:30',
    isLatestRevision: true,
    parentId: 'QT-2026-0429',
  },
  // Single-revision groups (rest of list)
  {
    recordId: 'dq-002',
    baseId: 'QT-2026-0428-014',
    revisionNumber: 1,
    displayId: 'QT-2026-0428-014-001',
    clientName: 'TechPark India Pvt Ltd',
    phone: '+91 80 4455 8899',
    event: 'Annual Town Hall Catering',
    eventDateISO: '2026-06-03',
    amount: 185000,
    status: 'Accepted',
    template: 'Corporate Lunch',
    createdISO: '2026-04-28T16:14:22+05:30',
    isLatestRevision: true,
    parentId: null,
  },
  {
    recordId: 'dq-003',
    baseId: 'QT-2026-0426-008',
    revisionNumber: 1,
    displayId: 'QT-2026-0426-008-001',
    clientName: 'Meera Kapoor',
    phone: '+91 98450 33221',
    event: 'Baby Shower Lunch',
    eventDateISO: '2026-05-02',
    amount: 48000,
    status: 'Draft',
    template: 'Standard Banquet',
    createdISO: '2026-04-26T11:08:05+05:30',
    isLatestRevision: true,
    parentId: null,
  },
  {
    recordId: 'dq-004',
    baseId: 'QT-2026-0425-091',
    revisionNumber: 1,
    displayId: 'QT-2026-0425-091-001',
    clientName: 'Greenfield School',
    phone: '+91 94488 77112',
    event: 'Teachers Day Buffet',
    eventDateISO: '2026-09-05',
    amount: 92000,
    status: 'Declined',
    template: 'Standard Banquet',
    createdISO: '2026-04-25T07:42:51+05:30',
    isLatestRevision: true,
    parentId: null,
  },
  {
    recordId: 'dq-005',
    baseId: 'QT-2026-0423-055',
    revisionNumber: 1,
    displayId: 'QT-2026-0423-055-001',
    clientName: 'Ananya Reddy',
    phone: '+91 99001 55443',
    event: 'Silver Jubilee Dinner',
    eventDateISO: '2026-07-14',
    amount: 310000,
    status: 'Sent',
    template: 'Evening Gala',
    createdISO: '2026-04-23T18:20:33+05:30',
    isLatestRevision: true,
    parentId: null,
  },
  {
    recordId: 'dq-006',
    baseId: 'QT-2026-0422-077',
    revisionNumber: 1,
    displayId: 'QT-2026-0422-077-001',
    clientName: 'Coastal Resorts LLP',
    phone: '+91 83444 99100',
    event: 'Executive Retreat Brunch',
    eventDateISO: '2026-08-01',
    amount: 145000,
    status: 'Draft',
    template: 'Corporate Lunch',
    createdISO: '2026-04-22T09:03:44+05:30',
    isLatestRevision: true,
    parentId: null,
  },
  {
    recordId: 'dq-007',
    baseId: 'QT-2026-0420-003',
    revisionNumber: 1,
    displayId: 'QT-2026-0420-003-001',
    clientName: 'Imran Malik',
    phone: '+91 77665 88776',
    event: 'Nikah Reception Dinner',
    eventDateISO: '2026-06-21',
    amount: 198000,
    status: 'Accepted',
    template: 'Wedding Buffet',
    createdISO: '2026-04-20T14:45:09+05:30',
    isLatestRevision: true,
    parentId: null,
  },
  {
    recordId: 'dq-008',
    baseId: 'QT-2026-0418-033',
    revisionNumber: 1,
    displayId: 'QT-2026-0418-033-001',
    clientName: 'Startup Hub Kerala',
    phone: '+91 48444 66110',
    event: 'Pitch Day Lunch',
    eventDateISO: '2026-05-10',
    amount: 56000,
    status: 'Declined',
    template: 'Corporate Lunch',
    createdISO: '2026-04-18T10:55:56+05:30',
    isLatestRevision: true,
    parentId: null,
  },
  {
    recordId: 'dq-009',
    baseId: 'QT-2026-0415-088',
    revisionNumber: 1,
    displayId: 'QT-2026-0415-088-001',
    clientName: 'Dr. Kavitha Pillai',
    phone: '+91 98711 66220',
    event: '60th Birthday Brunch',
    eventDateISO: '2026-04-29',
    amount: 72000,
    status: 'Sent',
    template: 'Standard Banquet',
    createdISO: '2026-04-15T13:12:41+05:30',
    isLatestRevision: true,
    parentId: null,
  },
  {
    recordId: 'dq-010',
    baseId: 'QT-2026-0410-056',
    revisionNumber: 1,
    displayId: 'QT-2026-0410-056-001',
    clientName: 'Harini & Vivek Murthy',
    phone: '+91 98330 77441',
    event: 'Engagement Cocktail Hour',
    eventDateISO: '2026-05-31',
    amount: 112000,
    status: 'Draft',
    template: 'Evening Gala',
    createdISO: '2026-04-10T08:19:52+05:30',
    isLatestRevision: true,
    parentId: null,
  },
];
