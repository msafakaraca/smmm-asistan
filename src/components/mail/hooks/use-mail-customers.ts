"use client";

import useSWR, { mutate } from "swr";

export interface MailCustomer {
    id: string;
    unvan: string;
    kisaltma: string | null;
    vknTckn: string;
    email: string | null;
    telefon1: string | null;
    status: string;
    sirketTipi: string;
    siraNo: string | null;
    mailSent: boolean;
    mailSentAt: string | null;
    whatsappSent: boolean;
    whatsappSentAt: string | null;
    sentBeyannameler: string[];
}

export interface MailCustomersResponse {
    customers: MailCustomer[];
    total: number;
    year: number;
    month: number;
    mode: string;
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Bilinmeyen hata' }));
        throw new Error(error.error || 'Veri yüklenirken hata oluştu');
    }
    return res.json();
};

export function useMailCustomers(
    year: number,
    month: number,
    mode: 'mukellef' | 'banka',
    search?: string
) {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const url = `/api/mail?year=${year}&month=${month}&mode=${mode}${searchParam}`;

    const { data, error, isLoading, mutate: revalidate, isValidating } = useSWR<MailCustomersResponse>(
        year && month ? url : null,
        fetcher,
        {
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            refreshInterval: 30000, // 30 saniyede bir otomatik yenileme
            dedupingInterval: 5000,
        }
    );

    return {
        customers: data?.customers || [],
        total: data?.total || 0,
        isLoading,
        error,
        refresh: revalidate,
        isRefreshing: isValidating && !isLoading, // Arka planda yenilenme durumu
    };
}

/**
 * Mail durumunu günceller
 */
export async function updateMailStatus(
    customerId: string,
    year: number,
    month: number,
    mode: string,
    action: 'mailSent' | 'whatsappSent',
    value: boolean,
    sentBeyannameler?: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await fetch('/api/mail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerId,
                year,
                month,
                mode,
                action,
                value,
                sentBeyannameler
            })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { success: false, error: data.error || 'Güncelleme başarısız' };
        }

        // Revalidate the cache
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/mail?'));

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' };
    }
}

/**
 * Toplu mail durumu güncelleme
 */
export async function bulkUpdateMailStatus(
    customerIds: string[],
    year: number,
    month: number,
    mode: string,
    action: 'mailSent' | 'whatsappSent',
    value: boolean,
    sentBeyannameler?: string[]
): Promise<{ success: boolean; results?: { success: number; failed: number }; error?: string }> {
    try {
        const res = await fetch('/api/mail', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerIds,
                year,
                month,
                mode,
                action,
                value,
                sentBeyannameler
            })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { success: false, error: data.error || 'Toplu güncelleme başarısız' };
        }

        const data = await res.json();

        // Revalidate the cache
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/mail?'));

        return { success: true, results: data.results };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' };
    }
}

/**
 * Mail durumlarını sıfırla
 */
export async function resetMailStatus(
    type: 'all' | 'single',
    year: number,
    month: number,
    mode: string,
    field: 'mail' | 'whatsapp' | 'both',
    customerId?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const res = await fetch('/api/mail/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                customerId,
                year,
                month,
                mode,
                field
            })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { success: false, error: data.error || 'Sıfırlama başarısız' };
        }

        const data = await res.json();

        // Revalidate the cache
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/mail?'));

        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' };
    }
}

/**
 * WhatsApp gönderimi
 */
export async function sendWhatsApp(
    customerId: string,
    year: number,
    month: number,
    mode: string,
    beyannameler: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const res = await fetch('/api/mail/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerId,
                year,
                month,
                mode,
                beyannameler
            })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { success: false, error: data.error || 'WhatsApp gönderimi başarısız' };
        }

        const data = await res.json();

        // Revalidate the cache
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/mail?'));

        return { success: true, messageId: data.messageId };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' };
    }
}

/**
 * Toplu WhatsApp gönderimi
 */
export async function bulkSendWhatsApp(
    customerIds: string[],
    year: number,
    month: number,
    mode: string,
    beyannameler: string[]
): Promise<{ success: boolean; results?: { success: number; failed: number; noPhone: number }; error?: string }> {
    try {
        const res = await fetch('/api/mail/whatsapp', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerIds,
                year,
                month,
                mode,
                beyannameler
            })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { success: false, error: data.error || 'Toplu WhatsApp gönderimi başarısız' };
        }

        const data = await res.json();

        // Revalidate the cache
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/mail?'));

        return { success: true, results: data.results };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' };
    }
}
