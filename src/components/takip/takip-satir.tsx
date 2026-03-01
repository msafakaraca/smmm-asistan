"use client";

import { memo, useState } from "react";
import { Icon } from "@iconify/react";

// Custom Check icon for specific styling needs
const CheckIcon = ({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = ({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

import { BooleanCell, cycleBoolean } from "./boolean-cell";
import { cn } from "@/lib/utils";
import { extractCellData } from "@/lib/takip-utils";

interface TakipKolon {
  id: string;
  kod: string;
  baslik: string;
  tip: string;
  siraNo: number;
  aktif: boolean;
  sistem: boolean;
}

interface TakipSatir {
  id: string;
  no: string;
  isim: string;
  siraNo: number;
  degerler: Record<string, unknown>;
}

interface TakipSatirRowProps {
  satir: TakipSatir;
  kolonlar: TakipKolon[];
  onUpdate: (id: string, data: Partial<TakipSatir>) => void;
  onDelete: (id: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export const TakipSatirRow = memo(function TakipSatirRow({
  satir,
  kolonlar,
  onUpdate,
  onDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: TakipSatirRowProps) {
  const [localIsim, setLocalIsim] = useState(satir.isim);

  // Boolean kolonlara tıklama
  const handleCellClick = (kolonKod: string) => {
    const cellData = extractCellData(satir.degerler[kolonKod]);
    const currentValue = cellData.value as boolean | null;
    const newValue = cycleBoolean(currentValue);
    // Sadece değeri gönder, API metadata'yı ekleyecek
    onUpdate(satir.id, {
      degerler: { [kolonKod]: newValue },
    });
  };

  // Metin değişikliği
  const handleTextChange = (kolonKod: string, value: string) => {
    onUpdate(satir.id, {
      degerler: { [kolonKod]: value },
    });
  };

  // İsim blur
  const handleIsimBlur = () => {
    if (localIsim !== satir.isim) {
      onUpdate(satir.id, { isim: localIsim });
    }
  };

  // Aktif ve sistem olmayan kolonlari filtrele
  const dinamikKolonlar = kolonlar.filter((k) => !k.sistem && k.aktif);

  // Son Durum değeri (metadata destekli) - 3 durum
  const sonDurumData = extractCellData(satir.degerler["SONDUR"]);
  const sonDurumTamam = sonDurumData.value === true;
  const sonDurumIptal = sonDurumData.value === false;

  // Son Durum toggle: 3-state cycle (null → true → false → null)
  const handleSonDurumToggle = () => {
    const currentValue = sonDurumData.value as boolean | null;
    const newValue = cycleBoolean(currentValue);
    onUpdate(satir.id, {
      degerler: { SONDUR: newValue },
    });
  };

  return (
    <tr className={cn(
      "group transition-colors duration-200 takip-row border-b border-slate-200 dark:border-slate-600",
      sonDurumTamam
        ? "bg-emerald-100 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40"
        : sonDurumIptal
        ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
        : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50"
    )}>
      {/* Checkbox - Selection Mode */}
      {isSelectionMode && (
        <td className="border-x border-slate-300 dark:border-slate-600 p-2 w-10 text-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </td>
      )}
      {/* NO - Read Only (Mükellef listesinden düzenlenir) */}
      <td className="border-x border-slate-300 dark:border-slate-600 p-0 w-12">
        <span className="block w-full h-full px-2 py-1.5 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
          {satir.no || "-"}
        </span>
      </td>

      {/* İSİM/ÜNVAN */}
      <td className="border-x border-slate-300 dark:border-slate-600 p-0 min-w-[200px] max-w-[250px]">
        <input
          type="text"
          value={localIsim}
          onChange={(e) => setLocalIsim(e.target.value)}
          onBlur={handleIsimBlur}
          title={localIsim}
          className="w-full h-full px-2 py-1.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-200 bg-transparent outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-1 focus:ring-indigo-500 truncate"
        />
      </td>

      {/* Dinamik Kolonlar */}
      {dinamikKolonlar.map((kolon) => {
        const cellData = extractCellData(satir.degerler[kolon.kod]);

        return kolon.tip === "boolean" ? (
          <BooleanCell
            key={kolon.id}
            value={cellData.value as boolean | null}
            onClick={() => handleCellClick(kolon.kod)}
            metadata={cellData.metadata}
          />
        ) : (
          <td key={kolon.id} className="border-x border-slate-300 dark:border-slate-600 p-0">
            <input
              type="text"
              defaultValue={(cellData.value as string) ?? ""}
              onBlur={(e) => handleTextChange(kolon.kod, e.target.value)}
              className="w-full h-full px-2 py-1.5 text-center text-xs text-slate-700 dark:text-slate-300 bg-transparent outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-1 focus:ring-indigo-500"
              placeholder="..."
            />
          </td>
        );
      })}

      {/* Son Durum - 3 durumlu: Tamam (yeşil), İptal (amber), Bekliyor (boş) */}
      <td className={cn(
        "border-x border-slate-300 dark:border-slate-600 p-1 text-center",
        sonDurumTamam && "bg-emerald-100 dark:bg-emerald-900/30",
        sonDurumIptal && "bg-amber-100 dark:bg-amber-900/30"
      )}>
        <button
          onClick={handleSonDurumToggle}
          className={cn(
            "w-4 h-4 rounded border flex items-center justify-center transition-all mx-auto",
            sonDurumTamam
              ? "bg-emerald-600 border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500"
              : sonDurumIptal
              ? "bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-600"
              : "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-500 hover:border-emerald-400 dark:hover:border-emerald-500"
          )}
        >
          {sonDurumTamam && <CheckIcon className="w-3 h-3 text-white" strokeWidth={3} />}
          {sonDurumIptal && <XIcon className="w-3 h-3 text-white" strokeWidth={3} />}
        </button>
      </td>

      {/* Sil butonu */}
      <td
        className={cn(
          "border-x border-slate-300 dark:border-slate-600 p-1 w-10 bg-white dark:bg-slate-800",
          "opacity-0 group-hover:opacity-100 transition-opacity"
        )}
      >
        <button
          onClick={() => onDelete(satir.id)}
          className="w-full h-full flex items-center justify-center text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          title="Satırı Sil"
        >
          <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
});
