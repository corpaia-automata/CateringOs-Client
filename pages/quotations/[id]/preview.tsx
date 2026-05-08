import Head from 'next/head';
import type { GetServerSideProps } from 'next';

import QuotationPreview from '@/components/quotation/QuotationPreview';
import { QuotationPdfDownloadButton } from '@/components/quotation/QuotationPdfDownloadButton';
import { fetchQuotation } from '@/lib/api/quotations';
import type { QuotationData, QuotationSnapshot } from '@/types/quotation';

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const needle = `${name}=`;
  const segments = cookieHeader.split(';').map((s) => s.trim());
  for (const seg of segments) {
    if (seg.startsWith(needle)) {
      return decodeURIComponent(seg.slice(needle.length));
    }
  }
  return null;
}

function getAccessTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  return readCookie(cookieHeader, 'cos_access') ?? readCookie(cookieHeader, 'access_token');
}

function getTenantSlugFromCookieHeader(cookieHeader: string | undefined): string | null {
  return readCookie(cookieHeader, 'cos_tenant_slug');
}

export interface QuotationPreviewPageProps {
  snapshot: QuotationSnapshot;
  quotation: QuotationData;
  quotationId: string;
  tenantSlug: string;
  pageTitle: string;
}

export default function QuotationPreviewPage({
  snapshot,
  quotation,
  quotationId,
  tenantSlug,
  pageTitle,
}: QuotationPreviewPageProps) {
  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <div
        style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: '16px 24px 0',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <QuotationPdfDownloadButton quotationId={quotationId} tenantSlug={tenantSlug} />
      </div>
      <QuotationPreview snapshot={snapshot} quotation={quotation} mode="preview" />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<QuotationPreviewPageProps> = async (ctx) => {
  const rawId = ctx.params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id || typeof id !== 'string') {
    return { notFound: true };
  }

  const token = getAccessTokenFromCookieHeader(ctx.req.headers.cookie);
  const slugFromCookie = getTenantSlugFromCookieHeader(ctx.req.headers.cookie);
  const slugFromQuery = typeof ctx.query.slug === 'string' ? ctx.query.slug : null;
  const tenantSlug = slugFromCookie || slugFromQuery;

  if (!token || !tenantSlug) {
    const dest = `/login?from=${encodeURIComponent(ctx.resolvedUrl)}`;
    return { redirect: { destination: dest, permanent: false } };
  }

  try {
    const { snapshot, quotation } = await fetchQuotation(id, {
      accessToken: token,
      tenantSlug,
    });
    const pageTitle = `${quotation.customer_name || 'Client'} — Quotation #${quotation.quote_number || id}`;
    return {
      props: {
        snapshot,
        quotation,
        quotationId: id,
        tenantSlug,
        pageTitle,
      },
    };
  } catch {
    return { notFound: true };
  }
};
