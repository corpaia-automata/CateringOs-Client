'use client';

import { useParams } from 'next/navigation';

import { CreateEventPage } from '@/components/events/CreateEventPage';

export default function CreateEventSlugRoute() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';

  return (
    <CreateEventPage
      backHref={`/app/${slug}/events`}
      detailHref={id => `/app/${slug}/events/${id}`}
    />
  );
}
