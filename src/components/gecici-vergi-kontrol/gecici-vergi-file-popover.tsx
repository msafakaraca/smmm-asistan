"use client";

/**
 * Geçici Vergi File Popover Component
 *
 * Dosya linkine tıklandığında:
 * - Tek dosya varsa: Direkt yeni sekmede açar
 * - Birden fazla dosya varsa: Popover ile seçim sunar
 * - Dosya yoksa: "Dosya bulunamadı" mesajı gösterir
 */

import { useState, useCallback, useRef, useEffect, cloneElement, isValidElement } from "react";
import { Loader2, FileX } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FileInfo {
  id: string;
  name: string;
}

interface GeciciVergiFilePopoverProps {
  customerId: string;
  year: number;
  month: number;
  fileCount: number;
  fileCategory?: "TAHAKKUK" | "BEYANNAME";
  beyannameTuru: string; // "GGECICI" veya "KGECICI"
  children: React.ReactElement;
}

export function GeciciVergiFilePopover({
  customerId,
  year,
  month,
  fileCount,
  fileCategory = "TAHAKKUK",
  beyannameTuru,
  children,
}: GeciciVergiFilePopoverProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [noFiles, setNoFiles] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchFiles = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    const params = new URLSearchParams({
      customerId,
      year: year.toString(),
      month: month.toString(),
      fileCategory,
      beyannameTuru,
    });

    try {
      const res = await fetch(`/api/gecici-vergi-kontrol/customer-files?${params}`, {
        signal: abortControllerRef.current.signal,
      });
      const data = await res.json();
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }, [customerId, year, month, fileCategory, beyannameTuru]);

  const handleTriggerClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (open) {
      setOpen(false);
      return;
    }

    if (fileCount === 0) {
      setNoFiles(true);
      setFiles([]);
      setOpen(true);
      return;
    }

    if (fileCount === 1) {
      const newWindow = window.open("about:blank", "_blank");

      try {
        const data = await fetchFiles();
        if (data.success && data.files && data.files.length > 0 && newWindow) {
          newWindow.location.href = `/api/files/view?id=${data.files[0].id}`;
        } else if (newWindow) {
          newWindow.close();
        }
      } catch (error) {
        console.error("[GeciciVergiFilePopover] Dosya açılamadı:", error);
        if (newWindow) newWindow.close();
      }
      return;
    }

    setLoading(true);
    setOpen(true);
    setNoFiles(false);

    try {
      const data = await fetchFiles();
      if (data.success && data.files && data.files.length > 0) {
        setFiles(data.files);
      } else {
        setNoFiles(true);
        setFiles([]);
      }
    } catch (error) {
      console.error("[GeciciVergiFilePopover] Dosyalar getirilemedi:", error);
      setNoFiles(true);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [open, fileCount, fetchFiles]);

  const handleFileClick = useCallback((fileId: string) => {
    window.open(`/api/files/view?id=${fileId}`, "_blank");
    setOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        onClick: handleTriggerClick,
      } as React.HTMLAttributes<HTMLElement>)
    : children;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="center" sideOffset={5}>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Yükleniyor...
            </span>
          </div>
        ) : noFiles || files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <FileX className="h-8 w-8 mb-2" />
            <span className="text-sm">Dosya bulunamadı</span>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground px-2 pb-1 border-b mb-1">
              {fileCategory === "BEYANNAME" ? "Beyanname" : "Tahakkuk"} - {files.length} dosya bulundu
            </p>
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => handleFileClick(file.id)}
                className="w-full text-left px-2 py-1.5 hover:bg-muted rounded text-sm transition-colors truncate"
                title={file.name}
              >
                {file.name}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
