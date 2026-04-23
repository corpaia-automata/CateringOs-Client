export interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit_of_measure: string;
  unit_cost: number;
  is_active: boolean;
}

export interface Dish {
  id: string;
  tenant: string;
  name: string;
  dish_type: 'recipe' | 'live_counter' | 'fixed_price';
  veg_non_veg: 'veg' | 'non_veg';
  description: string;
  image_url: string;
  base_price: number;
  selling_price: number;
  labour_cost: number;
  serving_unit: 'PLATE' | 'KG' | 'PIECE' | 'LITRE' | 'PORTION';
  category: string | null;
  category_name?: string;
  has_recipe: boolean;
  is_active: boolean;
  batch_size: number;
  batch_unit: string;
  created_at: string;
  updated_at: string;
}

export interface RecipeLine {
  id: string;
  ingredient: string;
  ingredient_name: string;
  ingredient_uom: string;
  ingredient_category: string;
  qty_per_unit: number;
  unit: string;
  unit_cost_snapshot: number;
}

export interface Recipe {
  exists?: boolean;
  batch_size: number;
  batch_unit: string;
  lines: RecipeLine[];
}

export interface RecipePutPayload {
  batch_size: number;
  batch_unit: string;
  lines: { ingredient: string; qty_per_unit: number; unit: string }[];
}
