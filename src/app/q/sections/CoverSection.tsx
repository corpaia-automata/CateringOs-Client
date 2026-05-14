import Image from 'next/image';

import type { SectionProps } from './types';
import { formatEventDateIso } from './utils';

/**
 * Hero, logo, tagline, and key event cues for the quote cover.
 */
export function CoverSection({ quotation, schema, branding }: SectionProps) {
  if (schema.cover_style === 'none') {
    return null;
  }

  const hasHero = Boolean(branding.hero_image && String(branding.hero_image).trim());
  const hasLogo = Boolean(branding.logo && String(branding.logo).trim());
  const hasTagline = Boolean(branding.company_tagline && branding.company_tagline.trim());
  const event = quotation.event;
  const clientName = event?.client_name?.trim() || '';
  const eventDateRaw = event?.event_date?.trim() || '';
  const dateLabel = eventDateRaw ? formatEventDateIso(eventDateRaw) : '';

  if (!hasHero && !hasLogo && !hasTagline && !clientName && !dateLabel) {
    return null;
  }

  return (
    <header className="q-cover">
      {hasHero ? (
        <div className="q-cover__hero">
          <Image
            src={branding.hero_image as string}
            alt=""
            fill
            className="q-cover__hero-image"
            sizes="100vw"
            unoptimized
            priority
          />
        </div>
      ) : null}

      {hasLogo ? (
        <div className="q-cover__logo-wrap">
          <Image
            src={branding.logo}
            alt=""
            width={240}
            height={120}
            className="q-cover__logo"
            unoptimized
          />
        </div>
      ) : null}

      {hasTagline ? <p className="q-cover__tagline">{branding.company_tagline}</p> : null}

      {clientName || dateLabel ? (
        <div className="q-cover__meta">
          {clientName ? <p className="q-cover__meta-line q-section-body">{clientName}</p> : null}
          {dateLabel ? <p className="q-cover__meta-line q-section-body">{dateLabel}</p> : null}
        </div>
      ) : null}
    </header>
  );
}
