/**
 * useActivitiesData Hook
 *
 * Aktiviteler sayfası için paginated SWR hook.
 * Filtre parametreleri + pagination desteği.
 * Dashboard panelinden BAĞIMSIZ - ayrı SWR key.
 */

import useSWR from "swr";
import { useMemo } from "react";
import type { ActivityPageResponse, ActivityFilter } from "@/types/dashboard";

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("API request failed");
    (error as Error & { status: number }).status = res.status;
    throw error;
  }
  return res.json();
};

interface UseActivitiesDataOptions extends ActivityFilter {
  page: number;
  pageSize?: number;
}

export function useActivitiesData(options: UseActivitiesDataOptions) {
  const { page, pageSize = 25, userId, action, resource, startDate, endDate } = options;

  const swrKey = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (userId) params.set("userId", userId);
    if (action) params.set("action", action);
    if (resource) params.set("resource", resource);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return `/api/dashboard/activity?${params.toString()}`;
  }, [page, pageSize, userId, action, resource, startDate, endDate]);

  const { data, isLoading, isValidating, mutate } = useSWR<ActivityPageResponse>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 15000,
      refreshInterval: 30000, // 30sn polling
    }
  );

  return {
    activities: data?.activities ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    isLoading,
    isValidating,
    mutate,
  };
}
