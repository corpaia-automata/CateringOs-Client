'use client';

import { useEffect, type CSSProperties, type ComponentType } from 'react';

import type { PublicQuotationResponse } from '@/src/types/quotation';

import { ActionBar } from './ActionBar';
import {
  AboutSection,
  CoverSection,
  EventDetailsSection,
  MenuSection,
  PricingSection,
  ServicesSection,
  TermsSection,
  WhyUsSection,
  type SectionProps,
} from './sections';

interface QuotationRendererProps {
  data: PublicQuotationResponse;
  isPrint?: boolean;
}

const SECTION_MAP: Record<string, ComponentType<SectionProps>> = {
  cover: CoverSection,
  about: AboutSection,
  why_us: WhyUsSection,
  event_details: EventDetailsSection,
  menu: MenuSection,
  services: ServicesSection,
  pricing: PricingSection,
  terms: TermsSection,
};

const FALLBACK_SECTIONS = [
  { id: 'cover', enabled: true, order: 1 },
  { id: 'about', enabled: true, order: 2 },
  { id: 'why_us', enabled: true, order: 3 },
  { id: 'event_details', enabled: true, order: 4 },
  { id: 'menu', enabled: true, order: 5 },
  { id: 'services', enabled: true, order: 6 },
  { id: 'pricing', enabled: true, order: 7 },
  { id: 'terms', enabled: true, order: 8 },
] as const;

/**
 * Renders the public quotation using template-driven section order and theme.
 */
export function QuotationRenderer({ data, isPrint = false }: QuotationRendererProps) {
  useEffect(() => {
    const templateType = data?.template?.type || 'classic';
    import(`./themes/${templateType}.css`).catch(() => import('./themes/classic.css'));
    import('./themes/print.css');
  }, [data?.template?.type]);

  const configuredSections = Array.isArray(data?.template?.sections_config?.sections)
    ? data.template.sections_config.sections
    : [];
  // Some legacy templates return empty sections_config; render defaults instead of a blank page.
  const sections = configuredSections.length > 0 ? configuredSections : FALLBACK_SECTIONS;

  const enabledSections = sections.filter((section) => section.enabled).sort((a, b) => a.order - b.order);

  const rootStyle = {
    '--q-primary': data.template.branding.primary_color,
    '--q-accent': data.template.branding.accent_color,
    '--q-font-heading': data.template.branding.font_heading,
    '--q-font-body': data.template.branding.font_body,
  } as CSSProperties;

  return (
    <div className={`quotation-root${isPrint ? ' print-mode' : ''}`} style={rootStyle}>
      {enabledSections.map((section) => {
        const SectionComponent = SECTION_MAP[section.id];
        if (!SectionComponent) {
          return null;
        }
        return (
          <SectionComponent
            key={section.id}
            quotation={data.quotation}
            schema={data.template.schema}
            branding={data.template.branding}
          />
        );
      })}
      <ActionBar token={data.quotation.public_token} isPrint={isPrint} />
    </div>
  );
}
