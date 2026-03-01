"use client";

import { SWRConfig } from "swr";
import { toast } from "@/components/ui/sonner";
import { ReactNode } from "react";

interface FetchError extends Error {
  info?: { message?: string };
  status?: number;
}

const globalFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error: FetchError = new Error("Veri yüklenemedi");
    try {
      error.info = await res.json();
    } catch {
      // JSON parse hatası - ignore
    }
    error.status = res.status;
    throw error;
  }
  return res.json();
};

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher: globalFetcher,
        onError: (error: FetchError, _key: string) => {
          // 401, 403, 404 için toast gösterme
          if ([401, 403, 404].includes(error?.status || 0)) return;
          toast.error("Veri yüklenirken hata oluştu", {
            description: error?.info?.message || error?.message,
          });
        },
        onErrorRetry: (
          error: FetchError,
          _key: string,
          _config: unknown,
          revalidate: (opts?: { retryCount: number }) => void,
          { retryCount }: { retryCount: number }
        ) => {
          // 401, 403, 404 için retry yapma
          if ([401, 403, 404].includes(error?.status || 0)) return;
          // 3 denemeden fazlası yapma
          if (retryCount >= 3) return;
          // Exponential backoff ile retry
          setTimeout(() => revalidate({ retryCount }), 5000 * (retryCount + 1));
        },
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
        keepPreviousData: true,
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  );
}
