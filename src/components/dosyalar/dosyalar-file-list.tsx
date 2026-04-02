/**
 * DosyalarFileList Component
 *
 * Dosya listesi tablosu ve context menu
 */

import { memo, useRef } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DosyalarFileRow } from "./dosyalar-file-row";
import type { FileItem, FilteredResult, SelectionRect, ClipboardState } from "./types";
import { formatBytes } from "./types";

interface DosyalarFileListProps {
  items: FileItem[];
  filteredResults: FilteredResult[];
  loading: boolean;
  selection: Set<string>;
  clipboard: ClipboardState | null;
  isSelecting: boolean;
  selectionRect: SelectionRect | null;
  containerRef: React.RefObject<HTMLDivElement>;

  // Event handlers
  onItemClick: (e: React.MouseEvent, item: FileItem) => void;
  onItemContextMenu: (e: React.MouseEvent, item: FileItem) => void;
  onDoubleClick: (item: FileItem) => void;
  onDragStart: (e: React.DragEvent, item: FileItem) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, folderId: string | null) => void;
  onContainerMouseDown: (e: React.MouseEvent) => void;

  // Actions
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onRename: (item: FileItem) => void;
  onDelete: () => void;
  onRefresh: () => void;
  onUploadClick: () => void;
  onDownload: () => void;
  onColorChange: (color: string | null) => void;
  onNewFolder: () => void;
}

