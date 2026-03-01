/**
 * SWR Hook: Beyanname Takip Verileri
 *
 * Aylık beyanname durumlarını cache'li şekilde yükler.
 * - Year/Month değiştiğinde otomatik refetch
 * - 60 saniye dedupe
 */
import useSWR from 'swr';

interface BeyannameStatus {
  status: 'bos' | 'verildi' | 'muaf' | '3aylik';
  meta?: {
    sentDate?: string;
    [key: string]: any;
  };
}

// Format: { customerId: { "KDV1": { status: "verildi", meta: {...} }, ... } }
type BeyannameTakipData = Record<string, Record<string, BeyannameStatus>>;

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Beyanname takip verileri yüklenemedi');
  }
  return res.json();
};

interface UseBeyannameTakipOptions {
  year: number;
  month: number;
  revalidateOnFocus?: boolean;
}

export function useBeyannameTakip(options: UseBeyannameTakipOptions) {
  const { year, month, revalidateOnFocus = false } = options;

  const { data, error, isLoading, isValidating, mutate } = useSWR<BeyannameTakipData>(
    `/api/beyanname-takip?year=${year}&month=${month}`,
    fetcher,
    {
      revalidateOnFocus,
      dedupingInterval: 60000, // 60 saniye aynı istek yapılmaz
      keepPreviousData: true,
    }
  );

  return {
    takipData: data || {},
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
    mutate,
  };
}

export type { BeyannameTakipData, BeyannameStatus };
