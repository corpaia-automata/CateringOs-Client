import { BrandingForm } from './BrandingForm';

interface BrandingSettingsPageProps {
  params: { slug: string };
}

/**
 * Branding/template settings page for a caterer workspace.
 */
export default function BrandingSettingsPage({ params }: BrandingSettingsPageProps) {
  return <BrandingForm slug={params.slug} />;
}
