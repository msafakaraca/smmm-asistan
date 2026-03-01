/**
 * DosyalarToolbar Component
 *
 * Navigasyon, arama ve aksiyon butonları
 */

import { memo } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Breadcrumb } from "./types";

interface DosyalarToolbarProps {
  breadcrumbs: Breadcrumb[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchClear: () => void;
  onNavigate: (folderId: string | null) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onRefresh: () => void;
  onNewFolder: () => void;
  onToggleSidebar: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  showSidebar: boolean;
}

export const DosyalarToolbar = memo(function DosyalarToolbar({
  breadcrumbs,
  searchTerm,
  onSearchChange,
  onSearchClear,
  onNavigate,
  onGoBack,
  onGoForward,
  onGoUp,
  onRefresh,
  onNewFolder,
  onToggleSidebar,
  canGoBack,
  canGoForward,
  showSidebar,
}: DosyalarToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-2 border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Navigation & Breadcrumbs Container */}
      <div className="flex items-center flex-1 min-w-0 border border-border rounded-lg overflow-hidden">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 px-1 border-r border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onGoBack}
            disabled={!canGoBack}
            title="Geri"
          >
            <Icon icon="solar:alt-arrow-left-bold" className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onGoForward}
            disabled={!canGoForward}
            title="İleri"
          >
            <Icon icon="solar:alt-arrow-right-bold" className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onGoUp}
            disabled={breadcrumbs.length <= 1}
            title="Üst Klasör"
          >
            <Icon icon="solar:alt-arrow-up-bold" className="h-4 w-4" />
          </Button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm overflow-hidden flex-1 min-w-0 px-3 py-1.5">
          {/* Mükellefler Home Button */}
          <button
            onClick={() => onNavigate(null)}
            className="flex items-center gap-1.5 hover:text-primary transition-colors shrink-0 font-medium"
            title="Mükelleflere dön"
          >
            <Icon icon="solar:home-bold" className="h-4 w-4" />
            <span>Mükellefler</span>
          </button>

          {/* Breadcrumb Items */}
          {breadcrumbs.map((crumb) => (
            <div key={crumb.id ?? "root"} className="flex items-center min-w-0">
              <Icon icon="solar:alt-arrow-right-linear" className="h-3 w-3 mx-1 text-muted-foreground shrink-0" />
              <button
                onClick={() => onNavigate(crumb.id)}
                className="hover:text-primary hover:underline truncate max-w-[150px] text-left"
                title={crumb.name}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative w-64 shrink-0">
        <Icon icon="solar:magnifer-bold" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Ara..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 pr-8 h-9"
        />
        {searchTerm && (
          <button
            onClick={onSearchClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Temizle"
          >
            <Icon icon="solar:close-circle-bold" className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <Button variant="outline" size="sm" onClick={onNewFolder}>
        <Icon icon="solar:folder-add-bold" className="h-4 w-4 mr-2" />
        Yeni Klasör
      </Button>

      <Button
        variant={showSidebar ? "default" : "outline"}
        size="sm"
        onClick={onToggleSidebar}
        className={showSidebar ? "bg-primary text-primary-foreground" : ""}
      >
        <Icon icon="solar:filter-bold" className="h-4 w-4 mr-2" />
        Filtrele
      </Button>

      <Button variant="outline" size="sm" onClick={onRefresh}>
        <Icon icon="solar:refresh-bold" className="h-4 w-4 mr-2" />
        Yenile
      </Button>
    </div>
  );
});
