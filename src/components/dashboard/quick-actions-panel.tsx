"use client";

import { memo, useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Globe,
  FileText,
  CreditCard,
  Mail,
  Building2,
  Server,
  Receipt,
  Link2,
  BookOpen,
  FileCheck,
  Users,
  AlertTriangle,
  ShieldCheck,
  Search,
  ChevronDown,
  X,
  User,
  Briefcase,
  Loader2,
} from "lucide-react";
import { toast } from "@/components/ui/modern-toast";
import { useBotLog } from "@/context/bot-log-context";
import { VergiLevhasiDialog } from "./vergi-levhasi-dialog";
import { IskurGirisDialog } from "./iskur-giris-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface QuickActionsPanelProps {
  className?: string;
}

// Müşteri tipi
interface Customer {
  id: string;
  unvan: string;
  kisaltma?: string | null;
  sirketTipi: string;
  hasGibCredentials?: boolean;
  hasEdevletCredentials?: boolean;
  hasTurmobCredentials?: boolean;
  hasIskurCredentials?: boolean;
}

// Link tipi
interface QuickLink {
  id: string;
  label: string;
  icon: React.ReactNode;
}

// Mükellef ile Giriş Yapılan İşlemler
const MUKELLEF_LINKS: QuickLink[] = [
  { id: "ivd", label: "Yeni İnternet Vergi Dairesi", icon: <Globe className="h-3 w-3 shrink-0" /> },
  { id: "ebeyanname", label: "E-Beyanname Sistemi", icon: <FileText className="h-3 w-3 shrink-0" /> },
  { id: "digital-gib", label: "Digital.gib / Borç Sorgulama", icon: <CreditCard className="h-3 w-3 shrink-0" /> },
  { id: "etebligat", label: "E-Tebligat Sorgulama", icon: <Mail className="h-3 w-3 shrink-0" /> },
  { id: "edevlet-mukellef", label: "E-Devlet Kapısı", icon: <ShieldCheck className="h-3 w-3 shrink-0" /> },
  { id: "gib-5000", label: "GİB 5000/2000", icon: <Server className="h-3 w-3 shrink-0" /> },
  { id: "vergi-levhasi", label: "Vergi Levhası İndir", icon: <Receipt className="h-3 w-3 shrink-0" /> },
  { id: "turmob-luca", label: "TÜRMOB Luca E-Entegratör", icon: <Link2 className="h-3 w-3 shrink-0" /> },
  { id: "edefter", label: "GİB E-Defter Sistemi", icon: <BookOpen className="h-3 w-3 shrink-0" /> },
  { id: "iskur", label: "İŞKUR İşveren Sistemi", icon: <Briefcase className="h-3 w-3 shrink-0" /> },
];

// Meslek Mensubu ile Giriş Yapılan İşlemler
const MESLEK_MENSUBU_LINKS: QuickLink[] = [
  { id: "mm-ivd", label: "Yeni İnternet Vergi Dairesi", icon: <Globe className="h-3 w-3 shrink-0" /> },
  { id: "mm-ebeyanname", label: "E-Beyanname Sistemi", icon: <FileText className="h-3 w-3 shrink-0" /> },
  { id: "mm-digital-gib", label: "Digital.gib / Borç Sorgulama", icon: <CreditCard className="h-3 w-3 shrink-0" /> },
  { id: "mm-etebligat", label: "E-Tebligat Sorgulama", icon: <Mail className="h-3 w-3 shrink-0" /> },
  { id: "mm-interaktif-vd", label: "İnteraktif Vergi Dairesi", icon: <Building2 className="h-3 w-3 shrink-0" /> },
  { id: "defter-beyan", label: "Defter Beyan Sistemi", icon: <BookOpen className="h-3 w-3 shrink-0" /> },
  { id: "edevlet", label: "E-Devlet Kapısı", icon: <ShieldCheck className="h-3 w-3 shrink-0" /> },
  { id: "ebeyan", label: "E-Beyan Sistemi", icon: <FileCheck className="h-3 w-3 shrink-0" /> },
];

