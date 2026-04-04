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
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useBotLog } from "@/context/bot-log-context";
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
// Not: refreshInterval burada yok — WS invalidation kullanılıyor,
// WS koptuğunda adaptiveIndependentConfig fallback polling açar
const periodIndependentConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 30000, // 30 saniye
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

  // WS bağlantı durumuna göre adaptive config
  const { wsConnected } = useBotLog();
  const adaptiveIndependentConfig = useMemo(() => ({
    ...periodIndependentConfig,
    // WS bağlı değilse fallback polling aç (120 saniye)
    refreshInterval: wsConnected ? 0 : 120000,
  }), [wsConnected]);

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
  // BATCH INITIAL FETCH - Tek roundtrip ile ilk yükleme
  // ============================================

  const batchInitialized = useRef(false);

  useEffect(() => {
    if (batchInitialized.current) return;
    batchInitialized.current = true;

    const statsUrl = `/api/dashboard/stats?year=${selectedYear}&month=${selectedMonth}`;

    fetch("/api/dashboard/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        widgets: ["stats", "alerts", "activity", "upcoming"],
        params: {
          stats: { year: String(selectedYear), month: String(selectedMonth) },
          activity: { limit: "8", diverse: "true" },
          upcoming: { limit: "3", days: "30" },
        },
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        startTransition(() => {
          if (data.stats?.ok) mutate(statsUrl, data.stats.data, false);
          if (data.alerts?.ok) mutate("/api/dashboard/alerts", data.alerts.data, false);
          if (data.activity?.ok) mutate("/api/dashboard/activity?limit=8&diverse=true", data.activity.data, false);
          if (data.upcoming?.ok) mutate("/api/dashboard/upcoming?limit=3&days=30", data.upcoming.data, false);
        });
      })
      .catch(() => {
        // Batch başarısız olursa SWR individual hook'lar fallback olarak çalışır
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Alerts - Dönem bağımsız, WS invalidation ile güncellenir
  const {
    data: alerts,
    isLoading: alertsLoading,
    isValidating: alertsValidating,
  } = useSWR<DashboardAlert[]>("/api/dashboard/alerts", fetcher, adaptiveIndependentConfig);

  // Activities - Dönem bağımsız, WS invalidation ile güncellenir
  const {
    data: activities,
    isLoading: activitiesLoading,
    isValidating: activitiesValidating,
  } = useSWR<ActivityItem[]>(
    "/api/dashboard/activity?limit=8&diverse=true",
    fetcher,
    adaptiveIndependentConfig
  );

  // Upcoming - Dönem bağımsız, WS invalidation ile güncellenir
  const {
    data: upcomingData,
    isLoading: upcomingLoading,
    isValidating: upcomingValidating,
  } = useSWR<UpcomingData>(
    "/api/dashboard/upcoming?limit=3&days=30",
    fetcher,
    adaptiveIndependentConfig
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
 * Dashboard verilerini önceden yükle (batch)
 * Sidebar'da dashboard linkine hover edildiğinde çağrılabilir.
 * Tek roundtrip ile tüm widget'ları çeker ve SWR cache'ine yazar.
 */
export function prefetchDashboardData() {
  const { defaultYear, defaultMonth } = getDefaultPeriod();

  fetch("/api/dashboard/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      widgets: ["stats", "alerts", "activity", "upcoming"],
      params: {
        stats: { year: String(defaultYear), month: String(defaultMonth) },
        activity: { limit: "8", diverse: "true" },
        upcoming: { limit: "3", days: "30" },
      },
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      const statsUrl = `/api/dashboard/stats?year=${defaultYear}&month=${defaultMonth}`;
      if (data.stats?.ok) mutate(statsUrl, data.stats.data, false);
      if (data.alerts?.ok) mutate("/api/dashboard/alerts", data.alerts.data, false);
      if (data.activity?.ok) mutate("/api/dashboard/activity?limit=8&diverse=true", data.activity.data, false);
      if (data.upcoming?.ok) mutate("/api/dashboard/upcoming?limit=3&days=30", data.upcoming.data, false);
    })
    .catch(() => {
      // Batch başarısız olursa sessizce devam et
    });
}
