'use client';

import { useMemo, useState } from 'react';

import { AboutPage } from '@/components/quotation/pages/AboutPage';
import { CoverPage } from '@/components/quotation/pages/CoverPage';
import { MenuPage } from '@/components/quotation/pages/MenuPage';
import { PricingPage } from '@/components/quotation/pages/PricingPage';
import { QuoteInfoPage } from '@/components/quotation/pages/QuoteInfoPage';
import { ServicesPage } from '@/components/quotation/pages/ServicesPage';
import { WhyUsPage } from '@/components/quotation/pages/WhyUsPage';
import '@/styles/quotation-tokens.css';
import type { MenuSection, QuotationData, QuotationSnapshot } from '@/types/quotation';

import styles from './QuotationPreview.module.css';

const TOTAL_PAGES = 8;

const TAB_LABELS = [
  'Cover',
  'About',
  'Why Us',
  'Quote Info',
  'Menu (1)',
  'Menu (2)',
  'Services',
  'Pricing',
] as const;

const MENU_FOOTER_NOTE =
  '❖ Highlighted items are Chef\'s Recommendations · seasonal availability · Jain options available';

function splitMenuAcrossTwoPages(menu: MenuSection[]): [MenuSection[], MenuSection[]] {
  if (menu.length === 0) return [[], []];
  const mid = Math.ceil(menu.length / 2);
  return [menu.slice(0, mid), menu.slice(mid)];
}

export interface QuotationPreviewProps {
  snapshot: QuotationSnapshot;
  quotation: QuotationData;
  mode: 'preview' | 'print';
}

export default function QuotationPreview({
  snapshot,
  quotation,
  mode,
}: QuotationPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const [menuSections1, menuSections2] = useMemo(
    () => splitMenuAcrossTwoPages(quotation.menu),
    [quotation.menu],
  );

  const pages = useMemo(
    () =>
      [
        <CoverPage
          key="cover"
          snapshot={snapshot}
          quotation={quotation}
          pageNumber={1}
          totalPages={TOTAL_PAGES}
        />,
        <AboutPage
          key="about"
          snapshot={snapshot}
          quotation={quotation}
          pageNumber={2}
          totalPages={TOTAL_PAGES}
        />,
        <WhyUsPage
          key="why-us"
          snapshot={snapshot}
          quotation={quotation}
          pageNumber={3}
          totalPages={TOTAL_PAGES}
        />,
        <QuoteInfoPage
          key="quote-info"
          snapshot={snapshot}
          quotation={quotation}
          pageNumber={4}
          totalPages={TOTAL_PAGES}
        />,
        <MenuPage
          key="menu-1"
          snapshot={snapshot}
          quotation={quotation}
          pageNumber={5}
          pageTitle="Menu (1)"
          sections={menuSections1}
          footerNote={MENU_FOOTER_NOTE}
          totalPages={TOTAL_PAGES}
        />,
        <MenuPage
          key="menu-2"
          snapshot={snapshot}
          quotation={quotation}
          pageNumber={6}
          pageTitle="Menu (2)"
          sections={menuSections2}
          footerNote={MENU_FOOTER_NOTE}
          totalPages={TOTAL_PAGES}
        />,
        <ServicesPage
          key="services"
          snapshot={snapshot}
          quotation={quotation}
          pageNumber={7}
          totalPages={TOTAL_PAGES}
        />,
        <PricingPage
          key="pricing"
          snapshot={snapshot}
          quotation={quotation}
          pageNumber={8}
          totalPages={TOTAL_PAGES}
        />,
      ],
    [snapshot, quotation, menuSections1, menuSections2],
  );

  if (mode === 'print') {
    return (
      <div className={styles.printRoot}>
        <div className={styles.printStack}>{pages}</div>
      </div>
    );
  }

  return (
    <div className={styles.previewRoot}>
      <nav className={styles.tabs} aria-label="Quotation pages">
        {TAB_LABELS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={index === activeIndex ? styles.tabActive : styles.tab}
            onClick={() => setActiveIndex(index)}
            aria-current={index === activeIndex ? 'page' : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className={styles.stage}>
        {pages.map((page, index) => (
          <div
            key={TAB_LABELS[index]}
            className={
              index === activeIndex ? styles.pageSlotActive : styles.pageSlotHidden
            }
          >
            {page}
          </div>
        ))}
      </div>

      <div className={styles.footerNav}>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          disabled={activeIndex === 0}
          aria-label="Previous page"
        >
          <span aria-hidden>←</span>
          Prev
        </button>
        <span className={styles.pageIndicator}>
          Page {activeIndex + 1} of {TOTAL_PAGES}
        </span>
        <button
          type="button"
          className={styles.navButton}
          onClick={() =>
            setActiveIndex((i) => Math.min(TOTAL_PAGES - 1, i + 1))
          }
          disabled={activeIndex === TOTAL_PAGES - 1}
          aria-label="Next page"
        >
          Next
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
