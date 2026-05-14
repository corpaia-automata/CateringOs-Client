import type { AppProps } from 'next/app';

/**
 * Pages Router entry — keeps /q/* routes free of app-route-specific wrappers.
 */
export default function PagesApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
