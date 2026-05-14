import { DM_Sans, Playfair_Display } from 'next/font/google';

import { QuotationPage } from '@/components/quotation/QuotationPage';
import { PageHeader } from '@/components/quotation/shared/PageHeader';
import '@/styles/quotation-tokens.css';
import type { QuotationData, QuotationSnapshot } from '@/types/quotation';

import styles from './PricingPage.module.css';

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

function sumLineItems(quotation: QuotationData): number {
  return quotation.line_items.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);
}

export interface PricingPageProps {
  snapshot: QuotationSnapshot;
  quotation: QuotationData;
  pageNumber: number;
  totalPages?: number;
}

export function PricingPage({
  snapshot,
  quotation,
  pageNumber,
  totalPages = 1,
}: PricingPageProps) {
  const subtotal = sumLineItems(quotation);
  const grandTotal = Number(quotation.total_amount) || 0;
  const gstAmount = Math.max(0, Math.round(grandTotal - subtotal));
  const advance = Number(quotation.advance_amount) || 0;
  const balance = Math.max(0, grandTotal - advance);

  return (
    <QuotationPage
      pageNumber={pageNumber}
      totalPages={totalPages}
      quoteNumber={quotation.quote_number}
      businessName={snapshot.business_name}
    >
      <div className={`${playfair.variable} ${dmSans.variable} ${styles.pageRoot}`}>
        <PageHeader label="Investment Summary" title="Pricing & Payment Terms" />
        <div className={styles.body}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadRow}>
                  <th className={`${styles.th} ${styles.thNum}`} scope="col">
                    #
                  </th>
                  <th className={styles.th} scope="col">
                    Description
                  </th>
                  <th className={styles.th} scope="col">
                    Qty
                  </th>
                  <th className={styles.th} scope="col">
                    Rate
                  </th>
                  <th className={`${styles.th} ${styles.thAmount}`} scope="col">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotation.line_items.length === 0 ? (
                  <tr className={styles.rowOdd}>
                    <td className={styles.td} colSpan={5}>
                      No line items.
                    </td>
                  </tr>
                ) : (
                  quotation.line_items.map((line, i) => (
                    <tr
                      key={`${line.description}-${i}`}
                      className={i % 2 === 1 ? styles.rowEven : styles.rowOdd}
                    >
                      <td className={`${styles.td} ${styles.tdNum}`}>{i + 1}</td>
                      <td className={styles.td}>{line.description || '—'}</td>
                      <td className={styles.td}>{line.qty ?? '—'}</td>
                      <td className={styles.td}>{formatINR(Number(line.rate) || 0)}</td>
                      <td className={`${styles.td} ${styles.tdAmount}`}>
                        {formatINR(Number(line.amount) || 0)}
                      </td>
                    </tr>
                  ))
                )}
                <tr className={styles.subtotalRow}>
                  <td className={`${styles.td} ${styles.subtotalLabel}`} colSpan={4}>
                    Subtotal
                  </td>
                  <td className={`${styles.td} ${styles.subtotalAmount}`}>
                    {formatINR(subtotal)}
                  </td>
                </tr>
                <tr className={styles.gstRow}>
                  <td className={`${styles.td} ${styles.gstLabel}`} colSpan={4}>
                    GST
                  </td>
                  <td className={`${styles.td} ${styles.gstAmount}`}>
                    {formatINR(gstAmount)}
                  </td>
                </tr>
                <tr className={styles.totalRow}>
                  <td className={`${styles.td} ${styles.totalLabel}`} colSpan={4}>
                    Grand Total
                  </td>
                  <td className={`${styles.td} ${styles.totalAmount}`}>
                    {formatINR(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.paymentGrid}>
            <div className={`${styles.paymentCard} ${styles.paymentCardAdvance}`}>
              <p className={styles.paymentLabel}>Advance required</p>
              <p className={styles.paymentAmount}>{formatINR(advance)}</p>
              <p className={styles.paymentHint}>
                Due by {formatDisplayDate(quotation.valid_until)}
              </p>
            </div>
            <div className={`${styles.paymentCard} ${styles.paymentCardBalance}`}>
              <p className={`${styles.paymentLabel} ${styles.paymentLabelDark}`}>
                Balance payment
              </p>
              <p className={`${styles.paymentAmount} ${styles.paymentAmountDark}`}>
                {formatINR(balance)}
              </p>
              <p className={`${styles.paymentHint} ${styles.paymentHintDark}`}>
                Due on day of event
              </p>
            </div>
          </div>

          {quotation.terms?.length ? (
            <section className={styles.termsBox} aria-label="Terms and conditions">
              <h4 className={styles.termsTitle}>Terms &amp; conditions</h4>
              <ul className={styles.termsList}>
                {quotation.terms.map((term, idx) => (
                  <li key={`${idx}-${term.slice(0, 24)}`} className={styles.termItem}>
                    <span className={styles.termNum}>{idx + 1}.</span>
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className={styles.signatureRow}>
            <div className={styles.sigBlock}>
              <p className={styles.sigLabel}>Authorised by</p>
              <p className={styles.sigName}>{snapshot.business_name || '—'}</p>
            </div>
            <div className={styles.sigBlock}>
              <p className={styles.sigLabel}>Client acceptance</p>
              <p className={styles.sigName}>{quotation.customer_name || '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </QuotationPage>
  );
}
