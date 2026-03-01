"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";

// Feature Card Component
function FeatureCard({
    icon,
    title,
    tag,
    onClick,
}: {
    icon: React.ReactNode;
    title: string;
    tag: string;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="group text-left p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/50
                       hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200
                       focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        >
            <div className="mb-3">{icon}</div>
            <p className="text-sm font-medium text-gray-900 leading-relaxed">
                {title}
            </p>
            <span className="inline-block mt-3 text-[11px] text-gray-500">
                {tag}
            </span>
        </button>
    );
}

// Robot Mascot Component
function RobotMascot() {
    return (
        <div className="relative animate-float">
            {/* Speech Bubble */}
            <div className="absolute -top-2 -right-2 bg-white rounded-xl px-3 py-2 shadow-lg text-xs whitespace-nowrap z-10">
                <span>Selam! </span>
                <span className="inline-block animate-wave">👋</span>
                <span> Yardıma hazırım!</span>
                {/* Bubble tail */}
                <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white transform rotate-45"></div>
            </div>

            {/* Robot Body */}
            <div className="w-32 h-32 relative">
                {/* Main Body */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl shadow-lg flex items-center justify-center">
                    <Icon icon="solar:robot-bold" className="w-16 h-16 text-gray-700" />
                </div>
                {/* Antenna */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-4 bg-gray-400 rounded-full">
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
            </div>
        </div>
    );
}

export function AIClient({ userName = "Mali Müşavir" }: { userName?: string }) {
    const [message, setMessage] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        // TODO: Backend entegrasyonu
        console.log("Message:", message);
        setMessage("");
    };

    const handleCardClick = (prompt: string) => {
        setMessage(prompt);
    };

    return (
        <div className="absolute inset-0 -m-4 xl:-m-6 flex flex-col overflow-hidden">
            {/* Background Gradient Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-purple-300/40 rounded-full blur-[120px]"></div>
                <div className="absolute top-20 right-20 w-[400px] h-[400px] bg-blue-300/40 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-10 left-1/3 w-[450px] h-[450px] bg-pink-300/30 rounded-full blur-[120px]"></div>
            </div>

            {/* Main Content - Full Screen */}
            <main className="relative flex-1 flex flex-col justify-center overflow-auto">
                <div className="w-full max-w-4xl mx-auto px-8 py-12">
                    {/* Header */}
                    <header className="flex items-center justify-between mb-12">
                        {/* Model Selector */}
                        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                            <Icon icon="solar:snowflake-bold" className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium text-gray-700">Asistan v1.0</span>
                            <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4 text-gray-400" />
                        </button>

                        {/* Daily Title */}
                        <span className="text-sm text-gray-400">SMMM AI Asistan</span>

                        {/* Spacer for alignment */}
                        <div className="w-32"></div>
                    </header>

                    {/* Hero Section */}
                    <section className="relative mb-10">
                        <div className="pr-48">
                            <h1 className="text-4xl font-semibold leading-tight">
                                <span className="text-gray-900">Merhaba </span>
                                <span className="text-primary">{userName}</span>
                                <span className="text-gray-900">,</span>
                                <br />
                                <span className="text-gray-900">Bugün Ne Yapmak İstersin?</span>
                            </h1>
                        </div>

                        {/* Robot Mascot */}
                        <div className="absolute right-0 top-0">
                            <RobotMascot />
                        </div>
                    </section>

                    {/* Feature Cards - Muhasebe Odaklı */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
                        <FeatureCard
                            icon={<Icon icon="solar:calculator-bold" className="w-6 h-6 text-orange-500" />}
                            title="KDV, Gelir Vergisi, Kurumlar Vergisi hesaplamaları ve beyanname sorguları."
                            tag="Vergi Hesaplama"
                            onClick={() => handleCardClick("KDV hesaplaması nasıl yapılır?")}
                        />
                        <FeatureCard
                            icon={<Icon icon="solar:notebook-bookmark-bold" className="w-6 h-6 text-blue-500" />}
                            title="Muhasebe kayıtları, hesap planı ve yevmiye fişi oluşturma rehberi."
                            tag="Muhasebe Kayıtları"
                            onClick={() => handleCardClick("Satış faturası için muhasebe kaydı nasıl yapılır?")}
                        />
                        <FeatureCard
                            icon={<Icon icon="solar:shield-check-bold" className="w-6 h-6 text-green-500" />}
                            title="SGK bildirgeleri, işe giriş-çıkış, MUHSGK ve e-bildirge işlemleri."
                            tag="SGK İşlemleri"
                            onClick={() => handleCardClick("MUHSGK beyannamesi nasıl verilir?")}
                        />
                    </section>

                    {/* Input Area */}
                    <section>
                        {/* Status Bar */}
                        <div className="flex items-center justify-center px-1 mb-3">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <Icon icon="solar:cpu-bolt-bold" className="w-3.5 h-3.5" />
                                <span>AI Asistan v1.0 ile güçlendirildi</span>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <form onSubmit={handleSubmit}>
                            <div className="flex items-center gap-3 p-4 bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-sm">
                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder='Örnek: "KDV oranlarını açıkla" veya "Muhasebe kaydı nasıl yapılır"'
                                    className="flex-1 bg-transparent text-gray-700 placeholder:text-gray-400 text-sm focus:outline-none"
                                />
                                <button
                                    type="button"
                                    className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Icon icon="solar:microphone-bold" className="w-5 h-5" />
                                </button>
                                <button
                                    type="submit"
                                    className="w-9 h-9 flex items-center justify-center bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
                                >
                                    <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </main>
        </div>
    );
}

