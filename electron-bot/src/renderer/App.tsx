import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Status from './pages/Status';

// Electron API bridge
declare global {
    interface Window {
        electron: {
            login: (email: string, password: string) => Promise<{ success: boolean; user?: any; token?: string; error?: string }>;
            getStoredSession: () => Promise<{ user: any; token: string } | null>;
            logout: () => Promise<void>;
            onBotCommand: (callback: (data: any) => void) => void;
            sendProgress: (progress: number, message: string) => void;
            minimize: () => void;
            close: () => void;
        };
    }
}

type AppState = 'loading' | 'login' | 'status';

function App() {
    const [state, setState] = useState<AppState>('loading');
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // Check for stored session
        checkSession();
    }, []);

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

    const handleLogin = async (email: string, password: string) => {
        const result = await window.electron?.login(email, password);
        if (result?.success && result.user) {
            setUser(result.user);
            setState('status');
            return { success: true };
        }
        return { success: false, error: result?.error || 'Giriş başarısız' };
    };

    const handleLogout = async () => {
        await window.electron?.logout();
        setUser(null);
        setState('login');
    };

    if (state === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (state === 'login') {
        return <Login onLogin={handleLogin} />;
    }

    return <Status user={user} onLogout={handleLogout} />;
}

export default App;
