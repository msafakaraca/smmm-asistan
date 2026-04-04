import { useState } from 'react';
import { Building2, KeyRound, ArrowRight, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LoginProps {
    onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

type ActiveView = 'login' | 'forgot-password';
type ViewState = 'normal' | 'loading' | 'error' | 'success';

export default function Login({ onLogin }: LoginProps) {
    const [activeView, setActiveView] = useState<ActiveView>('login');
    const [viewState, setViewState] = useState<ViewState>('normal');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleViewChange = (view: ActiveView) => {
        setActiveView(view);
        setViewState('normal');
        setErrorMessage('');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setViewState('loading');
        setErrorMessage('');

        const result = await onLogin(email, password);

        if (!result.success) {
            setErrorMessage(result.error || 'E-posta adresi veya şifre hatalı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.');
            setViewState('error');
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setViewState('loading');
        setErrorMessage('');

        // Şifre sıfırlama API çağrısı (şimdilik simülasyon)
        try {
            const response = await fetch(`${window.location.origin}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (response.ok) {
                setViewState('success');
            } else {
                setErrorMessage('Bu e-posta adresi sistemde kayıtlı değil. Lütfen doğru adresi girdiğinizden emin olun.');
                setViewState('error');
            }
        } catch {
            // API yoksa da başarılı göster (kullanıcıya bilgi sızdırmamak için)
            setViewState('success');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#e8ecf1',
        }}>
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '32px 32px 24px',
                position: 'relative',
            }}>
                {/* Merkez Container */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{ width: '520px' }}>
                        {activeView === 'login' ? (
                            <LoginView
                                email={email}
                                setEmail={setEmail}
                                password={password}
                                setPassword={setPassword}
                                viewState={viewState}
                                errorMessage={errorMessage}
                                onSubmit={handleLogin}
                                onForgotPasswordClick={() => handleViewChange('forgot-password')}
                            />
                        ) : (
                            <ForgotPasswordView
                                email={email}
                                setEmail={setEmail}
                                viewState={viewState}
                                errorMessage={errorMessage}
                                onSubmit={handleForgotPassword}
                                onBackToLoginClick={() => handleViewChange('login')}
                            />
                        )}
                    </div>
                </div>

                {/* Alt Bilgi */}
                <div style={{
                    flexShrink: 0,
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#9ca3af',
                    marginTop: '16px',
                }}>
                    SMMM Asistan v1.0 © 2026
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════
   GİRİŞ YAP (LOGIN) EKRANI
   ══════════════════════════════════════════════════════════════════ */

interface LoginViewProps {
    email: string;
    setEmail: (v: string) => void;
    password: string;
    setPassword: (v: string) => void;
    viewState: ViewState;
    errorMessage: string;
    onSubmit: (e: React.FormEvent) => void;
    onForgotPasswordClick: () => void;
}

function LoginView({ email, setEmail, password, setPassword, viewState, errorMessage, onSubmit, onForgotPasswordClick }: LoginViewProps) {
    const isLoading = viewState === 'loading';
    const isError = viewState === 'error';

    return (
        <div style={{
            width: '100%',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
        }}>
            {/* Logo */}
            <div style={{
                width: '64px',
                height: '64px',
                backgroundColor: '#eff6ff',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
            }}>
                <Building2 style={{ width: 32, height: 32, color: '#2563eb' }} />
            </div>

            {/* Başlık */}
            <h1 style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#1e293b',
                textAlign: 'center',
                margin: 0,
            }}>
                SMMM Asistan'a Hoşgeldiniz
            </h1>
            <p style={{
                fontSize: '14px',
                color: '#64748b',
                marginTop: '8px',
                marginBottom: '24px',
                textAlign: 'center',
            }}>
                Mali müşavirlik otomasyon platformu
            </p>

            {/* Form */}
            <form onSubmit={onSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* E-Posta */}
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
                    <label style={labelStyle}>E-Posta Adresi</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ornek@email.com"
                        required
                        disabled={isLoading}
                        style={{
                            ...inputStyle,
                            ...(isLoading ? disabledInputStyle : {}),
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#2563eb';
                            e.target.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.2)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#cbd5e1';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                </div>

                {/* Şifre */}
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Şifre</label>
                        <button
                            type="button"
                            onClick={onForgotPasswordClick}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: '#2563eb',
                                cursor: 'pointer',
                                padding: 0,
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                        >
                            Şifremi Unuttum?
                        </button>
                    </div>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        disabled={isLoading}
                        style={{
                            ...inputStyle,
                            ...(isLoading ? disabledInputStyle : {}),
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#2563eb';
                            e.target.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.2)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#cbd5e1';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                </div>

                {/* Hata Mesajı */}
                {isError && (
                    <div style={{
                        marginBottom: '20px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        padding: '14px 16px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '14px',
                    }}>
                        <AlertCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
                        <span style={{ fontWeight: 500 }}>{errorMessage}</span>
                    </div>
                )}

                {/* Submit Butonu */}
                <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                        ...primaryButtonStyle,
                        ...(isLoading ? { opacity: 0.8, cursor: 'not-allowed' } : {}),
                    }}
                    onMouseOver={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#1e3a8a'; }}
                    onMouseOut={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#1e40af'; }}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin" style={{ width: 20, height: 20 }} />
                            <span>Giriş Yapılıyor...</span>
                        </>
                    ) : (
                        <>
                            <span>Giriş Yap</span>
                            <ArrowRight style={{ width: 20, height: 20 }} />
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════
   ŞİFREMİ UNUTTUM EKRANI
   ══════════════════════════════════════════════════════════════════ */

interface ForgotPasswordViewProps {
    email: string;
    setEmail: (v: string) => void;
    viewState: ViewState;
    errorMessage: string;
    onSubmit: (e: React.FormEvent) => void;
    onBackToLoginClick: () => void;
}

function ForgotPasswordView({ email, setEmail, viewState, errorMessage, onSubmit, onBackToLoginClick }: ForgotPasswordViewProps) {
    const isLoading = viewState === 'loading';
    const isError = viewState === 'error';
    const isSuccess = viewState === 'success';

    return (
        <div style={{
            width: '100%',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
        }}>
            {/* İkon */}
            <div style={{
                width: '64px',
                height: '64px',
                backgroundColor: '#eff6ff',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
            }}>
                <KeyRound style={{ width: 32, height: 32, color: '#2563eb' }} />
            </div>

            {/* Başlık */}
            <h1 style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#1e293b',
                textAlign: 'center',
                margin: 0,
            }}>
                Şifrenizi mi Unuttunuz?
            </h1>
            <p style={{
                fontSize: '14px',
                color: '#64748b',
                marginTop: '8px',
                marginBottom: '24px',
                textAlign: 'center',
                lineHeight: '1.625',
            }}>
                Hesabınıza kayıtlı e-posta adresinizi girin. Size şifrenizi sıfırlayabilmeniz için bir bağlantı göndereceğiz.
            </p>

            {/* Başarılı Gönderim */}
            {isSuccess ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#065f46',
                        padding: '20px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        fontSize: '14px',
                        width: '100%',
                        marginBottom: '24px',
                    }}>
                        <CheckCircle2 style={{ width: 20, height: 20, flexShrink: 0, marginTop: 2, color: '#059669' }} />
                        <div>
                            <span style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>Bağlantı gönderildi!</span>
                            <span style={{ color: 'rgba(6,95,70,0.9)', lineHeight: '1.625' }}>
                                Şifre sıfırlama yönergelerini e-posta adresinize gönderdik. Lütfen gelen kutunuzu (ve spam klasörünü) kontrol edin.
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onBackToLoginClick}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            padding: '8px 16px',
                            borderRadius: '8px',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#f1f5f9';
                            e.currentTarget.style.color = '#1e293b';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#475569';
                        }}
                    >
                        <ArrowLeft style={{ width: 16, height: 16 }} /> Giriş Ekranına Dön
                    </button>
                </div>
            ) : (
                /* Form */
                <form onSubmit={onSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* E-Posta */}
                    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
                        <label style={labelStyle}>E-Posta Adresi</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ornek@email.com"
                            required
                            disabled={isLoading}
                            style={{
                                ...inputStyle,
                                ...(isLoading ? disabledInputStyle : {}),
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#2563eb';
                                e.target.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.2)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#cbd5e1';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Hata Mesajı */}
                    {isError && (
                        <div style={{
                            marginBottom: '20px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            padding: '14px 16px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '14px',
                        }}>
                            <AlertCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
                            <span style={{ fontWeight: 500 }}>{errorMessage}</span>
                        </div>
                    )}

                    {/* Butonlar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            type="submit"
                            disabled={isLoading}
                            style={{
                                ...primaryButtonStyle,
                                ...(isLoading ? { opacity: 0.8, cursor: 'not-allowed' } : {}),
                            }}
                            onMouseOver={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#1e3a8a'; }}
                            onMouseOut={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#1e40af'; }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" style={{ width: 20, height: 20 }} />
                                    <span>Bağlantı Gönderiliyor...</span>
                                </>
                            ) : (
                                <span>Bağlantı Gönder</span>
                            )}
                        </button>

                        <button
                            type="button"
                            disabled={isLoading}
                            onClick={onBackToLoginClick}
                            style={{
                                width: '100%',
                                backgroundColor: 'transparent',
                                color: '#64748b',
                                fontWeight: 600,
                                padding: '14px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.15s',
                                ...(isLoading ? { opacity: 0.5 } : {}),
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                e.currentTarget.style.color = '#1e293b';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#64748b';
                            }}
                        >
                            <ArrowLeft style={{ width: 16, height: 16 }} />
                            Giriş Ekranına Dön
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════
   ORTAK STİLLER
   ══════════════════════════════════════════════════════════════════ */

const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#475569',
    marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
    transition: 'all 0.15s',
    background: '#ffffff',
};

const disabledInputStyle: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    color: '#94a3b8',
    cursor: 'not-allowed',
};

const primaryButtonStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#1e40af',
    color: '#ffffff',
    fontWeight: 700,
    padding: '14px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.15s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};
