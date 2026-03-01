/**
 * DosyalarPage Component
 *
 * Ana dosya yönetimi sayfası - tüm bileşenleri orkestre eder
 */

"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { toast } from "@/components/ui/sonner";
import { useFilesTree } from "./hooks/use-files-tree";
import { useFileSelection } from "./hooks/use-file-selection";
import { DosyalarToolbar } from "./dosyalar-toolbar";
import { DosyalarFileList } from "./dosyalar-file-list";
import { DosyalarFooter } from "./dosyalar-footer";
import { DosyalarSidebar } from "./dosyalar-sidebar";
import { NewFolderDialog, RenameDialog, DeleteDialog } from "./dialogs/folder-dialog";
import type { FileItem, Customer, BeyannameType, FilteredResult } from "./types";
import { BEYANNAME_TYPE_OPTIONS } from "@/lib/constants/beyanname-types";

export function DosyalarPage() {
  // ANLIK navigasyon için useFilesTree hook'u (0ms latency)
  const {
    items: rawItems,
    breadcrumbs,
    loading,
    currentFolderId,
    canGoBack,
    canGoForward,
    navigateTo,
    goBack,
    goForward,
    goUp,
    refresh,
    createFolder,
    renameItem,
    deleteItems,
    moveItems,
    updateColor,
    uploadFiles,
  } = useFilesTree();

  // Sidebar için ayrı state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [beyannameTypes, setBeyannameTypes] = useState<BeyannameType[]>([]);
  const [filteredResults, setFilteredResults] = useState<FilteredResult[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Sidebar verilerini bir kere yükle (sayfa açılışında)
  useEffect(() => {
    // Customers fetch
    fetch("/api/customers")
      .then(r => r.json())
      .then(c => {
        // API doğrudan array dönüyor
        setCustomers(Array.isArray(c) ? c : (c.customers || []));
      })
      .catch((err) => {
        console.error("[DosyalarPage] Customers fetch error:", err);
      });

    // Beyanname türleri fetch
    fetch("/api/beyanname-turleri")
      .then(r => r.json())
      .then(b => {
        // API: { kod, aciklama, kisaAd, kategori, siraNo }
        // BeyannameType: { code, name, count }
        if (Array.isArray(b) && b.length > 0) {
          const formattedTypes: BeyannameType[] = b.map((item: { kod: string; aciklama: string; kisaAd?: string }) => ({
            code: item.kod,
            name: item.kisaAd || item.aciklama || item.kod,
            count: 0
          }));
          setBeyannameTypes(formattedTypes);
        } else {
          // Fallback: Statik beyanname türleri
          console.log("[DosyalarPage] API boş döndü, statik türler kullanılıyor");
          const fallbackTypes: BeyannameType[] = BEYANNAME_TYPE_OPTIONS.map(opt => ({
            code: opt.value,
            name: opt.label.split(" - ")[1] || opt.label,
            count: 0
          }));
          setBeyannameTypes(fallbackTypes);
        }
      })
      .catch((err) => {
        console.error("[DosyalarPage] Beyanname türleri fetch error:", err);
        // Fallback: Statik beyanname türleri
        const fallbackTypes: BeyannameType[] = BEYANNAME_TYPE_OPTIONS.map(opt => ({
          code: opt.value,
          name: opt.label.split(" - ")[1] || opt.label,
          count: 0
        }));
        setBeyannameTypes(fallbackTypes);
      });
  }, []);

  // Client-side arama filtresi (ANLIK)
  const items = useMemo(() => {
    if (!searchTerm.trim()) return rawItems;
    const term = searchTerm.toLowerCase();
    return rawItems.filter(item =>
      item.name.toLowerCase().includes(term)
    );
  }, [rawItems, searchTerm]);

  // filteredItems = items (uyumluluk için)
  const filteredItems = items;

  // Sidebar filtre fonksiyonları
  // API zorunlu parametreler: type, fileTypes, month, year
  // API opsiyonel: customerId, companyType
  const applyFilter = useCallback(async (params: {
    companyType: string;
    customerId: string;
    fileTypes: string[];
    beyannameType: string;
    month: number | null;
    year: number | null;
  }) => {
    // Zorunlu parametreleri kontrol et
    if (!params.beyannameType || !params.fileTypes?.length || !params.month || !params.year) {
      // Zorunlu parametreler eksikse filtreleme yapma
      console.warn("[Filter] Zorunlu parametreler eksik:", {
        type: params.beyannameType,
        fileTypes: params.fileTypes,
        month: params.month,
        year: params.year
      });
      return;
    }

    setFilterLoading(true);
    try {
      const queryParams = new URLSearchParams();

      // Zorunlu parametreler - API "type" bekliyor
      queryParams.set("type", params.beyannameType);
      queryParams.set("fileTypes", params.fileTypes.join(","));
      queryParams.set("month", params.month.toString());
      queryParams.set("year", params.year.toString());

      // Opsiyonel parametreler
      if (params.customerId && params.customerId !== "ALL") {
        queryParams.set("customerId", params.customerId);
      }
      if (params.companyType && params.companyType !== "ALL") {
        queryParams.set("companyType", params.companyType);
      }

      const res = await fetch(`/api/files/filter?${queryParams.toString()}`);
      const data = await res.json();

      // API { results: [...], totalCustomers, totalDocuments } formatında dönüyor
      if (data.results && Array.isArray(data.results)) {
        setFilteredResults(data.results);
        if (data.totalDocuments > 0) {
          toast.success(`${data.totalCustomers} mükellef, ${data.totalDocuments} dosya bulundu`);
        } else {
          toast.info("Filtreye uygun dosya bulunamadı");
        }
      } else {
        setFilteredResults([]);
        toast.info("Filtreye uygun dosya bulunamadı");
      }
    } catch (error) {
      console.error("[Filter] Hata:", error);
      setFilteredResults([]);
    } finally {
      setFilterLoading(false);
    }
  }, []);

  const clearFilter = useCallback(() => {
    setFilteredResults([]);
    toast.info("Filtre temizlendi");
  }, []);

  // Selection hook
  const {
    selection,
    clipboard,
    isSelecting,
    selectionRect,
    containerRef,
    clearSelection,
    handleItemClick,
    handleItemContextMenu,
    copySelection,
    cutSelection,
    pasteFromClipboard,
    handleContainerMouseDown,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDeleteSelected,
  } = useFileSelection({
    items: filteredItems,
    onDeleteItems: deleteItems,
    onMoveItems: moveItems,
  });

  // UI state
  const [showSidebar, setShowSidebar] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameItem_, setRenameItem] = useState<FileItem | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Double click handler - tüm tarayıcılarda yeni sekmede açar
  const handleDoubleClick = useCallback((item: FileItem) => {
    if (item.isFolder) {
      setSearchTerm("");
      navigateTo(item.id);
    } else {
      // Tüm dosyaları (PDF dahil) yeni sekmede aç
      window.open(`/api/files/view?id=${item.id}`, "_blank");
    }
  }, [navigateTo]);

  // Open rename dialog
  const handleOpenRename = useCallback((item: FileItem) => {
    setRenameItem(item);
    setRenameDialogOpen(true);
  }, []);

  // Handle rename confirm
  const handleRenameConfirm = useCallback(async (newName: string): Promise<boolean> => {
    if (!renameItem_) return false;
    return renameItem(renameItem_.id, newName);
  }, [renameItem_, renameItem]);

  // Handle new folder confirm
  const handleNewFolderConfirm = useCallback(async (name: string): Promise<boolean> => {
    return createFolder(name);
  }, [createFolder]);

  // Handle delete confirm
  const handleDeleteConfirm = useCallback(async (): Promise<boolean> => {
    return handleDeleteSelected();
  }, [handleDeleteSelected]);

  // Handle file upload
  const handleFileUpload = useCallback((files: FileList) => {
    uploadFiles(files, currentFolderId);
  }, [uploadFiles, currentFolderId]); // useFilesTree.uploadFiles zaten targetFolderId alıyor

  // Handle upload click
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle download
  const handleDownload = useCallback(() => {
    if (selection.size === 0) return;

    const ids = Array.from(selection);
    ids.forEach(id => {
      const item = items.find(i => i.id === id);
      if (item && !item.isFolder) {
        window.open(`/api/files/download?id=${id}`, "_blank");
      }
    });
  }, [selection, items]);

  // Handle color change
  const handleColorChange = useCallback((color: string | null) => {
    if (selection.size !== 1) return;
    const id = Array.from(selection)[0];
    updateColor(id, color);
  }, [selection, updateColor]);

  // Search clear
  const handleSearchClear = useCallback(() => {
    setSearchTerm("");
    navigateTo(null);
  }, [setSearchTerm, navigateTo]);

  // Navigation wrappers - searchTerm'i temizleyerek navigate et
  const handleNavigate = useCallback((folderId: string | null) => {
    setSearchTerm("");
    navigateTo(folderId);
  }, [navigateTo]);

  const handleGoBack = useCallback(() => {
    setSearchTerm("");
    goBack();
  }, [goBack]);

  const handleGoForward = useCallback(() => {
    setSearchTerm("");
    goForward();
  }, [goForward]);

  const handleGoUp = useCallback(() => {
    setSearchTerm("");
    goUp();
  }, [goUp]);

  return (
    <>
      <div className="flex flex-col h-full w-full bg-background">
        {/* Toolbar */}
        <DosyalarToolbar
          breadcrumbs={breadcrumbs}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchClear={handleSearchClear}
          onNavigate={handleNavigate}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onGoUp={handleGoUp}
          onRefresh={refresh}
          onNewFolder={() => setNewFolderDialogOpen(true)}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          showSidebar={showSidebar}
        />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* File List */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            <DosyalarFileList
              items={filteredItems}
              filteredResults={filteredResults}
              loading={loading}
              selection={selection}
              clipboard={clipboard}
              isSelecting={isSelecting}
              selectionRect={selectionRect}
              containerRef={containerRef}
              onItemClick={handleItemClick}
              onItemContextMenu={handleItemContextMenu}
              onDoubleClick={handleDoubleClick}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onContainerMouseDown={handleContainerMouseDown}
              onCopy={copySelection}
              onCut={cutSelection}
              onPaste={pasteFromClipboard}
              onRename={handleOpenRename}
              onDelete={() => setDeleteDialogOpen(true)}
              onRefresh={refresh}
              onUploadClick={handleUploadClick}
              onDownload={handleDownload}
              onColorChange={handleColorChange}
              onNewFolder={() => setNewFolderDialogOpen(true)}
            />

            {/* Hidden File Input */}
            <input
              type="file"
              multiple
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files);
                  e.target.value = "";
                }
              }}
            />

            {/* Footer */}
            <DosyalarFooter
              itemCount={items.length}
              selection={selection}
              clipboard={clipboard}
              items={filteredItems}
              onCut={cutSelection}
              onCopy={copySelection}
              onPaste={pasteFromClipboard}
              onDownload={handleDownload}
              onDelete={() => setDeleteDialogOpen(true)}
            />
          </div>

          {/* Sidebar */}
          <DosyalarSidebar
            isOpen={showSidebar}
            onClose={() => setShowSidebar(false)}
            customers={customers}
            beyannameTypes={beyannameTypes}
            onApplyFilter={applyFilter}
            onClearFilter={clearFilter}
            hasFilterResults={filteredResults.length > 0}
            filterLoading={filterLoading}
          />
        </div>
      </div>

      {/* Dialogs */}
      <NewFolderDialog
        open={newFolderDialogOpen}
        onOpenChange={setNewFolderDialogOpen}
        onConfirm={handleNewFolderConfirm}
      />

      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        currentName={renameItem_?.name || ""}
        onConfirm={handleRenameConfirm}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemCount={selection.size}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
