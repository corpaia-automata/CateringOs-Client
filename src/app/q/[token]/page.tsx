import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { fetchPublicQuotation } from '@/src/lib/api/quotation';

import { QuotationRenderer } from '../QuotationRenderer';

interface PublicQuotationPageProps {
  params: { token: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('404');
}

function isPrintEnabled(value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) {
    return value[0] === 'true';
  }
  return value === 'true';
}

function getTenantNameFromResponse(data: Awaited<ReturnType<typeof fetchPublicQuotation>>): string {
  return data.template.branding.company_tagline?.trim() || 'Catering';
}

/**
 * Public quotation page rendered from the tokenized share link.
 */
export default async function PublicQuotationPage({ params, searchParams }: PublicQuotationPageProps) {
  const isPrint = isPrintEnabled(searchParams?.print);
  let data;
  try {
    data = await fetchPublicQuotation(params.token);
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }
  return <QuotationRenderer data={data} isPrint={isPrint} />;
}

export async function generateMetadata({ params }: Pick<PublicQuotationPageProps, 'params'>): Promise<Metadata> {
  try {
    const data = await fetchPublicQuotation(params.token);
    const clientName = data.quotation.event?.client_name?.trim() || 'Client';
    const tenantName = getTenantNameFromResponse(data);
    return {
      title: `Quotation for ${clientName} — ${tenantName}`,
    };
  } catch {
    return {
      title: 'Quotation',
    };
  }
}
