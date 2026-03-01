/**
 * useFilesTree Hook - Windows Explorer benzeri ANLIK navigasyon
 *
 * Strateji:
 * 1. Sayfa yüklendiğinde TÜM dosyaları tek seferde çek
 * 2. Client-side Map ile tree yapısı oluştur
 * 3. Navigasyon = sadece state değişikliği = ANLIK (0ms)
 * 4. CRUD işlemleri: Önce local state güncelle, sonra API
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import useSWR from "swr";
import { toast } from "@/components/ui/sonner";
import type { FileItem } from "../types";

interface Breadcrumb {
  id: string;
  name: string;
}

interface TreeResponse {
  items: FileItem[];
  total: number;
}

// Fetcher
const fetcher = async (url: string): Promise<TreeResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Dosyalar yüklenemedi");
  return res.json();
};

export function useFilesTree() {
  // Tüm dosyaları tek seferde yükle (cache devre dışı - her zaman güncel veri)
  const { data, error, isLoading, mutate } = useSWR<TreeResponse>(
    "/api/files/tree",
    fetcher,
    {
      revalidateOnFocus: true,       // Her focus'ta yenile
      revalidateOnReconnect: true,   // Reconnect'te yenile
      dedupingInterval: 0,           // Cache YOK - her istek yeni
    }
  );

  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([null]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT-SIDE TREE YAPISI - O(1) lookup ile ANLIK navigasyon
  // ═══════════════════════════════════════════════════════════════════════════

  // parentId -> children Map (O(1) lookup)
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, FileItem[]>();
    if (!data?.items) return map;

    for (const item of data.items) {
      const parentId = item.parentId ?? null;
      if (!map.has(parentId)) {
        map.set(parentId, []);
      }
      map.get(parentId)!.push(item);
    }

    return map;
  }, [data?.items]);

  // id -> item Map (O(1) lookup)
  const itemMap = useMemo(() => {
    const map = new Map<string, FileItem>();
    if (!data?.items) return map;

    for (const item of data.items) {
      map.set(item.id, item);
    }

    return map;
  }, [data?.items]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ANLIK NAVIGATION - Sadece state değişikliği, API çağrısı YOK
  // ═══════════════════════════════════════════════════════════════════════════

  // Mevcut klasörün içeriği - O(1)
  const items = useMemo(() => {
    return childrenMap.get(currentFolderId) ?? [];
  }, [childrenMap, currentFolderId]);

  // Breadcrumbs - O(depth) ama genelde max 5-10
  const breadcrumbs = useMemo(() => {
    const crumbs: Breadcrumb[] = [];
    let current = currentFolderId;

    while (current) {
      const item = itemMap.get(current);
      if (!item) break;
      crumbs.unshift({ id: item.id, name: item.name });
      current = item.parentId ?? null;
    }

    return crumbs;
  }, [currentFolderId, itemMap]);

  // Navigation helpers
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  // ANLIK navigasyon - sadece state güncelleme
  const navigateTo = useCallback((folderId: string | null) => {
    if (folderId === currentFolderId) return;

    setCurrentFolderId(folderId);
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(folderId);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [currentFolderId, historyIndex]);

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setCurrentFolderId(history[newIndex]);
  }, [canGoBack, historyIndex, history]);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setCurrentFolderId(history[newIndex]);
  }, [canGoForward, historyIndex, history]);

  const goUp = useCallback(() => {
    if (breadcrumbs.length === 0 && currentFolderId === null) return;

    const parentId = breadcrumbs.length > 1
      ? breadcrumbs[breadcrumbs.length - 2].id
      : null;

    navigateTo(parentId);
  }, [breadcrumbs, currentFolderId, navigateTo]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD İŞLEMLERİ - Önce local state güncelle (ANLIK), sonra API
  // ═══════════════════════════════════════════════════════════════════════════

  const refresh = useCallback(async () => {
    await mutate();
    toast.success("Dosyalar yenilendi");
  }, [mutate]);

  // Klasör oluştur
  const createFolder = useCallback(async (name: string): Promise<boolean> => {
    const tempId = `temp-${Date.now()}`;
    const newItem: FileItem = {
      id: tempId,
      name,
      isFolder: true,
      parentId: currentFolderId,
      updatedAt: new Date().toISOString(),
    };

    // Optimistic update
    mutate(
      current => current ? {
        ...current,
        items: [...current.items, newItem]
      } : current,
      { revalidate: false }
    );

    try {
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

      const created = await res.json();

      // Gerçek id ile güncelle
      mutate(
        current => current ? {
          ...current,
          items: current.items.map(item =>
            item.id === tempId ? { ...item, id: created.id } : item
          )
        } : current,
        { revalidate: false }
      );

      toast.success("Klasör oluşturuldu");
      return true;
    } catch (error) {
      // Rollback
      mutate();
      toast.error("Klasör oluşturulurken hata oluştu");
      return false;
    }
  }, [currentFolderId, mutate]);

  // Öğeleri sil
  const deleteItems = useCallback(async (ids: string[]): Promise<boolean> => {
    const idSet = new Set(ids);

    // Recursive: Alt öğeleri de bul
    const getAllDescendants = (parentIds: string[]): string[] => {
      const descendants: string[] = [];
      for (const parentId of parentIds) {
        const children = childrenMap.get(parentId) ?? [];
        for (const child of children) {
          descendants.push(child.id);
          if (child.isFolder) {
            descendants.push(...getAllDescendants([child.id]));
          }
        }
      }
      return descendants;
    };

    const folderIds = ids.filter(id => itemMap.get(id)?.isFolder);
    const descendantIds = getAllDescendants(folderIds);
    const allIdsToDelete = new Set([...ids, ...descendantIds]);

    // Optimistic update
    mutate(
      current => current ? {
        ...current,
        items: current.items.filter(item => !allIdsToDelete.has(item.id))
      } : current,
      { revalidate: false }
    );

    try {
      const res = await fetch(`/api/files?ids=${ids.join(",")}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Silinemedi");

      toast.success(`${ids.length} öğe silindi`);
      return true;
    } catch (error) {
      mutate();
      toast.error("Silme işlemi başarısız");
      return false;
    }
  }, [childrenMap, itemMap, mutate]);

  // Yeniden adlandır
  const renameItem = useCallback(async (id: string, newName: string): Promise<boolean> => {
    // Optimistic update
    mutate(
      current => current ? {
        ...current,
        items: current.items.map(item =>
          item.id === id ? { ...item, name: newName } : item
        )
      } : current,
      { revalidate: false }
    );

    try {
      const res = await fetch("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName })
      });

      if (!res.ok) throw new Error("Yeniden adlandırılamadı");

      toast.success("Ad değiştirildi");
      return true;
    } catch (error) {
      mutate();
      toast.error("Yeniden adlandırma başarısız");
      return false;
    }
  }, [mutate]);

  // Öğeleri taşı
  const moveItems = useCallback(async (ids: string[], targetFolderId: string | null): Promise<boolean> => {
    // Optimistic update
    mutate(
      current => current ? {
        ...current,
        items: current.items.map(item =>
          ids.includes(item.id) ? { ...item, parentId: targetFolderId } : item
        )
      } : current,
      { revalidate: false }
    );

    try {
      const res = await fetch("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, parentId: targetFolderId })
      });

      if (!res.ok) throw new Error("Taşınamadı");

      toast.success(`${ids.length} öğe taşındı`);
      return true;
    } catch (error) {
      mutate();
      toast.error("Taşıma işlemi başarısız");
      return false;
    }
  }, [mutate]);

  // Renk güncelle
  const updateColor = useCallback(async (id: string, color: string | null): Promise<boolean> => {
    // Optimistic update
    mutate(
      current => current ? {
        ...current,
        items: current.items.map(item =>
          item.id === id ? { ...item, color } : item
        )
      } : current,
      { revalidate: false }
    );

    try {
      const res = await fetch("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, color })
      });

      if (!res.ok) throw new Error("Renk değiştirilemedi");

      toast.success("Klasör rengi güncellendi");
      return true;
    } catch (error) {
      mutate();
      toast.error("Renk değiştirilemedi");
      return false;
    }
  }, [mutate]);

  // Dosya yükle
  const uploadFiles = useCallback(async (files: FileList, targetFolderId: string | null) => {
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("parentId", targetFolderId ?? "null");

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
      await mutate();
    }
  }, [mutate]);

  return {
    // Data
    items,
    breadcrumbs,
    allItems: data?.items ?? [],
    totalCount: data?.total ?? 0,

    // State
    currentFolderId,
    loading: isLoading,
    error,

    // Navigation
    canGoBack,
    canGoForward,
    navigateTo,
    goBack,
    goForward,
    goUp,

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
