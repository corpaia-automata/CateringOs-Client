import { DM_Sans, Playfair_Display } from 'next/font/google';

import { QuotationPage } from '@/components/quotation/QuotationPage';
import { PageHeader } from '@/components/quotation/shared/PageHeader';
import '@/styles/quotation-tokens.css';
import type { QuotationData, QuotationSnapshot } from '@/types/quotation';

import styles from './AboutPage.module.css';

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

const STATS = [
  { value: '15+', label: 'Years Experience' },
  { value: '2,400+', label: 'Events Served' },
  { value: '120+', label: 'Team Members' },
  { value: '98%', label: 'Satisfaction' },
] as const;

const VALUE_CARDS = [
  {
    title: 'Premium Ingredients',
    body: 'Fresh produce, quality proteins, and authentic spices chosen for flavor and consistency on every plate.',
  },
  {
    title: 'Trained Service Team',
    body: 'Courteous, well-drilled staff who keep service smooth from guest arrival through breakdown.',
  },
  {
    title: 'Custom Menus',
    body: 'Menus tailored to your culture, dietary needs, and budget—without compromising on taste or presentation.',
  },
  {
    title: 'Full Setup & Cleanup',
    body: 'We handle staging, rentals coordination, and post-event teardown so you can focus on your guests.',
  },
] as const;

function aboutParagraphs(aboutText: string): string[] {
  const parts = aboutText
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\n/g, ' '))
    .filter(Boolean);
  if (parts.length === 0) {
    return [
      'We are a full-service catering team dedicated to memorable dining experiences—blending traditional recipes with professional execution.',
      'From intimate gatherings to large celebrations, we plan menus, logistics, and service so your event feels seamless and special.',
    ];
  }
  return parts.slice(0, 2);
}

export interface AboutPageProps {
  snapshot: QuotationSnapshot;
  quotation: QuotationData;
  pageNumber: number;
  totalPages?: number;
}

export function AboutPage({
  snapshot,
  quotation,
  pageNumber,
  totalPages = 1,
}: AboutPageProps) {
  const paragraphs = aboutParagraphs(snapshot.about_text ?? '');
  const aboutTitle = `About ${snapshot.business_name}`;

  return (
    <QuotationPage
      pageNumber={pageNumber}
      totalPages={totalPages}
      quoteNumber={quotation.quote_number}
      businessName={snapshot.business_name}
    >
      <div className={`${playfair.variable} ${dmSans.variable} ${styles.pageRoot}`}>
        <PageHeader label="Who We Are" title={aboutTitle} />
        <div className={styles.body}>
          <div className={styles.prose}>
            {paragraphs.map((text, i) => (
              <p key={i} className={styles.paragraph}>
                {text}
              </p>
            ))}
          </div>
          <div className={styles.statsRow}>
            {STATS.map((s) => (
              <div key={s.label} className={styles.stat}>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
          <div className={styles.cardGrid}>
            {VALUE_CARDS.map((card) => (
              <article key={card.title} className={styles.card}>
                <div className={styles.cardIcon} aria-hidden />
                <div className={styles.cardContent}>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  <p className={styles.cardBody}>{card.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </QuotationPage>
  );
}
