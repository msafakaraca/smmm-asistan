/**
 * useDosyalarData Hook
 *
 * Dosya ve klasör verilerini yönetir
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "@/components/ui/sonner";
import type { FileItem, Customer, BeyannameType, FilteredResult, Breadcrumb } from "../types";

interface UseDosyalarDataProps {
  customerId?: string;
}

interface UseDosyalarDataReturn {
  // Data
  items: FileItem[];
  customers: Customer[];
  beyannameTypes: BeyannameType[];
  filteredResults: FilteredResult[];
  breadcrumbs: Breadcrumb[];

  // State
  loading: boolean;
  filterLoading: boolean;
  currentFolderId: string | null;
  searchTerm: string;

  // Navigation
  history: (string | null)[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;

  // Actions
  setSearchTerm: (term: string) => void;
  setCurrentFolderId: (id: string | null) => void;
  navigateTo: (folderId: string | null) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  refresh: () => Promise<void>;

  // Filter
  applyFilter: (params: FilterParams) => Promise<void>;
  clearFilter: () => void;

  // CRUD
  createFolder: (name: string, parentId: string | null) => Promise<boolean>;
  renameItem: (id: string, newName: string) => Promise<boolean>;
  deleteItems: (ids: string[]) => Promise<boolean>;
  moveItems: (ids: string[], targetFolderId: string | null) => Promise<boolean>;
  uploadFiles: (files: FileList, parentId: string | null) => Promise<void>;
  updateFolderColor: (id: string, color: string | null) => Promise<boolean>;

  // Computed
  filteredItems: FileItem[];
}

interface FilterParams {
  companyType: string;
  customerId: string;
  fileTypes: string[];
  beyannameType: string;
  month: number | null;
  year: number | null;
}

export function useDosyalarData({ customerId: propCustomerId }: UseDosyalarDataProps = {}): UseDosyalarDataReturn {
  // Core state
  const [items, setItems] = useState<FileItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [beyannameTypes, setBeyannameTypes] = useState<BeyannameType[]>([]);
  const [filteredResults, setFilteredResults] = useState<FilteredResult[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: "Ana Klasör" }]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);

  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [history, setHistory] = useState<(string | null)[]>([null]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Fetch folder contents
  const fetchContents = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const url = folderId
        ? `/api/files?parentId=${folderId}`
        : `/api/files?parentId=null`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Dosyalar yüklenemedi");
      const data = await res.json();
      setItems(data.items || []);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Dosyalar yüklenirken hata oluştu");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch breadcrumbs
  const fetchBreadcrumbs = useCallback(async (folderId: string | null) => {
    if (!folderId) {
      setBreadcrumbs([{ id: null, name: "Ana Klasör" }]);
      return;
    }

    try {
      const res = await fetch(`/api/files/breadcrumbs?id=${folderId}`);
      if (res.ok) {
        const data = await res.json();
        setBreadcrumbs([{ id: null, name: "Ana Klasör" }, ...data]);
      }
    } catch (error) {
      console.error("Breadcrumb error:", error);
    }
  }, []);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error("Customers fetch error:", error);
    }
  }, []);

  // Fetch beyanname types
  const fetchBeyannameTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/beyanname-turleri");
      if (res.ok) {
        const data = await res.json();
        const types = data.map((t: { kod: string; aciklama: string }) => ({
          code: t.kod,
          name: t.aciklama,
          count: 0
        }));
        setBeyannameTypes(types);
      }
    } catch (error) {
      console.error("Beyanname types fetch error:", error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const initFolderId = propCustomerId || null;
    setCurrentFolderId(initFolderId);
    setHistory([initFolderId]);
    setHistoryIndex(0);

    Promise.all([
      fetchContents(initFolderId),
      fetchBreadcrumbs(initFolderId),
      fetchCustomers(),
      fetchBeyannameTypes()
    ]);
  }, [propCustomerId, fetchContents, fetchBreadcrumbs, fetchCustomers, fetchBeyannameTypes]);

  // Navigate to folder
  const navigateTo = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    fetchContents(folderId);
    fetchBreadcrumbs(folderId);

    // Update history
    const newHistory = [...history.slice(0, historyIndex + 1), folderId];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Clear filter results when navigating
    setFilteredResults([]);
  }, [history, historyIndex, fetchContents, fetchBreadcrumbs]);

  // Navigation helpers
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    const newIndex = historyIndex - 1;
    const folderId = history[newIndex];
    setHistoryIndex(newIndex);
    setCurrentFolderId(folderId);
    fetchContents(folderId);
    fetchBreadcrumbs(folderId);
  }, [canGoBack, historyIndex, history, fetchContents, fetchBreadcrumbs]);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    const newIndex = historyIndex + 1;
    const folderId = history[newIndex];
    setHistoryIndex(newIndex);
    setCurrentFolderId(folderId);
    fetchContents(folderId);
    fetchBreadcrumbs(folderId);
  }, [canGoForward, historyIndex, history, fetchContents, fetchBreadcrumbs]);

  const goUp = useCallback(() => {
    if (breadcrumbs.length <= 1) return;
    const parentBreadcrumb = breadcrumbs[breadcrumbs.length - 2];
    navigateTo(parentBreadcrumb.id);
  }, [breadcrumbs, navigateTo]);

  // Refresh
  const refresh = useCallback(async () => {
    await fetchContents(currentFolderId);
    await fetchBreadcrumbs(currentFolderId);
  }, [currentFolderId, fetchContents, fetchBreadcrumbs]);

  // Apply filter
  const applyFilter = useCallback(async (params: FilterParams) => {
    setFilterLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (params.companyType !== "ALL") queryParams.set("companyType", params.companyType);
      if (params.customerId !== "ALL") queryParams.set("customerId", params.customerId);
      if (params.fileTypes.length > 0) queryParams.set("fileTypes", params.fileTypes.join(","));
      if (params.beyannameType) queryParams.set("beyannameType", params.beyannameType);
      if (params.month) queryParams.set("month", params.month.toString());
      if (params.year) queryParams.set("year", params.year.toString());

      const res = await fetch(`/api/files/filter?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Filtreleme başarısız");

      const data = await res.json();
      setFilteredResults(data);

      if (data.length === 0) {
        toast.info("Filtreye uygun dosya bulunamadı");
      } else {
        const totalDocs = data.reduce((acc: number, r: FilteredResult) => acc + r.documents.length, 0);
        toast.success(`${totalDocs} dosya bulundu (${data.length} mükellef)`);
      }
    } catch (error) {
      console.error("Filter error:", error);
      toast.error("Filtreleme sırasında hata oluştu");
    } finally {
      setFilterLoading(false);
    }
  }, []);

  // Clear filter
  const clearFilter = useCallback(() => {
    setFilteredResults([]);
  }, []);

  // Create folder
  const createFolder = useCallback(async (name: string, parentId: string | null): Promise<boolean> => {
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId, isFolder: true })
      });

      if (!res.ok) throw new Error("Klasör oluşturulamadı");

      toast.success("Klasör oluşturuldu");
      await refresh();
      return true;
    } catch (error) {
      console.error("Create folder error:", error);
      toast.error("Klasör oluşturulurken hata oluştu");
      return false;
    }
  }, [refresh]);

  // Rename item
  const renameItem = useCallback(async (id: string, newName: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      });

      if (!res.ok) throw new Error("Yeniden adlandırma başarısız");

      toast.success("Ad değiştirildi");
      await refresh();
      return true;
    } catch (error) {
      console.error("Rename error:", error);
      toast.error("Yeniden adlandırma başarısız");
      return false;
    }
  }, [refresh]);

  // Delete items
  const deleteItems = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });

      if (!res.ok) throw new Error("Silme başarısız");

      toast.success(`${ids.length} öğe silindi`);
      await refresh();
      return true;
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Silme işlemi başarısız");
      return false;
    }
  }, [refresh]);

  // Move items
  const moveItems = useCallback(async (ids: string[], targetFolderId: string | null): Promise<boolean> => {
    try {
      const res = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, targetFolderId })
      });

      if (!res.ok) throw new Error("Taşıma başarısız");

      toast.success(`${ids.length} öğe taşındı`);
      await refresh();
      return true;
    } catch (error) {
      console.error("Move error:", error);
      toast.error("Taşıma işlemi başarısız");
      return false;
    }
  }, [refresh]);

  // Upload files
  const uploadFiles = useCallback(async (files: FileList, parentId: string | null) => {
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append("files", file));
    if (parentId) formData.append("parentId", parentId);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error("Yükleme başarısız");

      toast.success(`${files.length} dosya yüklendi`);
      await refresh();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Dosya yüklenirken hata oluştu");
    }
  }, [refresh]);

  // Update folder color
  const updateFolderColor = useCallback(async (id: string, color: string | null): Promise<boolean> => {
    try {
      const res = await fetch(`/api/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color })
      });

      if (!res.ok) throw new Error("Renk değiştirilemedi");

      await refresh();
      return true;
    } catch (error) {
      console.error("Color update error:", error);
      toast.error("Renk değiştirilemedi");
      return false;
    }
  }, [refresh]);

  // Filtered items (by search term)
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  return {
    // Data
    items,
    customers,
    beyannameTypes,
    filteredResults,
    breadcrumbs,

    // State
    loading,
    filterLoading,
    currentFolderId,
    searchTerm,

    // Navigation
    history,
    historyIndex,
    canGoBack,
    canGoForward,

    // Actions
    setSearchTerm,
    setCurrentFolderId,
    navigateTo,
    goBack,
    goForward,
    goUp,
    refresh,

    // Filter
    applyFilter,
    clearFilter,

    // CRUD
    createFolder,
    renameItem,
    deleteItems,
    moveItems,
    uploadFiles,
    updateFolderColor,

    // Computed
    filteredItems,
  };
}
