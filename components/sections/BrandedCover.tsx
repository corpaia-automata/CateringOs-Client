/* eslint-disable @next/next/no-img-element */
import { firstNumber, firstString, formatDate, getPath, type SectionProps } from './types';

export default function BrandedCover({ data, branding = {} }: SectionProps) {
  const brandColor = branding.brand_color || '#2C2C2A';
  const clientName = firstString(data, ['client_name', 'customer_name', 'inquiry.customer_name', 'event.client_name']);
  const venue = firstString(data, ['venue', 'event.venue', 'inquiry.venue']);
  const dateValue = getPath(data, 'event_date') ?? getPath(data, 'date') ?? getPath(data, 'inquiry.tentative_date');
  const pax = firstNumber(data, ['pax', 'guest_count', 'event.guest_count', 'inquiry.guest_count']);
  const hasBranding = Boolean(branding.cover_image_url || branding.logo_url || branding.brand_color);

  if (!hasBranding) {
    return (
      <section className="flex min-h-[900px] flex-col justify-center rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Classic Quotation</p>
        <h1 className="mt-6 text-5xl font-bold text-slate-950">Catering Quotation</h1>
        <p className="mt-6 text-xl text-slate-600">{clientName}</p>
      </section>
    );
  }

  return (
    <section
      className="relative flex min-h-[900px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-12 text-white shadow-sm"
      style={{
        backgroundImage: branding.cover_image_url ? `linear-gradient(rgba(15,23,42,0.45), rgba(15,23,42,0.65)), url(${branding.cover_image_url})` : undefined,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <div className="relative z-10 flex w-full flex-col">
        {branding.logo_url ? (
          <img src={branding.logo_url} alt="Brand logo" className="h-16 w-16 rounded-xl bg-white object-contain p-2" />
        ) : null}
        <div className="mt-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">Proposal</p>
          <h1 className="mt-4 text-6xl font-bold uppercase leading-tight" style={{ color: brandColor }}>
            Catering Quotation
          </h1>
          <div className="mt-8 grid gap-3 text-lg text-white/90 sm:grid-cols-2">
            <p><span className="font-semibold">Client:</span> {clientName}</p>
            <p><span className="font-semibold">Venue:</span> {venue}</p>
            <p><span className="font-semibold">Date:</span> {formatDate(dateValue)}</p>
            <p><span className="font-semibold">Pax:</span> {pax || '-'} guests</p>
          </div>
        </div>
      </div>
    </section>
  );
}
