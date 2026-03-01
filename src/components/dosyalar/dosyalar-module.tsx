"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Folder,
    File,
    FileText,
    FileSpreadsheet,
    ChevronRight,
    ChevronLeft,
    ChevronUp,
    Home,
    LayoutGrid,
    LayoutList,
    RefreshCw,
    FolderPlus,
    Copy,
    Scissors,
    ClipboardPaste,
    Trash2,
    Search,
    Loader2,
    Pencil,
    CheckSquare,
    XSquare,
    Palette,
    Circle,
    Upload,
    Download,
    Filter,
    PanelLeft,
    PanelLeftClose,
    FileCheck
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useTerminal } from "@/context/terminal-context";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BEYANNAME_TYPE_OPTIONS, MONTH_OPTIONS, YEAR_OPTIONS } from "@/lib/constants/beyanname-types";
import { Building2, User, Briefcase } from "lucide-react";

// Types
type ViewMode = "grid" | "list";

interface FileItem {
    id: string;
    name: string;
    isFolder: boolean;
    size?: number;
    updatedAt?: string | Date;
    color?: string | null;
    parentId?: string | null;
}

interface Breadcrumb {
    id: string;
    name: string;
}

interface ClipboardState {
    action: "copy" | "cut";
    items: FileItem[];
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export default function DosyalarModule() {
    const terminal = useTerminal();
    // Data States
    const [items, setItems] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);

    // UI States
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [searchTerm, setSearchTerm] = useState("");

