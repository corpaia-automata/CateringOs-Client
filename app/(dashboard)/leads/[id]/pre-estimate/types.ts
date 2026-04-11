export interface PreEstimateItem {
  id: string;
  category_id: string;
  name: string;
  unit: string;
  quantity: string;
  rate: string;
  total: string;
}

export interface PreEstimateCategory {
  id: string;
  name: string;
  order: number;
  items: PreEstimateItem[];
}

export interface PreEstimate {
  id: string;
  inquiry: string;
  event_type: string;
  service_type: string;
  location: string;
  guest_count: number;
  target_margin: string;
  total_cost: string | null;
  total_quote: string | null;
  total_profit: string | null;
  categories: PreEstimateCategory[];
  created_at: string;
  updated_at: string;
}

// Local draft item — used before saving to backend
export interface DraftItem {
  _key: string; // local uuid for keying
  id: string | null;
  name: string;
  unit: string;
  quantity: string;
  rate: string;
  total: string; // computed locally
}

export interface DraftCategory {
  id: string;
  name: string;
  order: number;
  items: DraftItem[];
}
