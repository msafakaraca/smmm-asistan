/**
 * useFilesCache Hook - SWR ile hızlı dosya yönetimi
 *
 * Özellikler:
 * - Client-side caching (aynı klasör anında açılır)
 * - Optimistic updates (UI anında güncellenir)
 * - Background revalidation (arka planda güncel veri çekilir)
 * - Prefetching (hover'da önceden yükle)
 */

import useSWR, { mutate } from "swr";
import { useCallback, useState, useTransition, useMemo } from "react";
import { toast } from "@/components/ui/sonner";

interface FileItem {
  id: string;
  name: string;
  isFolder: boolean;
  size?: number;
  updatedAt?: string | Date;
  color?: string | null;
  parentId?: string | null;
  sirketTipi?: string | null;
}

interface Breadcrumb {
  id: string;
  name: string;
}

interface FilesData {
  items: FileItem[];
  breadcrumbs: Breadcrumb[];
}

// Fetcher with error handling
const fetcher = async (url: string): Promise<FilesData> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Dosyalar yüklenemedi");
  return res.json();
};

// Cache key generator
const getCacheKey = (folderId: string | null) =>
  folderId ? `/api/files?parentId=${folderId}` : `/api/files`;

export function useFilesCache(initialFolderId: string | null = null) {
  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId);
  const [history, setHistory] = useState<(string | null)[]>([initialFolderId]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isPending, startTransition] = useTransition();

  // SWR for current folder - instant cache hit
  const { data, error, isLoading, isValidating } = useSWR<FilesData>(
    getCacheKey(currentFolderId),
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // 5 saniye içinde aynı istek tekrarlanmaz
      keepPreviousData: true, // Geçiş sırasında önceki veriyi göster
    }
  );

  // Derived state
  const items = data?.items ?? [];
  const breadcrumbs = data?.breadcrumbs ?? [];

  // Navigation helpers
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  // Prefetch a folder (hover'da çağrılır)
  const prefetch = useCallback((folderId: string) => {
    const key = getCacheKey(folderId);
    // SWR cache'e yükle ama UI'ı güncelleme
    mutate(key, fetcher(key), { revalidate: false });
  }, []);

  // Navigate to folder - INSTANT with cache
  const navigateTo = useCallback((folderId: string | null) => {
    if (folderId === currentFolderId) return;

    // Optimistic: Anında state güncelle
    startTransition(() => {
      setCurrentFolderId(folderId);

      // History güncelle
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(folderId);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
    });
  }, [currentFolderId, historyIndex]);

  // Go back
  const goBack = useCallback(() => {
    if (!canGoBack) return;
    const newIndex = historyIndex - 1;
    const folderId = history[newIndex];

    startTransition(() => {
      setHistoryIndex(newIndex);
      setCurrentFolderId(folderId);
    });
  }, [canGoBack, historyIndex, history]);

  // Go forward
  const goForward = useCallback(() => {
    if (!canGoForward) return;
    const newIndex = historyIndex + 1;
    const folderId = history[newIndex];

    startTransition(() => {
      setHistoryIndex(newIndex);
      setCurrentFolderId(folderId);
    });
  }, [canGoForward, historyIndex, history]);

  // Go up (parent folder)
  const goUp = useCallback(() => {
    if (breadcrumbs.length === 0 && currentFolderId === null) return;

    const parentId = breadcrumbs.length > 1
      ? breadcrumbs[breadcrumbs.length - 2].id
      : null;

    navigateTo(parentId);
  }, [breadcrumbs, currentFolderId, navigateTo]);

  // Refresh current folder
  const refresh = useCallback(async () => {
    const key = getCacheKey(currentFolderId);
    await mutate(key);
    toast.success("Dosyalar yenilendi");
  }, [currentFolderId]);

  // Create folder - optimistic update
  const createFolder = useCallback(async (name: string): Promise<boolean> => {
    const key = getCacheKey(currentFolderId);

    try {
      // Optimistic update
      mutate(key, async (current: FilesData | undefined) => {
        const tempId = `temp-${Date.now()}`;
        const optimisticItem: FileItem = {
          id: tempId,
          name,
          isFolder: true,
          updatedAt: new Date().toISOString(),
        };

        return {
          ...current!,
          items: [optimisticItem, ...(current?.items ?? [])]
        };
      }, { revalidate: false });

      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parentId: currentFolderId,
          isFolder: true
        })
      });

      if (!res.ok) throw new Error("Klasör oluşturulamadı");

      toast.success("Klasör oluşturuldu");
      await mutate(key); // Gerçek veriyi al
      return true;
    } catch (error) {
      toast.error("Klasör oluşturulurken hata oluştu");
      await mutate(key); // Rollback
      return false;
    }
  }, [currentFolderId]);

  // Delete items - optimistic update
  const deleteItems = useCallback(async (ids: string[]): Promise<boolean> => {
    const key = getCacheKey(currentFolderId);
    const idSet = new Set(ids);

    try {
      // Optimistic: Anında kaldır
      mutate(key, async (current: FilesData | undefined) => ({
        ...current!,
        items: (current?.items ?? []).filter(item => !idSet.has(item.id))
      }), { revalidate: false });

      const res = await fetch(`/api/files?ids=${ids.join(",")}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Silinemedi");

      toast.success(`${ids.length} öğe silindi`);
      return true;
    } catch (error) {
      toast.error("Silme işlemi başarısız");
      await mutate(key); // Rollback
      return false;
    }
  }, [currentFolderId]);

  // Rename item
  const renameItem = useCallback(async (id: string, newName: string): Promise<boolean> => {
    const key = getCacheKey(currentFolderId);

    try {
      // Optimistic update
      mutate(key, async (current: FilesData | undefined) => ({
        ...current!,
        items: (current?.items ?? []).map(item =>
          item.id === id ? { ...item, name: newName } : item
        )
      }), { revalidate: false });

      const res = await fetch("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName })
      });

      if (!res.ok) throw new Error("Yeniden adlandırılamadı");

      toast.success("Ad değiştirildi");
      return true;
    } catch (error) {
      toast.error("Yeniden adlandırma başarısız");
      await mutate(key); // Rollback
      return false;
    }
  }, [currentFolderId]);

  // Move items
  const moveItems = useCallback(async (ids: string[], targetFolderId: string | null): Promise<boolean> => {
    const sourceKey = getCacheKey(currentFolderId);
    const targetKey = getCacheKey(targetFolderId);
    const idSet = new Set(ids);

    try {
      // Optimistic: Kaynaktan kaldır
      mutate(sourceKey, async (current: FilesData | undefined) => ({
        ...current!,
        items: (current?.items ?? []).filter(item => !idSet.has(item.id))
      }), { revalidate: false });

      const res = await fetch("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, parentId: targetFolderId })
      });

      if (!res.ok) throw new Error("Taşınamadı");

      toast.success(`${ids.length} öğe taşındı`);

      // Hedefi de yenile
      if (targetFolderId !== currentFolderId) {
        mutate(targetKey);
      }

      return true;
    } catch (error) {
      toast.error("Taşıma işlemi başarısız");
      await mutate(sourceKey); // Rollback
      return false;
    }
  }, [currentFolderId]);

  // Update folder color
  const updateColor = useCallback(async (id: string, color: string | null): Promise<boolean> => {
    const key = getCacheKey(currentFolderId);

    try {
      mutate(key, async (current: FilesData | undefined) => ({
        ...current!,
        items: (current?.items ?? []).map(item =>
          item.id === id ? { ...item, color } : item
        )
      }), { revalidate: false });

      const res = await fetch("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, color })
      });

      if (!res.ok) throw new Error("Renk değiştirilemedi");

      toast.success("Klasör rengi güncellendi");
      return true;
    } catch (error) {
      toast.error("Renk değiştirilemedi");
      await mutate(key);
      return false;
    }
  }, [currentFolderId]);

  // Upload files
  const uploadFiles = useCallback(async (files: FileList, targetFolderId: string | null) => {
    const key = getCacheKey(targetFolderId ?? currentFolderId);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      if (targetFolderId) formData.append("parentId", targetFolderId);
      else formData.append("parentId", "null");

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
      } catch {
        toast.error(`${file.name} hata oluştu`, { id: toastId });
      }
    }

    if (successCount > 0) {
      await mutate(key);
    }
  }, [currentFolderId]);

  return {
    // Data
    items,
    breadcrumbs,

    // State
    currentFolderId,
    loading: isLoading && !data, // İlk yükleme
    validating: isValidating, // Arka planda güncelleme
    error,

    // Navigation
    history,
    historyIndex,
    canGoBack,
    canGoForward,
    navigateTo,
    goBack,
    goForward,
    goUp,
    prefetch,

    // Actions
    refresh,
    createFolder,
    deleteItems,
    renameItem,
    moveItems,
    updateColor,
    uploadFiles,
  };
}
