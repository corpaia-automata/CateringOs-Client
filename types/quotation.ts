export interface Section {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

export interface QuotationSnapshot {
  business_name: string;
  tagline: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  phone: string;
  email: string;
  since_year: string | number;
  about_text: string;
  sections: Section[];
}

export interface LineItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface MenuItem {
  name: string;
  highlight?: boolean;
}

export interface MenuSection {
  category: string;
  items: MenuItem[];
}

export interface ServiceCard {
  title: string;
  items: string[];
}

export interface QuotationData {
  quote_number: string;
  created_at: string;
  valid_until: string;
  customer_name: string;
  event_type: string;
  event_date: string; 
  venue: string;
  pax: number;
  service_type: string;
  advance_amount: number;
  total_amount: number;
  line_items: LineItem[];
  menu: MenuSection[];
  services: ServiceCard[];
  terms: string[];
  notes: string;
}
