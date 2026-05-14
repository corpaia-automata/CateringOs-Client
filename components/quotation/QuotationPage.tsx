import type { ReactNode } from 'react';

import '@/styles/quotation-tokens.css';

import styles from './QuotationPage.module.css';

export interface QuotationPageProps {
  children: ReactNode;
  pageNumber: number;
  totalPages: number;
  quoteNumber: string;
  businessName: string;
}

export function QuotationPage({
  children,
  pageNumber,
  totalPages,
  quoteNumber,
  businessName,
}: QuotationPageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.body}>{children}</div>
      <footer
        className={styles.footer}
        aria-label="Quotation page footer"
        data-total-pages={totalPages}
      >
        <span className={styles.footerLeft}>
          {businessName}
          {' · '}
          {quoteNumber}
        </span>
        <span className={styles.footerRight}>Page {pageNumber}</span>
      </footer>
    </div>
  );
}
