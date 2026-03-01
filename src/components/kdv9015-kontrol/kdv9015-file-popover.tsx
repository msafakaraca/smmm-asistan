"use client";

/**
 * KDV9015 File Popover Component
 *
 * Dosya linkine tiklandiginda:
 * - Tek dosya varsa: Direkt yeni sekmede acar
 * - Birden fazla dosya varsa: Popover ile secim sunar
 * - Dosya yoksa: "Dosya bulunamadi" mesaji gosterir
 *
 * type parametresi ile beyanname veya tahakkuk dosyalarini filtreler
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

interface Kdv9015FilePopoverProps {
  customerId: string;
  year: number;
  month: number;
  type: "tahakkuk" | "beyanname";
  fileCount: number;
  children: React.ReactElement;
}

export function Kdv9015FilePopover({
  customerId,
  year,
  month,
  type,
  fileCount,
  children,
}: Kdv9015FilePopoverProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [noFiles, setNoFiles] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchFiles = useCallback(async () => {
    // Önceki isteği iptal et
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Yeni AbortController oluştur
    abortControllerRef.current = new AbortController();

    const params = new URLSearchParams({
      customerId,
      year: year.toString(),
      month: month.toString(),
      type,
    });

    try {
      const res = await fetch(`/api/kdv9015-kontrol/customer-files?${params}`, {
        signal: abortControllerRef.current.signal,
      });
      const data = await res.json();
      return data;
    } catch (error) {
      // AbortError'ı ignore et
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }, [customerId, year, month, type]);

  const handleTriggerClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Popover zaten aciksa kapat
    if (open) {
      setOpen(false);
      return;
    }

    // Dosya yoksa - popover ac ve "dosya bulunamadi" goster
    if (fileCount === 0) {
      setNoFiles(true);
      setFiles([]);
      setOpen(true);
      return;
    }

    // Tek dosya varsa - popover acmadan direkt PDF ac
    if (fileCount === 1) {
      // Once yeni sekmeyi hemen ac (kullanici beklemez)
      const newWindow = window.open("about:blank", "_blank");

      try {
        const data = await fetchFiles();
        if (data.success && data.files && data.files.length > 0 && newWindow) {
          // Sekme acikken URL'i guncelle
          newWindow.location.href = `/api/files/view?id=${data.files[0].id}`;
        } else if (newWindow) {
          newWindow.close();
        }
      } catch (error) {
        console.error("[Kdv9015FilePopover] Dosya acilamadi:", error);
        if (newWindow) newWindow.close();
      }
      return;
    }

    // Birden fazla dosya - popover ac ve listele
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
      console.error("[Kdv9015FilePopover] Dosyalar getirilemedi:", error);
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

  // Cleanup - component unmount olduğunda fetch'i iptal et
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Children'a onClick ekle
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
              Yukleniyor...
            </span>
          </div>
        ) : noFiles || files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <FileX className="h-8 w-8 mb-2" />
            <span className="text-sm">Dosya bulunamadi</span>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground px-2 pb-1 border-b mb-1">
              {files.length} dosya bulundu - birini secin
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
