/**
 * KontrolCustomerRow Component
 *
 * Memoized müşteri satırı bileşeni.
 * Inline düzenleme ve beyanname hücreleri içerir.
 * Yeni ikon tabanlı statü sistemi.
 */

import React from "react";
import { Icon } from "@iconify/react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  FileText,
  FileCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  Customer,
  BeyannameTuru,
  BeyannameStatus,
  BeyannameStatusMeta,
  FileInfo,
} from "./types";
import { toTitleCase } from "@/lib/utils/text";

interface KontrolCustomerRowProps {
  customer: Customer;
  index: number;
  beyannameTurleri: BeyannameTuru[];
  customerStatuses: Record<string, BeyannameStatus>;
  // Edit states
  editingSiraNo: string | null;
  editingSiraNoValue: string;
  editingUnvan: string | null;
  editingUnvanValue: string;
  // Handlers
  onSiraNoClick: (customerId: string, currentSiraNo: string | null) => void;
  onSiraNoChange: (value: string) => void;
  onSiraNoSave: (customerId: string) => void;
  onSiraNoCancel: () => void;
  onUnvanClick: (customerId: string, currentUnvan: string) => void;
  onUnvanChange: (value: string) => void;
  onUnvanSave: (customerId: string) => void;
  onUnvanCancel: () => void;
  onOpenCustomer: (customerId: string) => void;
  onDeleteCustomer: (customerId: string) => void;
  onLeftClick: (
    customerId: string,
    beyannameKod: string,
    currentStatus: string
  ) => void;
  onRightClick: (
    e: React.MouseEvent,
    customerId: string,
    beyannameKod: string
  ) => void;
}

// Meta bilgilerini al
function getMeta(
  customerStatuses: Record<string, BeyannameStatus>,
  beyannameKod: string
): BeyannameStatusMeta | undefined {
  const data = customerStatuses[beyannameKod];
  return data?.meta;
}

// Files bilgilerini al (BeyannameStatus.files ve meta.files backwards compatibility)
function getFiles(
  customerStatuses: Record<string, BeyannameStatus>,
  beyannameKod: string
): { beyanname?: FileInfo; tahakkuk?: FileInfo; sgkTahakkuk?: FileInfo; hizmetListesi?: FileInfo } | undefined {
  const data = customerStatuses[beyannameKod];
  return data?.files || data?.meta?.files;
}

// PDF açma fonksiyonu
function openPdf(
  e: React.MouseEvent,
  docInfo?: { documentId?: string; path?: string }
) {
  e.stopPropagation();
  if (docInfo?.documentId) {
    window.open(
      `/api/files/view?id=${docInfo.documentId}`,
      "_blank",
      "width=1000,height=800"
    );
  } else if (docInfo?.path) {
    window.open(
      `/api/files?path=${docInfo.path}`,
      "_blank",
      "width=1000,height=800"
    );
  }
}

// Efektif statü hesapla (backward compat: verildi → onaylandi gibi göster, isMuaf → gonderilmeyecek)
function getEffectiveStatus(status: string, isMuaf: boolean): string {
  if (isMuaf) return "gonderilmeyecek";
  if (status === "muaf") return "gonderilmeyecek";
  if (status === "3aylik") return "onay_bekliyor";
  return status;
}

