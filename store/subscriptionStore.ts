import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export type SubscriptionApiData = {
  subscription?: SubscriptionApiData;
  subscription_status?: SubscriptionStatus | null;
  trial_days_left?: number;
  trial_ends_at?: string | null;
  has_active_access?: boolean;
};

type SubscriptionState = {
  subscriptionStatus: SubscriptionStatus | null;
  trialDaysLeft: number;
  trialEndDate: string | null;
  hasActiveAccess: boolean;
  isLoaded: boolean;
  syncFromApi: (apiData: SubscriptionApiData | null | undefined) => void;
  reset: () => void;
};

const initialState = {
  subscriptionStatus: null,
  trialDaysLeft: 0,
  trialEndDate: null,
  hasActiveAccess: false,
  isLoaded: false,
};

export function writeSubscriptionStatusCookie(status: SubscriptionStatus | null) {
  if (typeof document === 'undefined') return;

  if (!status) {
    document.cookie = 'subscription_status=; path=/; max-age=0';
    return;
  }

  document.cookie = `subscription_status=${status}; path=/; max-age=604800; SameSite=Lax`;
}

export const subscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      ...initialState,
      syncFromApi: (apiData) => {
        const source = apiData?.subscription ?? apiData;
        const subscriptionStatus = source?.subscription_status ?? null;

        writeSubscriptionStatusCookie(subscriptionStatus);
        set({
          subscriptionStatus,
          trialDaysLeft: source?.trial_days_left ?? 0,
          trialEndDate: source?.trial_ends_at ?? null,
          hasActiveAccess: source?.has_active_access ?? false,
          isLoaded: true,
        });
      },
      reset: () => {
        writeSubscriptionStatusCookie(null);
        set(initialState);
      },
    }),
    {
      name: 'subscription-store',
      partialize: (state) => ({
        subscriptionStatus: state.subscriptionStatus,
        trialDaysLeft: state.trialDaysLeft,
        trialEndDate: state.trialEndDate,
        hasActiveAccess: state.hasActiveAccess,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isLoaded = false;
      },
    }
  )
);

export const useSubscriptionStore = subscriptionStore;
export const useIsTrialing = () => subscriptionStore((state) => state.subscriptionStatus === 'TRIAL');
export const useIsExpired = () =>
  subscriptionStore((state) => state.subscriptionStatus === 'EXPIRED' || state.subscriptionStatus === 'CANCELLED');
export const useHasAccess = () => subscriptionStore((state) => state.hasActiveAccess);
export const useTrialDaysLeft = () => subscriptionStore((state) => state.trialDaysLeft);
