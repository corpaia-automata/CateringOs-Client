'use client';

import { CreateEventPage } from '@/components/events/CreateEventPage';

export default function CreateEventRoute() {
  return <CreateEventPage backHref="/events" detailHref={id => `/events/${id}`} />;
}
