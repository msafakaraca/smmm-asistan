/**
 * ÖKC Bildirim Sorgulama Client Component
 * =========================================
 * Mükellef seçimi, dönem seçimi, ÖKC bildirim sorgulama, sonuç tablosu ve detay dialog.
 * Detay bilgisi ayrı API çağrısı gerektirmez — liste ile birlikte gelir.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  Cpu,
  Loader2,
  AlertTriangle,
  Search,
  Download,
  FileText,
  X,
  ExternalLink,
  ChevronsUpDown,
  Check,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOkcQuery } from "./hooks/use-okc-query";
import type { OkcBildirim, OkcMeta } from "./hooks/use-okc-query";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Customer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  hasGibCredentials: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

/** Beyanname dönem kuralı: bir önceki ay */
function getDefaultPeriod() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  let previousMonth = currentMonth - 1;
  let previousYear = currentYear;
  if (previousMonth === 0) {
    previousMonth = 12;
    previousYear = currentYear - 1;
  }
  return {
    ay: String(previousMonth).padStart(2, "0"),
    yil: String(previousYear),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Sayı parse: hem "23139.76" (standart) hem "23.139,76" (TR) formatını destekler */
function parseNumber(val: string): number {
  if (!val || val === "0") return 0;
  if (val.includes(",")) {
    return parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return parseFloat(val) || 0;
}

function formatCurrency(value: string): string {
  if (value.includes(",")) return value;
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Sayıyı TR para formatına çevir */
function formatNum(val: number): string {
  return val.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Excel Export
// ═══════════════════════════════════════════════════════════════════════════

function exportToExcel(bildirimler: OkcBildirim[], customerName: string, meta: OkcMeta | null) {
  if (bildirimler.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const rows: string[][] = [
    ["#", "Firma Kodu", "Firma Adı", "ÖKC Markası", "ÖKC Modeli", "Cihaz Sicil No", "Bildirim Zamanı", "Bildirim Yöntemi"],
  ];

  for (let i = 0; i < bildirimler.length; i++) {
    const b = bildirimler[i];
    rows.push([
      String(i + 1),
      b.firmaKodu,
      b.firmaAdi,
      b.marka,
      b.model,
      b.sicilNo,
      b.bildirimTarih,
      b.bildirimYontem,
    ]);
  }

  // Toplam satırı
  if (meta) {
    rows.push(["", "", "", "", "", "", `Toplam: ${meta.toplamKayit} kayıt`, ""]);
  }

  const BOM = "\uFEFF";
  const csv = BOM + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `okc-bildirimler-${customerName.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("ÖKC bildirim bilgileri dışa aktarıldı");
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Export
// ═══════════════════════════════════════════════════════════════════════════

/** Dialog ile birebir aynı yapıda detay satırlarını döndürür (sadece sıfır olmayan kalemler) */
function getOkcDetayRows(d: OkcBildirim["detayBilgi"]): { section: string; rows: { label: string; value: string }[] }[] {
  const toplamSatis = parseNumber(d.satisKdv0) + parseNumber(d.satisKdv20);
  const result: { section: string; rows: { label: string; value: string }[] }[] = [];

  // Aylık Satış ve KDV Bilgileri — Toplam Satış ve Toplam KDV her zaman gösterilir
  const kdvRows: { label: string; value: string }[] = [];
  if (parseNumber(d.satisKdv0) !== 0) kdvRows.push({ label: "%0 KDV'li Satışlar", value: formatNum(parseNumber(d.satisKdv0)) });
  if (parseNumber(d.satisKdv20) !== 0) kdvRows.push({ label: "%20 KDV'li Satışlar", value: formatNum(parseNumber(d.satisKdv20)) });
  kdvRows.push({ label: "Toplam Satış", value: formatNum(toplamSatis) });
  kdvRows.push({ label: "Toplam KDV", value: formatNum(parseNumber(d.kdvToplam)) });
  result.push({ section: "Aylık Satış ve KDV Bilgileri", rows: kdvRows });

  // Belge Türlerine Göre Satış Tutarları
  const belgeItems: [string, string][] = [
    ["ÖKC Fişleri", d.okcfistutartutar],
    ["Faturalar", d.faturatutartutar],
    ["Serbest Meslek Makbuzları", d.smmtutartutar],
    ["Müstahsil Makbuzları", d.muhtasiltutartutar],
    ["Giriş/Yolcu Biletleri", d.gybilettutartutar],
    ["Gider Pusulaları", d.gpusulatutartutar],
  ];
  const belgeRows = belgeItems.filter(([, v]) => parseNumber(v) !== 0).map(([l, v]) => ({ label: l, value: formatNum(parseNumber(v)) }));
  if (belgeRows.length > 0) result.push({ section: "Belge Türlerine Göre Satış Tutarları (KDV Dahil)", rows: belgeRows });

  // Ödeme Türlerine Göre Satış Tutarları
  const odemeItems: [string, string][] = [
    ["Nakit", d.nakitodemetutar],
    ["Banka/Kredi Kartı", d.bkkartodemetutar],
    ["Yemek Kartı/Çeki", d.yemekkcodemetutar],
    ["Diğer", d.digerodemetutar],
  ];
  const odemeRows = odemeItems.filter(([, v]) => parseNumber(v) !== 0).map(([l, v]) => ({ label: l, value: formatNum(parseNumber(v)) }));
  if (odemeRows.length > 0) result.push({ section: "Ödeme Türlerine Göre Satış Tutarları", rows: odemeRows });

  // Bilgi Fişleri Tutar ve Adet Bilgileri
  const fisItems: [string, string, string][] = [
    ["Fatura Bilgi Fişi", d.faturabfistutar, d.faturabfisadet],
    ["Yemek Kartı Bilgi Fişi", d.yemekkcbfistutar, d.yemekkcbfisadet],
    ["Avans Bilgi Fişi", d.avansbfistutar, d.avansbfisadet],
    ["Fatura Tahsilatı", d.faturatahsilatbfistutar, d.faturatahsilatbfisadet],
    ["Otopark Giriş", d.otoparkbfistutar, d.otoparkbfisadet],
    ["Cari Hesap Tahsilatı", d.carihesapbfistutar, d.carihesapbfisadet],
    ["Diğer", d.digerbfistutar, d.digerbfisadet],
  ];
  const fisRows = fisItems.filter(([, t, a]) => parseNumber(t) !== 0 || parseNumber(a) !== 0).map(([l, t, a]) => ({ label: l, value: `${formatNum(parseNumber(t))}  (${a} adet)` }));
  if (fisRows.length > 0) result.push({ section: "Bilgi Fişleri Tutar ve Adet Bilgileri", rows: fisRows });

  return result;
}

async function exportToPdf(
  bildirimler: OkcBildirim[],
  customerName: string,
  meta: OkcMeta | null
) {
  if (bildirimler.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const fontName = { current: "helvetica" };

  // Türkçe karakter destekli Roboto fontunu yükle
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch("/fonts/Roboto-Regular.ttf"),
      fetch("/fonts/Roboto-Bold.ttf"),
    ]);
    const [regularBuf, boldBuf] = await Promise.all([
      regularRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ]);

    const toBase64 = (buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    doc.addFileToVFS("Roboto-Regular.ttf", toBase64(regularBuf));
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", toBase64(boldBuf));
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto");
    fontName.current = "Roboto";
  } catch {
    doc.setFont("helvetica");
  }

  // Başlık
  doc.setFontSize(14);
  doc.text("ÖKC Aylık Satış Rapor Bildirimleri", 14, 15);

  // Meta bilgileri
  doc.setFontSize(9);
  doc.text(`Mükellef: ${customerName}`, 14, 22);
  if (meta) {
    const ayAdi = MONTHS_TR[parseInt(meta.ay, 10) - 1] || meta.ay;
    doc.text(`Dönem: ${ayAdi} ${meta.yil}`, 14, 27);
    doc.text(`Toplam Kayıt: ${meta.toplamKayit}`, 140, 22);
  }

  // Ana liste tablosu
  const headRow = ["#", "Firma Kodu", "Firma Adı", "Marka", "Model", "Sicil No", "Bildirim Zamanı", "Yöntem"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bodyRows: any[][] = bildirimler.map((b, i) => [
    String(i + 1),
    b.firmaKodu,
    b.firmaAdi,
    b.marka,
    b.model,
    b.sicilNo,
    b.bildirimTarih,
    b.bildirimYontem,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoTable(doc, {
    head: [headRow],
    body: bodyRows,
    startY: 32,
    theme: "grid",
    margin: { left: 14, right: 14 },
    styles: {
      font: fontName.current,
      fontSize: 7,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
    },
    headStyles: {
      font: fontName.current,
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
    },
    tableWidth: "auto",
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 20, halign: "center" },
      2: { halign: "left" },
      3: { cellWidth: 30, halign: "center" },
      4: { cellWidth: 25, halign: "center" },
      5: { cellWidth: 30, halign: "center" },
      6: { cellWidth: 40, halign: "center" },
      7: { cellWidth: 30, halign: "center" },
    },
  } as never);

  // Her ÖKC için detay sayfası — dialog ile birebir aynı yapı
  const pageW = doc.internal.pageSize.getWidth();
  const marginLeft = 14;
  const marginRight = 14;
  const usableW = pageW - marginLeft - marginRight;

  for (let idx = 0; idx < bildirimler.length; idx++) {
    const b = bildirimler[idx];
    const sections = getOkcDetayRows(b.detayBilgi);

    // Yeni sayfa
    doc.addPage();
    doc.setFont(fontName.current, "bold");
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("ÖKC Aylık Satış Rapor Bildirimi", marginLeft, 15);

    // Cihaz bilgileri
    doc.setFont(fontName.current, "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(
      `Firma Kodu: ${b.firmaKodu}    Sicil No: ${b.sicilNo}    Rapor No: ${b.detayBilgi.aylikSatisRaporNo}`,
      marginLeft,
      22,
    );

    // Tablo body oluştur — her bölüm için başlık satırı + veri satırları
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableBody: any[][] = [];

    for (const section of sections) {
      // Bölüm başlığı
      tableBody.push([
        {
          content: section.section,
          colSpan: 2,
          styles: {
            fontStyle: "bold",
            fillColor: [230, 240, 250],
            textColor: [41, 128, 185],
            fontSize: 7.5,
            cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
          },
        },
      ]);
      // Veri satırları
      for (const row of section.rows) {
        tableBody.push([row.label, row.value]);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoTable(doc, {
      body: tableBody,
      startY: 27,
      theme: "striped",
      margin: { left: marginLeft, right: marginRight },
      tableWidth: usableW,
      styles: {
        font: fontName.current,
        fontSize: 7.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
        textColor: [40, 40, 40],
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "right", fontStyle: "bold" },
      },
    } as never);
  }

  // Altbilgi — tüm sayfalara
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Sayfa ${i} / ${pageCount} - Oluşturulma: ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR")}`,
      14,
      doc.internal.pageSize.getHeight() - 7,
    );
  }

  const safeName = customerName.replace(/\s+/g, "_");
  doc.save(`OKC_Bildirimleri_${safeName}.pdf`);
  toast.success("PDF olarak indirildi");
}

// ═══════════════════════════════════════════════════════════════════════════
// Detay Dialog Bileşeni
// ═══════════════════════════════════════════════════════════════════════════

function DetayRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 even:bg-muted/30 rounded-sm">
      <span className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? "font-semibold" : ""}`}>{formatCurrency(value)}</span>
    </div>
  );
}

function DetayAdetRow({ label, tutar, adet }: { label: string; tutar: string; adet: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 even:bg-muted/30 rounded-sm">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm tabular-nums">
        {formatCurrency(tutar)} <span className="text-xs text-muted-foreground">({adet} adet)</span>
      </span>
    </div>
  );
}

function DetaySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-primary border-b pb-1 mb-1">
        {title}
      </h4>
      {children}
    </div>
  );
}

function OkcDetayDialog({
  bildirim,
  open,
  onClose,
}: {
  bildirim: OkcBildirim | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!bildirim) return null;

  const d = bildirim.detayBilgi;

  // Toplam satış hesapla
  const satisKdv0Num = parseNumber(d.satisKdv0);
  const satisKdv20Num = parseNumber(d.satisKdv20);
  const toplamSatis = (satisKdv0Num + satisKdv20Num).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-lg">ÖKC Aylık Satış Rapor Bildirimi</DialogTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
            <span>Firma Kodu: <strong className="text-foreground">{bildirim.firmaKodu}</strong></span>
            <span>Sicil No: <strong className="text-foreground">{bildirim.sicilNo}</strong></span>
            <span>Rapor No: <strong className="text-foreground">{d.aylikSatisRaporNo}</strong></span>
          </div>
        </DialogHeader>

        <ScrollArea className="px-6 pb-6 max-h-[calc(85vh-120px)]">
          <div className="space-y-5">
            {/* KDV Bilgileri */}
            <DetaySection title="Aylık Satış ve KDV Bilgileri">
              <DetayRow label="%0 KDV'li Satışlar" value={d.satisKdv0} />
              <DetayRow label="%20 KDV'li Satışlar" value={d.satisKdv20} />
              <DetayRow label="Toplam Satış" value={toplamSatis} bold />
              <DetayRow label="Toplam KDV" value={d.kdvToplam} bold />
            </DetaySection>

            {/* Belge Türleri */}
            <DetaySection title="Belge Türlerine Göre Satış Tutarları (KDV Dahil)">
              <DetayRow label="ÖKC Fişleri" value={d.okcfistutartutar} />
              <DetayRow label="Faturalar" value={d.faturatutartutar} />
              <DetayRow label="Serbest Meslek Makbuzları" value={d.smmtutartutar} />
              <DetayRow label="Müstahsil Makbuzları" value={d.muhtasiltutartutar} />
              <DetayRow label="Giriş/Yolcu Biletleri" value={d.gybilettutartutar} />
              <DetayRow label="Gider Pusulaları" value={d.gpusulatutartutar} />
            </DetaySection>

            {/* Ödeme Türleri */}
            <DetaySection title="Ödeme Türlerine Göre Satış Tutarları">
              <DetayRow label="Nakit" value={d.nakitodemetutar} />
              <DetayRow label="Banka/Kredi Kartı" value={d.bkkartodemetutar} />
              <DetayRow label="Yemek Kartı/Çeki" value={d.yemekkcodemetutar} />
              <DetayRow label="Diğer" value={d.digerodemetutar} />
            </DetaySection>

            {/* Bilgi Fişleri */}
            <DetaySection title="Bilgi Fişleri Tutar ve Adet Bilgileri">
              <DetayAdetRow label="Fatura Bilgi Fişi" tutar={d.faturabfistutar} adet={d.faturabfisadet} />
              <DetayAdetRow label="Yemek Kartı Bilgi Fişi" tutar={d.yemekkcbfistutar} adet={d.yemekkcbfisadet} />
              <DetayAdetRow label="Avans Bilgi Fişi" tutar={d.avansbfistutar} adet={d.avansbfisadet} />
              <DetayAdetRow label="Fatura Tahsilatı" tutar={d.faturatahsilatbfistutar} adet={d.faturatahsilatbfisadet} />
              <DetayAdetRow label="Otopark Giriş" tutar={d.otoparkbfistutar} adet={d.otoparkbfisadet} />
              <DetayAdetRow label="Cari Hesap Tahsilatı" tutar={d.carihesapbfistutar} adet={d.carihesapbfisadet} />
              <DetayAdetRow label="Diğer" tutar={d.digerbfistutar} adet={d.digerbfisadet} />
            </DetaySection>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function OkcClient() {
  // Mükellef listesi
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dönem
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [ay, setAy] = useState(defaultPeriod.ay);
  const [yil, setYil] = useState(defaultPeriod.yil);

  // Detay dialog state
  const [selectedBildirim, setSelectedBildirim] = useState<OkcBildirim | null>(null);
  const [detayDialogOpen, setDetayDialogOpen] = useState(false);

  // Hook
  const {
    bildirimler,
    meta,
    isLoading,
    progress,
    error,
    errorCode,
    startQuery,
    clearResults,
  } = useOkcQuery();

  // Mükellef listesi yükle
  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch("/api/customers?fields=minimal");
        if (!res.ok) return;
        const data = await res.json();
        const mapped: Customer[] = (data || []).map((c: { id: string; unvan: string; kisaltma: string | null; vknTckn: string; hasGibCredentials: boolean }) => ({
          id: c.id,
          unvan: c.unvan,
          kisaltma: c.kisaltma,
          vknTckn: c.vknTckn,
          hasGibCredentials: c.hasGibCredentials,
        }));
        setCustomers(mapped);
      } catch {
        toast.error("Mükellef listesi yüklenemedi");
      } finally {
        setCustomersLoading(false);
      }
    }
    loadCustomers();
  }, []);

  // Filtrelenmiş mükellefler
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.unvan.toLowerCase().includes(search) ||
        (c.kisaltma && c.kisaltma.toLowerCase().includes(search)) ||
        c.vknTckn.includes(search)
    );
  }, [customers, customerSearch]);

  // Seçili mükellef
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Sorgula
  const handleQuery = useCallback(async () => {
    if (!selectedCustomerId) {
      toast.error("Lütfen bir mükellef seçin");
      return;
    }

    if (!selectedCustomer?.hasGibCredentials) {
      toast.error("Seçili mükellefin GİB bilgileri eksik. Şifreler sayfasından GİB kullanıcı adı ve şifresini girin.");
      return;
    }

    await startQuery(selectedCustomerId, ay, yil);
  }, [selectedCustomerId, selectedCustomer, ay, yil, startQuery]);

  // Temizle
  const handleClear = useCallback(() => {
    clearResults();
    setSelectedBildirim(null);
  }, [clearResults]);

  // Detay göster
  const handleShowDetail = useCallback((bildirim: OkcBildirim) => {
    setSelectedBildirim(bildirim);
    setDetayDialogOpen(true);
  }, []);

  return (
    <div className="flex flex-col h-full p-1">
      <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <Cpu className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">ÖKC Bildirim Sorgulama</h1>
      </div>

      {/* Filtreler */}
      <div className="px-6 py-3 border-b">
        <div className="flex flex-col gap-4">
          {/* Mükellef Seçimi — Combobox */}
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={isLoading || customersLoading}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setComboboxOpen(true)}
              >
                <span className={selectedCustomer ? "text-foreground" : "text-muted-foreground"}>
                  {customersLoading
                    ? "Yükleniyor..."
                    : selectedCustomer
                      ? (selectedCustomer.kisaltma || selectedCustomer.unvan)
                      : "Mükellef ara veya seçin..."
                  }
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0"
              style={{ width: "var(--radix-popover-trigger-width)" }}
              align="start"
            >
              <div className="p-2">
                <Input
                  ref={inputRef}
                  placeholder="Mükellef ara (ünvan, kısaltma veya VKN)..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="h-8"
                  autoFocus
                />
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <div className="py-4 px-3 text-center text-sm text-muted-foreground">
                    {customerSearch ? "Sonuç bulunamadı" : "Mükellef yok"}
                  </div>
                ) : (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerSearch("");
                        setComboboxOpen(false);
                      }}
                    >
                      <Check
                        className={`h-4 w-4 shrink-0 ${
                          selectedCustomerId === c.id ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <span className="truncate">{c.kisaltma || c.unvan}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({c.vknTckn})
                      </span>
                      {!c.hasGibCredentials && (
                        <span className="text-xs text-destructive shrink-0">GİB eksik</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Dönem Seçimi — Tek ay/yıl */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Dönem</label>
              <div className="flex gap-2">
                <Select value={ay} onValueChange={setAy} disabled={isLoading}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_TR.map((name, i) => (
                      <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={yil} onValueChange={setYil} disabled={isLoading}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex items-end gap-2">
              <Button onClick={handleQuery} disabled={isLoading || !selectedCustomerId || !selectedCustomer?.hasGibCredentials}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sorgulanıyor...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Sorgula
                  </>
                )}
              </Button>
              {bildirimler.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportToExcel(bildirimler, selectedCustomer?.kisaltma || selectedCustomer?.unvan || "mukellef", meta)
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportToPdf(
                        bildirimler,
                        selectedCustomer?.kisaltma || selectedCustomer?.unvan || "mukellef",
                        meta
                      )
                    }
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                  <Button variant="ghost" onClick={handleClear}>
                    <X className="mr-2 h-4 w-4" />
                    Temizle
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ana İçerik */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
      {/* GİB bilgileri eksik uyarısı */}
      {selectedCustomer && !selectedCustomer.hasGibCredentials && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            {selectedCustomer.kisaltma || selectedCustomer.unvan} için GİB Dijital Vergi Dairesi bilgileri eksik.
            <a
              href="/dashboard/sifreler"
              className="inline-flex items-center gap-1 underline hover:no-underline"
            >
              Şifreler sayfasından girin
              <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* İlerleme Durumu */}
      {isLoading && progress.status && (
        <div className="flex items-center gap-2 rounded-lg border bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          <span>{progress.status}</span>
        </div>
      )}

      {/* Hata Mesajı */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-1 items-center justify-between gap-4">
            <span>{error}</span>
            {errorCode === "CAPTCHA_FAILED" && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={handleQuery}
                disabled={isLoading}
              >
                Tekrar Deneyin
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Sonuç Tablosu */}
      {bildirimler.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted/50">
                <th className="w-12 px-3 py-3 text-center font-medium">#</th>
                <th className="px-3 py-3 text-left font-medium">Firma Kodu</th>
                <th className="px-3 py-3 text-left font-medium">Firma Adı</th>
                <th className="px-3 py-3 text-left font-medium">ÖKC Markası</th>
                <th className="px-3 py-3 text-left font-medium">ÖKC Modeli</th>
                <th className="px-3 py-3 text-left font-medium">Cihaz Sicil No</th>
                <th className="px-3 py-3 text-left font-medium">Bildirim Zamanı</th>
                <th className="px-3 py-3 text-left font-medium">Bildirim Yöntemi</th>
                <th className="w-20 px-3 py-3 text-center font-medium">Detay</th>
              </tr>
            </thead>
            <tbody>
              {bildirimler.map((b, index) => (
                <tr key={`${b.sicilNo}-${index}`} className="border-b border-border/70 transition-colors hover:bg-muted/50">
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2.5">{b.firmaKodu}</td>
                  <td className="px-3 py-2.5 font-medium">{b.firmaAdi}</td>
                  <td className="px-3 py-2.5">{b.marka}</td>
                  <td className="px-3 py-2.5">{b.model}</td>
                  <td className="px-3 py-2.5">{b.sicilNo}</td>
                  <td className="px-3 py-2.5 text-xs">{b.bildirimTarih}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {b.bildirimYontem}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleShowDetail(b)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Göster
                    </Button>
                  </td>
                </tr>
              ))}
              {/* Toplam Satırı */}
              {meta && (
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td className="px-3 py-3" colSpan={8}>
                    <span className="text-muted-foreground">TOPLAM</span>
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({meta.toplamKayit} kayıt)
                    </span>
                  </td>
                  <td className="px-3 py-3" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sonuç yok */}
      {!isLoading && !error && bildirimler.length === 0 && meta !== null && (
        <Alert>
          <Cpu className="h-4 w-4" />
          <AlertDescription>
            Bu dönem için ÖKC bildirim kaydı bulunamadı.
          </AlertDescription>
        </Alert>
      )}

      {/* Boş Durum — henüz sorgu yapılmadı */}
      {!isLoading && !error && bildirimler.length === 0 && meta === null && (
        <div className="flex flex-col items-center justify-center gap-2 p-12 text-muted-foreground">
          <Cpu className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Mükellef seçip dönem belirledikten sonra <strong>Sorgula</strong> butonuna tıklayın.
          </p>
          <p className="text-center text-xs">
            Yeni Nesil ÖKC aylık satış rapor bildirimleri GİB İnternet Vergi Dairesi üzerinden sorgulanır.
          </p>
        </div>
      )}

      </div>
      {/* /Ana İçerik */}
      </div>
      {/* /Çerçeve */}

      {/* Detay Dialog */}
      <OkcDetayDialog
        bildirim={selectedBildirim}
        open={detayDialogOpen}
        onClose={() => setDetayDialogOpen(false)}
      />
    </div>
  );
}
