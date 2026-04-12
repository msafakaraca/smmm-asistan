/**
 * Vergi Levhası PDF Önizleme Dialog
 * ===================================
 * blobUrl null olduğunda loading spinner gösterir.
 * Vergi levhası tek sayfa olduğundan iframe FitPage ile gösterilir.
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

export interface VergiLevhasiPdfData {
  blobUrl: string | null;
  customerName: string;
  onayZamani: string;
}

interface VergiLevhasiPdfDialogProps {
  data: VergiLevhasiPdfData | null;
  onClose: () => void;
}

export default function VergiLevhasiPdfDialog({ data, onClose }: VergiLevhasiPdfDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeError, setIframeError] = useState(false);

  const prevBlobUrl = useRef<string | null>(null);
  if (data?.blobUrl !== prevBlobUrl.current) {
    prevBlobUrl.current = data?.blobUrl ?? null;
    if (iframeError) setIframeError(false);
  }

  const handlePrint = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.print();
    } catch {
      if (data?.blobUrl) window.open(data.blobUrl, "_blank");
    }
  }, [data?.blobUrl]);

  const handleDownload = useCallback(() => {
    if (!data?.blobUrl) return;
    const a = document.createElement("a");
    a.href = data.blobUrl;
    a.download = `Vergi_Levhasi_${data.customerName.replace(/[/\\:*?"<>|]/g, "_")}.pdf`;
    a.click();
  }, [data]);

  const isLoading = !!data && !data.blobUrl;

  return (
    <Dialog open={!!data} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onEscapeKeyDown={onClose}
          onClick={(e: MouseEvent) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>
              Vergi Levhası - {data?.customerName}
            </DialogPrimitive.Title>
          </VisuallyHidden.Root>
          {/* Yatay PDF: oran ~4:3, genişlik 900px → yükseklik ~900*0.75=675px + header ~70px */}
          <div className="bg-background border rounded-lg shadow-xl flex flex-col w-full max-w-[900px] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
               style={{ height: "min(calc(min(900px, 100vw - 2rem) * 0.73 + 70px), 90vh)" }}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b px-4 py-3 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate">Vergi Levhası</h2>
                <p className="text-sm text-muted-foreground truncate">
                  {data?.customerName}
                </p>
                {data?.onayZamani && (
                  <p className="text-xs text-muted-foreground">
                    {data.onayZamani}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload} disabled={isLoading}>
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">İndir</span>
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint} disabled={isLoading}>
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Yazdır</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 ml-1" onClick={onClose}>
                  <X className="h-4 w-4" />
                  <span className="sr-only">Kapat</span>
                </Button>
              </div>
            </div>

            {/* PDF */}
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
                </div>
              ) : data?.blobUrl ? (
                <iframe
                  ref={iframeRef}
                  src={`${data.blobUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full border-0"
                  title="Vergi Levhası PDF Önizleme"
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
