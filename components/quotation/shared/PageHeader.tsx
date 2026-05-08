import { DM_Sans, Playfair_Display } from 'next/font/google';

import '@/styles/quotation-tokens.css';

import styles from './PageHeader.module.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-q-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-q-body',
  display: 'swap',
});

export interface PageHeaderProps {
  label: string;
  title: string;
}

export function PageHeader({ label, title }: PageHeaderProps) {
  return (
    <header
      className={`${playfair.variable} ${dmSans.variable} ${styles.header}`}
    >
      <p className={styles.label}>{label}</p>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.underline} aria-hidden />
    </header>
  );
}
