"use client";

import { useState, memo } from "react";
import { Icon } from "@iconify/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TakipKolon {
  id: string;
  kod: string;
  baslik: string;
  tip: string;
  siraNo: number;
  aktif: boolean;
  sistem: boolean;
}

interface KolonHeaderProps {
  kolon: TakipKolon;
  onUpdate: (data: Partial<TakipKolon>) => void;
  onDelete: () => void;
}

export const KolonHeader = memo(function KolonHeader({ kolon, onUpdate, onDelete }: KolonHeaderProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [baslik, setBaslik] = useState(kolon.baslik);

  const handleSaveEdit = () => {
    if (baslik.trim()) {
      onUpdate({ baslik: baslik.trim() });
      setEditOpen(false);
    }
  };

  const handleDelete = () => {
    onDelete();
    setDeleteOpen(false);
  };

  return (
    <>
      <th className="border-x border-slate-300 dark:border-slate-600 px-2 py-2 bg-slate-100 dark:bg-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap">
        <div className="flex items-center justify-center gap-1">
          <span>{kolon.baslik}</span>
          {!kolon.sistem && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded opacity-50 hover:opacity-100 transition-opacity">
                  <Icon icon="solar:settings-bold" className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Icon icon="solar:pen-bold" className="h-4 w-4 mr-2" />
                  Düzenle
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                >
                  <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4 mr-2" />
                  Sil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </th>

      {/* Düzenleme Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Kolon Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="baslik">Kolon Başlığı</Label>
              <Input
                id="baslik"
                value={baslik}
                onChange={(e) => setBaslik(e.target.value)}
                placeholder="Kolon başlığı"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSaveEdit}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme Onay Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Kolonu Sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400 py-4">
            <strong>&quot;{kolon.baslik}&quot;</strong> kolonunu silmek
            istediğinize emin misiniz? Bu işlem geri alınamaz.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
