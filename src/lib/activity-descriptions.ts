/**
 * Activity Description Builder
 *
 * Audit log kayıtları için zengin Türkçe açıklamalar üreten PURE FUNCTION.
 * DB çağrısı YAPMAZ - sadece verilen veriden string üretir.
 *
 * 3 katmanlı bilgi hiyerarşisi:
 * - primary: Ana açıklama (userName + ne yaptı)
 * - secondary: Detay bilgisi (değişiklik, count, status vb.)
 * - meta: Yapısal bilgi (entityName, changedFields)
 */

import type { ActivityDescription } from "@/types/dashboard";

// ============================================
// ACTION & RESOURCE LABELS
// ============================================

export const actionLabels: Record<string, string> = {
  LOGIN: "giriş yaptı",
  LOGOUT: "çıkış yaptı",
  LOGIN_FAILED: "giriş denemesi başarısız oldu",
  CREATE: "oluşturdu",
  UPDATE: "güncelledi",
  DELETE: "sildi",
  VIEW: "görüntüledi",
  VIEW_SENSITIVE: "hassas bilgileri görüntüledi",
  EXPORT: "dışa aktardı",
  IMPORT: "içe aktardı",
  BULK_DELETE: "toplu sildi",
  BULK_UPDATE: "toplu güncelledi",
  BOT_START: "bot başlattı",
  BOT_COMPLETE: "bot tamamladı",
  BOT_ERROR: "bot hatası",
  SETTINGS_UPDATE: "ayarları güncelledi",
  PASSWORD_CHANGE: "şifre değiştirdi",
  PERMISSION_CHANGE: "yetki değiştirdi",
};

export const resourceLabels: Record<string, string> = {
  customers: "Müşteri",
  documents: "Dosya",
  beyanname_takip: "Beyanname",
  beyanname_turleri: "Beyanname Türü",
  credentials: "Şifre Bilgisi",
  users: "Kullanıcı",
  settings: "Ayarlar",
  reminders: "Hatırlatıcı",
  tasks: "Görev",
  gib_bot: "GİB Bot",
  turmob_bot: "TÜRMOB Bot",
  email: "E-posta",
  announcements: "Duyuru",
  sgk_kontrol: "SGK Kontrol",
  kdv_kontrol: "KDV Kontrol",
  takip: "Takip Çizelgesi",
  takip_satirlar: "Takip Satırı",
  takip_kolonlar: "Takip Kolonu",
  customer_groups: "Müşteri Grubu",
  customer_branches: "SGK Şubesi",
};

// ============================================
// ENTITY NAME RESOLVER
// ============================================

/**
 * Details alanından entity adını çıkarır (fallback zinciri)
 * NOT: `field` dahil DEĞİL - field teknik alan adıdır, entity adı değil.
 * baslik (Türkçe) kod'dan (İngilizce) önce gelir.
 */
function resolveEntityName(details?: Record<string, unknown> | null): string | null {
  if (!details) return null;

  // Fallback zinciri: entityName -> unvan -> title -> name -> baslik -> kod
  if (typeof details.entityName === "string" && details.entityName) return details.entityName;
  if (typeof details.unvan === "string" && details.unvan) return details.unvan;
  if (typeof details.title === "string" && details.title) return details.title;
  if (typeof details.name === "string" && details.name) return details.name;
  if (typeof details.baslik === "string" && details.baslik) return details.baslik;
  if (typeof details.kod === "string" && details.kod) return details.kod;

  return null;
}

// ============================================
// BEYANNAME STATUS LABELS
// ============================================

const statusLabels: Record<string, string> = {
  verildi: "verildi",
  bekliyor: "bekliyor",
  verilmeyecek: "verilmeyecek",
  bos: "boş",
};

const monthNames = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// ============================================
// DESCRIPTION BUILDERS (per resource+action)
// ============================================

function buildCustomersDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const entityName = resolveEntityName(details);

  switch (action) {
    case "CREATE":
      return {
        primary: entityName
          ? `${userName}, ${entityName} adlı yeni mükellef ekledi`
          : `${userName}, yeni bir mükellef ekledi`,
        secondary: details?.vknTckn ? `VKN/TCKN: ${details.vknTckn}` : undefined,
        meta: { entityName: entityName || undefined },
      };

    case "UPDATE":
      return {
        primary: entityName
          ? `${userName}, ${entityName} müşterisini güncelledi`
          : `${userName}, bir müşteri kaydını güncelledi`,
        secondary: details?.changedFields
          ? `Değiştirilen: ${(details.changedFields as string[]).join(", ")}`
          : undefined,
        meta: { entityName: entityName || undefined, changedFields: details?.changedFields as string[] | undefined },
      };

    case "DELETE":
      return {
        primary: entityName
          ? `${userName}, ${entityName} müşterisini sildi`
          : `${userName}, bir müşteri kaydını sildi`,
        secondary: details?.vknTckn ? `VKN/TCKN: ${details.vknTckn}` : undefined,
        meta: { entityName: entityName || undefined },
      };

    case "IMPORT": {
      const count = details?.count as number | undefined;
      return {
        primary: count
          ? `${userName}, ${count} müşteri kaydı içe aktardı`
          : `${userName}, müşteri verilerini içe aktardı`,
        secondary: details?.successCount != null
          ? `Başarılı: ${details.successCount}, Başarısız: ${details.failCount ?? 0}`
          : undefined,
      };
    }

    case "BULK_DELETE": {
      const count = details?.count as number | undefined;
      return {
        primary: count
          ? `${userName}, ${count} müşteri kaydını toplu sildi`
          : `${userName}, müşteri kayıtlarını toplu sildi`,
      };
    }

    case "BULK_UPDATE": {
      const count = details?.count as number | undefined;
      return {
        primary: count
          ? `${userName}, ${count} müşteri kaydını toplu güncelledi`
          : `${userName}, müşteri kayıtlarını toplu güncelledi`,
      };
    }

    default:
      return buildGenericDescription(action, "customers", details, userName);
  }
}

function buildBeyannameTakipDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const kod = details?.kod as string | undefined;
  const status = details?.status as string | undefined;
  const year = details?.year as number | undefined;
  const month = details?.month as number | undefined;

  const periodStr = year && month ? `${monthNames[month] || month}. ay ${year}` : undefined;

  switch (action) {
    case "UPDATE":
      return {
        primary: kod
          ? `${userName}, ${kod} beyanname durumunu güncelledi`
          : `${userName}, beyanname durumunu güncelledi`,
        secondary: [
          status ? `Durum: ${statusLabels[status] || status}` : null,
          periodStr,
        ].filter(Boolean).join(" - ") || undefined,
        meta: { entityName: kod || undefined },
      };

    case "BULK_UPDATE": {
      const count = details?.count as number | undefined;
      const actionType = details?.action as string | undefined;
      return {
        primary: actionType === "reset"
          ? `${userName}, beyanname durumlarını sıfırladı`
          : `${userName}, ${count || ""} beyanname durumunu toplu güncelledi`,
        secondary: periodStr || undefined,
      };
    }

    case "BULK_DELETE": {
      const count = details?.count as number | undefined;
      return {
        primary: `${userName}, ${count || ""} beyanname takip kaydını toplu sildi`,
        secondary: periodStr || undefined,
      };
    }

    default:
      return buildGenericDescription(action, "beyanname_takip", details, userName);
  }
}

function buildBeyannameTurleriDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const entityName = resolveEntityName(details);
  const aciklama = details?.aciklama as string | undefined;

  switch (action) {
    case "CREATE":
      return {
        primary: entityName
          ? `${userName}, ${entityName} beyanname türünü ekledi`
          : `${userName}, yeni beyanname türü ekledi`,
        secondary: aciklama || undefined,
        meta: { entityName: entityName || undefined },
      };

    case "UPDATE":
      return {
        primary: entityName
          ? `${userName}, ${entityName} beyanname türünü güncelledi`
          : `${userName}, bir beyanname türünü güncelledi`,
        secondary: details?.aktif != null ? `Durum: ${details.aktif ? "Aktif" : "Pasif"}` : undefined,
        meta: { entityName: entityName || undefined },
      };

    case "DELETE":
      return {
        primary: entityName
          ? `${userName}, ${entityName} beyanname türünü sildi`
          : `${userName}, bir beyanname türünü sildi`,
        meta: { entityName: entityName || undefined },
      };

    default:
      return buildGenericDescription(action, "beyanname_turleri", details, userName);
  }
}

