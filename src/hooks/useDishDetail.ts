import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Dish, Recipe, RecipePutPayload } from '@/types/dish';

// api.ts auto-injects the tenant slug via buildPath, so paths here are slug-relative.
// The `slug` parameter is accepted for call-site consistency but the URL uses the
// stored slug from authStorage (same tenant, same session).

export function useDish(_slug: string, dishId: string) {
  return useQuery({
    queryKey: ['dish', dishId],
    queryFn: () => api.get(`/master/dishes/${dishId}/`),
    enabled: !!dishId,
  });
}

const EMPTY_RECIPE: Recipe = { lines: [], batch_size: 0, batch_unit: 'KG' };

export function useRecipe(_slug: string, dishId: string) {
  const query = useQuery<Recipe>({
    queryKey: ['recipe', dishId],
    queryFn: (): Promise<Recipe> => api.get(`/master/dishes/${dishId}/recipe/`),
    enabled: !!dishId,
    select: (data: Recipe) => data ?? EMPTY_RECIPE,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { ...query, data: query.data ?? EMPTY_RECIPE };
}

export function useSaveRecipe(_slug: string, dishId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipePutPayload) =>
      api.put(`/master/dishes/${dishId}/recipe/`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', dishId] });
      queryClient.invalidateQueries({ queryKey: ['dish', dishId] });
    },
  });
}

export function useUpdateDish(_slug: string, dishId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Dish>) =>
      api.put(`/master/dishes/${dishId}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dish', dishId] });
    },
  });
}

export function useIngredientSearch(_slug: string, query: string) {
  return useQuery({
    queryKey: ['ing-search', query],
    enabled: query.trim().length > 1,
    queryFn: () =>
      api.get(`/master/ingredients/?search=${query}&is_active=true`),
    staleTime: 30000,
  });
}
