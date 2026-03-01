/**
 * FolderDialog Components
 *
 * Yeni klasör, yeniden adlandırma ve silme dialogları
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Yeni Klasör Dialog
interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => Promise<boolean>;
}

export function NewFolderDialog({
  open,
  onOpenChange,
  onConfirm,
}: NewFolderDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const success = await onConfirm(name.trim());
    setLoading(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Klasör Oluştur</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Klasör Adı"
          autoFocus
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            İptal
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !name.trim()}>
            {loading ? "Oluşturuluyor..." : "Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Yeniden Adlandırma Dialog
interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onConfirm: (newName: string) => Promise<boolean>;
}

export function RenameDialog({
  open,
  onOpenChange,
  currentName,
  onConfirm,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName(currentName);
    }
  }, [open, currentName]);

  const handleConfirm = async () => {
    if (!name.trim() || name === currentName) return;
    setLoading(true);
    const success = await onConfirm(name.trim());
    setLoading(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeniden Adlandır</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Yeni İsim"
          autoFocus
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            İptal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !name.trim() || name === currentName}
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Silme Dialog
interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  onConfirm: () => Promise<boolean>;
}

export function DeleteDialog({
  open,
  onOpenChange,
  itemCount,
  onConfirm,
}: DeleteDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    const success = await onConfirm();
    setLoading(false);
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Silme İşlemi</DialogTitle>
          <DialogDescription>
            {itemCount} öğeyi silmek istediğinize emin misiniz?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            İptal
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Siliniyor..." : "Evet, Sil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