function KontrolCustomerRowComponent({
  customer,
  index,
  beyannameTurleri,
  customerStatuses,
  editingSiraNo,
  editingSiraNoValue,
  editingUnvan,
  editingUnvanValue,
  onSiraNoClick,
  onSiraNoChange,
  onSiraNoSave,
  onSiraNoCancel,
  onUnvanClick,
  onUnvanChange,
  onUnvanSave,
  onUnvanCancel,
  onOpenCustomer,
  onDeleteCustomer,
  onLeftClick,
  onRightClick,
}: KontrolCustomerRowProps) {
  return (
    <tr
      className="hover:bg-muted/80 transition-colors"
    >
      {/* No - Read Only (Mükellef listesinden düzenlenir) */}
      <td className="border border-border px-1 py-1 text-center font-mono text-muted-foreground w-16 bg-background">
        <span className="text-xs">
          {customer.siraNo || "-"}
        </span>
      </td>

      {/* Mükellef - Editable */}
      <td className="border border-border px-2 py-1 font-medium w-64 bg-background">
        {editingUnvan === customer.id ? (
          <input
            type="text"
            value={editingUnvanValue}
            onChange={(e) => onUnvanChange(e.target.value)}
            onBlur={() => onUnvanSave(customer.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onUnvanSave(customer.id);
              if (e.key === "Escape") onUnvanCancel();
            }}
            className="w-full h-6 text-xs border rounded px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2 group">
            {customer.sirketTipi === "firma" ? (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
              >
                Firma
              </Badge>
            ) : customer.sirketTipi === "basit_usul" ? (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
              >
                Basit
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
              >
                Şahıs
              </Badge>
            )}
            <span
              className="truncate cursor-pointer hover:underline"
              title="Tıkla: Düzenle"
              onClick={() => onUnvanClick(customer.id, customer.unvan)}
            >
              {toTitleCase(customer.unvan)}
            </span>
            <Icon
              icon="solar:pen-bold"
              className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => onUnvanClick(customer.id, customer.unvan)}
            />
            <Icon
              icon="solar:folder-open-bold"
              className="h-3 w-3 text-blue-500/70 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => onOpenCustomer(customer.id)}
            />
            <Icon
              icon="solar:trash-bin-trash-bold"
              className="h-3 w-3 text-red-500/70 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => onDeleteCustomer(customer.id)}
            />
          </div>
        )}
      </td>

      {/* Beyanname Hücreleri */}
      {beyannameTurleri.map((tur) => {
        const beyannameData = customerStatuses[tur.kod];
        const rawStatus = beyannameData?.status || "bos";
        const isMuaf =
          customer.verilmeyecekBeyannameler?.includes(tur.kod) || false;
        const effectiveStatus = getEffectiveStatus(rawStatus, isMuaf);

        return (
          <BeyannameCell
            key={tur.kod}
            customerId={customer.id}
            turKod={tur.kod}
            status={effectiveStatus}
            customerStatuses={customerStatuses}
            onLeftClick={onLeftClick}
            onRightClick={onRightClick}
          />
        );
      })}
    </tr>
  );
}

// Beyanname hücre bileşeni — ikon tabanlı statü sistemi
interface BeyannameCellProps {
  customerId: string;
  turKod: string;
  status: string;
  customerStatuses: Record<string, BeyannameStatus>;
  onLeftClick: (
    customerId: string,
    beyannameKod: string,
    currentStatus: string
  ) => void;
  onRightClick: (
    e: React.MouseEvent,
    customerId: string,
    beyannameKod: string
  ) => void;
}

