import Head from 'next/head';
import Link from 'next/link';

/**
 * Entry point for creating templates outside cloning — placeholder until onboarding/cloning UX ships.
 */
export default function AdminTemplatesNewPlaceholder() {
  return (
    <>
      <Head>
        <title>New quotation template · Admin</title>
      </Head>
      <div className="min-h-screen bg-[#f8fafc] px-6 py-12">
        <div className="mx-auto max-w-lg rounded-xl border border-[#e2e8f0] bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-[#0f172a]">New quotation template</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#64748b]">
            Templates are provisioned per tenant (often during onboarding). To duplicate layout for another workspace,
            use <strong>Clone</strong> from the{' '}
            <Link href="/admin/templates" className="font-semibold text-[#1C3355] underline">
              templates list
            </Link>
            .
          </p>
          <Link
            href="/admin/templates"
            className="mt-6 inline-flex rounded-lg bg-[#1C3355] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162a47]"
          >
            Back to templates
          </Link>
        </div>
      </div>
    </>
  );
}
