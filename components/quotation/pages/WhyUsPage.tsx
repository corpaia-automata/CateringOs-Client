import { DM_Sans, Playfair_Display } from 'next/font/google';

import { QuotationPage } from '@/components/quotation/QuotationPage';
import { PageHeader } from '@/components/quotation/shared/PageHeader';
import '@/styles/quotation-tokens.css';
import type { QuotationData, QuotationSnapshot } from '@/types/quotation';

import styles from './WhyUsPage.module.css';

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

const COMMITMENTS = [
  {
    title: 'End-to-End Event Management',
    text: 'Timeline planning, vendor coordination, and on-site supervision so catering aligns with your run-of-show.',
  },
  {
    title: 'Authentic Kerala Cuisine Expertise',
    text: 'Regional classics and contemporary presentations rooted in traditional techniques and balanced flavors.',
  },
  {
    title: 'Scalable for Any Event Size',
    text: 'From private dinners to high-volume buffets, our kitchen and service model scales without losing quality.',
  },
  {
    title: 'Transparent Pricing',
    text: 'Clear quotations, line-item clarity, and no surprise add-ons—know what you are paying for up front.',
  },
  {
    title: 'FSSAI Certified & Hygiene-Compliant',
    text: 'Food safety protocols, trained handlers, and audit-ready processes for peace of mind at every service.',
  },
] as const;

const GALLERY_LABELS = [
  'Wedding',
  'Corporate',
  'Birthday',
  'Reception',
  'Outdoor',
  'Buffet',
] as const;

export interface WhyUsPageProps {
  snapshot: QuotationSnapshot;
  quotation: QuotationData;
  pageNumber: number;
  totalPages?: number;
}

export function WhyUsPage({
  snapshot,
  quotation,
  pageNumber,
  totalPages = 1,
}: WhyUsPageProps) {
  return (
    <QuotationPage
      pageNumber={pageNumber}
      totalPages={totalPages}
      quoteNumber={quotation.quote_number}
      businessName={snapshot.business_name}
    >
      <div className={`${playfair.variable} ${dmSans.variable} ${styles.pageRoot}`}>
        <PageHeader label="Our Commitment" title="Why Choose Us" />
        <div className={styles.body}>
          <ul className={styles.list}>
            {COMMITMENTS.map((item, index) => (
              <li key={item.title} className={styles.item}>
                <span className={styles.numberCircle}>{index + 1}</span>
                <div className={styles.itemBody}>
                  <h4 className={styles.itemTitle}>{item.title}</h4>
                  <p className={styles.itemText}>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.gallery}>
            {GALLERY_LABELS.map((label) => (
              <div key={label} className={styles.galleryCell}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </QuotationPage>
  );
}
