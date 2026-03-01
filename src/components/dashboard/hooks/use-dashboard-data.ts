/**
 * useDashboardData Hook - SWR Optimized Version
 *
 * Dashboard sayfası için optimize edilmiş veri yönetimi hook'u.
 * SWR ile cache stratejisi, stale-while-revalidate pattern.
 *
 * Optimizasyonlar:
 * - SWR ile automatic caching ve deduplication
 * - Dönem bağımlı ve bağımsız veriler için ayrı cache keys
 * - Background revalidation ile anlık UI
 * - Error retry ve fallback
 */

import useSWR, { mutate } from "swr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DashboardStats,
  DashboardAlert,
  ActivityItem,
  UpcomingReminder,
} from "@/types/dashboard";

// ============================================
// TYPES
// ============================================

interface UseDashboardDataOptions {
  initialYear?: number;
  initialMonth?: number;
}

interface UpcomingData {
  events: UpcomingReminder[];
  tasks: UpcomingReminder[];
}

// ============================================
// FETCHER (401 redirect destekli)
// ============================================

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);

  // 401 = oturum süresi dolmuş, login'e yönlendir
  if (res.status === 401) {
    // SWR cache'ini tamamen temizle
    mutate(() => true, undefined, { revalidate: false });
    window.location.href = "/login";
    // Redirect sırasında SWR'ın tekrar denemesini engelle
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    const error = new Error("API request failed");
    (error as Error & { status: number }).status = res.status;
    throw error;
  }
  return res.json();
};

// ============================================
// SWR CONFIG
// ============================================

// Dönem bağımlı veriler için config (stats)
const periodDependentConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 30000, // 30 saniye içinde aynı istek tekrarlanmaz
  errorRetryCount: 2,
  errorRetryInterval: 3000,
  keepPreviousData: true, // Dönem değişirken önceki veriyi göster
  // SESSION_EXPIRED hatalarında retry yapma
  onErrorRetry: (error: Error & { status?: number }) => {
    if (error.message === "SESSION_EXPIRED") return;
  },
};

