import { DM_Sans, Playfair_Display } from 'next/font/google';

import { QuotationPage } from '@/components/quotation/QuotationPage';
import { PageHeader } from '@/components/quotation/shared/PageHeader';
import '@/styles/quotation-tokens.css';
import type {
  MenuSection,
  QuotationData,
  QuotationSnapshot,
} from '@/types/quotation';

import styles from './MenuPage.module.css';

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

function splitSectionsForColumns(sections: MenuSection[]): [MenuSection[], MenuSection[]] {
  if (sections.length === 0) return [[], []];
  const mid = Math.ceil(sections.length / 2);
  return [sections.slice(0, mid), sections.slice(mid)];
}

function MenuSectionBlock({
  section,
  isLast,
}: {
  section: MenuSection;
  isLast: boolean;
}) {
  return (
    <section
      className={`${styles.section} ${isLast ? styles.sectionLast : ''}`}
    >
      <h3 className={styles.categoryHeader}>
        <span className={styles.categoryDiamond} aria-hidden>
          ❖
        </span>
        <span className={styles.categoryTitle}>{section.category}</span>
      </h3>
      <ul className={styles.itemList}>
        {section.items.map((item, idx) => (
          <li key={`${section.category}-${item.name}-${idx}`} className={styles.itemRow}>
            <span className={styles.bullet} aria-hidden />
            {item.highlight ? (
              <span className={styles.itemHighlight}>{item.name}</span>
            ) : (
              <span className={styles.itemName}>{item.name}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface MenuPageProps {
  snapshot: QuotationSnapshot;
  quotation: QuotationData;
  pageNumber: number;
  pageTitle: string;
  sections: MenuSection[];
  footerNote?: string;
  totalPages?: number;
}

export function MenuPage({
  snapshot,
  quotation,
  pageNumber,
  pageTitle,
  sections,
  footerNote,
  totalPages = 1,
}: MenuPageProps) {
  const [leftSections, rightSections] = splitSectionsForColumns(sections);

  return (
    <QuotationPage
      pageNumber={pageNumber}
      totalPages={totalPages}
      quoteNumber={quotation.quote_number}
      businessName={snapshot.business_name}
    >
      <div className={`${playfair.variable} ${dmSans.variable} ${styles.pageRoot}`}>
        <PageHeader label="Curated for Your Event" title={pageTitle} />
        <div className={styles.body}>
          <div className={styles.grid}>
            {sections.length === 0 ? (
              <p className={styles.emptyState}>No menu items on this page.</p>
            ) : (
              <>
                <div className={styles.column}>
                  {leftSections.map((section, i) => (
                    <MenuSectionBlock
                      key={`${section.category}-L-${i}`}
                      section={section}
                      isLast={i === leftSections.length - 1}
                    />
                  ))}
                </div>
                <div className={styles.column}>
                  {rightSections.map((section, i) => (
                    <MenuSectionBlock
                      key={`${section.category}-R-${i}`}
                      section={section}
                      isLast={i === rightSections.length - 1}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          {footerNote ? (
            <aside className={styles.footerNote}>
              <p className={styles.footerNoteText}>{footerNote}</p>
            </aside>
          ) : null}
        </div>
      </div>
    </QuotationPage>
  );
}