export const DosyalarFileList = memo(function DosyalarFileList({
  items,
  filteredResults,
  loading,
  selection,
  clipboard,
  isSelecting,
  selectionRect,
  containerRef,
  onItemClick,
  onItemContextMenu,
  onDoubleClick,
  onDragStart,
  onDragOver,
  onDrop,
  onContainerMouseDown,
  onCopy,
  onCut,
  onPaste,
  onRename,
  onDelete,
  onRefresh,
  onUploadClick,
  onDownload,
  onColorChange,
  onNewFolder,
}: DosyalarFileListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get selected item for context menu
  const getSelectedItem = (): FileItem | null => {
    if (selection.size !== 1) return null;
    const id = Array.from(selection)[0];
    return items.find(i => i.id === id) || null;
  };

  // Check if all selected items are folders
  const allSelectedAreFolders = Array.from(selection).every(
    id => items.find(i => i.id === id)?.isFolder
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex-1 overflow-hidden flex flex-col">
        <div
          className="flex-1 overflow-hidden content-area relative flex flex-col"
          onMouseDown={onContainerMouseDown}
          ref={containerRef}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, null)}
        >
          {/* Selection Rectangle */}
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

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Icon
                icon="solar:refresh-bold"
                className="h-8 w-8 animate-spin text-muted-foreground"
              />
            </div>
          ) : filteredResults.length > 0 ? (
            /* Filtered Results View */
            <div className="flex-1 overflow-auto p-4 space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  Filtrelenmiş Dosyalar (
                  {filteredResults.reduce((acc, r) => acc + r.documents.length, 0)} dosya,{" "}
                  {filteredResults.length} mükellef)
                </h2>
              </div>
              {filteredResults.map((result) => (
                <div key={result.customer.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                    <Icon icon="solar:folder-bold" className="h-5 w-5 text-amber-400" />
                    <h3 className="font-medium">{result.customer.unvan}</h3>
                    <span className="text-xs text-muted-foreground ml-2">
                      {result.customer.vknTckn}
                    </span>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded ml-auto">
                      {result.documents.length} dosya
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {result.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer group"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/api/files/view?id=${doc.id}`, "_blank");
                        }}
                      >
                        <Icon
                          icon="solar:document-text-bold"
                          className="h-4 w-4 text-red-500 shrink-0"
                        />
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
          ) : items.length === 0 ? (
            /* Empty State */
            <div
              className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 cursor-pointer hover:opacity-80 transition-opacity select-none"
              onClick={(e) => {
                e.stopPropagation();
                onUploadClick();
              }}
            >
              <Icon
                icon="solar:upload-bold"
                className="h-16 w-16 mb-4 text-muted-foreground/50"
              />
              <p className="text-lg font-medium">Buraya dosya yüklemek için tıklayın</p>
              <p className="text-sm">veya dosyaları sürükleyin</p>
            </div>
          ) : (
            /* File Table */
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-background z-20 shadow-sm shadow-border/20">
                  <tr className="h-9 border-b text-xs font-medium text-muted-foreground select-none">
                    <th className="pl-4 pr-2 text-left font-medium w-auto min-w-[200px]">
                      Ad
                    </th>
                    <th className="w-[140px] px-4 text-left font-medium">
                      Şirket Türü
                    </th>
                    <th className="w-[160px] px-4 text-left font-medium">
                      Değiştirme tarihi
                    </th>
                    <th className="w-[120px] px-4 text-left font-medium">Tür</th>
                    <th className="w-[100px] pl-2 pr-4 text-right font-medium">
                      Boyut
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <DosyalarFileRow
                      key={item.id}
                      item={item}
                      isSelected={selection.has(item.id)}
                      isCut={
                        clipboard?.action === "cut" &&
                        clipboard.items.some((i) => i.id === item.id)
                      }
                      onClick={onItemClick}
                      onContextMenu={onItemContextMenu}
                      onDoubleClick={onDoubleClick}
                      onDragStart={onDragStart}
                      onDrop={onDrop}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ContextMenuTrigger>

      {/* Context Menu */}
      <ContextMenuContent className="w-64">
        {selection.size > 0 ? (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/20">
              {selection.size} öğe seçili
            </div>
            <ContextMenuItem onClick={onCopy}>
              <Icon icon="solar:copy-bold" className="h-4 w-4 mr-2" />
              Kopyala
            </ContextMenuItem>
            <ContextMenuItem onClick={onCut}>
              <Icon icon="solar:scissors-bold" className="h-4 w-4 mr-2" />
              Kes
            </ContextMenuItem>
            <ContextMenuSeparator />

            {selection.size === 1 && (
              <ContextMenuItem
                onClick={() => {
                  const item = getSelectedItem();
                  if (item) onRename(item);
                }}
              >
                <Icon icon="solar:pen-bold" className="h-4 w-4 mr-2" />
                Yeniden Adlandır
              </ContextMenuItem>
            )}

            {/* Color picker for folders */}
            {selection.size === 1 && getSelectedItem()?.isFolder && (
              <div className="p-2 border-t mt-1">
                <div className="flex items-center gap-1.5 mb-2 px-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  <Icon icon="solar:pallete-2-bold" className="h-3 w-3" />
                  Renk Değiştir
                </div>
                <div className="flex gap-2 px-1">
                  <button
                    onClick={() => onColorChange("blue")}
                    className="h-6 w-6 rounded-full bg-blue-500 hover:ring-2 ring-offset-2 ring-blue-500 transition-all border border-black/10 shadow-sm"
                    title="Mavi"
                  />
                  <button
                    onClick={() => onColorChange("yellow")}
                    className="h-6 w-6 rounded-full bg-amber-400 hover:ring-2 ring-offset-2 ring-amber-400 transition-all border border-black/10 shadow-sm"
                    title="Sarı"
                  />
                  <button
                    onClick={() => onColorChange("green")}
                    className="h-6 w-6 rounded-full bg-emerald-500 hover:ring-2 ring-offset-2 ring-emerald-500 transition-all border border-black/10 shadow-sm"
                    title="Yeşil"
                  />
                  <button
                    onClick={() => onColorChange(null)}
                    className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 hover:ring-2 ring-offset-2 ring-gray-400 transition-all border border-black/10 shadow-sm flex items-center justify-center text-[10px]"
                    title="Varsayılan"
                  >
                    <Icon
                      icon="solar:refresh-bold"
                      className="h-3 w-3 text-muted-foreground"
                    />
                  </button>
                </div>
              </div>
            )}

            <ContextMenuSeparator />
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/20">
              Sistem
            </div>
            <ContextMenuItem onClick={onRefresh}>
              <Icon icon="solar:refresh-bold" className="h-4 w-4 mr-2" />
              Yenile
            </ContextMenuItem>
            <ContextMenuItem onClick={onUploadClick}>
              <Icon icon="solar:upload-bold" className="h-4 w-4 mr-2" />
              Dosya Yükle
            </ContextMenuItem>
            <ContextMenuItem onClick={onDownload} disabled={allSelectedAreFolders}>
              <Icon icon="solar:download-bold" className="h-4 w-4 mr-2" />
              İndir
            </ContextMenuItem>
            <ContextMenuItem
              className="text-destructive border-t mt-1"
              onClick={onDelete}
            >
              <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4 mr-2" />
              Sil
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem onClick={onNewFolder}>
              <Icon icon="solar:folder-add-bold" className="h-4 w-4 mr-2" />
              Yeni Klasör
            </ContextMenuItem>
            <ContextMenuItem onClick={onRefresh}>
              <Icon icon="solar:refresh-bold" className="h-4 w-4 mr-2" />
              Yenile
            </ContextMenuItem>
            <ContextMenuItem onClick={onUploadClick}>
              <Icon icon="solar:upload-bold" className="h-4 w-4 mr-2" />
              Dosya Yükle
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={!clipboard} onClick={onPaste}>
              <Icon icon="solar:clipboard-bold" className="h-4 w-4 mr-2" />
              Yapıştır
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});
