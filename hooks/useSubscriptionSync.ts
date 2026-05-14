'use client';

import { useEffect } from 'react';
import { authStorage } from '@/lib/auth';
import { api } from '@/lib/api';
import { subscriptionStore, useSubscriptionStore, type SubscriptionApiData } from '@/store/subscriptionStore';

function isBlockedStatus(status: string | null | undefined) {
  return status === 'EXPIRED' || status === 'CANCELLED';
}

async function syncSubscription(syncFromApi: (apiData: SubscriptionApiData | null | undefined) => void) {
  const data = (await api.get('/billing/status/')) as SubscriptionApiData;
  syncFromApi(data);
}

export function useSubscriptionSync() {
  useEffect(() => {
    async function sync() {
      if (!authStorage.isLoggedIn()) return;

      const latestStatus = subscriptionStore.getState().subscriptionStatus;
      if (isBlockedStatus(latestStatus)) {
        return;
      }

      try {
        await syncSubscription(subscriptionStore.getState().syncFromApi);
      } catch {
        // TrialExpiredError responses already update the store in the API client.
        const status = subscriptionStore.getState().subscriptionStatus;
        if (isBlockedStatus(status)) return;
      }
    }

    void sync();
  }, []);

  useEffect(() => {
    let intervalId: number | undefined;

    async function sync() {
      if (!authStorage.isLoggedIn()) return;

      try {
        await syncSubscription(subscriptionStore.getState().syncFromApi);
      } catch {
        // TrialExpiredError responses already update the store in the API client.
        const latestStatus = subscriptionStore.getState().subscriptionStatus;
        if (isBlockedStatus(latestStatus)) return;
      }
    }

    function updatePolling(nextStatus: string | null) {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }

      if (nextStatus === 'TRIAL') {
        intervalId = window.setInterval(() => {
          void sync();
        }, 60000);
      }
    }

    updatePolling(subscriptionStore.getState().subscriptionStatus);
    const unsubscribe = subscriptionStore.subscribe((state, previousState) => {
      if (state.subscriptionStatus !== previousState.subscriptionStatus) {
        updatePolling(state.subscriptionStatus);
      }
    });

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      unsubscribe();
    };
  }, []);
}

export function useRequireAccess(redirectTo: string) {
  const hasActiveAccess = useSubscriptionStore((state) => state.hasActiveAccess);
  const isLoaded = useSubscriptionStore((state) => state.isLoaded);

  useEffect(() => {
    if (isLoaded && !hasActiveAccess) {
      window.location.replace(redirectTo);
    }
  }, [hasActiveAccess, isLoaded, redirectTo]);

  return { hasActiveAccess, isLoaded };
}
