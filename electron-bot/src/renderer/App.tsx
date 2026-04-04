import { useState, useEffect } from 'react';
import { Bot, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Electron API bridge
declare global {
    interface Window {
        electron: {
            login: (email: string, password: string) => Promise<{ success: boolean; user?: any; token?: string; error?: string }>;
            getStoredSession: () => Promise<{ user: any; token: string } | null>;
            logout: () => Promise<void>;
            getChromiumStatus: () => Promise<{ installed: boolean }>;
            retryChromiumDownload: () => Promise<{ success: boolean; error?: string }>;
            onChromiumProgress: (callback: (data: any) => void) => void;
            onBotCommand: (callback: (data: any) => void) => void;
            sendProgress: (progress: number, message: string) => void;
            dashboard: {
                getCustomers: () => Promise<{ success: boolean; customers?: any[]; error?: string }>;
                launch: (params: { linkId: string; customerId?: string; credentialType: string; application?: string; targetPage?: string }) => Promise<{ success: boolean; error?: string }>;
                onLaunchProgress: (callback: (data: any) => void) => void;
                onLaunchError: (callback: (data: any) => void) => void;
                onLaunchComplete: (callback: (data: any) => void) => void;
            };
            minimize: () => void;
            close: () => void;
        };
    }
}

interface ChromiumProgress {
    percent: number;
    downloadedMB: number;
    totalMB: number;
    status: string;
}

type AppState = 'loading' | 'downloading' | 'completed' | 'error' | 'login' | 'status';

function App() {
    const [state, setState] = useState<AppState>('loading');
    const [user, setUser] = useState<any>(null);
    const [dlProgress, setDlProgress] = useState<ChromiumProgress>({
        percent: 0, downloadedMB: 0, totalMB: 0, status: 'Hazırlanıyor...',
    });

    useEffect(() => {
        // Chromium indirme progress'ini dinle
        window.electron?.onChromiumProgress((data: ChromiumProgress) => {
            if (data.status === 'done') {
                setState('completed');
                // 1.5 saniye sonra login'e geç
                setTimeout(() => checkSession(), 1500);
                return;
            }
            if (data.percent === -1) {
                setState('error');
                setDlProgress(data);
                return;
            }
            setState('downloading');
            setDlProgress(data);
        });

        // Token expired event'ini dinle
        window.electron?.onBotCommand((data) => {
            if (data?.type === 'session-expired') {
                setUser(null);
                setState('login');
            }
        });

        // Chromium durumunu kontrol et
        checkChromiumThenSession();
    }, []);

    const checkChromiumThenSession = async () => {
        try {
            const chromium = await window.electron?.getChromiumStatus();
            if (chromium?.installed) {
                checkSession();
            }
            // Chromium yoksa onChromiumProgress event'leri gelecek
        } catch {
            checkSession();
        }
    };

    const checkSession = async () => {
        try {
            const session = await window.electron?.getStoredSession();
            if (session?.user) {
                setUser(session.user);
                setState('status');
            } else {
                setState('login');
            }
        } catch {
            setState('login');
        }
    };

    const handleRetryDownload = () => {
        setState('downloading');
        setDlProgress({ percent: 0, downloadedMB: 0, totalMB: 0, status: 'Tekrar deneniyor...' });
        window.electron?.retryChromiumDownload();
    };

    const handleLogin = async (email: string, password: string) => {
        const result = await window.electron?.login(email, password);
        if (result?.success && result.user) {
            setUser(result.user);
            setState('status');
            return { success: true };
        }
        return { success: false, error: result?.error || 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.' };
    };

    const handleLogout = async () => {
        await window.electron?.logout();
        setUser(null);
        setState('login');
    };

    // ── Loading ──────────────────────────────────────────────────
    if (state === 'loading') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8ecf1' }}>
                <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%' }} />
            </div>
        );
    }

    // ── Chromium İndirme / Tamamlandı / Hata ─────────────────────
    if (state === 'downloading' || state === 'completed' || state === 'error') {
        const isCompleted = state === 'completed';
        const isError = state === 'error';

        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                background: '#e8ecf1',
            }}>
                {/* Ana İçerik Alanı */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px',
                }}>
                    {/* İç Kart */}
                    <div style={{
                        width: '580px',
                        background: '#ffffff',
                        borderRadius: '16px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                        border: '1px solid #e2e8f0',
                        padding: '48px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center' as const,
                    }}>
                        {/* Logo / İkon */}
                        <div style={{ position: 'relative', marginBottom: '28px' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isCompleted ? '#ecfdf5' : isError ? '#fef2f2' : '#eff6ff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                transition: 'background-color 0.5s',
                            }}>
                                {isCompleted ? (
                                    <CheckCircle2 style={{ width: 40, height: 40, color: '#10b981' }} />
                                ) : isError ? (
                                    <AlertCircle style={{ width: 40, height: 40, color: '#ef4444' }} />
                                ) : (
                                    <Bot style={{ width: 40, height: 40, color: '#2563eb' }} />
                                )}
                            </div>

                            {/* Devam ediyor animasyonu göstergesi */}
                            {state === 'downloading' && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-4px',
                                    right: '-4px',
                                    width: '24px',
                                    height: '24px',
                                    background: '#fff',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                }}>
                                    <RefreshCw className="animate-spin" style={{ width: 14, height: 14, color: '#2563eb' }} />
                                </div>
                            )}
                        </div>

                        {/* Başlık */}
                        <h1 style={{
                            fontSize: '24px',
                            fontWeight: 700,
                            color: '#1e293b',
                            letterSpacing: '-0.025em',
                            marginBottom: '12px',
                        }}>
                            {isCompleted ? 'Kurulum Tamamlandı' : 'SMMM Bot İlk Kurulum'}
                        </h1>

                        {/* Açıklama */}
                        <p style={{
                            color: '#64748b',
                            fontSize: '14px',
                            lineHeight: '1.625',
                            marginBottom: '40px',
                            padding: '0 8px',
                        }}>
                            GİB/SGK otomasyon süreçleri için gerekli arka plan bileşenleri hazırlanıyor. Bu işlem yalnızca bir kez yapılır ve internet hızınıza bağlı olarak birkaç dakika sürebilir.
                        </p>

                        {/* Durum Alanı */}
                        <div style={{ width: '100%' }}>
                            {isError ? (
                                <div style={{
                                    width: '100%',
                                    backgroundColor: 'rgba(254,242,242,0.8)',
                                    border: '1px solid #fecaca',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                }}>
                                    <p style={{ color: '#b91c1c', fontSize: '14px', fontWeight: 500, marginBottom: '16px' }}>
                                        İndirme başarısız oldu. Lütfen internet bağlantınızı ve güvenlik duvarı ayarlarınızı kontrol edin.
                                    </p>
                                    <button
                                        onClick={handleRetryDownload}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '10px 24px',
                                            backgroundColor: '#dc2626',
                                            color: '#fff',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            border: 'none',
                                            cursor: 'pointer',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                        }}
                                    >
                                        <RefreshCw style={{ width: 16, height: 16 }} />
                                        Tekrar Dene
                                    </button>
                                </div>
                            ) : (
                                <div style={{ width: '100%' }}>
                                    {/* Durum Metinleri */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                                        <span style={{
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            color: isCompleted ? '#059669' : '#374151',
                                        }}>
                                            {isCompleted
                                                ? 'Tüm bileşenler başarıyla kuruldu! Yönlendiriliyorsunuz...'
                                                : 'Tarayıcı bileşenleri indiriliyor...'
                                            }
                                        </span>
                                        <span style={{
                                            fontSize: '18px',
                                            fontWeight: 700,
                                            color: isCompleted ? '#059669' : '#2563eb',
                                        }}>
                                            %{isCompleted ? 100 : dlProgress.percent}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{
                                        height: '10px',
                                        width: '100%',
                                        backgroundColor: '#f3f4f6',
                                        borderRadius: '9999px',
                                        overflow: 'hidden',
                                        marginBottom: '8px',
                                        position: 'relative',
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            borderRadius: '9999px',
                                            backgroundColor: isCompleted ? '#10b981' : '#2563eb',
                                            width: `${isCompleted ? 100 : Math.max(dlProgress.percent, 2)}%`,
                                            transition: 'width 0.7s ease-out',
                                            position: 'relative',
                                        }}>
                                            {state === 'downloading' && (
                                                <div className="animate-pulse" style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                                }} />
                                            )}
                                        </div>
                                    </div>

                                    {/* Detay Metni */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>
                                        <span>{isCompleted ? 'Kurulum bitiriliyor' : 'Chromium (Otomasyon Motoru)'}</span>
                                        <span>
                                            {isCompleted
                                                ? `${dlProgress.totalMB || dlProgress.downloadedMB} MB / ${dlProgress.totalMB || dlProgress.downloadedMB} MB`
                                                : `${dlProgress.downloadedMB} MB / ${dlProgress.totalMB} MB`
                                            }
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Alt Bilgi / Versiyon */}
                    <div style={{ marginTop: '32px', fontSize: '12px', fontWeight: 500, color: '#9ca3af' }}>
                        SMMM Bot v1.0.0 • Güvenli Bağlantı
                    </div>
                </div>
            </div>
        );
    }

    // ── Login / Status ───────────────────────────────────────────
    if (state === 'login') {
        return <Login onLogin={handleLogin} />;
    }

    return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;
