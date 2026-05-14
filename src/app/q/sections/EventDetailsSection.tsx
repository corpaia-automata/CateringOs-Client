import type { SectionProps } from './types';
import { formatEventDateIso } from './utils';

/**
 * Inquiry snapshot: guest scale, venue, schedule.
 */
export function EventDetailsSection({ quotation }: SectionProps) {
  const ev = quotation.event;
  if (!ev) {
    return null;
  }

  const client = ev.client_name?.trim() || '';
  const type = ev.event_type?.trim() || '';
  const venue = ev.venue?.trim() || '';
  const dateRaw = ev.event_date?.trim() || '';
  const pax = typeof ev.pax === 'number' && Number.isFinite(ev.pax) ? ev.pax : null;

  if (!client && !type && !venue && !dateRaw && pax === null) {
    return null;
  }

  const dateLabel = dateRaw ? formatEventDateIso(dateRaw) : '';
  const paxLabel = pax !== null ? `${pax} guests` : '';

  return (
    <section className="q-event-details" aria-label="Event details">
      <h2 className="q-section-title">Event details</h2>
      <div className="q-event-details__grid">
        {client ? (
          <div>
            <p className="q-event-details__field-label">Client</p>
            <p className="q-event-details__field-value">{client}</p>
          </div>
        ) : null}
        {type ? (
          <div>
            <p className="q-event-details__field-label">Event type</p>
            <p className="q-event-details__field-value">{type}</p>
          </div>
        ) : null}
        {paxLabel ? (
          <div>
            <p className="q-event-details__field-label">Guests</p>
            <p className="q-event-details__field-value">{paxLabel}</p>
          </div>
        ) : null}
        {venue ? (
          <div>
            <p className="q-event-details__field-label">Venue</p>
            <p className="q-event-details__field-value">{venue}</p>
          </div>
        ) : null}
        {dateLabel ? (
          <div>
            <p className="q-event-details__field-label">Event date</p>
            <p className="q-event-details__field-value">{dateLabel}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
