import { useState } from 'react';

interface LoginProps {
    onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export default function Login({ onLogin }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await onLogin(email, password);

        if (!result.success) {
            setError(result.error || 'Giriş başarısız');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col bg-white">
            {/* Title Bar Placeholder (if needed for drag) - Optional since we switched to frame: true but autoHideMenuBar */}
            {/* <div className="title-bar h-8 w-full" /> */}

            {/* Main Content - Centered */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 w-full max-w-lg mx-auto">

                {/* Header Section */}
                <div className="w-full text-center mb-8">
                    {/* Logo: Arka plan silindi, sadece ikon */}
                    <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
                        <svg className="w-16 h-16 text-blue-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">SMMM Asistan'a Hoşgeldiniz</h1>
                </div>

                {/* Form Section */}
                <div className="w-full">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 rounded bg-red-50 text-red-700 border border-red-100 flex items-center gap-2 text-sm font-medium">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">E-Posta Adresi</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ornek@email.com"
                                required
                                disabled={loading}
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:ring-1 focus:ring-blue-700 text-sm font-medium transition-colors"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Şifre</label>
                                <button type="button" className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline bg-transparent border-none p-0 cursor-pointer">Şifremi Unuttum?</button>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                disabled={loading}
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:ring-1 focus:ring-blue-700 text-sm font-medium transition-colors"
                                style={{ letterSpacing: '0.1em' }}
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 px-6 rounded-lg text-white font-bold text-sm shadow-md hover:shadow-lg bg-blue-800 hover:bg-blue-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Giriş Yapılıyor...
                                    </>
                                ) : (
                                    <>
                                        Giriş Yap
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center border-t border-slate-100 w-full pt-4">
                    <p className="text-slate-400 font-medium text-xs">
                        SMMM Asistan v1.0 &copy; 2026
                    </p>
                </div>
            </div>
        </div>
    );
}
