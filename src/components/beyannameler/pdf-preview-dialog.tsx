/**
 * PDF Önizleme Dialog
 * ====================
 * Beyanname PDF'lerini sayfa içi dialog'da görüntüler.
 * blobUrl null olduğunda loading spinner gösterir (anında açılma desteği).
 */

"use client";

import { useCallback, useRef, useState, type MouseEvent } from "react";
import { X, Printer, Download, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";

export interface PdfPreviewData {
  blobUrl: string | null;
  turAdi: string;
  donem: string;
  customerName: string;
}

interface PdfPreviewDialogProps {
  data: PdfPreviewData | null;
  onClose: () => void;
}

export default function PdfPreviewDialog({ data, onClose }: PdfPreviewDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeError, setIframeError] = useState(false);

  // Dialog açılırken error state'i sıfırla
  const prevBlobUrl = useRef<string | null>(null);
  if (data?.blobUrl !== prevBlobUrl.current) {
    prevBlobUrl.current = data?.blobUrl ?? null;
    if (iframeError) setIframeError(false);
  }

  const handlePrint = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.print();
    } catch {
      // Cross-origin durumunda fallback
      if (data?.blobUrl) window.open(data.blobUrl, "_blank");
    }
  }, [data?.blobUrl]);

  const handleDownload = useCallback(() => {
    if (!data?.blobUrl) return;
    const a = document.createElement("a");
    a.href = data.blobUrl;
    a.download = `${data.turAdi.replace(/[/\\:*?"<>|]/g, "_")} - ${data.donem}.pdf`;
    a.click();
  }, [data]);

  const isLoading = !!data && !data.blobUrl;

  return (
    <Dialog open={!!data} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
          onEscapeKeyDown={onClose}
          onClick={(e: MouseEvent) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>
              {data?.turAdi || "Beyanname"} - PDF Önizleme
            </DialogPrimitive.Title>
          </VisuallyHidden.Root>
          <div className="bg-background border rounded-lg shadow-xl flex flex-col w-full h-full max-w-[900px] max-h-[90vh] md:max-h-[90vh] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b px-4 py-3 shrink-0">
              {/* Sol: Bilgiler */}
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate">
                  {data?.turAdi || "Beyanname"}
                </h2>
                <p className="text-sm text-muted-foreground truncate">
                  {data?.customerName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data?.donem}
                </p>
              </div>

              {/* Sag: Butonlar */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleDownload}
                  disabled={isLoading}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">İndir</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handlePrint}
                  disabled={isLoading}
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Yazdır</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 ml-1"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Kapat</span>
                </Button>
              </div>
            </div>

            {/* PDF Görüntüleyici / Loading / Hata */}
            <div className="flex-1 min-h-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">PDF yükleniyor...</p>
                </div>
              ) : iframeError ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                  <p className="text-sm font-medium">PDF görüntülenemedi</p>
                  <p className="text-xs text-center max-w-sm">
                    Dosya bozuk olabilir veya tarayıcınız bu PDF&apos;i görüntüleyemiyor.
                    İndirmeyi deneyin.
                  </p>
                </div>
              ) : data?.blobUrl ? (
                <iframe
                  ref={iframeRef}
                  src={`${data.blobUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full border-0"
                  title="Beyanname PDF Önizleme"
                  onError={() => setIframeError(true)}
                />
              ) : null}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
