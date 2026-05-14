import { QuotationForm } from '../components/QuotationForm';

interface EditQuotationPageProps {
  params: { slug: string; id: string };
}

/**
 * Edit quotation page in the caterer dashboard.
 */
export default function EditQuotationPage({ params }: EditQuotationPageProps) {
  return <QuotationForm slug={params.slug} quotationId={params.id} />;
}
