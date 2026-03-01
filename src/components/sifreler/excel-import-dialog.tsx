"use client";

import { useState, useRef, useCallback } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import ExcelJS from "exceljs";

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "gib" | "sgk";
  onSuccess: () => void;
}

interface ParsedRow {
  vknTckn: string;
  [key: string]: string;
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  type,
  onSuccess,
}: ExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/sifreler/template?type=${type}`);
      if (!response.ok) {
        throw new Error("Şablon indirilemedi");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_sifre_sablonu.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Şablon indirme hatası:", error);
      toast.error("Şablon indirilirken bir hata oluştu");
    }
  };

  const parseExcelFile = useCallback(async (selectedFile: File) => {
    setLoading(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error("Dosyada yeterli veri yok");
      }

      // İlk satır başlık
      const headerRow = worksheet.getRow(1);
      const headers: Record<number, string> = {};
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value?.toString().toLowerCase().trim() || "";
      });

      if (Object.keys(headers).length === 0) {
        throw new Error("Dosyada yeterli veri yok");
      }

      const rows: ParsedRow[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Başlık satırını atla

        const parsedRow: ParsedRow = { vknTckn: "" };

        row.eachCell((cell, colNumber) => {
          const headerName = headers[colNumber] || "";
          const value = cell.value?.toString() || "";

          if (
            headerName === "vkn" ||
            headerName === "tckn" ||
            headerName === "vkn/tckn" ||
            headerName === "vkntckn"
          ) {
            parsedRow.vknTckn = value;
          } else if (type === "gib") {
            if (
              headerName === "kullanici kodu" ||
              headerName === "kullanicikodu" ||
              headerName === "gibkodu"
            ) {
              parsedRow.gibKodu = value;
            } else if (
              headerName === "sifre" ||
              headerName === "gibsifre" ||
              headerName === "parola"
            ) {
              parsedRow.gibSifre = value;
            }
          } else if (type === "sgk") {
            if (
              headerName === "kullanici adi" ||
              headerName === "kullaniciadi" ||
              headerName === "sgkkullaniciadi"
            ) {
              parsedRow.sgkKullaniciAdi = value;
            } else if (
              headerName === "isyeri kodu" ||
              headerName === "isyerikodu" ||
              headerName === "sgkisyerikodu"
            ) {
              parsedRow.sgkIsyeriKodu = value;
            } else if (
              headerName === "sistem sifresi" ||
              headerName === "sistemsifresi" ||
              headerName === "sgksistemsifresi"
            ) {
              parsedRow.sgkSistemSifresi = value;
            } else if (
              headerName === "isyeri sifresi" ||
              headerName === "isyerisifresi" ||
              headerName === "sgkisyerisifresi"
            ) {
              parsedRow.sgkIsyeriSifresi = value;
            }
          }
        });

        // VKN/TCKN olmayan satirlari atla
        if (parsedRow.vknTckn) {
          rows.push(parsedRow);
        }
      });

      if (rows.length === 0) {
        throw new Error("Geçerli veri bulunamadı");
      }

      setParsedData(rows);
      setFile(selectedFile);
      toast.success(`${rows.length} kayıt bulundu`);
    } catch (error) {
      console.error("Excel parse hatası:", error);
      toast.error(
        error instanceof Error ? error.message : "Dosya okunurken hata oluştu"
      );
      setFile(null);
      setParsedData([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      parseExcelFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const isExcel =
        droppedFile.name.endsWith(".xlsx") ||
        droppedFile.name.endsWith(".xls");
      if (isExcel) {
        parseExcelFile(droppedFile);
      } else {
        toast.error("Lütfen Excel dosyası (.xlsx, .xls) yükleyin");
      }
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setImporting(true);
    try {
      // API'nin beklediği formata dönüştür
      const updates = parsedData.map((row) => {
        if (type === "gib") {
          return {
            vknTckn: row.vknTckn,
            kullaniciKodu: row.gibKodu || undefined,
            sifre: row.gibSifre || undefined,
          };
        } else {
          return {
            vknTckn: row.vknTckn,
            kullaniciAdi: row.sgkKullaniciAdi || undefined,
            isyeriKodu: row.sgkIsyeriKodu || undefined,
            sistemSifresi: row.sgkSistemSifresi || undefined,
            isyeriSifresi: row.sgkIsyeriSifresi || undefined,
          };
        }
      });

      const response = await fetch("/api/sifreler/bulk-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type, updates }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "İçeri aktarma işlemi başarısız");
      }

      const result = await response.json();
      toast.success(result.message);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("İçeri aktarma hatası:", error);
      toast.error(
        error instanceof Error ? error.message : "İçeri aktarma sırasında hata oluştu"
      );
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setIsDragging(false);
    onOpenChange(false);
  };

  const getDialogTitle = () => {
    return type === "gib" ? "GİB Şifreleri Yükle" : "SGK Şifreleri Yükle";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="solar:file-download-bold" className="size-5 text-primary" />
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription>
            Excel dosyasından toplu şifre yükleme
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Şablon indirme */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Icon icon="solar:document-bold" className="size-5 text-muted-foreground" />
              <span className="text-sm">Excel şablon dosyası</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Icon icon="solar:download-bold" className="size-4 mr-2" />
              Şablonu İndir
            </Button>
          </div>

          {/* Dosya yükleme alanı */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <Icon
                  icon="solar:refresh-bold"
                  className="size-8 animate-spin text-primary"
                />
                <span className="text-sm text-muted-foreground">
                  Dosya okunuyor...
                </span>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-2">
                <Icon
                  icon="solar:file-check-bold"
                  className="size-8 text-green-600"
                />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {parsedData.length} kayıt bulundu
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Icon
                  icon="solar:upload-bold"
                  className="size-8 text-muted-foreground"
                />
                <span className="text-sm text-muted-foreground">
                  Excel dosyasını sürükleyin veya tıklayın
                </span>
                <span className="text-xs text-muted-foreground">
                  .xlsx veya .xls formatında
                </span>
              </div>
            )}
          </div>

          {/* Önizleme */}
          {parsedData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 border-b">
                <span className="text-sm font-medium">Önizleme (ilk 5 kayıt)</span>
              </div>
              <div className="max-h-40 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-3 py-2 text-left">VKN/TCKN</th>
                      {type === "gib" ? (
                        <>
                          <th className="px-3 py-2 text-left">Kullanıcı Kodu</th>
                          <th className="px-3 py-2 text-left">Şifre</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2 text-left">Kullanıcı Adı</th>
                          <th className="px-3 py-2 text-left">İşyeri Kodu</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((row, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="px-3 py-2">{row.vknTckn}</td>
                        {type === "gib" ? (
                          <>
                            <td className="px-3 py-2">{row.gibKodu || "-"}</td>
                            <td className="px-3 py-2">
                              {row.gibSifre ? "•••••" : "-"}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2">
                              {row.sgkKullaniciAdi || "-"}
                            </td>
                            <td className="px-3 py-2">
                              {row.sgkIsyeriKodu || "-"}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            İptal
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedData.length === 0 || importing}
          >
            {importing && (
              <Icon icon="solar:refresh-bold" className="size-4 animate-spin mr-2" />
            )}
            İçeri Aktar ({parsedData.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
