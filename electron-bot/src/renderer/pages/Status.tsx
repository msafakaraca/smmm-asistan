import { useState, useEffect } from 'react';

interface StatusProps {
    user: any;
    onLogout: () => void;
}

export default function Status({ user, onLogout }: StatusProps) {
    const [botStatus, setBotStatus] = useState<string>('Aktif ve Çalışıyor');
    const [botMessage, setBotMessage] = useState<string>('Veriler işleniyor, lütfen bekleyiniz...');

    useEffect(() => {
        // Listen for bot commands from website via WebSocket
        window.electron?.onBotCommand((data) => {
            if (data.type === 'start') {
                setBotStatus('Çalışıyor');
                setBotMessage('Bot başlatıldı...');
                // Minimize to tray
                window.electron?.minimize();
            } else if (data.type === 'progress') {
                setBotStatus('İşleniyor');
                setBotMessage(data.message || 'İşlem devam ediyor...');
            } else if (data.type === 'complete') {
                setBotStatus('Tamamlandı');
                setBotMessage('İşlem başarıyla tamamlandı!');
            } else if (data.type === 'error') {
                setBotStatus('Hata');
                setBotMessage(data.message || 'Bir hata oluştu.');
            }
        });

        // Body background color change for dark theme of this page
        document.body.style.backgroundColor = '#0f172a';
        return () => {
            document.body.style.backgroundColor = '#ffffff'; // Reset to white on unmount
        };
    }, []);

    return (
        <div className="bot-working-screen">

            <div className="bot-loader-container">
                <div className="ring ring-outer"></div>
                <div className="ring ring-middle"></div>
                <div className="ring ring-inner"></div>

                <div className="orbit-container orbit-1">
                    <div className="data-dot"></div>
                </div>
                <div className="orbit-container orbit-2">
                    <div className="data-dot"></div>
                </div>

                <div className="bot-core">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="bot-icon">
                        <path d="M12 2a2 2 0 0 1 2 2v2h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2zm0 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-5-2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
                    </svg>
                </div>
            </div>

            <div className="status-text">
                <h2>Bot {botStatus}</h2>
                <p>{botMessage}</p>
            </div>

            {/* Optional Logout Button for Development/Testing */}
            <div className="absolute bottom-4 right-4">
                <button
                    onClick={onLogout}
                    className="text-white/50 hover:text-white text-xs px-3 py-1 bg-white/10 rounded transition-colors"
                >
                    Çıkış ({user?.name || user?.email})
                </button>
            </div>

        </div>
    );
}
