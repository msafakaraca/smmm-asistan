"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@iconify/react";

// Önerilen kolonlar
const ONERILEN_KOLONLAR = [
  { kod: "MUHTASAR", baslik: "Muhtasar", tip: "boolean" },
  { kod: "VERGITA", baslik: "Vergi Tahsil Alındısı", tip: "boolean" },
  { kod: "PUANTAJ", baslik: "Puantaj", tip: "boolean" },
  { kod: "RAPOR", baslik: "Rapor", tip: "boolean" },
  { kod: "EDEFTER", baslik: "E-Defter", tip: "boolean" },
  { kod: "BERAT", baslik: "Berat", tip: "boolean" },
  { kod: "SGK", baslik: "SGK", tip: "boolean" },
  { kod: "SONDUR", baslik: "Son Durum", tip: "boolean" },
  { kod: "NOTLAR", baslik: "Notlar", tip: "text" },
];

interface KolonEkleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (kolon: { kod: string; baslik: string; tip: string }) => void;
  mevcutKolonlar: string[];
}

// Türkçe karakterleri ve boşlukları temizleyip uppercase kod oluştur
function generateKod(baslik: string): string {
  return baslik
    .toUpperCase()
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/İ/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

export function KolonEkleModal({
  open,
  onOpenChange,
  onAdd,
  mevcutKolonlar,
}: KolonEkleModalProps) {
  const [baslik, setBaslik] = useState("");
  const [tip, setTip] = useState("boolean");

  // Mevcut olmayan önerilen kolonlar
  const kullanilabilirOneriler = ONERILEN_KOLONLAR.filter(
    (k) => !mevcutKolonlar.includes(k.kod)
  );

  const handleOneriliSec = (kolon: (typeof ONERILEN_KOLONLAR)[0]) => {
    onAdd(kolon);
    onOpenChange(false);
  };

  const handleOzelKolonEkle = () => {
    if (!baslik.trim()) return;

    const kod = generateKod(baslik);
    if (mevcutKolonlar.includes(kod)) {
      alert("Bu kolon zaten mevcut!");
      return;
    }

    onAdd({ kod, baslik: baslik.trim(), tip });
    setBaslik("");
    setTip("boolean");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Kolon Ekle</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Önerilen Kolonlar */}
          {kullanilabilirOneriler.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Önerilen Kolonlar
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {kullanilabilirOneriler.map((kolon) => (
                  <Button
                    key={kolon.kod}
                    variant="outline"
                    className="justify-start h-auto py-2 px-3"
                    onClick={() => handleOneriliSec(kolon)}
                  >
                    <Icon icon="solar:check-read-bold" className="h-4 w-4 mr-2 text-green-600 dark:text-green-500" />
                    <span className="text-sm">{kolon.baslik}</span>
                    <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                      {kolon.tip === "boolean" ? "Tik" : "Metin"}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Özel Kolon */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Özel Kolon Oluştur
            </Label>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="kolon-baslik" className="text-xs text-slate-500 dark:text-slate-400">
                  Kolon Adı
                </Label>
                <Input
                  id="kolon-baslik"
                  value={baslik}
                  onChange={(e) => setBaslik(e.target.value)}
                  placeholder="Örn: Banka Dekontu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kolon-tip" className="text-xs text-slate-500 dark:text-slate-400">
                  Kolon Tipi
                </Label>
                <Select value={tip} onValueChange={setTip}>
                  <SelectTrigger id="kolon-tip">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boolean">Tik (✓/✗/●)</SelectItem>
                    <SelectItem value="text">Metin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleOzelKolonEkle} disabled={!baslik.trim()}>
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
