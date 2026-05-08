import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import ExpiredOverlay from '@/components/trial/ExpiredOverlay';
import SubscriptionProvider from '@/components/trial/SubscriptionProvider';
import TrialBanner from '@/components/trial/TrialBanner';
import Providers from './providers';
import './globals.css';

/** Bump when replacing `public/favicon.png` so browsers pick up the new tab icon. */
const FAVICON = '/favicon.png?v=2';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CateringOS',
  description: 'Catering operations management system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={FAVICON} type="image/png" sizes="any" />
        <link rel="shortcut icon" href={FAVICON} type="image/png" />
        <link rel="apple-touch-icon" href={FAVICON} />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background`}>
        <Providers>
          <SubscriptionProvider>
            {/* <TrialBanner /> */}
            {children}
            <ExpiredOverlay />
            <Toaster position="top-right" />
          </SubscriptionProvider>
        </Providers>
      </body>
    </html>
  );
}
