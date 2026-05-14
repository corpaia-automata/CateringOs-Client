import type { Branding, Quotation, TemplateSchema } from '@/src/types/quotation';

/** Props passed to every quotation section (layout is pure display from API data). */
export interface SectionProps {
  quotation: Quotation;
  schema: TemplateSchema;
  branding: Branding;
}
