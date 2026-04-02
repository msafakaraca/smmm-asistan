/**
 * DosyalarFileRow Component
 *
 * Memoized dosya/klasör satırı
 */

import { memo, useCallback } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import type { FileItem } from "./types";
import { normalizeSirketTipi, formatBytes } from "./types";

interface DosyalarFileRowProps {
  item: FileItem;
  isSelected: boolean;
  isCut: boolean;
  onClick: (e: React.MouseEvent, item: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
  onDoubleClick: (item: FileItem) => void;
  onDragStart: (e: React.DragEvent, item: FileItem) => void;
  onDrop: (e: React.DragEvent, folderId: string | null) => void;
}

// Format date like Windows Explorer: DD.MM.YYYY HH:mm
function formatDate(date: string | Date | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Get file type description
function getFileType(item: FileItem): string {
  if (item.isFolder) return "Dosya klasörü";
  const ext = item.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "PDF Belgesi";
    case "xlsx": case "xls": return "Excel Dosyası";
    case "docx": case "doc": return "Word Belgesi";
    case "png": case "jpg": case "jpeg": case "gif": return "Resim Dosyası";
    case "zip": case "rar": return "Sıkıştırılmış";
    default: return "Dosya";
  }
}

// Get file icon based on extension
function getFileIcon(item: FileItem): { icon: string; color: string } {
  if (item.isFolder) {
    const colors: Record<string, string> = {
      blue: "text-blue-500",
      yellow: "text-yellow-500",
      green: "text-emerald-500",
    };
    return {
      icon: "solar:folder-bold",
      color: item.color ? colors[item.color] || "text-yellow-500" : "text-yellow-500"
    };
  }

  const ext = item.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return { icon: "solar:document-text-bold", color: "text-red-500" };
    case "xlsx": case "xls":
      return { icon: "solar:document-text-bold", color: "text-green-600" };
    case "docx": case "doc":
      return { icon: "solar:document-text-bold", color: "text-blue-600" };
    case "png": case "jpg": case "jpeg": case "gif":
      return { icon: "solar:gallery-bold", color: "text-purple-500" };
    case "zip": case "rar":
      return { icon: "solar:zip-file-bold", color: "text-orange-500" };
    default:
      return { icon: "solar:document-text-bold", color: "text-blue-500" };
  }
}

export const DosyalarFileRow = memo(function DosyalarFileRow({
  item,
  isSelected,
  isCut,
  onClick,
  onContextMenu,
  onDoubleClick,
  onDragStart,
  onDrop,
}: DosyalarFileRowProps) {
  const { icon, color } = getFileIcon(item);

  // Tek tıklama — seçim
  const handleClick = useCallback((e: React.MouseEvent) => {
    onClick(e, item);
  }, [item, onClick]);

  // Çift tıklama — klasör navigasyonu / dosya açma (native event, re-render'dan bağımsız)
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onDoubleClick(item);
  }, [item, onDoubleClick]);

  return (
    <tr
      className={cn(
        "group hover:bg-muted/80 transition-colors select-none cursor-pointer",
        isSelected && "bg-blue-500/15 hover:bg-blue-500/20",
        isCut && "opacity-50"
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => onContextMenu(e, item)}
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDragOver={(e) => { if (item.isFolder) e.preventDefault(); }}
      onDrop={(e) => { if (item.isFolder) onDrop(e, item.id); }}
      data-file-item
      data-file-id={item.id}
    >
      {/* Name Column */}
      <td className="pl-4 pr-2 py-1.5 align-middle">
        <div className="flex items-center min-w-0 pointer-events-none">
          <div className="flex items-center justify-center shrink-0 w-6 mr-2">
            <Icon icon={icon} className={cn("h-5 w-5", color)} />
          </div>
          <span className="truncate text-sm font-medium" title={item.name}>
            {item.name}
          </span>
        </div>
      </td>

      {/* Şirket Türü */}
      <td className="w-[140px] px-4 py-1.5 align-middle">
        {item.isFolder && item.sirketTipi ? (() => {
          const normalized = normalizeSirketTipi(item.sirketTipi);
          return (
            <span className={cn(
              "text-xs px-2.5 py-0.5 rounded-full font-semibold shadow-sm inline-block whitespace-nowrap",
              normalized === "Firma" && "bg-gradient-to-r from-indigo-500 to-blue-600 text-white",
              normalized === "Şahıs" && "bg-gradient-to-r from-emerald-500 to-teal-600 text-white",
              normalized === "Basit Usul" && "bg-gradient-to-r from-orange-400 to-amber-500 text-white"
            )}>
              {normalized}
            </span>
          );
        })() : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>

      {/* Date */}
      <td className="w-[160px] px-4 py-1.5 text-xs text-muted-foreground whitespace-nowrap align-middle">
        {formatDate(item.updatedAt)}
      </td>

      {/* Type */}
      <td className="w-[120px] px-4 py-1.5 text-xs text-muted-foreground truncate align-middle">
        {getFileType(item)}
      </td>

      {/* Size */}
      <td className="w-[100px] pl-2 pr-4 py-1.5 text-xs text-muted-foreground text-right align-middle">
        {item.size && !item.isFolder ? formatBytes(item.size) : ""}
      </td>
    </tr>
  );
});
