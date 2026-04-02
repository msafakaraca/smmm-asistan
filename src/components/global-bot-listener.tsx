"use client";

/**
 * GlobalBotListener Component
 *
 * Tüm sayfalarda WebSocket üzerinden bot mesajlarını dinler.
 * Bot tamamlandığında:
 * - BotResultContext'e sonucu kaydeder
 * - BotLogContext'e logları ekler
 * - Beyanname-takip sayfasına yönlendirir
 *
 * Layout'ta bir kez render edilir.
 */

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBotLog } from "@/context/bot-log-context";
import { useBotResult } from "@/context/bot-result-context";
import type { GibBotResult } from "@/types/gib";

export function GlobalBotListener() {
    const router = useRouter();
    const { addLog, setLiveMessage, clearLiveMessage, setBotRunning, setBotStatus, setElectronConnected, setWsRef } = useBotLog();
    const { setPendingResult } = useBotResult();
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Refs for callbacks to avoid stale closures
    const addLogRef = useRef(addLog);
    const setLiveMessageRef = useRef(setLiveMessage);
    const clearLiveMessageRef = useRef(clearLiveMessage);
    const setBotRunningRef = useRef(setBotRunning);
    const setBotStatusRef = useRef(setBotStatus);
    const setElectronConnectedRef = useRef(setElectronConnected);
    const setPendingResultRef = useRef(setPendingResult);
    const routerRef = useRef(router);

    useEffect(() => {
        addLogRef.current = addLog;
        setLiveMessageRef.current = setLiveMessage;
        clearLiveMessageRef.current = clearLiveMessage;
        setBotRunningRef.current = setBotRunning;
        setBotStatusRef.current = setBotStatus;
        setElectronConnectedRef.current = setElectronConnected;
        setPendingResultRef.current = setPendingResult;
        routerRef.current = router;
    }, [addLog, setLiveMessage, clearLiveMessage, setBotRunning, setBotStatus, setElectronConnected, setPendingResult, router]);

    // Parse bot tarih aralığından beyanname dönemini hesapla
    const calculateTargetPeriod = useCallback((endDate: string) => {
        try {
            const endDateObj = new Date(endDate);
            const uploadMonth = endDateObj.getMonth() + 1; // 1-indexed
            let targetMonth = uploadMonth - 1;
            let targetYear = endDateObj.getFullYear();

            if (targetMonth === 0) {
                targetMonth = 12;
                targetYear -= 1;
            }

            return { year: targetYear, month: targetMonth };
        } catch {
            // Fallback: bir önceki ay
            const now = new Date();
            let month = now.getMonth(); // 0-indexed, bu ay -1 = önceki ay
            let year = now.getFullYear();
            if (month === 0) {
                month = 12;
                year -= 1;
            }
            return { year, month };
        }
    }, []);

    useEffect(() => {
        // React StrictMode'da async WS oluşturma sızıntısını önlemek için bayrak
        let isCancelled = false;

        const connectWS = async () => {
            try {
                // Get Token
                const tokenRes = await fetch("/api/auth/token");
                if (isCancelled) return;

                if (!tokenRes.ok) {
                    console.log("[GLOBAL-BOT-WS] Token alınamadı, 5s sonra tekrar deneniyor...");
                    reconnectTimerRef.current = setTimeout(connectWS, 5000);
                    return;
                }
                const { token } = await tokenRes.json();
                if (isCancelled) return;

                // Connect
                const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
                const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3001';
                const wsHost = `${window.location.hostname}:${wsPort}`;
                const ws = new WebSocket(`${protocol}//${wsHost}?token=${token}`);
                wsRef.current = ws;
                setWsRef(ws);

                // Eğer bu arada cancel olduysa hemen kapat
                if (isCancelled) {
                    ws.close();
                    return;
                }

                ws.onopen = () => {
                    console.log("[GLOBAL-BOT-WS] Bağlantı kuruldu");
                };

                ws.onmessage = (event) => {
                    if (isCancelled) return;

                    try {
                        const message = JSON.parse(event.data);

                        if (message.type === "bot:progress") {
                            const data = message.data;
                            // Emojileri ve özel karakterleri temizle
                            const rawMessage = (data.message || '')
                                .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
                                .replace(/[✅❌⏭️📊📥📋⏱️🚀🔐📅🔄💡🚨]/g, '')
                                .trim();

                            if (!rawMessage) return;

                            // Sayfa satırları (Sayfa X/Y) yerinde güncellenir
                            // İndirme satırları ([1/96]) yeşil success olarak yerinde güncellenir
                            const isDownloadItem = /\[\d+\/\d+\]/.test(rawMessage);
                            const isPageFetch = /Sayfa \d+\/\d+/.test(rawMessage);

                            if (isPageFetch) {
                                // Sayfa çekme — yerinde güncellenen satır
                                setLiveMessageRef.current(rawMessage, 'progress', data.progress);
                            } else if (isDownloadItem) {
                                // PDF indirme — yeşil, yerinde güncellenen satır
                                setLiveMessageRef.current(rawMessage, 'success', data.progress);
                            } else {
                                // Kalıcı log satırı (sorgulanıyor, özet bilgiler vb.)
                                addLogRef.current('progress', rawMessage, undefined, data.progress);
                            }

                        } else if (message.type === "bot:batch-results" || message.type === "bot:batch-processed") {
                            // Batch mesajları canlı mesajı günceller
                            const data = message.data;
                            if (data?.stats) {
                                const s = data.stats;
                                const processed = s.matched ?? s.total ?? 0;
                                const files = s.filesProcessed ?? s.downloaded ?? 0;
                                let statusMsg = `İşlenen: **${processed}**`;
                                if (files > 0) statusMsg += `  ·  Dosya: **${files}**`;
                                setLiveMessageRef.current(statusMsg, 'batch');
                            }

                        } else if (message.type === "bot:complete") {
                            const data = message.data;
                            const wasStopped = data?.stopped === true;

                            setBotRunningRef.current(false);
                            setBotStatusRef.current(wasStopped ? 'idle' : 'completed');

                            if (!wasStopped) {
                                // Canlı mesajı tamamlanma mesajına güncelle
                                const s = data?.stats;
                                if (s) {
                                    const parts = [`**${s.total || 0}** beyanname`];
                                    if (s.downloaded > 0) parts.push(`**${s.downloaded}** PDF indirildi`);
                                    if (s.failed > 0) parts.push(`**${s.failed}** başarısız`);
                                    const durationMin = Math.floor((s.duration || 0) / 60);
                                    const durationSec = (s.duration || 0) % 60;
                                    const durationStr = durationMin > 0 ? `${durationMin}dk ${durationSec}sn` : `${durationSec}sn`;
                                    parts.push(`süre: **${durationStr}**`);
                                    setLiveMessageRef.current(`Tamamlandı — ${parts.join('  ·  ')}`, 'success', 100);
                                } else {
                                    setLiveMessageRef.current('Tamamlandı', 'success', 100);
                                }

                                // Sonucu kaydet (cross-page persistence için)
                                const reportData: GibBotResult = {
                                    ...data,
                                    success: true,
                                };
                                setPendingResultRef.current(reportData);

                                // Beyanname-kontrol veya mükellefler sayfasındaysa yönlendirme yapma
                                const currentPath = window.location.pathname;
                                const isOnBeyannameKontrol = currentPath.includes('/beyanname-kontrol');
                                const isOnMukellefler = currentPath.includes('/mukellefler');

                                if (!isOnBeyannameKontrol && !isOnMukellefler) {
                                    const endDate = data.endDate || data.startDate;
                                    if (endDate) {
                                        const { year, month } = calculateTargetPeriod(endDate);
                                        setTimeout(() => {
                                            routerRef.current.push(`/dashboard/kontrol-cizelgesi/beyanname-takip?year=${year}&month=${month}`);
                                        }, 1000);
                                    } else {
                                        const { year, month } = calculateTargetPeriod(new Date().toISOString());
                                        setTimeout(() => {
                                            routerRef.current.push(`/dashboard/kontrol-cizelgesi/beyanname-takip?year=${year}&month=${month}`);
                                        }, 1000);
                                    }
                                }
                            } else {
                                // Durduruldu → canlı mesajı temizle
                                clearLiveMessageRef.current();
                            }

                        } else if (message.type === "bot:error") {
                            const errorData = message.data;
                            const errorMsg = errorData?.message || errorData?.error || "Bilinmeyen hata";
                            const isCritical = errorData?.isCritical || errorData?.errorDetails?.isCritical;

                            setBotRunningRef.current(false);
                            setBotStatusRef.current('error');

                            // Canlı mesajı hata mesajıyla güncelle
                            setLiveMessageRef.current(`Hata: ${errorMsg}`, 'error');
                            if (isCritical && errorData?.errorDetails?.userAction) {
                                addLogRef.current('warning', `Öneri: ${errorData.errorDetails.userAction}`);
                            }

                        } else if (message.type === "bot:start") {
                            // Bot başlatıldı — sadece state güncelle
                            // NOT: addLog yapmıyoruz çünkü use-bot-connection zaten ekledi
                            setBotRunningRef.current(true);
                            setBotStatusRef.current('running');

                        } else if (message.type === "sgk:ebildirge-progress") {
                            // SGK E-Bildirge ilerleme — global log'a ekle
                            const sgkData = message.data;
                            const sgkMsg = sgkData?.status || sgkData?.message || "";
                            if (sgkMsg) {
                                setLiveMessageRef.current(sgkMsg, "progress");
                            }

                        } else if (message.type === "sgk:ebildirge-error") {
                            // SGK E-Bildirge hata
                            const sgkError = message.data?.error || "SGK sorgulama hatası";
                            setLiveMessageRef.current(`SGK Hata: ${sgkError}`, "error");

                        } else if (message.type === "electron:status") {
                            const connected = message.data?.connected === true;
                            setElectronConnectedRef.current(connected);
                        }
                    } catch (e) {
                        console.error("[GLOBAL-BOT-WS] Parse error", e);
                    }
                };

                ws.onclose = () => {
                    if (isCancelled) return;
                    console.log("[GLOBAL-BOT-WS] Bağlantı kesildi, 5s sonra tekrar deneniyor...");
                    wsRef.current = null;
                    setWsRef(null);
                    setElectronConnectedRef.current(false);
                    reconnectTimerRef.current = setTimeout(connectWS, 5000);
                };

                ws.onerror = (error) => {
                    console.error("[GLOBAL-BOT-WS] Error:", error);
                };

            } catch (e) {
                if (isCancelled) return;
                console.error("[GLOBAL-BOT-WS] Setup failed:", e);
                reconnectTimerRef.current = setTimeout(connectWS, 5000);
            }
        };

        connectWS();

        return () => {
            isCancelled = true;
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
                setWsRef(null);
            }
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
        };
    }, [calculateTargetPeriod]);

    // Bu component UI render etmez
    return null;
}
