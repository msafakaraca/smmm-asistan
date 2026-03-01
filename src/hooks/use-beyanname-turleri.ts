/**
 * SWR Hook: Beyanname Türleri
 *
 * Beyanname türlerini cache'li şekilde yükler.
 * - Nadiren değişir, uzun cache süresi
 * - 5 dakika dedupe
 */
import useSWR from 'swr';

interface BeyannameTuru {
  id: string;
  kod: string;
  aciklama: string;
  kisaAd: string | null;
  kategori: string | null;
  aktif: boolean;
  siraNo: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Beyanname türleri yüklenemedi');
  }
  const data = await res.json();
  // Sadece aktif olanları al ve sırala
  return data
    .filter((t: BeyannameTuru) => t.aktif)
    .sort((a: BeyannameTuru, b: BeyannameTuru) => a.siraNo - b.siraNo);
};

interface UseBeyannameTurleriOptions {
  revalidateOnFocus?: boolean;
}

export function useBeyannameTurleri(options: UseBeyannameTurleriOptions = {}) {
  const { revalidateOnFocus = false } = options;

  const { data, error, isLoading, isValidating, mutate } = useSWR<BeyannameTuru[]>(
    '/api/beyanname-turleri',
    fetcher,
    {
      revalidateOnFocus,
      dedupingInterval: 300000, // 5 dakika aynı istek yapılmaz
      keepPreviousData: true,
    }
  );

  return {
    beyannameTurleri: data || [],
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
    mutate,
  };
}

export type { BeyannameTuru };
