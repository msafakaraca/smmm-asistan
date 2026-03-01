/**
 * DosyalarFooter Component
 *
 * Alt bilgi çubuğu - seçim sayısı, pano durumu ve aksiyon butonları
 */

import { memo } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import type { ClipboardState, FileItem } from "./types";

interface DosyalarFooterProps {
  itemCount: number;
  selection: Set<string>;
  clipboard: ClipboardState | null;
  items: FileItem[];

  // Actions
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export const DosyalarFooter = memo(function DosyalarFooter({
  itemCount,
  selection,
  clipboard,
  items,
  onCut,
  onCopy,
  onPaste,
  onDownload,
  onDelete,
}: DosyalarFooterProps) {
  // Check if all selected items are folders
  const allSelectedAreFolders = Array.from(selection).every(
    id => items.find(i => i.id === id)?.isFolder
  );

  return (
    <div className="flex items-center justify-between bg-background h-12 px-3 select-none text-xs font-medium border-t">
      {/* Left side - Info */}
      <div className="flex items-center gap-4 text-muted-foreground">
        <span className="text-sm text-foreground">{itemCount} öğe</span>
        {selection.size > 0 && (
          <span className="text-foreground border-l pl-4 dark:border-gray-700">
            {selection.size} öğe seçili
          </span>
        )}
        {clipboard && clipboard.items.length > 0 && (
          <span className="text-foreground border-l pl-4 dark:border-gray-700">
            {clipboard.items.length} öğe panoda
          </span>
        )}
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-1">
        {selection.size > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs hover:bg-muted"
              onClick={onCut}
            >
              <Icon icon="solar:scissors-bold" className="h-4 w-4 mr-2" />
              Kes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs hover:bg-muted"
              onClick={onCopy}
            >
              <Icon icon="solar:copy-bold" className="h-4 w-4 mr-2" />
              Kopyala
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs hover:bg-muted"
              onClick={onDownload}
              disabled={allSelectedAreFolders}
            >
              <Icon icon="solar:download-bold" className="h-4 w-4 mr-2" />
              İndir
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4 mr-2" />
              Sil
            </Button>
          </>
        )}
        {clipboard && clipboard.items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs hover:bg-muted"
            onClick={onPaste}
          >
            <Icon icon="solar:clipboard-bold" className="h-4 w-4 mr-2" />
            Yapıştır
          </Button>
        )}
      </div>
    </div>
  );
});
