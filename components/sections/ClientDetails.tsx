import { firstNumber, firstString, formatDate, getPath, type SectionProps } from './types';

export default function ClientDetails({ data }: SectionProps) {
  const clientName = firstString(data, ['client_name', 'customer_name', 'inquiry.customer_name', 'event.client_name']);
  const venue = firstString(data, ['venue', 'event.venue', 'inquiry.venue']);
  const dateValue = getPath(data, 'event_date') ?? getPath(data, 'date') ?? getPath(data, 'inquiry.tentative_date');
  const pax = firstNumber(data, ['pax', 'guest_count', 'event.guest_count', 'inquiry.guest_count']);
  const quoteNumber = firstString(data, ['quote_number', 'quotation_number', 'id']);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Client Details</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Detail label="Client" value={clientName} />
        <Detail label="Quotation No." value={quoteNumber} />
        <Detail label="Venue" value={venue} />
        <Detail label="Date" value={formatDate(dateValue)} />
        <Detail label="Pax" value={pax ? `${pax} guests` : '-'} />
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}
