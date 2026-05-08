/**
 * Types for public + tenant quotation API payloads.
 * ``Quotation.id`` is a UUID string from the backend; menu row ``id`` values match API (often numeric or string — use ``number`` where the API uses integer dish ids).
 */

export interface Branding {
  logo: string;
  hero_image: string | null;
  primary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  company_tagline: string;
  about_text: string;
  why_choose_us: string;
}

export interface SectionConfig {
  id: string;
  enabled: boolean;
  order: number;
}

export interface TemplateSchema {
  spacing: 'comfortable' | 'spacious' | 'compact';
  menu_layout: 'table' | 'cards' | 'list';
  show_item_quantities: boolean;
  show_complimentary_tags: boolean;
  pricing_style: 'summary_box' | 'highlight_box' | 'inline';
  cover_style: 'full_bleed' | 'none';
  show_page_numbers: boolean;
  footer_text: string;
}

export interface QuotationTemplate {
  type: 'classic' | 'premium' | 'minimal';
  branding: Branding;
  sections_config: { sections: SectionConfig[] };
  schema: TemplateSchema;
}

export interface MenuDish {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  is_complimentary: boolean;
}

export interface MenuService {
  id: number;
  name: string;
  staff_count: number;
  counter_count: number;
  equipment_list: string[];
}

export interface EventDetails {
  client_name: string;
  event_type: string;
  pax: number;
  venue: string;
  event_date: string;
}

export interface Quotation {
  /** UUID primary key from the API (JSON string). */
  id: string;
  event: EventDetails | null;
  menu_dishes: MenuDish[];
  menu_services: MenuService[];
  subtotal: string;
  total: string;
  costing: Record<string, unknown>;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  public_token: string;
  /** Present once backend PDF generation has completed. */
  pdf_url?: string | null;
  created_at: string;
}

export interface PublicQuotationResponse {
  template: QuotationTemplate;
  quotation: Quotation;
}