// Credential field -> Türkçe etiket
const credentialFieldLabels: Record<string, string> = {
  all_customer_credentials_summary: "tüm müşteri şifre özetini",
  gib_credentials: "GİB şifre bilgilerini",
  sgk_credentials: "SGK şifre bilgilerini",
  edevlet_credentials: "e-Devlet şifre bilgilerini",
  credentials: "şifre bilgilerini",
};

function buildCredentialsDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const entityName = resolveEntityName(details);
  const field = details?.field as string | undefined;
  const fieldLabel = field ? credentialFieldLabels[field] || "şifre bilgilerini" : "şifre bilgilerini";

  switch (action) {
    case "VIEW_SENSITIVE":
      // field = "all_customer_credentials_summary" → "tüm müşteri şifre özetini görüntüledi"
      // field = "gib_credentials" + entityName → "ABC Ltd. GİB şifre bilgilerini görüntüledi"
      if (field === "all_customer_credentials_summary") {
        return {
          primary: `${userName}, ${fieldLabel} görüntüledi`,
        };
      }
      return {
        primary: entityName
          ? `${userName}, ${entityName} ${fieldLabel} görüntüledi`
          : `${userName}, ${fieldLabel} görüntüledi`,
        meta: { entityName: entityName || undefined },
      };

    case "UPDATE":
      return {
        primary: entityName
          ? `${userName}, ${entityName} ${fieldLabel} güncelledi`
          : `${userName}, ${fieldLabel} güncelledi`,
        meta: { entityName: entityName || undefined },
      };

    default:
      return buildGenericDescription(action, "credentials", details, userName);
  }
}

function buildUsersDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const targetName = (details?.name as string) || (details?.email as string);

  switch (action) {
    case "LOGIN":
      return {
        primary: `${userName} sisteme giriş yaptı`,
        secondary: details?.ipAddress ? `IP: ${details.ipAddress}` : undefined,
      };

    case "LOGOUT":
      return { primary: `${userName} sistemden çıkış yaptı` };

    case "LOGIN_FAILED":
      return {
        primary: `Başarısız giriş denemesi`,
        secondary: details?.email
          ? `E-posta: ${details.email}${details.reason ? ` - ${details.reason}` : ""}`
          : undefined,
      };

    case "CREATE":
      return {
        primary: targetName
          ? `${userName}, ${targetName} kullanıcısını oluşturdu`
          : `${userName}, yeni kullanıcı oluşturdu`,
        secondary: details?.role ? `Rol: ${details.role === "admin" ? "Yönetici" : "Kullanıcı"}` : undefined,
        meta: { entityName: targetName || undefined },
      };

    case "UPDATE":
      return {
        primary: targetName
          ? `${userName}, ${targetName} kullanıcısını güncelledi`
          : `${userName}, bir kullanıcıyı güncelledi`,
        meta: { entityName: targetName || undefined },
      };

    case "DELETE":
      return {
        primary: targetName
          ? `${userName}, ${targetName} kullanıcısını sildi`
          : `${userName}, bir kullanıcıyı sildi`,
        meta: { entityName: targetName || undefined },
      };

    case "PASSWORD_CHANGE":
      return { primary: `${userName} şifresini değiştirdi` };

    case "PERMISSION_CHANGE":
      return {
        primary: targetName
          ? `${userName}, ${targetName} kullanıcısının yetkilerini değiştirdi`
          : `${userName}, kullanıcı yetkilerini değiştirdi`,
        meta: { entityName: targetName || undefined },
      };

    default:
      return buildGenericDescription(action, "users", details, userName);
  }
}

function buildTasksDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const entityName = resolveEntityName(details);

  switch (action) {
    case "CREATE":
      return {
        primary: entityName
          ? `${userName}, "${entityName}" görevini oluşturdu`
          : `${userName}, yeni bir görev oluşturdu`,
        meta: { entityName: entityName || undefined },
      };

    case "UPDATE":
      return {
        primary: entityName
          ? `${userName}, "${entityName}" görevini güncelledi`
          : `${userName}, bir görevi güncelledi`,
        meta: { entityName: entityName || undefined },
      };

    case "DELETE":
      return {
        primary: entityName
          ? `${userName}, "${entityName}" görevini sildi`
          : `${userName}, bir görevi sildi`,
        meta: { entityName: entityName || undefined },
      };

    default:
      return buildGenericDescription(action, "tasks", details, userName);
  }
}

function buildRemindersDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const entityName = resolveEntityName(details);

  switch (action) {
    case "CREATE":
      return {
        primary: entityName
          ? `${userName}, "${entityName}" hatırlatıcısını oluşturdu`
          : `${userName}, yeni hatırlatıcı oluşturdu`,
        meta: { entityName: entityName || undefined },
      };

    case "UPDATE":
      return {
        primary: entityName
          ? `${userName}, "${entityName}" hatırlatıcısını güncelledi`
          : `${userName}, bir hatırlatıcıyı güncelledi`,
        meta: { entityName: entityName || undefined },
      };

    case "DELETE":
      return {
        primary: entityName
          ? `${userName}, "${entityName}" hatırlatıcısını sildi`
          : `${userName}, bir hatırlatıcıyı sildi`,
        meta: { entityName: entityName || undefined },
      };

    default:
      return buildGenericDescription(action, "reminders", details, userName);
  }
}

function buildTakipKolonlarDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  // Kolon adı için baslik (Türkçe) öncelikli, kod fallback
  const baslik = details?.baslik as string | undefined;
  const kod = details?.kod as string | undefined;
  const kolonAdi = baslik || kod;

  switch (action) {
    case "CREATE":
      return {
        primary: kolonAdi
          ? `${userName}, "${kolonAdi}" takip kolonunu ekledi`
          : `${userName}, yeni takip kolonu ekledi`,
        meta: { entityName: kolonAdi || undefined },
      };

    case "UPDATE":
      return {
        primary: kolonAdi
          ? `${userName}, "${kolonAdi}" takip kolonunu güncelledi`
          : `${userName}, bir takip kolonunu güncelledi`,
        meta: { entityName: kolonAdi || undefined },
      };

    case "DELETE":
      return {
        primary: kolonAdi
          ? `${userName}, "${kolonAdi}" takip kolonunu sildi`
          : `${userName}, bir takip kolonunu sildi`,
        meta: { entityName: kolonAdi || undefined },
      };

    default:
      return buildGenericDescription(action, "takip_kolonlar", details, userName);
  }
}

function buildTakipSatirlarDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const customerName = details?.customerName as string | undefined;
  // kolonBaslik (Türkçe) öncelikli, kolonKod fallback
  const kolonBaslik = details?.kolonBaslik as string | undefined;
  const kolonKod = details?.kolonKod as string | undefined;
  const kolonAdi = kolonBaslik || kolonKod;
  const field = details?.field as string | undefined;

  // Boolean değer -> Türkçe etiket
  const valueToLabel = (val: unknown): string => {
    if (val === true) return "Tamam";
    if (val === false) return "İptal";
    if (val === null || val === undefined) return "Bekliyor";
    return String(val);
  };

  switch (action) {
    case "UPDATE": {
      if (field === "SONDUR") {
        const newValue = details?.newValue;
        return {
          primary: customerName
            ? `${userName}, ${customerName} satırını ${newValue === true ? "tamamlandı" : "tamamlanmadı"} olarak işaretledi`
            : `${userName}, bir takip satırını güncelledi`,
          meta: { entityName: customerName || undefined },
        };
      }
      // Normal kolon değişikliği
      const value = details?.value;
      const valueStr = valueToLabel(value);
      return {
        primary: customerName && kolonAdi
          ? `${userName}, ${customerName} satırında "${kolonAdi}" kolonunu güncelledi`
          : customerName
            ? `${userName}, ${customerName} takip satırını güncelledi`
            : `${userName}, bir takip satırını güncelledi`,
        secondary: kolonAdi ? `${kolonAdi}: ${valueStr}` : undefined,
        meta: { entityName: customerName || undefined },
      };
    }

    case "CREATE":
      return {
        primary: customerName
          ? `${userName}, ${customerName} için takip satırı oluşturdu`
          : `${userName}, yeni takip satırı oluşturdu`,
        meta: { entityName: customerName || undefined },
      };

    case "DELETE":
      return {
        primary: customerName
          ? `${userName}, ${customerName} takip satırını sildi`
          : `${userName}, bir takip satırını sildi`,
        meta: { entityName: customerName || undefined },
      };

    case "BULK_UPDATE": {
      const count = details?.count as number | undefined;
      const resetAction = details?.action as string | undefined;
      const bulkKolonAdi = kolonBaslik || kolonKod;
      const bulkValueLabel = details?.valueLabel as string | undefined;

      if (resetAction === "reset") {
        const year = details?.year as number | undefined;
        const month = details?.month as number | undefined;
        const periodStr = year && month ? `${monthNames[month] || month}. ay ${year}` : undefined;
        return {
          primary: count
            ? `${userName}, ${count} takip satırını sıfırladı`
            : `${userName}, takip satırlarını sıfırladı`,
          secondary: periodStr || undefined,
        };
      }

      return {
        primary: count && bulkKolonAdi
          ? `${userName}, ${count} satırda "${bulkKolonAdi}" kolonunu toplu güncelledi`
          : count
            ? `${userName}, ${count} takip satırını toplu güncelledi`
            : `${userName}, takip satırlarını toplu güncelledi`,
        secondary: bulkKolonAdi && bulkValueLabel ? `${bulkKolonAdi}: ${bulkValueLabel}` : undefined,
      };
    }

    default:
      return buildGenericDescription(action, "takip_satirlar", details, userName);
  }
}

function buildDocumentsDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const entityName = resolveEntityName(details);

  switch (action) {
    case "CREATE":
      return {
        primary: entityName
          ? `${userName}, ${entityName} dosyasını yükledi`
          : `${userName}, yeni dosya yükledi`,
        meta: { entityName: entityName || undefined },
      };

    case "DELETE":
      return {
        primary: entityName
          ? `${userName}, ${entityName} dosyasını sildi`
          : `${userName}, bir dosyayı sildi`,
        meta: { entityName: entityName || undefined },
      };

    case "BULK_DELETE": {
      const count = details?.count as number | undefined;
      return {
        primary: count
          ? `${userName}, ${count} dosyayı toplu sildi`
          : `${userName}, dosyaları toplu sildi`,
      };
    }

    case "BULK_UPDATE": {
      const count = details?.count as number | undefined;
      return {
        primary: count
          ? `${userName}, ${count} dosyayı toplu güncelledi`
          : `${userName}, dosyaları toplu güncelledi`,
      };
    }

    default:
      return buildGenericDescription(action, "documents", details, userName);
  }
}

function buildSettingsDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const settingType = (details?.settingType as string) || (details?.type as string);

  const settingTypeLabels: Record<string, string> = {
    gib: "GİB",
    turmob: "TÜRMOB",
    general: "genel",
    notification: "bildirim",
  };

  const label = settingType ? settingTypeLabels[settingType] || settingType : "";

  return {
    primary: label
      ? `${userName}, ${label} ayarlarını güncelledi`
      : `${userName}, ayarları güncelledi`,
  };
}

function buildBotDescription(
  action: string,
  resource: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const botLabel = resource === "gib_bot" ? "GİB Bot" : "TÜRMOB Bot";

  switch (action) {
    case "BOT_START":
      return {
        primary: `${userName}, ${botLabel}'u başlattı`,
        secondary: details?.taskType ? `İşlem: ${details.taskType}` : undefined,
      };

    case "BOT_COMPLETE":
      return {
        primary: `${botLabel} işlemi tamamlandı`,
        secondary: details?.count ? `${details.count} kayıt işlendi` : undefined,
      };

    case "BOT_ERROR":
      return {
        primary: `${botLabel} hatası oluştu`,
        secondary: details?.error ? `Hata: ${details.error}` : undefined,
      };

    default:
      return buildGenericDescription(action, resource, details, userName);
  }
}

function buildCustomerGroupsDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const entityName = resolveEntityName(details);

  switch (action) {
    case "CREATE":
      return {
        primary: entityName
          ? `${userName}, "${entityName}" grubunu oluşturdu`
          : `${userName}, yeni müşteri grubu oluşturdu`,
        meta: { entityName: entityName || undefined },
      };

    case "UPDATE":
      return {
        primary: entityName
          ? `${userName}, "${entityName}" grubunu güncelledi`
          : `${userName}, bir müşteri grubunu güncelledi`,
        meta: { entityName: entityName || undefined },
      };

    case "DELETE":
      return {
        primary: entityName
          ? `${userName}, "${entityName}" grubunu sildi`
          : `${userName}, bir müşteri grubunu sildi`,
        meta: { entityName: entityName || undefined },
      };

    default:
      return buildGenericDescription(action, "customer_groups", details, userName);
  }
}

function buildCustomerBranchesDescription(
  action: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const branchName = details?.branchName as string | undefined;
  const customerName = resolveEntityName(details);

  switch (action) {
    case "CREATE": {
      const parts: string[] = [];
      if (branchName) parts.push(`"${branchName}"`);
      parts.push("SGK şubesini ekledi");

      return {
        primary: customerName
          ? `${userName}, ${customerName} müşterisine ${parts.join(" ")}`
          : `${userName}, ${branchName ? `"${branchName}" ` : "yeni "}SGK şubesi ekledi`,
        secondary: details?.isFirstBranch ? "İlk şube (SGK verileri taşındı)" : undefined,
        meta: { entityName: branchName || undefined },
      };
    }

    case "UPDATE":
      return {
        primary: branchName
          ? `${userName}, "${branchName}" SGK şubesini güncelledi`
          : `${userName}, bir SGK şubesini güncelledi`,
        meta: { entityName: branchName || undefined },
      };

    case "DELETE":
      return {
        primary: branchName
          ? `${userName}, "${branchName}" SGK şubesini sildi`
          : `${userName}, bir SGK şubesini sildi`,
        meta: { entityName: branchName || undefined },
      };

    default:
      return buildGenericDescription(action, "customer_branches", details, userName);
  }
}

// ============================================
// GENERIC FALLBACK
// ============================================

function buildGenericDescription(
  action: string,
  resource: string,
  details: Record<string, unknown> | null,
  userName: string
): ActivityDescription {
  const actionLabel = actionLabels[action] || action.toLowerCase();
  const resLabel = resourceLabels[resource] || resource;
  const entityName = resolveEntityName(details);

  // Bulk işlemler için count
  const count = details?.count as number | undefined;

  if (count && (action === "BULK_DELETE" || action === "BULK_UPDATE" || action === "IMPORT")) {
    return {
      primary: `${userName}, ${count} ${resLabel.toLowerCase()} kaydını ${actionLabel}`,
    };
  }

  return {
    primary: entityName
      ? `${userName}, ${entityName} ${resLabel.toLowerCase()} kaydını ${actionLabel}`
      : `${userName}, bir ${resLabel.toLowerCase()} kaydını ${actionLabel}`,
    meta: { entityName: entityName || undefined },
  };
}

// ============================================
// MODÜL BAĞLAM ETİKETLERİ
// ============================================

/**
 * Her resource'un hangi modüle/alana ait olduğunu gösteren etiketler.
 * takip_satirlar ve takip_kolonlar ikisi de "Takip Çizelgesi" modülüne ait.
 * UI bileşenlerinde zaman satırında gösterilir.
 */
