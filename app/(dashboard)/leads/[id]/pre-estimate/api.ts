import { api } from '@/lib/api';
import { PreEstimate } from './types';

const BASE = (id: string) => `/inquiries/preestimates/${id}`;

export const preEstimateApi = {
  create: (body: {
    inquiry: string;
    event_type: string;
    service_type: string;
    location: string;
    guest_count: number;
    target_margin: number;
  }): Promise<PreEstimate> => api.post('/inquiries/preestimates/', body),

  get: (id: string): Promise<PreEstimate> => api.get(BASE(id)),

  addItem: (
    preEstimateId: string,
    body: {
      category_id: string;
      name: string;
      unit: string;
      quantity: string;
      rate: string;
    }
  ) => api.post(`${BASE(preEstimateId)}/add-item/`, body),

  recalculate: (id: string): Promise<PreEstimate> =>
    api.post(`${BASE(id)}/recalculate/`, {}),

  export: (id: string) => api.get(`${BASE(id)}/export/`),
};