// SGK İşlemleri
const SGK_LINKS: QuickLink[] = [
  { id: "ebildirge", label: "E-Bildirge", icon: <FileText className="h-3 w-3 shrink-0" /> },
  { id: "ebildirge-v2", label: "E-Bildirge V2", icon: <FileText className="h-3 w-3 shrink-0" /> },
  { id: "isveren", label: "İşveren Sistemi", icon: <Users className="h-3 w-3 shrink-0" /> },
  { id: "sigortali-giris-cikis", label: "Sigortalı İşe Giriş/Çıkış", icon: <Users className="h-3 w-3 shrink-0" /> },
  { id: "eborcu-yoktur", label: "E-Borcu Yoktur", icon: <ShieldCheck className="h-3 w-3 shrink-0" /> },
  { id: "is-kazasi", label: "İş Kazası E-Bildirim", icon: <AlertTriangle className="h-3 w-3 shrink-0" /> },
];

// Diğer İşlemler
const DIGER_LINKS: QuickLink[] = [
  { id: "efatura-iptal", label: "E-Fatura İptal/İtiraz Portalı", icon: <FileText className="h-3 w-3 shrink-0" /> },
  { id: "ticaret-sicil", label: "Ticaret Sicili Gazetesi", icon: <BookOpen className="h-3 w-3 shrink-0" /> },
  { id: "turmob-ebirlik", label: "TÜRMOB E-Birlik Sistemi", icon: <Link2 className="h-3 w-3 shrink-0" /> },
];

// Inline Combobox Bileşeni
interface InlineCustomerSelectProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  prefetchedCustomers?: Customer[];
}

