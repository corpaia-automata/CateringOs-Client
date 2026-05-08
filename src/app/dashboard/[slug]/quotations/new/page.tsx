import { QuotationForm } from '../components/QuotationForm';

interface NewQuotationPageProps {
  params: { slug: string };
}

/**
 * Create quotation page in the caterer dashboard.
 */
export default function NewQuotationPage({ params }: NewQuotationPageProps) {
  return <QuotationForm slug={params.slug} />;
}