function BeyannameCell({
  customerId,
  turKod,
  status,
  customerStatuses,
  onLeftClick,
  onRightClick,
}: BeyannameCellProps) {
  const meta = getMeta(customerStatuses, turKod);
  const files = getFiles(customerStatuses, turKod);

  // SGK ve Hizmet Listesi path'lerini kontrol et
  const sgkPath =
    files?.sgkTahakkuk?.path || meta?.sgkTahakkukPath || "";
  const hizmetPath =
    files?.hizmetListesi?.path || meta?.hizmetListesiPath || "";

  const isSgkTahakkuk =
    sgkPath.toUpperCase().includes("SGK_TAHAKKUK") ||
    (sgkPath && !sgkPath.toUpperCase().includes("HIZMET"));
  const hasHizmetListesi =
    hizmetPath ||
    sgkPath.toUpperCase().includes("HIZMET_LISTESI") ||
    sgkPath.toUpperCase().includes("HIZMET");

  const hasAnyFile =
    files?.beyanname ||
    files?.tahakkuk ||
    files?.sgkTahakkuk ||
    files?.hizmetListesi ||
    meta?.beyannamePath ||
    meta?.tahakkukPath ||
    meta?.sgkTahakkukPath ||
    meta?.hizmetListesiPath;

  const isLocked = status === "gonderilmeyecek";
  const isVerildi = status === "verildi" || status === "onaylandi";

  // Hücre tıklama title
  const cellTitle = isLocked
    ? "Gönderilmeyecek (kalıcı)"
    : "Sol tık: Durum değiştir | Sağ tık: Gönderilmeyecek (kalıcı)";

  return (
    <td
      data-cell={`${customerId}-${turKod}`}
      onClick={() => !isLocked && onLeftClick(customerId, turKod, status)}
      onContextMenu={(e) => onRightClick(e, customerId, turKod)}
      title={cellTitle}
      className={`
        border border-border text-center select-none h-8 transition-colors
        ${isLocked
          ? "cursor-not-allowed bg-muted/40"
          : "cursor-pointer bg-background hover:bg-muted/50"
        }
      `}
    >
      {/* Onaylandı veya Verildi — Yeşil tik + dosya linkleri */}
      {isVerildi && meta && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center w-full h-full gap-0.5">
                {hasAnyFile ? (
                  <div className="flex items-center gap-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-700 dark:text-green-500 flex-shrink-0" />
                    {/* B - Beyanname */}
                    {(files?.beyanname || meta?.beyannamePath) && (
                      <div
                        onClick={(e) =>
                          openPdf(e, files?.beyanname || { path: meta?.beyannamePath })
                        }
                        className="w-5 h-5 flex items-center justify-center bg-red-100 hover:bg-red-300 text-red-600 rounded-[3px] cursor-pointer border border-red-200 hover:border-red-400 transition-colors"
                        title="Beyanname PDF"
                      >
                        <span className="text-[10px] font-bold">B</span>
                      </div>
                    )}
                    {/* T - Tahakkuk */}
                    {(files?.tahakkuk || meta?.tahakkukPath) && (
                      <div
                        onClick={(e) =>
                          openPdf(e, files?.tahakkuk || { path: meta?.tahakkukPath })
                        }
                        className="w-5 h-5 flex items-center justify-center bg-orange-100 hover:bg-orange-300 text-orange-600 rounded-[3px] cursor-pointer border border-orange-200 hover:border-orange-400 transition-colors"
                        title="Tahakkuk PDF"
                      >
                        <span className="text-[10px] font-bold">T</span>
                      </div>
                    )}
                    {/* S - SGK Tahakkuk */}
                    {(files?.sgkTahakkuk || meta?.sgkTahakkukPath) &&
                      isSgkTahakkuk && (
                        <div
                          onClick={(e) =>
                            openPdf(e, files?.sgkTahakkuk || { path: meta?.sgkTahakkukPath })
                          }
                          className="w-5 h-5 flex items-center justify-center bg-blue-100 hover:bg-blue-300 text-blue-600 rounded-[3px] cursor-pointer border border-blue-200 hover:border-blue-400 transition-colors"
                          title="SGK Tahakkuk PDF"
                        >
                          <span className="text-[10px] font-bold">S</span>
                        </div>
                      )}
                    {/* H - Hizmet Listesi */}
                    {hasHizmetListesi && (
                      <div
                        onClick={(e) => {
                          if (files?.hizmetListesi) {
                            openPdf(e, files.hizmetListesi);
                          } else if (meta?.hizmetListesiPath) {
                            openPdf(e, { path: meta?.hizmetListesiPath });
                          } else if (sgkPath.toUpperCase().includes("HIZMET")) {
                            openPdf(e, files?.sgkTahakkuk || { path: meta?.sgkTahakkukPath });
                          }
                        }}
                        className="w-5 h-5 flex items-center justify-center bg-purple-100 hover:bg-purple-300 text-purple-600 rounded-[3px] cursor-pointer border border-purple-200 hover:border-purple-400 transition-colors"
                        title="Hizmet Listesi PDF"
                      >
                        <span className="text-[10px] font-bold">H</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-500" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="rounded-2xl px-5 py-4 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 border-green-200 dark:border-green-800 shadow-xl"
            >
              <div className="space-y-2.5 min-w-[220px]">
                <div className="font-bold text-green-800 dark:text-green-200 text-sm flex items-center gap-2 pb-2 border-b border-green-200 dark:border-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  {meta?.beyannameTuru}
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-green-700 dark:text-green-300">
                    <span className="font-medium">Gönderim Tarihi:</span>
                    <span>{meta?.yuklemeZamani}</span>
                  </div>
                  {meta?.donem && (
                    <div className="flex items-center justify-between text-green-700 dark:text-green-300">
                      <span className="font-medium">Vergilendirme Dönemi:</span>
                      <span>{meta?.donem}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 pt-2 border-t border-green-200 dark:border-green-700">
                  <span className="font-medium">Mükellef:</span>{" "}
                  {toTitleCase(meta?.unvan)}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Onaylandı/Verildi — meta yoksa sadece ikon */}
      {isVerildi && !meta && (
        <div className="flex items-center justify-center w-full h-full">
          <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-500" />
        </div>
      )}

      {/* Onay Bekliyor — Turuncu saat */}
      {status === "onay_bekliyor" && (
        <div className="flex items-center justify-center w-full h-full">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
      )}

      {/* Verilmedi — Kırmızı X */}
      {status === "verilmedi" && (
        <div className="flex items-center justify-center w-full h-full">
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
        </div>
      )}

      {/* Gönderilmeyecek — Gri ban (kilitli) */}
      {status === "gonderilmeyecek" && (
        <div className="flex items-center justify-center w-full h-full">
          <Ban className="w-3.5 h-3.5 text-muted-foreground/50" />
        </div>
      )}

      {/* Dilekçe Gönderilecek — Mor dosya */}
      {status === "dilekce_gonderilecek" && (
        <div className="flex items-center justify-center w-full h-full">
          <FileText className="w-4 h-4 text-purple-700 dark:text-purple-400" />
        </div>
      )}

      {/* Dilekçe Verildi — Mor/Yeşil dosya onay */}
      {status === "dilekce_verildi" && (
        <div className="flex items-center justify-center w-full h-full">
          <FileCheck className="w-4 h-4 text-purple-800 dark:text-purple-400" />
        </div>
      )}

      {/* Boş hücre */}
      {status === "bos" && (
        <div className="flex items-center justify-center w-full h-full" />
      )}
    </td>
  );
}

// React.memo ile sarmalayarak gereksiz re-render'ları önle
export const KontrolCustomerRow = React.memo(
  KontrolCustomerRowComponent,
  (prevProps, nextProps): boolean => {
    const prevMuaf = prevProps.customer.verilmeyecekBeyannameler;
    const nextMuaf = nextProps.customer.verilmeyecekBeyannameler;
    const muafEqual =
      prevMuaf === nextMuaf ||
      (prevMuaf?.length === nextMuaf?.length &&
       (prevMuaf?.every((item, i) => item === nextMuaf?.[i]) ?? true));

    return (
      prevProps.customer.id === nextProps.customer.id &&
      prevProps.customer.unvan === nextProps.customer.unvan &&
      prevProps.customer.siraNo === nextProps.customer.siraNo &&
      prevProps.customer.sirketTipi === nextProps.customer.sirketTipi &&
      muafEqual &&
      prevProps.index === nextProps.index &&
      prevProps.editingSiraNo === nextProps.editingSiraNo &&
      prevProps.editingUnvan === nextProps.editingUnvan &&
      prevProps.customerStatuses === nextProps.customerStatuses
    );
  }
);