// Dönem bağımsız veriler için config (alerts, activity, upcoming)
const periodIndependentConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000, // 60 saniye
  refreshInterval: 120000, // 2 dakikada bir background refresh
  errorRetryCount: 2,
  keepPreviousData: false, // Memory birikimini önle
  // SESSION_EXPIRED hatalarında retry yapma
  onErrorRetry: (error: Error & { status?: number }) => {
    if (error.message === "SESSION_EXPIRED") return;
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDefaultPeriod() {
  // Mali müşavirlik kuralı: Varsayılan dönem bir önceki ay
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  let defaultMonth = currentMonth - 1;
  let defaultYear = currentYear;
  if (defaultMonth === 0) {
    defaultMonth = 12;
    defaultYear = currentYear - 1;
  }
  return { defaultYear, defaultMonth };
}

// ============================================
// HOOK
// ============================================

export function useDashboardData(options: UseDashboardDataOptions = {}) {
  const { defaultYear, defaultMonth } = getDefaultPeriod();

  const [selectedYear, setSelectedYear] = useState(
    options.initialYear ?? defaultYear
  );
  const [selectedMonth, setSelectedMonth] = useState(
    options.initialMonth ?? defaultMonth
  );

  // Tenant değişikliği kontrolü: farklı kullanıcı giriş yaptıysa SWR cache'ini temizle
  const cacheChecked = useRef(false);
  useEffect(() => {
    if (cacheChecked.current) return;
    cacheChecked.current = true;

    // Supabase session'dan user ID al ve sessionStorage ile karşılaştır
    const checkTenantChange = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;

        const prevUserId = sessionStorage.getItem("dashboard_user_id");
        if (prevUserId && prevUserId !== user.id) {
          // Farklı kullanıcı - eski cache'i tamamen temizle ve yeniden yükle
          mutate(() => true, undefined, { revalidate: true });
        }
        sessionStorage.setItem("dashboard_user_id", user.id);
      } catch {
        // Sessizce devam et
      }
    };
    checkTenantChange();
  }, []);

  // ============================================
  // SWR HOOKS - Paralel ve cache'li veri çekme
  // ============================================

  // Stats - Dönem bağımlı
  const statsKey = `/api/dashboard/stats?year=${selectedYear}&month=${selectedMonth}`;
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    isValidating: statsValidating,
  } = useSWR<DashboardStats>(statsKey, fetcher, periodDependentConfig);

  // Alerts - Dönem bağımsız, background refresh
  const {
    data: alerts,
    isLoading: alertsLoading,
    isValidating: alertsValidating,
  } = useSWR<DashboardAlert[]>("/api/dashboard/alerts", fetcher, periodIndependentConfig);

  // Activities - Dönem bağımsız, diverse=true ile çeşitli aktiviteler, 60sn polling
  const {
    data: activities,
    isLoading: activitiesLoading,
    isValidating: activitiesValidating,
  } = useSWR<ActivityItem[]>(
    "/api/dashboard/activity?limit=8&diverse=true",
    fetcher,
    {
      ...periodIndependentConfig,
      refreshInterval: 60000, // 60 saniye polling - memory kullanımını azalt
    }
  );

  // Upcoming - Dönem bağımsız
  const {
    data: upcomingData,
    isLoading: upcomingLoading,
    isValidating: upcomingValidating,
  } = useSWR<UpcomingData>(
    "/api/dashboard/upcoming?limit=3&days=30",
    fetcher,
    periodIndependentConfig
  );

  // ============================================
  // DERIVED DATA
  // ============================================

  const upcomingEvents = useMemo(
    () => upcomingData?.events || [],
    [upcomingData]
  );

  const upcomingTasks = useMemo(
    () => upcomingData?.tasks || [],
    [upcomingData]
  );

  // ============================================
  // REFRESH FUNCTIONS
  // ============================================

  // Tüm verileri yeniden yükle (force revalidate)
  const refresh = useCallback(async () => {
    await Promise.all([
      mutate(statsKey),
      mutate("/api/dashboard/alerts"),
      mutate("/api/dashboard/activity?limit=8&diverse=true"),
      mutate("/api/dashboard/upcoming?limit=3&days=30"),
    ]);
  }, [statsKey]);

  // Sadece stats'ı yenile (dönem değişiminde otomatik olur)
  const refreshStats = useCallback(() => {
    mutate(statsKey);
  }, [statsKey]);

  // ============================================
  // LOADING STATES
  // ============================================

  // İlk yükleme (veri hiç yokken)
  const initialLoading = statsLoading || alertsLoading || activitiesLoading || upcomingLoading;

  // Background yenileme (veri varken yenileniyor)
  const isRefreshing = statsValidating || alertsValidating || activitiesValidating || upcomingValidating;

  // Combined loading - sadece ilk yüklemede true
  const loading = initialLoading && !stats && !alerts && !activities && !upcomingData;

  // ============================================
  // ERROR HANDLING
  // ============================================

  const error = statsError ? "İstatistikler yüklenirken hata oluştu" : null;

  // ============================================
  // RETURN
  // ============================================

  return {
    // Data (null-safe defaults)
    stats: stats ?? null,
    alerts: alerts ?? [],
    activities: activities ?? [],
    upcomingEvents,
    upcomingTasks,

    // Period
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,

    // Loading states
    loading,
    initialLoading,
    isRefreshing,
    statsLoading,
    alertsLoading,
    activitiesLoading,
    upcomingLoading,

    // Error
    error,

    // Actions
    refresh,
    refreshStats,
  };
}

// ============================================
// PREFETCH UTILITY
// ============================================

/**
 * Dashboard verilerini önceden yükle
 * Sidebar'da dashboard linkine hover edildiğinde çağrılabilir
 */
export function prefetchDashboardData() {
  const { defaultYear, defaultMonth } = getDefaultPeriod();

  // Preload all dashboard data - fetch and cache
  const urls = [
    `/api/dashboard/stats?year=${defaultYear}&month=${defaultMonth}`,
    "/api/dashboard/alerts",
    "/api/dashboard/activity?limit=8&diverse=true",
    "/api/dashboard/upcoming?limit=3&days=30",
  ];

  urls.forEach(url => {
    // Trigger fetch and populate SWR cache
    fetcher(url).then(data => {
      mutate(url, data, false);
    }).catch(() => {
      // Silent fail for prefetch
    });
  });
}
