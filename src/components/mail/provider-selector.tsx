"use client";

import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, LogOut, Mail, RefreshCw } from "lucide-react";

export type MailProvider = 'outlook' | 'gmail' | null;

interface ProviderInfo {
    name: string;
    email: string | null;
    accessToken: string | null;
}

interface EmailConnection {
    id: string;
    provider: string;
    email: string;
    lastSyncAt: string | null;
    syncStatus: string;
}

export function ProviderSelector() {
    const [provider, setProvider] = useState<MailProvider>(null);
    const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [connections, setConnections] = useState<EmailConnection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch connections from database
    const fetchConnections = useCallback(async () => {
        try {
            const response = await fetch('/api/email/connections');
            if (response.ok) {
                const data = await response.json();
                setConnections(data);

                // İlk bağlantıyı seç
                if (data.length > 0) {
                    const conn = data[0];
                    setProvider(conn.provider as MailProvider);
                    setProviderInfo({
                        name: conn.provider === 'gmail' ? 'Gmail' : 'Outlook',
                        email: conn.email,
                        accessToken: conn.id // Connection ID'yi sakla
                    });
                    // localStorage'a da kaydet (mail gönderimi için)
                    localStorage.setItem('mail_provider', conn.provider);
                    localStorage.setItem('mail_provider_info', JSON.stringify({
                        name: conn.provider === 'gmail' ? 'Gmail' : 'Outlook',
                        email: conn.email,
                        accessToken: conn.id,
                        connectionId: conn.id
                    }));
                } else {
                    setProvider(null);
                    setProviderInfo(null);
                    localStorage.removeItem('mail_provider');
                    localStorage.removeItem('mail_provider_info');
                }
            }
        } catch (error) {
            console.error('[ProviderSelector] Fetch connections error:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load connections on mount
    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    // Server-side OAuth redirect (hesap seçim ekranı gösterir)
    const handleGoogleConnect = useCallback(() => {
        setIsConnecting(true);
        setShowDropdown(false);
        // Mail sayfasına geri dön
        window.location.href = `/api/email/auth/google?redirect=/dashboard/mail`;
    }, []);

    // Microsoft OAuth redirect
    const handleMicrosoftConnect = useCallback(() => {
        setIsConnecting(true);
        setShowDropdown(false);
        window.location.href = `/api/email/auth/microsoft?redirect=/dashboard/mail`;
    }, []);

    // Disconnect handler
    const handleDisconnect = useCallback(async () => {
        if (!providerInfo?.accessToken) return;

        try {
            const response = await fetch(`/api/email/connections/${providerInfo.accessToken}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setProvider(null);
                setProviderInfo(null);
                localStorage.removeItem('mail_provider');
                localStorage.removeItem('mail_provider_info');
                setConnections([]);
            }
        } catch (error) {
            console.error('[ProviderSelector] Disconnect error:', error);
        }
        setShowDropdown(false);
    }, [providerInfo]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.provider-selector-container')) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-full border bg-slate-100 border-slate-200 text-slate-600 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Yükleniyor...</span>
            </div>
        );
    }

    return (
        <div className="relative provider-selector-container">
            {/* Compact Header Button */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={isConnecting}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all",
                    provider
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                )}
            >
                {isConnecting ? (
                    <>
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        <span>Bağlanıyor...</span>
                    </>
                ) : provider ? (
                    <>
                        {provider === 'outlook' ? (
                            <svg className="h-4 w-4" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                            </svg>
                        ) : (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        )}
                        <span className="hidden sm:inline truncate max-w-[120px]">{providerInfo?.email || (provider === 'outlook' ? 'Outlook' : 'Gmail')}</span>
                        <Check className="w-3 h-3 text-emerald-600" />
                    </>
                ) : (
                    <>
                        <Mail className="w-4 h-4" />
                        <span>Hesap Bağla</span>
                    </>
                )}
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 min-w-[260px]">
                    {provider && providerInfo ? (
                        // Connected state
                        <div className="p-3">
                            <div className="flex items-center gap-2 mb-3">
                                {provider === 'outlook' ? (
                                    <svg className="h-5 w-5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                                        <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                                        <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                                        <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm text-slate-800">
                                        {provider === 'outlook' ? 'Outlook' : 'Gmail'}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
                                        {providerInfo.email || providerInfo.name}
                                    </div>
                                </div>
                            </div>

                            {/* Farklı hesap bağla */}
                            <button
                                onClick={provider === 'gmail' ? handleGoogleConnect : handleMicrosoftConnect}
                                className="w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 mb-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Farklı Hesap Bağla
                            </button>

                            <button
                                onClick={handleDisconnect}
                                className="w-full px-3 py-2 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Bağlantıyı Kes
                            </button>
                        </div>
                    ) : (
                        // Disconnected state - show connect buttons
                        <div className="p-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-2">
                                Mail Hesabı Bağla
                            </div>
                            <button
                                onClick={handleMicrosoftConnect}
                                disabled={isConnecting}
                                className="w-full px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-3 rounded-lg"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                                    <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                                    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                                </svg>
                                Outlook ile Bağlan
                            </button>

                            <button
                                onClick={handleGoogleConnect}
                                disabled={isConnecting}
                                className="w-full px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-3 rounded-lg"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                Gmail ile Bağlan
                            </button>

                            <div className="px-2 py-2 text-[10px] text-slate-400 text-center border-t border-slate-100 mt-1">
                                Mail göndermek için hesap bağlayın
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Export helper to get current connection info
export function getMailAccessToken(): { provider: MailProvider; accessToken: string | null; connectionId: string | null } {
    if (typeof window === 'undefined') {
        return { provider: null, accessToken: null, connectionId: null };
    }

    const provider = localStorage.getItem('mail_provider') as MailProvider;
    const info = localStorage.getItem('mail_provider_info');

    if (!provider || !info) {
        return { provider: null, accessToken: null, connectionId: null };
    }

    const parsed = JSON.parse(info) as ProviderInfo & { connectionId?: string };
    return {
        provider,
        accessToken: parsed.accessToken,
        connectionId: parsed.connectionId || parsed.accessToken
    };
}