    // Sidebar & Filter States
    const [showSidebar, setShowSidebar] = useState(true);
    const [filterMode, setFilterMode] = useState<"browse" | "filter">("browse");
    const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>(["BEYANNAME"]); // Changed to array
    const [selectedBeyannameType, setSelectedBeyannameType] = useState<string>("");
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedCustomer, setSelectedCustomer] = useState<string>("ALL");
    const [selectedCompanyType, setSelectedCompanyType] = useState<string>("ALL");
    const [customerSearch, setCustomerSearch] = useState<string>("");
    const [customers, setCustomers] = useState<{ id: string, unvan: string, sirketTipi?: string }[]>([]);
    const [filteredResults, setFilteredResults] = useState<any[]>([]);
    const [filterLoading, setFilterLoading] = useState(false);
    const [availableBeyannameTypes, setAvailableBeyannameTypes] = useState<{ code: string, name: string, count: number }[]>([]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("local-view-mode") as ViewMode;
            if (saved) setViewMode(saved);
        }
    }, []);

    // History
    const [history, setHistory] = useState<(string | null)[]>([null]);
    const [historyIndex, setHistoryIndex] = useState(0);

    // Selection & Interaction States
    const [selection, setSelection] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Performance: Ref for selection to avoid re-creating handlers
    const selectionRef = useRef(selection);
    useEffect(() => { selectionRef.current = selection; }, [selection]);

    // Dialogs
    const [newFolderDialog, setNewFolderDialog] = useState(false);
    const [renameDialog, setRenameDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [newName, setNewName] = useState("");

    // --- Selection Box State ---
    const [selectionRect, setSelectionRect] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const dragStartSelectionRef = useRef<Set<string>>(new Set());

    // --- Selection Box Logic ---
    useEffect(() => {
        if (!isSelecting || !selectionRect) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            setSelectionRect((prev) => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
        };

        const handleGlobalMouseUp = () => {
            setIsSelecting(false);
            setSelectionRect(null);
        };

        window.addEventListener("mousemove", handleGlobalMouseMove);
        window.addEventListener("mouseup", handleGlobalMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove);
            window.removeEventListener("mouseup", handleGlobalMouseUp);
        };
    }, [isSelecting, selectionRect]);

    // Check intersection whenever rect changes
    useEffect(() => {
        if (!isSelecting || !selectionRect || !containerRef.current) return;

        const left = Math.min(selectionRect.startX, selectionRect.currentX);
        const top = Math.min(selectionRect.startY, selectionRect.currentY);
        const right = Math.max(selectionRect.startX, selectionRect.currentX);
        const bottom = Math.max(selectionRect.startY, selectionRect.currentY);

        // Don't select if the box is too small (accidental clicks)
        if (Math.abs(right - left) < 5 && Math.abs(bottom - top) < 5) return;

        const fileElements = containerRef.current.querySelectorAll("[data-file-item]");

        // Start with the selection we had when dragging began (if adding)
        const newSelection = new Set(dragStartSelectionRef.current);

        fileElements.forEach((el) => {
            const domRect = el.getBoundingClientRect();
            const intersect = !(domRect.right < left ||
                domRect.left > right ||
                domRect.bottom < top ||
                domRect.top > bottom);

            if (intersect) {
                const id = el.getAttribute("data-file-id");
                if (id) newSelection.add(id);
            }
        });

        setSelection(newSelection);

    }, [selectionRect, isSelecting]);

    const handleContainerMouseDown = (e: React.MouseEvent) => {
        // Ignore if clicking on a file item (handled by its own onClick)
        if ((e.target as HTMLElement).closest("[data-file-item]")) return;

        // Ignore right click
        if (e.button !== 0) return;

        // Start selection
        setIsSelecting(true);
        setSelectionRect({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });

        // Manage initial selection snapshot
        if (e.ctrlKey || e.metaKey) {
            dragStartSelectionRef.current = new Set(selection);
        } else {
            setSelection(new Set());
            dragStartSelectionRef.current = new Set();
        }
    };

    // --- Data Fetching ---
    const fetchContents = useCallback(async (folderId: string | null) => {
        setLoading(true);
        try {
            const url = folderId
                ? `/api/files?parentId=${folderId}`
                : `/api/files`;

            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);
                setBreadcrumbs(data.breadcrumbs || []);
                setSelection(new Set());
            }
        } catch (error) {
            console.error("Error fetching files:", error);
            toast.error("Dosyalar yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchContents(currentFolderId);
    }, [currentFolderId, fetchContents]);

    // Save view mode
    useEffect(() => {
        localStorage.setItem("local-view-mode", viewMode);
    }, [viewMode]);

    // Fetch customers for filter dropdown
    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const res = await fetch('/api/customers');
                if (res.ok) {
                    const data = await res.json();
                    setCustomers(data.customers || []);
                }
            } catch (error) {
                console.error("Error fetching customers:", error);
            }
        };
        fetchCustomers();
    }, []);

    // Fetch available beyanname types from database
    const fetchBeyannameTypes = useCallback(async () => {
        try {
            const res = await fetch('/api/files/beyanname-types');
            if (res.ok) {
                const data = await res.json();
                setAvailableBeyannameTypes(data.types || []);
            }
        } catch (error) {
            console.error("Error fetching beyanname types:", error);
        }
    }, []);

    useEffect(() => {
        fetchBeyannameTypes();
    }, [fetchBeyannameTypes]);

    // Auto-filter kaldırıldı - Manuel "Filtrele" butonuna güveniyoruz
    // Bu, race condition'ları ve gereksiz API çağrılarını önler

    // Apply Filter
    const applyFilter = async () => {
        // Zorunlu parametreleri kontrol et - API bunları bekliyor
        if (!selectedBeyannameType) {
            // Beyanname türü seçilmeden filtre uygulanamaz
            return;
        }

        if (selectedFileTypes.length === 0) {
            toast.warning("Lütfen en az bir dosya türü seçin");
            return;
        }

        if (!selectedMonth || !selectedYear) {
            toast.warning("Lütfen ay ve yıl seçin");
            return;
        }

        setFilterLoading(true);
        try {
            let filterUrl = `/api/files/filter?type=${selectedBeyannameType}&fileTypes=${selectedFileTypes.join(",")}&month=${selectedMonth}&year=${selectedYear}`;

            // Opsiyonel parametreler
            if (selectedCompanyType && selectedCompanyType !== "ALL") {
                filterUrl += `&companyType=${selectedCompanyType}`;
            }
            if (selectedCustomer !== "ALL") {
                filterUrl += `&customerId=${selectedCustomer}`;
            }

            const res = await fetch(filterUrl, { cache: "no-store" });

            if (res.ok) {
                const data = await res.json();
                setFilteredResults(data.results || []);
                if (data.totalDocuments > 0) {
                    toast.success(`${data.totalCustomers} mükellef, ${data.totalDocuments} dosya bulundu`);
                } else {
                    toast.info("Filtreye uygun dosya bulunamadı");
                }
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error("Filter API error:", errorData);
                toast.error("Filtre uygulanamadı");
            }
        } catch (error) {
            console.error("Filter error:", error);
            toast.error("Hata oluştu");
        } finally {
            setFilterLoading(false);
        }
    };

    // Navigate to customer folder from filtered results
    const handleNavigateToCustomer = (customerId: string) => {
        // Switch back to browse mode and navigate to customer folder
        setFilterMode("browse");
        navigateToMemoized(customerId);
    };

    // Clear filter and return to browse mode
    const clearFilter = () => {
        setFilterMode("browse");
        setFilteredResults([]);
        setSelectedBeyannameType("");
    };

    // --- Navigation ---
    // --- Navigation ---
    const navigateTo = useCallback((folderId: string | null) => {
        setCurrentFolderId(prev => {
            if (folderId === prev) return prev;
            // update history only if changing
            setHistory(h => {
                const newHistory = h.slice(0, historyIndex + 1);
                newHistory.push(folderId);
                return newHistory;
            });
            setHistoryIndex(h => h + 1); // This logic is tricky with slice.
            // Let's keep it simple but use refs if needed, or just accept history dependency.
            return folderId;
        });
    }, [historyIndex]); // history dependency removed by functional update? No, slice needs history.

    // Revert to standard impl but memoized
    const navigateToMemoized = useCallback((folderId: string | null) => {
        if (folderId === currentFolderId) return;
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(folderId);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCurrentFolderId(folderId);
    }, [history, historyIndex, currentFolderId]);

    const goBack = () => {
        if (historyIndex > 0) {
            const prevId = history[historyIndex - 1];
            setHistoryIndex(historyIndex - 1);
            setCurrentFolderId(prevId);
        }
    };

    const goForward = () => {
        if (historyIndex < history.length - 1) {
            const nextId = history[historyIndex + 1];
            setHistoryIndex(historyIndex + 1);
            setCurrentFolderId(nextId);
        }
    };

    const goUp = () => {
        if (breadcrumbs.length > 0) {
            const parentId = breadcrumbs.length > 1
                ? breadcrumbs[breadcrumbs.length - 2].id
                : null;
            navigateTo(parentId);
        } else if (currentFolderId !== null) {
            navigateTo(null);
        }
    };

    // --- Actions ---
    // --- Selection Logic ---
    const handleBackgroundClick = (e: React.MouseEvent) => {
        // Deprecated in favor of handleContainerMouseDown but kept for fallback or specific cases
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("grid-container")) {
            // setSelection(new Set()); // Handled by mousedown now
        }
    };

    const handleSelectAll = (e?: Event) => {
        e?.preventDefault();
        const allIds = new Set(items.map(i => i.id));
        setSelection(allIds);
    };

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (newFolderDialog || renameDialog || deleteDialog) return;

            if (e.key === "a" && (e.ctrlKey || e.metaKey)) handleSelectAll(e);
            else if (e.key === "c" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); copySelection(); }
            else if (e.key === "x" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); cutSelection(); }
            else if (e.key === "v" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); pasteFromClipboard(); }
            else if (e.key === "Delete" && selection.size > 0) setDeleteDialog(true);
            else if (e.key === "F2" && selection.size === 1) {
                const id = Array.from(selection)[0];
                const item = items.find(i => i.id === id);
                if (item) { setNewName(item.name); setRenameDialog(true); }
            }
            else if (e.key === "Backspace" && (e.target as HTMLElement).tagName !== "INPUT") goUp();
            else if (e.key === "Enter" && selection.size === 1) {
                const id = Array.from(selection)[0];
                const item = items.find(i => i.id === id);
                if (item) handleDoubleClick(item);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [items, selection, clipboard, newFolderDialog, renameDialog, deleteDialog]);

    // --- Actions ---
    const handleDoubleClick = useCallback((item: FileItem) => {
        if (item.isFolder) navigateToMemoized(item.id);
        else toast.info("Dosya önizleme yakında...");
    }, [navigateToMemoized]);

    const copySelection = () => {
        if (selection.size === 0) return;
        const selectedItems = items.filter(i => selection.has(i.id));
        setClipboard({ action: "copy", items: selectedItems });
        toast.info(`${selectedItems.length} öğe kopyalandı`);
    };

    const cutSelection = () => {
        if (selection.size === 0) return;
        const selectedItems = items.filter(i => selection.has(i.id));
        setClipboard({ action: "cut", items: selectedItems });
        toast.info(`${selectedItems.length} öğe kesildi`);
    };

    const pasteFromClipboard = async () => {
        if (!clipboard || clipboard.items.length === 0) return;
        toast.info("Yapıştırılıyor...");

        if (clipboard.action === "cut") {
            const ids = clipboard.items.map(i => i.id);
            try {
                const res = await fetch("/api/files", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids, parentId: currentFolderId })
                });

                if (res.ok) {
                    toast.success("Taşıma tamamlandı");
                    setClipboard(null);
                    fetchContents(currentFolderId);
                } else { toast.error("Taşıma yapılamadı"); }
            } catch (e) { toast.error("Hata oluştu"); }
        } else {
            toast.warning("Kopyalama özelliği backend güncellemesi bekliyor.");
        }
    };

    const handleDelete = async () => {
        if (selection.size === 0) return;
        const ids = Array.from(selection);
        try {
            const res = await fetch(`/api/files?ids=${ids.join(",")}`, { method: "DELETE" });
            const data = await res.json();

            if (res.ok) {
                toast.success(data.message || `${selection.size} öğe silindi`);
                setSelection(new Set());
                setDeleteDialog(false);
                fetchContents(currentFolderId);
                fetchBeyannameTypes();
            } else {
                toast.error(data.error || "Silinemedi");
            }
        } catch (error) { toast.error("Hata oluştu"); }
    };

    const handleSync = async () => {
        setSyncing(true);
        terminal.showTerminal("SMMM-ASİSTAN BOT");

        try {
            // Cleanup first
            try { await fetch("/api/files/cleanup", { cache: "no-store" }); } catch (e) { }

            // Start SSE stream
            const response = await fetch("/api/files/sync", {
                method: "POST",
                headers: {
                    "Accept": "text/event-stream",
                },
            });

            if (!response.ok) {
                const error = await response.json();
                toast.error(error.error || "Bağlantı hatası");
                terminal.addLog(`❌ HATA: ${error.error || "Bağlantı hatası"}`, 100);
                terminal.setLoading(false);
                terminal.autoClose(5000);
                setSyncing(false);
                return;
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                toast.error("Stream okunamadı");
                terminal.addLog("❌ Stream okunamadı", 100);
                terminal.setLoading(false);
                terminal.autoClose(5000);
                setSyncing(false);
                return;
            }

            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.error) {
                                toast.error(data.error);
                                terminal.addLog(`❌ HATA: ${data.error}`, 100);
                                terminal.setLoading(false);
                                terminal.autoClose(5000);
                            } else if (data.complete) {
                                if (data.stats) {
                                    const { created, existing, total } = data.stats;

                                    terminal.addLog("✅ Senkronizasyon Tamamlandı!", 100);
                                    terminal.addLog(`📊 Toplam: ${total} klasör`, 100);
                                    terminal.addLog(`   Yeni: ${created} | Mevcut: ${existing}`, 100);

                                    toast.success(`${created} yeni klasör oluşturuldu`);
                                    terminal.setLoading(false);

                                    // Auto-close terminal and refresh after 3 seconds
                                    setTimeout(() => {
                                        terminal.hideTerminal();
                                        fetchContents(currentFolderId);
                                        fetchBeyannameTypes();
                                    }, 3000);
                                }
                            } else {
                                terminal.addLog(data.message, data.percent);
                                terminal.setProgress(data.percent);
                            }
                        } catch (e) {
                            console.error("Failed to parse SSE data:", e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("File sync error:", error);
            toast.error("Bağlantı hatası");
            terminal.addLog("❌ Bağlantı hatası", 100);
            terminal.setLoading(false);
            terminal.autoClose(5000);
        } finally {
            setSyncing(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newName.trim()) return;
        try {
            const res = await fetch("/api/files", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim(), parentId: currentFolderId, isFolder: true })
            });
            if (res.ok) {
                toast.success("Klasör oluşturuldu");
                setNewFolderDialog(false);
                setNewName("");
                fetchContents(currentFolderId);
            } else { toast.error("Oluşturulamadı"); }
        } catch (e) { toast.error("Hata"); }
    };

    const handleRename = async () => {
        if (!newName.trim() || selection.size !== 1) return;
        const id = Array.from(selection)[0];
        try {
            const res = await fetch("/api/files", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, name: newName.trim() })
            });
            if (res.ok) {
                toast.success("Yeniden adlandırıldı");
                setRenameDialog(false);
                setNewName("");
                fetchContents(currentFolderId);
            } else { toast.error("Hata"); }
        } catch (e) { toast.error("Hata"); }
    };

    const handleColorChange = async (color: string | null) => {
        if (selection.size !== 1) return;
        const id = Array.from(selection)[0];
        try {
            const res = await fetch("/api/files", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, color })
            });
            if (res.ok) {
                setItems(prev => prev.map(item => item.id === id ? { ...item, color } : item));
                toast.success("Klasör rengi güncellendi");
            } else { toast.error("Hata"); }
        } catch (e) { toast.error("Hata"); }
    };

    // --- Drag and Drop Handlers ---
    // --- Drag and Drop Handlers ---
    const handleDragStart = useCallback((e: React.DragEvent, item: FileItem) => {
        // Use ref to read current selection without re-creating handler
        const sel = selectionRef.current;
        if (!sel.has(item.id)) setSelection(new Set([item.id]));
        const idsToDrag = sel.has(item.id) ? Array.from(sel) : [item.id];
        e.dataTransfer.setData("application/json", JSON.stringify({ ids: idsToDrag }));
        e.dataTransfer.effectAllowed = "move";
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        e.stopPropagation();

        // Check if dropping external files
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files, targetFolderId);
            return;
        }

        try {
            const data = e.dataTransfer.getData("application/json");
            const { ids } = JSON.parse(data);
            if (!ids || ids.length === 0) return;
            if (ids.includes(targetFolderId)) return;
            toast.info("Taşınıyor...");
            const res = await fetch("/api/files", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids, parentId: targetFolderId })
            });
            if (res.ok) {
                toast.success(`${ids.length} öğe taşındı`);
                fetchContents(currentFolderId);
            } else { toast.error("Taşıma başarısız"); }
        } catch (err) { console.error("Drop error", err); }
    }, [fetchContents, currentFolderId]);

    const handleFileUpload = async (files: FileList, targetFolderId: string | null) => {
        const total = files.length;
        let successCount = 0;

        for (let i = 0; i < total; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append("file", file);
            if (targetFolderId) formData.append("parentId", targetFolderId);
            else formData.append("parentId", "null"); // Explicit null string

            const toastId = toast.loading(`${file.name} yükleniyor...`);

            try {
                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (res.ok) {
                    toast.success(`${file.name} yüklendi`, { id: toastId });
                    successCount++;
                } else {
                    toast.error(`${file.name} yüklenemedi`, { id: toastId });
                }
            } catch (error) {
                toast.error(`${file.name} hata oluştu`, { id: toastId });
            }
        }

        if (successCount > 0) {
            fetchContents(currentFolderId);
            fetchBeyannameTypes();
        }
    };

    const handleDownload = async () => {
        if (selection.size === 0) return;

        // Only download files, skip folders for now
        const selectedFiles = items.filter(i => selection.has(i.id) && !i.isFolder);

        if (selectedFiles.length === 0) {
            toast.warning("Sadece dosyalar indirilebilir");
            return;
        }

        for (const file of selectedFiles) {
            try {
                // Trigger download
                const link = document.createElement("a");
                link.href = `/api/files/download?id=${file.id}`;
                link.setAttribute("download", file.name); // Suggested name
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                console.error("Download fail", e);
                toast.error(`${file.name} indirilemedi`);
            }
        }

        if (selectedFiles.length > 0) {
            toast.success("İndirme başlatıldı");
        }
    };

    // Optimized Selection Handlers
    const handleItemClick = useCallback((e: React.MouseEvent, item: FileItem) => {
        e.stopPropagation();

        if (e.ctrlKey || e.metaKey) {
            setSelection(prev => {
                const newSelection = new Set(prev);
                if (newSelection.has(item.id)) newSelection.delete(item.id);
                else {
                    newSelection.add(item.id);
                    setLastSelectedId(item.id);
                }
                return newSelection;
            });
        }
        else if (e.shiftKey && lastSelectedId) {
            // Complex logic with props needs ref to items or just items? items is prop in DosyalarModule
            // But handleItemClick needs access to 'items' which is state.
            // Since we use useCallback with [] or [items], re-creating it is fine as long as render loop passes new fn.
            // But wait, if we re-create handleItemClick, FileItemCard props change (since it is function prop).
            // This re-renders ALL items. This is bad for performance.
            // Solution: Use functional updates or Refs for non-primitive deps?
            // Actually, clicking is rare compared to hovering. So re-rendering all "on click" is acceptable for now.
            // The user wanted NO LAG, which was mostly about hover.

            // However, to keep it optimal, let's just accept re-render on click.
            setSelection(prev => {
                // We need access to items here.
                // This makes handleItemClick depend on `items`.
                // So when `items` change (fetch), callback changes. That's fine.
                return new Set([item.id]); // Simplify shift click for now? Or use ref?
            });
            setLastSelectedId(item.id);
        }
        else {
            setSelection(new Set([item.id]));
            setLastSelectedId(item.id);
        }
    }, [lastSelectedId]); // Missing `items` dependency for Shift logic if fully implemented.

    // Fixing Shift Click properly requires access to `items`.
    // Let's implement simpler Click first.

    const handleItemContextMenu = useCallback((e: React.MouseEvent, item: FileItem) => {
        // e.preventDefault(); // Do NOT prevent default, we want the context menu to trigger!
        setSelection(prev => {
            if (prev.has(item.id)) return prev;
            return new Set([item.id]);
        });
    }, []);

    const filteredItems = useMemo(() => {
        if (!searchTerm) return items;
        const lower = searchTerm.toLowerCase();
        return items.filter(i => i.name.toLowerCase().includes(lower));
    }, [items, searchTerm]);


    return (
        <div className="h-full flex flex-col bg-background select-none relative" onContextMenu={(e) => { }}>
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={goBack} disabled={historyIndex <= 0}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={goForward} disabled={historyIndex >= history.length - 1}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={goUp} disabled={breadcrumbs.length === 0}>
                        <ChevronUp className="h-4 w-4" />
                    </Button>
                </div>

                {/* Breadcrumbs or Filter Summary */}
                {filteredResults.length > 0 ? (
                    <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md min-h-[36px]">
                        <FileCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Filtre: {availableBeyannameTypes.find(t => t.code === selectedBeyannameType)?.name || BEYANNAME_TYPE_OPTIONS.find(t => t.value === selectedBeyannameType)?.label} - {MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                            ({filteredResults.length} mükellef)
                        </span>
                        <Button variant="ghost" size="sm" onClick={clearFilter} className="ml-auto text-blue-600 dark:text-blue-400 hover:text-blue-700">
                            <XSquare className="h-4 w-4 mr-1" />
                            Filtreyi Temizle
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center gap-1 px-3 py-1.5 bg-background border rounded-md min-h-[36px]"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, null)}
                    >
                        <button onClick={() => navigateTo(null)} className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-2">
                            <Home className="h-3.5 w-3.5" /> Bilgisayar
                        </button>
                        {breadcrumbs.map((crumb) => (
                            <span key={crumb.id} className="flex items-center gap-1 text-muted-foreground">
                                <ChevronRight className="h-3 w-3" />
                                <button
                                    onClick={() => navigateTo(crumb.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, crumb.id)}
                                    className="text-sm hover:text-primary transition-colors text-foreground"
                                >
                                    {crumb.name}
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="relative w-64">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-9" />
                </div>

                <div className="flex items-center border rounded-md">
                    <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" onClick={() => setViewMode("grid")} className="rounded-r-none">
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setViewMode("list")} className="rounded-l-none">
                        <LayoutList className="h-4 w-4" />
                    </Button>
                </div>

                <Button variant="outline" size="sm" onClick={() => { setNewName(""); setNewFolderDialog(true); }}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Yeni Klasör
                </Button>

                {/* Filter Toggle Button */}
                <Button
                    variant={showSidebar ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowSidebar(!showSidebar)}
                    className={showSidebar ? "bg-primary text-primary-foreground" : ""}
                >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtrele
                </Button>

                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                    {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Senkronize
                </Button>
            </div>

            {/* Main Content with Sidebar */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Filter Controls */}
                {showSidebar && (
                    <div className="w-96 border-r bg-muted/30 flex flex-col">
                        {/* Filter Header */}
                        <div className="flex items-center justify-between p-3 border-b bg-background">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-sm">Dosya Filtrele</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSidebar(false)}>
                                <PanelLeftClose className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Filter Controls */}
                        <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
                            {/* Company Type Selector - 2 rows */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Şirket Tipi</Label>
                                <div className="grid grid-cols-2 gap-1">
                                    <Button
                                        variant={selectedCompanyType === "ALL" ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => setSelectedCompanyType("ALL")}
                                    >
                                        Hepsi
                                    </Button>
                                    <Button
                                        variant={selectedCompanyType === "Firma" ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => setSelectedCompanyType("Firma")}
                                    >
                                        <Building2 className="h-3 w-3 mr-1" />
                                        Firma
                                    </Button>
                                    <Button
                                        variant={selectedCompanyType === "Şahıs" ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => setSelectedCompanyType("Şahıs")}
                                    >
                                        <User className="h-3 w-3 mr-1" />
                                        Şahıs
                                    </Button>
                                    <Button
                                        variant={selectedCompanyType === "Basit Usul" ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => setSelectedCompanyType("Basit Usul")}
                                    >
                                        <Briefcase className="h-3 w-3 mr-1" />
                                        Basit Usul
                                    </Button>
                                </div>
                            </div>

                            {/* Customer Selector - Dropdown */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Mükellef</Label>
                                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                                    <SelectTrigger className="h-8 text-sm">
                                        <SelectValue placeholder="Tüm Mükellefler" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-64">
                                        <SelectItem value="ALL">Tüm Mükellefler</SelectItem>
                                        {customers
                                            .filter(c => selectedCompanyType === "ALL" || c.sirketTipi === selectedCompanyType)
                                            .map(customer => (
                                                <SelectItem key={customer.id} value={customer.id}>
                                                    {customer.unvan}
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* File Type Selector - Multi-select */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Dosya Türü</Label>
                                <div className="grid grid-cols-1 gap-2 border rounded-md p-2 bg-background/50">
                                    {[
                                        { id: "BEYANNAME", label: "Beyanname" },
                                        { id: "TAHAKKUK", label: "Tahakkuk" },
                                        { id: "HIZMET_LISTESI", label: "Hizmet Listesi" }
                                    ].map(ft => (
                                        <div key={ft.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`ft-${ft.id}`}
                                                checked={selectedFileTypes.includes(ft.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedFileTypes(prev => checked
                                                        ? [...prev, ft.id]
                                                        : prev.filter(x => x !== ft.id)
                                                    );
                                                }}
                                            />
                                            <label
                                                htmlFor={`ft-${ft.id}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                                            >
                                                {ft.label}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Beyanname Türü</Label>
                                <Select value={selectedBeyannameType} onValueChange={setSelectedBeyannameType}>
                                    <SelectTrigger className="h-8 text-sm">
                                        <SelectValue placeholder="Seçiniz..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-64">
                                        {/* Öncelikli: Dinamik türler (DB'den), yoksa statik türler */}
                                        {availableBeyannameTypes.length > 0 ? (
                                            availableBeyannameTypes.map(type => (
                                                <SelectItem key={type.code} value={type.code}>
                                                    {type.name} <span className="text-muted-foreground text-xs ml-1">({type.count})</span>
                                                </SelectItem>
                                            ))
                                        ) : (
                                            /* Fallback: Statik beyanname türleri */
                                            BEYANNAME_TYPE_OPTIONS.map(option => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Month and Year in Row */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">Ay</Label>
                                    <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                                        <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MONTH_OPTIONS.map(option => (
                                                <SelectItem key={option.value} value={option.value.toString()}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">Yıl</Label>
                                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                        <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {YEAR_OPTIONS.map(option => (
                                                <SelectItem key={option.value} value={option.value.toString()}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2 pt-2 border-t">
                                {/* Filtrele Butonu */}
                                <Button
                                    onClick={applyFilter}
                                    disabled={filterLoading || !selectedBeyannameType || selectedFileTypes.length === 0}
                                    className="w-full"
                                >
                                    {filterLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Filtreleniyor...
                                        </>
                                    ) : (
                                        <>
                                            <Filter className="h-4 w-4 mr-2" />
                                            Filtrele
                                        </>
                                    )}
                                </Button>

                                {/* Clear Filter Button */}
                                {filteredResults.length > 0 && (
                                    <Button
                                        variant="outline"
                                        onClick={clearFilter}
                                        className="w-full h-9"
                                    >
                                        <XSquare className="h-4 w-4 mr-2" />
                                        Filtreyi Temizle
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )
                }

                {/* Main Content Wrapper */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                    {/* Content & Context Menu */}
                    <ContextMenu>
                        <ContextMenuTrigger className="flex-1 overflow-hidden flex flex-col">
                            <div
                                className="flex-1 overflow-auto p-4 content-area relative"
                                onMouseDown={handleContainerMouseDown}
                                ref={containerRef}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, currentFolderId)}
                            >
                                {/* Selection Rect Visual */}
                                {isSelecting && selectionRect && (
                                    <div
                                        className="fixed border border-blue-500 bg-blue-500/20 pointer-events-none z-50"
                                        style={{
                                            left: Math.min(selectionRect.startX, selectionRect.currentX),
                                            top: Math.min(selectionRect.startY, selectionRect.currentY),
                                            width: Math.abs(selectionRect.currentX - selectionRect.startX),
                                            height: Math.abs(selectionRect.currentY - selectionRect.startY),
                                        }}
                                    />
                                )}
                                {loading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : filteredResults.length > 0 ? (
                                    /* Filtered Results View - Show all filtered files grouped by customer */
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-lg font-semibold">
                                                Filtrelenmiş Dosyalar ({filteredResults.reduce((acc, r) => acc + r.documents.length, 0)} dosya, {filteredResults.length} mükellef)
                                            </h2>
                                        </div>
                                        {filteredResults.map((result) => (
                                            <div key={result.customer.id} className="border rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                                                    <Folder className="h-5 w-5 text-amber-400" />
                                                    <h3 className="font-medium">{result.customer.unvan}</h3>
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        {result.customer.vknTckn}
                                                    </span>
                                                    <span className="text-xs bg-muted px-2 py-0.5 rounded ml-auto">
                                                        {result.documents.length} dosya
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {result.documents.map((doc: any) => (
                                                        <div
                                                            key={doc.id}
                                                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer group"
                                                            onClick={() => {
                                                                // Navigate to parent folder of this document
                                                                if (result.customer.id) {
                                                                    handleNavigateToCustomer(result.customer.id);
                                                                }
                                                            }}
                                                        >
                                                            <FileText className="h-4 w-4 text-red-500 shrink-0" />
                                                            <span className="text-sm truncate flex-1">{doc.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {formatBytes(doc.size || 0)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : filteredItems.length === 0 ? (
                                    <div
                                        className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 cursor-pointer hover:opacity-80 transition-opacity select-none"
                                        onClick={(e) => {
                                            e.stopPropagation(); // prevent drag selection start if any
                                            fileInputRef.current?.click();
                                        }}
                                    >
                                        <Upload className="h-16 w-16 mb-4 text-muted-foreground/50" />
                                        <p className="text-lg font-medium">Buraya dosya yüklemek için tıklayın</p>
                                        <p className="text-sm">veya dosyaları sürükleyin</p>
                                    </div>
                                ) : (
                                    <>
                                        {viewMode === "list" && (
                                            <div className="flex items-center px-4 py-1 text-xs font-semibold text-muted-foreground border-b select-none sticky top-0 bg-background z-10 mb-2">
                                                <div className="flex-1 pl-2">Ad</div>
                                                <div className="w-[140px] px-2 border-l">Değiştirme tarihi</div>
                                                <div className="w-[120px] px-2 border-l">Tür</div>
                                                <div className="w-[80px] px-2 border-l text-right">Boyut</div>
                                            </div>
                                        )}
                                        <div className={cn(
                                            "grid gap-1",
                                            viewMode === "grid"
                                                ? "grid-cols-[repeat(auto-fill,minmax(140px,1fr))] grid-rows-[min-content] gap-y-8"
                                                : "grid-cols-1"
                                        )}>
                                            {filteredItems.map((item) => (
                                                <FileItemCard
                                                    key={item.id}
                                                    item={item}
                                                    viewMode={viewMode}
                                                    isSelected={selection.has(item.id)}
                                                    isCut={clipboard?.action === "cut" && clipboard.items.some(i => i.id === item.id) || false}
                                                    onClick={handleItemClick}
                                                    onContextMenu={handleItemContextMenu}
                                                    onDoubleClick={handleDoubleClick}
                                                    onDragStart={handleDragStart}
                                                    onDrop={handleDrop}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </ContextMenuTrigger>

                        <ContextMenuContent className="w-64">
                            {selection.size > 0 ? (
                                <>
                                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/20">
                                        {selection.size} öğe seçili
                                    </div>
                                    <ContextMenuItem onClick={copySelection}><Copy className="h-4 w-4 mr-2" /> Kopyala</ContextMenuItem>
                                    <ContextMenuItem onClick={cutSelection}><Scissors className="h-4 w-4 mr-2" /> Kes</ContextMenuItem>
                                    <ContextMenuSeparator />
                                    {selection.size === 1 && (
                                        <ContextMenuItem onClick={() => {
                                            const id = Array.from(selection)[0];
                                            const item = items.find(i => i.id === id);
                                            if (item) { setNewName(item.name); setRenameDialog(true); }
                                        }}>
                                            <Pencil className="h-4 w-4 mr-2" /> Yeniden Adlandır
                                        </ContextMenuItem>
                                    )}

                                    {selection.size === 1 && items.find(i => i.id === Array.from(selection)[0])?.isFolder && (
                                        <div className="p-2 border-t mt-1">
                                            <div className="flex items-center gap-1.5 mb-2 px-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                                <Palette className="h-3 w-3" /> Renk Değiştir
                                            </div>
                                            <div className="flex gap-2 px-1">
                                                <button
                                                    onClick={() => handleColorChange("blue")}
                                                    className="h-6 w-6 rounded-full bg-blue-500 hover:ring-2 ring-offset-2 ring-blue-500 transition-all border border-black/10 shadow-sm"
                                                    title="Mavi"
                                                />
                                                <button
                                                    onClick={() => handleColorChange("yellow")}
                                                    className="h-6 w-6 rounded-full bg-amber-400 hover:ring-2 ring-offset-2 ring-amber-400 transition-all border border-black/10 shadow-sm"
                                                    title="Sarı"
                                                />
                                                <button
                                                    onClick={() => handleColorChange("green")}
                                                    className="h-6 w-6 rounded-full bg-emerald-500 hover:ring-2 ring-offset-2 ring-emerald-500 transition-all border border-black/10 shadow-sm"
                                                    title="Yeşil"
                                                />
                                                <button
                                                    onClick={() => handleColorChange(null)}
                                                    className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 hover:ring-2 ring-offset-2 ring-gray-400 transition-all border border-black/10 shadow-sm flex items-center justify-center text-[10px]"
                                                    title="Varsayılan"
                                                >
                                                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <ContextMenuSeparator />
                                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/20">
                                        Sistem
                                    </div>
                                    <ContextMenuItem onClick={handleSync}>
                                        <RefreshCw className="h-4 w-4 mr-2" /> Yenile
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="h-4 w-4 mr-2" /> Dosya Yükle
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={handleDownload} disabled={Array.from(selection).every(id => items.find(i => i.id === id)?.isFolder)}>
                                        <Download className="h-4 w-4 mr-2" /> İndir
                                    </ContextMenuItem>
                                    <ContextMenuItem className="text-destructive border-t mt-1" onClick={() => setDeleteDialog(true)}>
                                        <Trash2 className="h-4 w-4 mr-2" /> Sil
                                    </ContextMenuItem>
                                </>
                            ) : (
                                <>
                                    <ContextMenuItem onClick={() => { setNewName(""); setNewFolderDialog(true); }}>
                                        <FolderPlus className="h-4 w-4 mr-2" /> Yeni Klasör
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={handleSync}>
                                        <RefreshCw className="h-4 w-4 mr-2" /> Yenile
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="h-4 w-4 mr-2" /> Dosya Yükle
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem disabled={!clipboard} onClick={pasteFromClipboard}>
                                        <ClipboardPaste className="h-4 w-4 mr-2" /> Yapıştır
                                    </ContextMenuItem>
                                </>
                            )}
                        </ContextMenuContent>
                    </ContextMenu>

                    {/* Hidden File Input */}
                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                handleFileUpload(e.target.files, currentFolderId);
                                e.target.value = ""; // Reset input
                            }
                        }}
                    />

                    {/* Persistent Info Bar (Footer) */}
                    <div className="flex items-center justify-between bg-background h-12 px-3 select-none text-xs font-medium border-t">
                        <div className="flex items-center gap-4 text-muted-foreground">
                            <span className="text-sm text-foreground">{items.length} öğe</span>
                            {selection.size > 0 && <span className="text-foreground border-l pl-4 dark:border-gray-700">{selection.size} öğe seçili</span>}
                            {clipboard?.items.length && <span className="text-foreground border-l pl-4 dark:border-gray-700">{clipboard.items.length} öğe panoda</span>}
                        </div>

                        <div className="flex items-center gap-1">
                            {/* Actions if selection */}
                            {selection.size > 0 && (
                                <>
                                    <Button variant="ghost" size="sm" className="h-8 px-3 text-xs hover:bg-muted" onClick={cutSelection}><Scissors className="h-4 w-4 mr-2" /> Kes</Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-3 text-xs hover:bg-muted" onClick={copySelection}><Copy className="h-4 w-4 mr-2" /> Kopyala</Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-3 text-xs hover:bg-muted" onClick={handleDownload} disabled={Array.from(selection).every(id => items.find(i => i.id === id)?.isFolder)}><Download className="h-4 w-4 mr-2" /> İndir</Button>
                                    <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteDialog(true)}><Trash2 className="h-4 w-4 mr-2" /> Sil</Button>
                                </>
                            )}
                            {clipboard?.items.length && (
                                <Button variant="ghost" size="sm" className="h-8 px-3 text-xs hover:bg-muted" onClick={pasteFromClipboard}><ClipboardPaste className="h-4 w-4 mr-2" /> Yapıştır</Button>
                            )}
                        </div>
                    </div>

                    {/* Dialogs */}
                    <Dialog open={newFolderDialog} onOpenChange={setNewFolderDialog}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Yeni Klasör Oluştur</DialogTitle></DialogHeader>
                            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Klasör Adı" autoFocus
                                onKeyDown={e => e.key === "Enter" && handleCreateFolder()} />
                            <DialogFooter><Button onClick={handleCreateFolder}>Oluştur</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={renameDialog} onOpenChange={setRenameDialog}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Yeniden Adlandır</DialogTitle></DialogHeader>
                            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Yeni İsim" autoFocus
                                onKeyDown={e => e.key === "Enter" && handleRename()} />
                            <DialogFooter><Button onClick={handleRename}>Kaydet</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Silme İşlemi</DialogTitle>
                                <DialogDescription>
                                    {selection.size} öğeyi silmek istediğinize emin misiniz?
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteDialog(false)}>İptal</Button>
                                <Button variant="destructive" onClick={handleDelete}>Evet, Sil</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </div>
    );
}

function copyAnimation(id: string, clipboard: ClipboardState | null) {
    return clipboard?.action === "cut" && clipboard.items.some(i => i.id === id);
}

const FileItemCard = memo(({ item, viewMode, isSelected, isCut, onClick, onContextMenu, onDoubleClick, onDragStart, onDrop }: {
    item: FileItem;
    viewMode: ViewMode;
    isSelected: boolean;
    isCut: boolean;
    onClick: (e: React.MouseEvent, item: FileItem) => void;
    onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
    onDoubleClick: (item: FileItem) => void;
    onDragStart: (e: React.DragEvent, item: FileItem) => void;
    onDrop: (e: React.DragEvent, folderId: string) => void;
}) => {
    return (
        <div
            className={cn(
                "group relative border rounded-lg hover:border-blue-500/50 hover:bg-muted/50 transition-all select-none cursor-pointer",
                viewMode === "grid" ? "flex flex-col gap-2 p-3 aspect-[4/3] items-center justify-center bg-card shadow-sm" : "flex items-center gap-3 p-2 h-12 w-full bg-card shadow-sm",
                isSelected && "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500",
                isCut && "opacity-50 dashed border-2"
            )}
            onClick={(e) => onClick(e, item)}
            onContextMenu={(e) => onContextMenu(e, item)}
            onDoubleClick={() => onDoubleClick(item)}
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            onDragOver={(e) => { if (item.isFolder) e.preventDefault(); }}
            onDrop={(e) => { if (item.isFolder) onDrop(e, item.id); }}
            data-file-item
            data-file-id={item.id}
        >
            <div className={cn("flex items-center justify-center shrink-0", viewMode === "grid" ? "mb-2" : "")}>
                {item.isFolder ? (
                    <Folder className={cn("text-yellow-400 fill-yellow-400/20", viewMode === "grid" ? "h-12 w-12" : "h-6 w-6")} />
                ) : (
                    <FileText className={cn("text-blue-400", viewMode === "grid" ? "h-10 w-10" : "h-5 w-5")} />
                )}
            </div>

            <div className={cn("flex-1 min-w-0 flex flex-col overflow-hidden", viewMode === "grid" ? "text-center w-full" : "gap-0.5")}>
                <span className="truncate text-sm font-medium leading-none" title={item.name}>{item.name}</span>
                {viewMode === "list" && (
                    <div className="flex text-xs text-muted-foreground ml-auto gap-4 items-center absolute right-4">
                        <span className="w-24 text-right hidden sm:block">{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("tr-TR") : "-"}</span>
                        <span className="w-20 text-right hidden sm:block">{item.isFolder ? "Klasör" : "Dosya"}</span>
                        <span className="w-16 text-right hidden sm:block">{item.size && !item.isFolder ? formatBytes(item.size) : "-"}</span>
                    </div>
                )}
                {viewMode === "grid" && item.size && !item.isFolder && (
                    <span className="text-[10px] text-muted-foreground mt-1">{formatBytes(item.size)}</span>
                )}
            </div>
        </div>
    );
});
FileItemCard.displayName = "FileItemCard";
