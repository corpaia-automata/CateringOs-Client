import { DM_Sans, Playfair_Display } from 'next/font/google';

import { QuotationPage } from '@/components/quotation/QuotationPage';
import { PageHeader } from '@/components/quotation/shared/PageHeader';
import '@/styles/quotation-tokens.css';
import type { QuotationData, QuotationSnapshot } from '@/types/quotation';

import styles from './QuoteInfoPage.module.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-q-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-q-body',
  display: 'swap',
});

function formatDisplayDate(value: string): string {
  if (!value?.trim()) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatINR(amount: number): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Placeholder until `setup_time` / `service_duration` exist on `QuotationData`. */
const PLACEHOLDER_SCHEDULE = '—';

export interface QuoteInfoPageProps {
  snapshot: QuotationSnapshot;
  quotation: QuotationData;
  pageNumber: number;
  totalPages?: number;
}

export function QuoteInfoPage({
  snapshot,
  quotation,
  pageNumber,
  totalPages = 1,
}: QuoteInfoPageProps) {
  const eventType = quotation.event_type?.trim() || '—';
  const paxLabel =
    quotation.pax != null ? `${quotation.pax} guests` : '—';

  const noteCopy = (() => {
    const advance = formatINR(quotation.advance_amount);
    const validUntil = formatDisplayDate(quotation.valid_until);
    return `Your booking is confirmed once we receive the advance of ${advance}. Please complete payment before the validity date. This quotation remains valid until ${validUntil} unless extended in writing by ${snapshot.business_name}.`;
  })();

  const rows = [
    { label: 'Client Name', cell: quotation.customer_name?.trim() || '—' },
    {
      label: 'Event Type',
      cell: (
        <span className={styles.badge}>{eventType}</span>
      ),
    },
    { label: 'Event Date', cell: formatDisplayDate(quotation.event_date) },
    { label: 'Venue', cell: quotation.venue?.trim() || '—' },
    { label: 'Guest Count', cell: quotation.pax != null ? String(quotation.pax) : '—' },
    {
      label: 'Service Type',
      cell: (
        <span className={styles.badge}>
          {quotation.service_type?.trim() || '—'}
        </span>
      ),
    },
    { label: 'Setup Time', cell: PLACEHOLDER_SCHEDULE },
    { label: 'Service Duration', cell: PLACEHOLDER_SCHEDULE },
    {
      label: 'Advance Required',
      cell: (
        <span className={styles.advanceValue}>
          {formatINR(quotation.advance_amount)}
        </span>
      ),
    },
  ];

  return (
    <QuotationPage
      pageNumber={pageNumber}
      totalPages={totalPages}
      quoteNumber={quotation.quote_number}
      businessName={snapshot.business_name}
    >
      <div className={`${playfair.variable} ${dmSans.variable} ${styles.pageRoot}`}>
        <PageHeader label="Your Quotation" title="Catering Quotation Details" />
        <div className={styles.subHeader}>
          <div className={styles.subLeft}>
            <p className={styles.customerName}>{quotation.customer_name || '—'}</p>
            <p className={styles.metaLine}>
              {eventType}
              {' · '}
              {paxLabel}
            </p>
          </div>

          <div className={styles.subRight}>
            <p className={styles.quoteNumber}>{quotation.quote_number}</p>
            <p className={styles.issuedLine}>
              Issued {formatDisplayDate(quotation.created_at)}
            </p>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th className={styles.th} scope="row">
                      {row.label}
                    </th>
                    <td className={styles.td}>{row.cell}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className={styles.noteBox}>
            <p className={styles.noteText}>{noteCopy}</p>
          </aside>
        </div>
      </div>
    </QuotationPage>
  );
}
