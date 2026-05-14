import { DM_Sans, Playfair_Display } from 'next/font/google';

import { QuotationPage } from '@/components/quotation/QuotationPage';
import { PageHeader } from '@/components/quotation/shared/PageHeader';
import '@/styles/quotation-tokens.css';
import type {
  QuotationData,
  QuotationSnapshot,
  ServiceCard,
} from '@/types/quotation';

import styles from './ServicesPage.module.css';

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

const DEFAULT_SERVICE_CARDS: ServiceCard[] = [
  {
    title: 'Service Staff',
    items: [
      'Head Chef',
      'Sous Chefs ×3',
      'Kitchen Helpers ×8',
      'Buffet Servers ×10',
      'Waiters ×6',
      'Supervisor',
    ],
  },
  {
    title: 'Serving Equipment',
    items: [
      'Chafing Dishes ×20',
      'Spoons',
      'Plates ×400',
      'Bowls',
      'Cutlery',
      'Tongs',
    ],
  },
  {
    title: 'Buffet Setup',
    items: [
      '6-Ft Tables ×6',
      'Skirting',
      'Covers',
      'Risers',
      'Signage',
      'Display Bowls',
    ],
  },
  {
    title: 'Logistics & Hygiene',
    items: [
      'Refrigerated Transport',
      'Food Warmers',
      'Hot Cases',
      'Waste Bins',
      'Cleanup',
      'Handwash',
    ],
  },
];

function resolveServiceCards(services: ServiceCard[] | undefined): ServiceCard[] {
  if (services?.length) return services;
  return DEFAULT_SERVICE_CARDS;
}

function ItemLine({ text }: { text: string }) {
  return (
    <li className={styles.item}>
      <span className={styles.dash} aria-hidden>
        —
      </span>
      <span>{text}</span>
    </li>
  );
}

function ServiceCardBlock({ card }: { card: ServiceCard }) {
  return (
    <article className={styles.card}>
      <h3 className={styles.cardTitle}>
        <span className={styles.cardDiamond} aria-hidden>
          ❖
        </span>
        <span className={styles.cardTitleText}>{card.title}</span>
      </h3>
      <ul className={styles.itemList}>
        {card.items.map((item, idx) => (
          <ItemLine key={`${card.title}-${idx}`} text={item} />
        ))}
      </ul>
    </article>
  );
}

export interface ServicesPageProps {
  snapshot: QuotationSnapshot;
  quotation: QuotationData;
  pageNumber: number;
  totalPages?: number;
}

export function ServicesPage({
  snapshot,
  quotation,
  pageNumber,
  totalPages = 1,
}: ServicesPageProps) {
  const cards = resolveServiceCards(quotation.services);
  const mainCards = cards.slice(0, 4);
  const extraCards = cards.slice(4);
  const extraItems = extraCards.flatMap((c) => c.items);

  return (
    <QuotationPage
      pageNumber={pageNumber}
      totalPages={totalPages}
      quoteNumber={quotation.quote_number}
      businessName={snapshot.business_name}
    >
      <div className={`${playfair.variable} ${dmSans.variable} ${styles.pageRoot}`}>
        <PageHeader label="What's Included" title="Services & Equipment" />
        <div className={styles.body}>
          <div className={styles.cardGrid}>
            {mainCards.map((card) => (
              <ServiceCardBlock key={card.title} card={card} />
            ))}
          </div>

          {extraItems.length > 0 ? (
            <section className={styles.additional} aria-label="Additional services">
              <h4 className={styles.additionalTitle}>Additional Services</h4>
              <div className={styles.additionalGrid}>
                {extraItems.map((item, idx) => (
                  <div key={`${item}-${idx}`} className={styles.item}>
                    <span className={styles.dash} aria-hidden>
                      —
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </QuotationPage>
  );
}
