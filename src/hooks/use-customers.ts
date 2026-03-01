/**
 * SWR Hook: Müşteri Listesi
 *
 * Müşteri verilerini cache'li şekilde yükler.
 * - 30 saniye dedupe (aynı istek tekrarlanmaz)
 * - Sayfa geçişlerinde cache'den hızlı yükleme
 * - Mutate ile manuel yenileme
 */
import useSWR from 'swr';

interface Customer {
  id: string;
  unvan: string;
  kisaltma?: string | null;
  vknTckn: string;
  vergiKimlikNo?: string | null;
  tcKimlikNo?: string | null;
  vergiDairesi?: string | null;
  sirketTipi: string;
  faaliyetKodu?: string | null;
  sortOrder?: number;
  email?: string | null;
  telefon1?: string | null;
  telefon2?: string | null;
  adres?: string | null;
  yetkiliKisi?: string | null;
  status?: string;
  notes?: string | null;
  siraNo?: string | null;
  verilmeyecekBeyannameler?: string[];
  createdAt?: string;
  updatedAt?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Müşteriler yüklenemedi');
  }
  return res.json();
};

interface UseCustomersOptions {
  page?: number;
  limit?: number;
  revalidateOnFocus?: boolean;
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const {
    page,
    limit,
    revalidateOnFocus = false
  } = options;

  // Pagination parametreleri varsa URL'e ekle
  const url = page !== undefined && limit !== undefined
    ? `/api/customers?page=${page}&limit=${limit}`
    : '/api/customers';

  const { data, error, isLoading, isValidating, mutate } = useSWR<Customer[]>(
    url,
    fetcher,
    {
      revalidateOnFocus,
      dedupingInterval: 5000, // 5 saniye (önceden 30 saniye - bot güncellemeleri için çok uzun)
      keepPreviousData: true, // Yenilenirken eski veriyi göster
    }
  );

  return {
    customers: data || [],
    isLoading,
    isValidating,
    error,
    // Force revalidate on manual refresh (ignore cache)
    refresh: () => mutate(undefined, { revalidate: true }),
    mutate,
  };
}

export type { Customer };
