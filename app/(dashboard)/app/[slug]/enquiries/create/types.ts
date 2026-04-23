// ─── RHF Form Values ──────────────────────────────────────────────────────────

export interface MenuItemField {
  dish: string;
  pricePerPlate: string;
  quantity: string;
}

export interface MenuSectionField {
  name: string;
  items: MenuItemField[];
}

export interface FormValues {
  clientName: string;
  contactNumber: string;
  sourceChannel: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  guestCount: string;
  eventType: string;
  serviceType: string;
  menuSections: MenuSectionField[];
}

// ─── Legacy types (kept for API payload shape) ────────────────────────────────

export interface MenuItem {
  /** Stable client-side key (never sent to server) */
  _key: string;
  dish: string;
  pricePerPlate: string;
  quantity: string;
}

export interface MenuSection {
  name: string;
  items: MenuItem[];
}

export interface ServiceItem {
  _key: string;
  service_name: string;
  description: string;
}

export interface FormErrors {
  client_name?: string;
  contact_number?: string;
  event_type?: string;
  service_type?: string;
}

// ─── Submit payload ───────────────────────────────────────────────────────────

export interface EnquiryPayload {
  customer_name: string;
  contact_number: string;
  source_channel: string;
  event_type: string;
  tentative_date: string;
  guest_count: number | null;
  estimated_budget?: number | null;
  notes?: string;
}
