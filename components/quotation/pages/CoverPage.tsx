import { DM_Sans, Playfair_Display } from 'next/font/google';

import { QuotationPage } from '@/components/quotation/QuotationPage';
import '@/styles/quotation-tokens.css';
import type { QuotationData, QuotationSnapshot } from '@/types/quotation';

import styles from './CoverPage.module.css';

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

function businessInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function formatDisplayDate(value: string): string {
  if (!value?.trim()) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface CoverPageProps {
  snapshot: QuotationSnapshot;
  quotation: QuotationData;
  pageNumber?: number;
  totalPages?: number;
}

export function CoverPage({
  snapshot,
  quotation,
  pageNumber = 1,
  totalPages = 1,
}: CoverPageProps) {
  const logoSrc = snapshot.logo_url?.trim();

  return (
    <QuotationPage
      pageNumber={pageNumber}
      totalPages={totalPages}
      quoteNumber={quotation.quote_number}
      businessName={snapshot.business_name}
    >
      <div
        className={`${playfair.variable} ${dmSans.variable} ${styles.root}`}
      >
        <div className={styles.goldBar} aria-hidden />
        <div className={styles.mainColumn}>
          <div className={styles.logoSection}>
            <div className={styles.logoCircle}>
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt=""
                  className={styles.logoImage}
                />
              ) : (
                <span className={styles.logoInitials}>
                  {businessInitials(snapshot.business_name)}
                </span>
              )}
            </div>
            <div className={styles.businessName}>{snapshot.business_name}</div>
            {snapshot.tagline ? (
              <div className={styles.tagline}>{snapshot.tagline}</div>
            ) : null}
          </div>
          <div className={styles.divider} role="separator" />
          <h1 className={styles.docTitle}>Catering Quotation</h1>
          <div className={styles.clientBox}>
            <div className={styles.preparedLabel}>Prepared for</div>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldRow}>
                <span className={styles.fieldName}>Customer Name</span>
                <span className={styles.fieldValue}>{quotation.customer_name || '—'}</span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldName}>Event Type</span>
                <span className={styles.fieldValue}>{quotation.event_type || '—'}</span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldName}>Event Date</span>
                <span className={styles.fieldValue}>{formatDisplayDate(quotation.event_date)}</span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldName}>Venue</span>
                <span className={styles.fieldValue}>{quotation.venue || '—'}</span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldName}>Guest Count</span>
                <span className={styles.fieldValue}>
                  {quotation.pax != null ? String(quotation.pax) : '—'}
                </span>
              </div>
            </div>
            <div className={styles.clientBoxBottom}>
              <span className={styles.quoteMeta}>Quote No. {quotation.quote_number}</span>
              <span className={styles.validMeta}>
                Valid Until {formatDisplayDate(quotation.valid_until)}
              </span>
            </div>
          </div>
          <div className={styles.flexGrow} aria-hidden />
        </div>
        <div className={styles.photoStrip} aria-hidden>
          <div className={styles.photoCell}>Food</div>
          <div className={styles.photoCell}>Setup</div>
          <div className={styles.photoCell}>Service</div>
          <div className={styles.photoCell}>Decor</div>
        </div>
        <footer className={styles.contactBar}>
          <span className={`${styles.contactItem} ${styles.contactLeft}`}>
            {snapshot.email || '—'}
          </span>
          <span className={`${styles.contactItem} ${styles.contactRight}`}>
            {snapshot.phone || '—'}
          </span>
        </footer>
      </div>
    </QuotationPage>
  );
}
