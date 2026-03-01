"use client";

/**
 * SGK File Popover Component
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

interface SgkFilePopoverProps {
  customerId: string;
  year: number;
  month: number;
  type: "tahakkuk" | "hizmet" | "beyanname" | "muhsgk_tahakkuk";
  fileCount: number; // Dosya sayısı - önceden biliniyor
  children: React.ReactElement;
}

export function SgkFilePopover({
  customerId,
  year,
  month,
  type,
  fileCount,
  children,
}: SgkFilePopoverProps) {
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
      const res = await fetch(`/api/sgk-kontrol/customer-files?${params}`, {
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

    // Popover zaten açıksa kapat
    if (open) {
      setOpen(false);
      return;
    }

    // Dosya yoksa - popover aç ve "dosya bulunamadı" göster
    if (fileCount === 0) {
      setNoFiles(true);
      setFiles([]);
      setOpen(true);
      return;
    }

    // Tek dosya varsa - popover açmadan direkt PDF aç
    if (fileCount === 1) {
      // Önce yeni sekmeyi hemen aç (kullanıcı beklemez)
      const newWindow = window.open("about:blank", "_blank");

      try {
        const data = await fetchFiles();
        if (data.success && data.files && data.files.length > 0 && newWindow) {
          // Sekme açıkken URL'i güncelle
          newWindow.location.href = `/api/files/view?id=${data.files[0].id}`;
        } else if (newWindow) {
          newWindow.close();
        }
      } catch (error) {
        console.error("[SgkFilePopover] Dosya açılamadı:", error);
        if (newWindow) newWindow.close();
      }
      return;
    }

    // Birden fazla dosya - popover aç ve listele
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
      console.error("[SgkFilePopover] Dosyalar getirilemedi:", error);
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
              {files.length} dosya bulundu - birini seçin
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