export const moduleContextLabels: Record<string, string> = {
  customers: "Mükellefler",
  documents: "Dosyalar",
  beyanname_takip: "Beyanname Takip",
  beyanname_turleri: "Beyanname Türleri",
  credentials: "Şifreler",
  users: "Kullanıcılar",
  settings: "Ayarlar",
  reminders: "Hatırlatıcılar",
  tasks: "Görevler",
  gib_bot: "GİB Bot",
  turmob_bot: "TÜRMOB Bot",
  email: "E-posta",
  announcements: "Duyurular",
  sgk_kontrol: "SGK Kontrol",
  kdv_kontrol: "KDV Kontrol",
  takip: "Takip Çizelgesi",
  takip_satirlar: "Takip Çizelgesi",
  takip_kolonlar: "Takip Çizelgesi",
  customer_groups: "Müşteri Grupları",
  customer_branches: "SGK Şubeleri",
};

// ============================================
// NOKTA + MODÜL ETİKETİ EKLEYİCİ
// ============================================

/**
 * Cümle sonuna nokta ekler.
 * Modül bağlam etiketi UI tarafında zaman satırına eklenir (moduleContextLabels export).
 */
function finalizeDescription(result: ActivityDescription): ActivityDescription {
  let primary = result.primary.trimEnd();
  if (!primary.endsWith(".") && !primary.endsWith("!") && !primary.endsWith("?")) {
    primary += ".";
  }

  return {
    ...result,
    primary,
  };
}

// ============================================
// MAIN BUILDER (PURE FUNCTION)
// ============================================

/**
 * Audit log kaydı için zengin Türkçe açıklama üretir.
 *
 * PURE FUNCTION - DB çağrısı YAPMAZ.
 * Eski/bozuk details verileri için try-catch + fallback.
 *
 * Her açıklamanın sonuna otomatik olarak:
 * - Nokta (.) eklenir
 * - Modül bağlam etiketi eklenir: (Mükellefler), (Takip Çizelgesi) vb.
 */
export function buildDescription(
  action: string,
  resource: string,
  details: Record<string, unknown> | null | undefined,
  userName: string
): ActivityDescription {
  try {
    const safeDetails = details || null;
    let result: ActivityDescription;

    switch (resource) {
      case "customers":
        result = buildCustomersDescription(action, safeDetails, userName);
        break;
      case "beyanname_takip":
        result = buildBeyannameTakipDescription(action, safeDetails, userName);
        break;
      case "beyanname_turleri":
        result = buildBeyannameTurleriDescription(action, safeDetails, userName);
        break;
      case "credentials":
        result = buildCredentialsDescription(action, safeDetails, userName);
        break;
      case "users":
        result = buildUsersDescription(action, safeDetails, userName);
        break;
      case "tasks":
        result = buildTasksDescription(action, safeDetails, userName);
        break;
      case "reminders":
        result = buildRemindersDescription(action, safeDetails, userName);
        break;
      case "takip_satirlar":
        result = buildTakipSatirlarDescription(action, safeDetails, userName);
        break;
      case "takip_kolonlar":
        result = buildTakipKolonlarDescription(action, safeDetails, userName);
        break;
      case "documents":
        result = buildDocumentsDescription(action, safeDetails, userName);
        break;
      case "settings":
        result = buildSettingsDescription(action, safeDetails, userName);
        break;
      case "gib_bot":
      case "turmob_bot":
        result = buildBotDescription(action, resource, safeDetails, userName);
        break;
      case "customer_groups":
        result = buildCustomerGroupsDescription(action, safeDetails, userName);
        break;
      case "customer_branches":
        result = buildCustomerBranchesDescription(action, safeDetails, userName);
        break;
      default:
        result = buildGenericDescription(action, resource, safeDetails, userName);
        break;
    }

    return finalizeDescription(result);
  } catch (error) {
    // Eski kayıtlar veya beklenmeyen format için graceful fallback
    console.error("[ActivityDescription] Build failed:", {
      action, resource, userName,
      error: error instanceof Error ? error.message : String(error),
    });
    const actionLabel = actionLabels[action] || action.toLowerCase();
    const resLabel = resourceLabels[resource] || resource;
    return {
      primary: `${userName}, bir ${resLabel.toLowerCase()} kaydını ${actionLabel}.`,
    };
  }
}
