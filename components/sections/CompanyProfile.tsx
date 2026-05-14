/* eslint-disable @next/next/no-img-element */
import type { SectionProps } from './types';

export default function CompanyProfile({ branding = {} }: SectionProps) {
  const hasProfile = Boolean(branding.company_bio || branding.logo_url);

  if (!hasProfile) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">About Us</h2>
        <p className="mt-4 text-slate-600">
          We prepare thoughtful catering experiences tailored to your event, menu, and service needs.
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-[900px] flex-col justify-center rounded-3xl border border-slate-200 bg-white p-12 shadow-sm">
      {branding.logo_url ? (
        <img src={branding.logo_url} alt="Brand logo" className="mb-10 h-20 w-20 rounded-2xl object-contain" />
      ) : null}
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">About</p>
      <h2 className="mt-4 text-4xl font-semibold text-slate-950">Company Profile</h2>
      <p className="mt-8 max-w-3xl whitespace-pre-line text-lg leading-8 text-slate-700">
        {branding.company_bio || 'Company profile details will appear here once branding is configured.'}
      </p>
    </section>
  );
}
