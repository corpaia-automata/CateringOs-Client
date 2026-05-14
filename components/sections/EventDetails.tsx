import { firstNumber, firstString, formatDate, getPath, type SectionProps } from './types';

export default function EventDetails({ data }: SectionProps) {
  const eventName = firstString(data, ['event_name', 'event_type', 'inquiry.event_type'], 'Event');
  const serviceType = firstString(data, ['service_type', 'event.service_type', 'service_type_narration']);
  const dateValue = getPath(data, 'event_date') ?? getPath(data, 'inquiry.tentative_date');
  const guests = firstNumber(data, ['guest_count', 'pax', 'event.guest_count', 'inquiry.guest_count']);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-semibold text-slate-950">Event Details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Detail label="Event" value={eventName} />
        <Detail label="Service" value={serviceType} />
        <Detail label="Date" value={formatDate(dateValue)} />
        <Detail label="Guests" value={guests ? `${guests} guests` : '-'} />
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