function InlineCustomerSelect({
  value,
  onValueChange,
  placeholder = "Mükellef seç...",
  prefetchedCustomers
}: InlineCustomerSelectProps) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(prefetchedCustomers || []);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(!!prefetchedCustomers);
  const [search, setSearch] = useState("");

  // Update customers if prefetched data changes
  useEffect(() => {
    if (prefetchedCustomers && prefetchedCustomers.length > 0) {
      setCustomers(prefetchedCustomers);
      setHasFetched(true);
    }
  }, [prefetchedCustomers]);

  useEffect(() => {
    if (open && !hasFetched) {
      setLoading(true);
      // Use minimal fields for faster response
      fetch("/api/customers?status=active&fields=minimal")
        .then((res) => res.ok ? res.json() : [])
        .then((data) => {
          setCustomers(data);
          setHasFetched(true);
        })
        .catch(() => setCustomers([]))
        .finally(() => setLoading(false));
    }
  }, [open, hasFetched]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === value);
  }, [customers, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) => c.unvan.toLowerCase().includes(q) || c.kisaltma?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const getIcon = (sirketTipi: string) => {
    switch (sirketTipi) {
      case "firma": return <Building2 className="h-3 w-3 text-blue-600 shrink-0" />;
      case "basit_usul": return <Briefcase className="h-3 w-3 text-amber-600 shrink-0" />;
      default: return <User className="h-3 w-3 text-emerald-600 shrink-0" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 text-xs font-normal w-full max-w-[280px] px-2",
            !value && "text-muted-foreground"
          )}
        >
          <span className="flex items-center gap-1.5 overflow-hidden flex-1">
            {selectedCustomer ? (
              <>
                {getIcon(selectedCustomer.sirketTipi)}
                <span className="truncate">{selectedCustomer.kisaltma || selectedCustomer.unvan}</span>
              </>
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-xs"
              autoFocus
            />
            {value && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => {
                  onValueChange(undefined);
                  setOpen(false);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {search ? "Sonuç bulunamadı" : "Mükellef bulunamadı"}
            </div>
          ) : (
            <div className="p-1">
              {filtered.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => {
                    onValueChange(customer.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:bg-accent transition-colors",
                    value === customer.id && "bg-accent"
                  )}
                >
                  {getIcon(customer.sirketTipi)}
                  <span className="truncate">{customer.kisaltma || customer.unvan}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// Link Bileşeni
interface QuickLinkItemProps {
  link: QuickLink;
  onLinkClick?: (id: string) => void;
}

function QuickLinkItem({ link, onLinkClick }: QuickLinkItemProps) {
  return (
    <button
      type="button"
      onClick={() => onLinkClick?.(link.id)}
      className="flex items-center gap-1.5 px-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors h-5 cursor-pointer"
    >
      {link.icon}
      <span className="truncate">{link.label}</span>
    </button>
  );
}

export const QuickActionsPanel = memo(function QuickActionsPanel({
  className,
}: QuickActionsPanelProps) {
  const [selectedMukellefId, setSelectedMukellefId] = useState<string>();
  const [selectedSgkMukellefId, setSelectedSgkMukellefId] = useState<string>();
  const [prefetchedCustomers, setPrefetchedCustomers] = useState<Customer[]>([]);
  const [vergiLevhasiDialogOpen, setVergiLevhasiDialogOpen] = useState(false);
  const [iskurDialogOpen, setIskurDialogOpen] = useState(false);
  const { electronConnected } = useBotLog();

  // SGK Şube seçim dialog state'leri
  const [sgkBranchDialogOpen, setSgkBranchDialogOpen] = useState(false);
  const [sgkBranches, setSgkBranches] = useState<{ id: string; branchName: string; hasCompleteCredentials: boolean }[]>([]);
  const [selectedSgkBranchId, setSelectedSgkBranchId] = useState<string>("");
  const [sgkPendingLinkId, setSgkPendingLinkId] = useState<string>("");
  const [fetchingBranches, setFetchingBranches] = useState(false);

  // Prefetch customers on mount (non-blocking)
  useEffect(() => {
    fetch("/api/customers?status=active&fields=minimal")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setPrefetchedCustomers(data))
      .catch(() => {});
  }, []);

  // Meslek Mensubu linkleri için handler
  const handleMeslekMensubuLink = async (linkId: string) => {
    // Electron bot bağlantı kontrolü
    if (!electronConnected) {
      toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
        description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
      });
      return;
    }

    // GİB uygulama başlatma (İVD ve E-Beyanname)
    if (linkId === "mm-ivd" || linkId === "mm-ebeyanname") {
      const application = linkId === "mm-ivd" ? "ivd" : "ebeyanname";
      const appName = linkId === "mm-ivd" ? "İnternet Vergi Dairesi" : "E-Beyanname";
      const toastId = `gib-launch-${application}`;

      // Önce mevcut toast'u temizle, sonra yeni göster
      toast.dismiss(toastId);
      toast.info(`${appName} açılıyor...`, {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ application }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "MISSING_CREDENTIALS") {
            toast.warning("GİB bilgileri eksik", {
              description: "Ayarlar > GİB Ayarları'ndan bilgilerinizi girin.",
            });
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // Meslek Mensubu ile Digital.gib / Borç Sorgulama
    else if (linkId === "mm-digital-gib") {
      const toastId = "mm-gib-borc-sorgulama";
      toast.dismiss(toastId);
      toast.info("Borç Sorgulama açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "ivd",
            targetPage: "borc-sorgulama",
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "MISSING_CREDENTIALS") {
            toast.warning("GİB bilgileri eksik", {
              description: "Ayarlar > GİB Ayarları'ndan bilgilerinizi girin.",
            });
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // Meslek Mensubu ile E-Tebligat Sorgulama
    else if (linkId === "mm-etebligat") {
      const toastId = "mm-gib-etebligat";
      toast.dismiss(toastId);
      toast.info("e-Tebligat açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "ivd",
            targetPage: "e-tebligat",
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "MISSING_CREDENTIALS") {
            toast.warning("GİB bilgileri eksik", {
              description: "Ayarlar > GİB Ayarları'ndan bilgilerinizi girin.",
            });
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // Meslek Mensubu ile İnteraktif Vergi Dairesi
    else if (linkId === "mm-interaktif-vd") {
      const toastId = "mm-gib-interaktif-vd";
      toast.dismiss(toastId);
      toast.info("İnteraktif Vergi Dairesi açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "interaktifvd",
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "MISSING_CREDENTIALS") {
            toast.warning("GİB bilgileri eksik", {
              description: "Ayarlar > GİB Ayarları'ndan bilgilerinizi girin.",
            });
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // Defter Beyan Sistemi
    else if (linkId === "defter-beyan") {
      const toastId = "mm-gib-defter-beyan";
      toast.dismiss(toastId);
      toast.info("Defter Beyan Sistemi açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "defter-beyan",
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "MISSING_CREDENTIALS") {
            toast.warning("GİB bilgileri eksik", {
              description: "Ayarlar > GİB Ayarları'ndan bilgilerinizi girin.",
            });
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // e-Beyan Sistemi
    else if (linkId === "ebeyan") {
      const toastId = "mm-gib-ebeyan";
      toast.dismiss(toastId);
      toast.info("e-Beyan Sistemi açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "ebeyan",
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "MISSING_CREDENTIALS") {
            toast.warning("GİB bilgileri eksik", {
              description: "Ayarlar > GİB Ayarları'ndan bilgilerinizi girin.",
            });
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // Meslek Mensubu ile e-Devlet Kapısı
    else if (linkId === "edevlet") {
      const toastId = "mm-edevlet";
      toast.dismiss(toastId);
      toast.info("e-Devlet Kapısı açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-edevlet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "MISSING_EDEVLET_CREDENTIALS") {
            toast.warning("e-Devlet bilgileri eksik", {
              description: "Ayarlar > Şifreler'den e-Devlet bilgilerinizi girin.",
            });
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    } else {
      toast.info(`${linkId} - Yakında...`, { duration: 2000 });
    }
  };

  // Mükellef ile giriş linkleri için handler
  const handleMukellefLink = async (linkId: string) => {
    // Electron bot bağlantı kontrolü
    if (!electronConnected) {
      toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
        description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
      });
      return;
    }

    // Yeni İnternet Vergi Dairesi (Mükellef ile)
    if (linkId === "ivd") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }

      // Önce credential kontrolü yap (API çağrısı yapmadan)
      const customer = prefetchedCustomers.find(c => c.id === selectedMukellefId);
      if (customer && !customer.hasGibCredentials) {
        toast.warning("Mükellef GİB bilgileri eksik", {
          description: "Mükellef kartından GİB bilgilerini girin.",
        });
        return;
      }

      const toastId = "gib-ivd";
      toast.dismiss(toastId);
      toast.info("İnternet Vergi Dairesi açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "ivd",
            customerId: selectedMukellefId,
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "CUSTOMER_MISSING_CREDENTIALS") {
            toast.warning("Mükellef GİB bilgileri eksik", {
              description: "Mükellef kartından GİB bilgilerini girin.",
            });
          } else if (data.code === "CUSTOMER_NOT_FOUND") {
            toast.error("Mükellef bulunamadı");
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // Digital.gib / Borç Sorgulama
    else if (linkId === "digital-gib") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }

      // Önce credential kontrolü yap
      const customer = prefetchedCustomers.find(c => c.id === selectedMukellefId);
      if (customer && !customer.hasGibCredentials) {
        toast.warning("Mükellef GİB bilgileri eksik", {
          description: "Mükellef kartından GİB bilgilerini girin.",
        });
        return;
      }

      const toastId = "gib-borc-sorgulama";
      toast.dismiss(toastId);
      toast.info("Borç Sorgulama açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "ivd",
            customerId: selectedMukellefId,
            targetPage: "borc-sorgulama",
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "CUSTOMER_MISSING_CREDENTIALS") {
            toast.warning("Mükellef GİB bilgileri eksik", {
              description: "Mükellef kartından GİB bilgilerini girin.",
            });
          } else if (data.code === "CUSTOMER_NOT_FOUND") {
            toast.error("Mükellef bulunamadı");
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // E-Beyanname Sistemi (Mükellef ile)
    else if (linkId === "ebeyanname") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }

      // Önce credential kontrolü yap
      const customer = prefetchedCustomers.find(c => c.id === selectedMukellefId);
      if (customer && !customer.hasGibCredentials) {
        toast.warning("Mükellef GİB bilgileri eksik", {
          description: "Mükellef kartından GİB bilgilerini girin.",
        });
        return;
      }

      const toastId = "gib-ebeyanname";
      toast.dismiss(toastId);
      toast.info("E-Beyanname Sistemi açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "ebeyanname",
            customerId: selectedMukellefId,
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "CUSTOMER_MISSING_CREDENTIALS") {
            toast.warning("Mükellef GİB bilgileri eksik", {
              description: "Mükellef kartından GİB bilgilerini girin.",
            });
          } else if (data.code === "CUSTOMER_NOT_FOUND") {
            toast.error("Mükellef bulunamadı");
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // E-Tebligat Sorgulama (Mükellef ile)
    else if (linkId === "etebligat") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }

      // Önce credential kontrolü yap
      const customer = prefetchedCustomers.find(c => c.id === selectedMukellefId);
      if (customer && !customer.hasGibCredentials) {
        toast.warning("Mükellef GİB bilgileri eksik", {
          description: "Mükellef kartından GİB bilgilerini girin.",
        });
        return;
      }

      const toastId = "gib-etebligat";
      toast.dismiss(toastId);
      toast.info("e-Tebligat açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "ivd",
            customerId: selectedMukellefId,
            targetPage: "e-tebligat",
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "CUSTOMER_MISSING_CREDENTIALS") {
            toast.warning("Mükellef GİB bilgileri eksik", {
              description: "Mükellef kartından GİB bilgilerini girin.",
            });
          } else if (data.code === "CUSTOMER_NOT_FOUND") {
            toast.error("Mükellef bulunamadı");
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // Vergi Levhası İndir
    else if (linkId === "vergi-levhasi") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }

      // Önce credential kontrolü yap
      const customer = prefetchedCustomers.find(c => c.id === selectedMukellefId);
      if (customer && !customer.hasGibCredentials) {
        toast.warning("Mükellef GİB bilgileri eksik", {
          description: "Mükellef kartından GİB bilgilerini girin.",
        });
        return;
      }

      setVergiLevhasiDialogOpen(true);
    }
    // GİB E-Defter Sistemi
    else if (linkId === "edefter") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }

      // Önce credential kontrolü yap
      const customer = prefetchedCustomers.find(c => c.id === selectedMukellefId);
      if (customer && !customer.hasGibCredentials) {
        toast.warning("Mükellef GİB bilgileri eksik", {
          description: "Mükellef kartından GİB bilgilerini girin.",
        });
        return;
      }

      const toastId = "gib-edefter";
      toast.dismiss(toastId);
      toast.info("E-Defter Sistemi açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "edefter",
            customerId: selectedMukellefId,
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
          toast.success("E-Defter Sistemi başlatıldı", {
            description: "Tarayıcı açılıyor...",
            duration: 2000,
          });
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "CUSTOMER_MISSING_CREDENTIALS") {
            toast.warning("Mükellef GİB bilgileri eksik", {
              description: "Mükellef kartından GİB bilgilerini girin.",
            });
          } else if (data.code === "CUSTOMER_NOT_FOUND") {
            toast.error("Mükellef bulunamadı");
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // İŞKUR İşveren Sistemi
    else if (linkId === "iskur") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }
      setIskurDialogOpen(true);
    }
    // GİB 5000/2000 (E-Arşiv Portal)
    else if (linkId === "gib-5000") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }

      const customer = prefetchedCustomers.find(c => c.id === selectedMukellefId);
      if (customer && !customer.hasGibCredentials) {
        toast.warning("Mükellef GİB bilgileri eksik", {
          description: "Mükellef kartından GİB bilgilerini girin.",
        });
        return;
      }

      const toastId = "gib-earsiv";
      toast.dismiss(toastId);
      toast.info("E-Arşiv Portal açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-gib", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application: "earsiv",
            customerId: selectedMukellefId,
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "CUSTOMER_MISSING_CREDENTIALS") {
            toast.warning("Mükellef GİB bilgileri eksik", {
              description: "Mükellef kartından GİB bilgilerini girin.",
            });
          } else if (data.code === "CUSTOMER_NOT_FOUND") {
            toast.error("Mükellef bulunamadı");
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // TÜRMOB Luca E-Entegratör
    else if (linkId === "turmob-luca") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }

      // Önce credential kontrolü yap
      const customer = prefetchedCustomers.find(c => c.id === selectedMukellefId);
      if (customer && !customer.hasTurmobCredentials) {
        toast.warning("Mükellef TÜRMOB bilgileri eksik", {
          description: "Mükellef kartından TÜRMOB bilgilerini girin.",
        });
        return;
      }

      const toastId = "turmob-luca";
      toast.dismiss(toastId);
      toast.info("TÜRMOB Luca açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-turmob", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: selectedMukellefId,
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "CUSTOMER_MISSING_TURMOB_CREDENTIALS") {
            toast.warning("Mükellef TÜRMOB bilgileri eksik", {
              description: "Mükellef kartından TÜRMOB bilgilerini girin.",
            });
          } else if (data.code === "CUSTOMER_NOT_FOUND") {
            toast.error("Mükellef bulunamadı");
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    }
    // Mükellef ile e-Devlet Kapısı
    else if (linkId === "edevlet-mukellef") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }

      // Önce credential kontrolü yap (API çağrısı yapmadan)
      const customer = prefetchedCustomers.find(c => c.id === selectedMukellefId);
      if (customer && !customer.hasEdevletCredentials) {
        toast.warning("Mükellef e-Devlet bilgileri eksik", {
          description: "Şifreler > e-Devlet Kapısı'ndan bilgileri girin.",
        });
        return;
      }

      const toastId = "edevlet-mukellef";
      toast.dismiss(toastId);
      toast.info("e-Devlet Kapısı açılıyor...", {
        id: toastId,
        description: "SMMM Asistan'a bağlanılıyor...",
        duration: 3000,
      });

      try {
        const res = await fetch("/api/bot/launch-edevlet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: selectedMukellefId,
          }),
        });
        const data = await res.json();

        if (res.ok) {
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          if (data.code === "BOT_NOT_CONNECTED") {
            toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
              description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
            });
          } else if (data.code === "CUSTOMER_MISSING_EDEVLET_CREDENTIALS") {
            toast.warning("Mükellef e-Devlet bilgileri eksik", {
              description: "Şifreler > e-Devlet Kapısı'ndan bilgileri girin.",
            });
          } else if (data.code === "CUSTOMER_NOT_FOUND") {
            toast.error("Mükellef bulunamadı");
          } else {
            toast.error(data.error || "Hata oluştu");
          }
        }
      } catch {
        toast.dismiss(toastId);
        toast.error("Bağlantı hatası");
      }
    } else {
      toast.info(`${linkId} - Yakında...`, { duration: 2000 });
    }
  };

  // Diğer İşlemler linkleri için handler
  const handleDigerLink = async (linkId: string) => {
    // Electron bot bağlantı kontrolü
    if (!electronConnected) {
      toast.warning("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
        description: "Bu işlem için masaüstü uygulamasının açık ve bağlı olması gerekiyor.",
      });
      return;
    }

    const linkLabels: Record<string, string> = {
      'efatura-iptal': 'E-Fatura İptal/İtiraz Portalı',
      'ticaret-sicil': 'Ticaret Sicili Gazetesi',
      'turmob-ebirlik': 'TÜRMOB E-Birlik Sistemi',
    };

    const label = linkLabels[linkId] || linkId;
    const toastId = `diger-${linkId}`;

    toast.dismiss(toastId);
    toast.info(`${label} açılıyor...`, {
      id: toastId,
      description: "SMMM Asistan'a bağlanılıyor...",
      duration: 3000,
    });

    try {
      const res = await fetch("/api/bot/launch-diger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: linkId }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.dismiss(toastId);
        toast.success(`${label} açıldı`, {
          description: "Tarayıcınızda açıldı.",
          duration: 2000,
        });
      } else {
        toast.dismiss(toastId);
        if (data.code === "BOT_NOT_CONNECTED") {
          toast.error("Electron Bot bağlı değil", {
            description: "Lütfen Electron uygulamasını başlatın.",
          });
        } else {
          toast.error(data.error || "Hata oluştu");
        }
      }
    } catch {
      toast.dismiss(toastId);
      toast.error("Bağlantı hatası");
    }
  };

  // SGK İşlemleri linkleri için handler
  const handleSgkLink = async (linkId: string) => {
    if (!selectedSgkMukellefId) {
      toast.warning("Mükellef seçilmedi", {
        description: "Lütfen önce bir mükellef seçin.",
      });
      return;
    }

    // Şubeleri kontrol et
    setFetchingBranches(true);
    try {
      const res = await fetch(`/api/customers/${selectedSgkMukellefId}/branches?fields=minimal`);
      if (!res.ok) {
        setFetchingBranches(false);
        toast.info(`${linkId} - Yakında...`, { duration: 2000 });
        return;
      }

      const branches = await res.json();
      setFetchingBranches(false);

      if (branches.length === 0) {
        // Şube yoksa direkt işlem yap
        toast.info(`${linkId} - SGK işlemi başlatılıyor...`, { duration: 2000 });
        return;
      }

      // Şubeler varsa dialog aç
      setSgkBranches(branches);
      setSgkPendingLinkId(linkId);
      setSelectedSgkBranchId(branches[0]?.id || "");
      setSgkBranchDialogOpen(true);
    } catch {
      setFetchingBranches(false);
      toast.error("Şube bilgileri alınamadı");
    }
  };

  // SGK Şube seçimi onaylandığında
  const handleSgkBranchConfirm = () => {
    const branch = sgkBranches.find(b => b.id === selectedSgkBranchId);
    if (!branch) return;

    const sgkCustomer = prefetchedCustomers.find(c => c.id === selectedSgkMukellefId);
    const customerName = sgkCustomer?.kisaltma || sgkCustomer?.unvan || "Mükellef";

    setSgkBranchDialogOpen(false);

    if (!branch.hasCompleteCredentials) {
      toast.warning("Şube SGK bilgileri eksik", {
        description: `${branch.branchName} şubesinin SGK bilgilerini tamamlayın.`,
      });
      return;
    }

    toast.info(`${customerName} - ${branch.branchName}`, {
      description: `SGK işlemi başlatılacak: ${sgkPendingLinkId}`,
      duration: 3000,
    });
  };

  // Seçili mükellef bilgisini al
  const selectedCustomer = prefetchedCustomers.find(c => c.id === selectedMukellefId);

  return (
    <div className={cn("grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4", className)}>
      {/* Meslek Mensubu ile Giriş Yapılan İşlemler */}
      <Card className="overflow-hidden p-0">
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-3 h-10 flex items-center">
          <h3 className="text-xs xl:text-sm font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
            Meslek Mensubu ile Giriş
          </h3>
        </div>
        <div className="px-2 -mt-3.5 pb-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-1">
            {MESLEK_MENSUBU_LINKS.map((link) => (
              <QuickLinkItem key={link.id} link={link} onLinkClick={handleMeslekMensubuLink} />
            ))}
          </div>
        </div>
      </Card>

      {/* Mükellef ile Giriş Yapılan İşlemler */}
      <Card className="overflow-hidden p-0">
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-3 h-10 flex items-center justify-between gap-2">
          <h3 className="text-xs xl:text-sm font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">
            Mükellef ile Giriş
          </h3>
          <InlineCustomerSelect
            value={selectedMukellefId}
            onValueChange={setSelectedMukellefId}
            prefetchedCustomers={prefetchedCustomers}
          />
        </div>
        <div className="px-2 -mt-3.5 pb-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-1">
            {MUKELLEF_LINKS.map((link) => (
              <QuickLinkItem key={link.id} link={link} onLinkClick={handleMukellefLink} />
            ))}
          </div>
        </div>
      </Card>

      {/* SGK İşlemleri */}
      <Card className="overflow-hidden p-0">
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-3 h-10 flex items-center justify-between gap-2">
          <h3 className="text-xs xl:text-sm font-semibold text-orange-700 dark:text-orange-300 whitespace-nowrap flex items-center gap-1.5">
            SGK İşlemleri
            {fetchingBranches && <Loader2 className="h-3 w-3 animate-spin" />}
          </h3>
          <InlineCustomerSelect
            value={selectedSgkMukellefId}
            onValueChange={setSelectedSgkMukellefId}
            prefetchedCustomers={prefetchedCustomers}
          />
        </div>
        <div className="px-2 -mt-3.5 pb-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-1">
            {SGK_LINKS.map((link) => (
              <QuickLinkItem key={link.id} link={link} onLinkClick={handleSgkLink} />
            ))}
          </div>
        </div>
      </Card>

      {/* Diğer İşlemler */}
      <Card className="overflow-hidden p-0">
        <div className="bg-purple-500/10 border-b border-purple-500/20 px-3 h-10 flex items-center">
          <h3 className="text-xs xl:text-sm font-semibold text-purple-700 dark:text-purple-300 whitespace-nowrap">
            Diğer İşlemler
          </h3>
        </div>
        <div className="px-2 -mt-3.5 pb-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-1">
            {DIGER_LINKS.map((link) => (
              <QuickLinkItem key={link.id} link={link} onLinkClick={handleDigerLink} />
            ))}
          </div>
        </div>
      </Card>

      {/* Vergi Levhası Dialog */}
      {selectedMukellefId && selectedCustomer && (
        <VergiLevhasiDialog
          open={vergiLevhasiDialogOpen}
          onOpenChange={setVergiLevhasiDialogOpen}
          customerId={selectedMukellefId}
          customerName={selectedCustomer.kisaltma || selectedCustomer.unvan}
        />
      )}

      {/* İŞKUR Giriş Dialog */}
      {selectedMukellefId && selectedCustomer && (
        <IskurGirisDialog
          open={iskurDialogOpen}
          onOpenChange={setIskurDialogOpen}
          customerId={selectedMukellefId}
          customerName={selectedCustomer.kisaltma || selectedCustomer.unvan}
          hasIskurCredentials={selectedCustomer.hasIskurCredentials ?? false}
          hasEdevletCredentials={selectedCustomer.hasEdevletCredentials ?? false}
        />
      )}

      {/* SGK Şube Seçim Dialog */}
      <Dialog open={sgkBranchDialogOpen} onOpenChange={setSgkBranchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Şube Seçin</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-3">
              Bu mükellefin birden fazla SGK şubesi bulunmaktadır. İşlem yapılacak şubeyi seçin:
            </p>
            <RadioGroup value={selectedSgkBranchId} onValueChange={setSelectedSgkBranchId}>
              <div className="space-y-2">
                {sgkBranches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center space-x-3 rounded-md border p-3 cursor-pointer hover:bg-accent"
                    onClick={() => setSelectedSgkBranchId(branch.id)}
                  >
                    <RadioGroupItem value={branch.id} id={`branch-${branch.id}`} />
                    <Label htmlFor={`branch-${branch.id}`} className="flex-1 cursor-pointer flex items-center justify-between">
                      <span className="text-sm font-medium">{branch.branchName}</span>
                      <Badge variant={branch.hasCompleteCredentials ? "default" : "secondary"} className="text-[10px] h-5">
                        {branch.hasCompleteCredentials ? "Bilgiler Tam" : "Eksik"}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSgkBranchDialogOpen(false)}>
              İptal
            </Button>
            <Button size="sm" onClick={handleSgkBranchConfirm} disabled={!selectedSgkBranchId}>
              Devam Et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

QuickActionsPanel.displayName = "QuickActionsPanel";
