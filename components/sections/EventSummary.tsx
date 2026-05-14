import { firstNumber, firstString, formatDate, getPath, type SectionProps } from './types';

export default function EventSummary({ data }: SectionProps) {
  const client = firstString(data, ['client_name', 'customer_name', 'inquiry.customer_name']);
  const eventType = firstString(data, ['event_type', 'event.event_type', 'inquiry.event_type']);
  const venue = firstString(data, ['venue', 'event.venue', 'inquiry.venue']);
  const dateValue = getPath(data, 'event_date') ?? getPath(data, 'inquiry.tentative_date');
  const guests = firstNumber(data, ['guest_count', 'pax', 'event.guest_count', 'inquiry.guest_count']);

  return (
    <section className="rounded-2xl bg-slate-950 p-8 text-white shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Event Summary</p>
      <h2 className="mt-3 text-3xl font-semibold">{eventType}</h2>
      <div className="mt-6 grid gap-4 text-sm text-white/80 sm:grid-cols-2">
        <p><span className="font-semibold text-white">Client:</span> {client}</p>
        <p><span className="font-semibold text-white">Venue:</span> {venue}</p>
        <p><span className="font-semibold text-white">Date:</span> {formatDate(dateValue)}</p>
        <p><span className="font-semibold text-white">Pax:</span> {guests || '-'} guests</p>
      </div>
    </section>
  );
}
