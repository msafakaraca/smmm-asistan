# Handoff: Mükellefler Sayfası — Tam Ekran Liste + Ayrı Detay Sayfası

**Tarih:** 2026-03-03
**Durum:** Tamamlandı

## Görev Tanımı

> Mükelefler sayfasındaki split-panel layout'u kaldır. Mükellef listesini tam ekran göster. Bir mükellefe tıkladığında `/dashboard/mukellefler/[id]` şeklinde ayrı bir detay sayfası açılsın. Detay sayfasında mevcut 3 tab (Profil, Şifreler, Şubeler) korunacak.

## Araştırma Bulguları

### Mevcut Yapı

- **`client.tsx` (673 satır):** Split-panel layout. Sol %60 liste, sağ %40 detay paneli. Mobilde detay modal olarak açılıyor.
- **`customer-detail-panel.tsx` (802 satır):** 3 tab — Profil (form), Şifreler (GİB credentials), Şubeler (SGK branch CRUD)
- **`empty-state.tsx` (148 satır):** Hiçbir mükellef seçilmediğinde sağ panelde gösterilen istatistik kartları + son güncellenenler
- **`columns.tsx` (327 satır):** Tablo kolon tanımları, EditableNoCell, actions dropdown
- **`page.tsx`:** Sadece metadata + `<CustomerListClient />` render
- **`[id]` route:** Henüz mevcut değil — oluşturulacak

### Mevcut API'ler (Backend Değişiklik YOK)

- `GET /api/customers` — Liste
- `GET /api/customers/[id]` — Tek mükellef detayı
- `GET /api/customers/[id]/credentials` — GİB şifreleri (encrypted)
- `GET/POST/PUT/DELETE /api/customers/[id]/branches` — Şube CRUD
- `PUT /api/customers/[id]` — Profil güncelleme
- `PATCH /api/customers` — SiraNo güncelleme
- `DELETE /api/customers/bulk-delete` — Toplu silme
- `POST /api/customers/bulk-status` — Toplu durum değiştirme
- `DELETE /api/customers/delete-all` — Tümünü silme

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/app/(dashboard)/dashboard/mukellefler/client.tsx` | **Düzenleme** | Split layout kaldır, tablo tam ekran, satır tıklama → `router.push`, sağ panel + mobil modal kaldır |
| `src/app/(dashboard)/dashboard/mukellefler/columns.tsx` | **Küçük düzenleme** | Kolon boyutlarını tam ekrana göre ayarla (isteğe bağlı) |
| `src/app/(dashboard)/dashboard/mukellefler/[id]/page.tsx` | **Yeni dosya** | Server component — metadata, params'tan id al |
| `src/app/(dashboard)/dashboard/mukellefler/[id]/client.tsx` | **Yeni dosya** | Detay client component — mevcut `customer-detail-panel.tsx`'den adapte |
| `src/app/(dashboard)/dashboard/mukellefler/components/customer-detail-panel.tsx` | **Silinebilir** | İçeriği `[id]/client.tsx`'e taşınacak |
| `src/app/(dashboard)/dashboard/mukellefler/components/empty-state.tsx` | **Silinebilir** | Split panel yok, artık gerek yok |

## Uygulama Planı

### Adım 1: Detay Sayfası Oluştur — `[id]/page.tsx`

- [ ] `src/app/(dashboard)/dashboard/mukellefler/[id]/page.tsx` oluştur
- [ ] Server component, metadata: `"Mükellef Detayı | SMMM Asistan"`
- [ ] `params.id` al, `<CustomerDetailClient id={id} />` render et

```typescript
// Beklenen yapı
import { Metadata } from "next";
import { CustomerDetailClient } from "./client";

export const metadata: Metadata = {
    title: "Mükellef Detayı | SMMM Asistan",
    description: "Mükellef detay bilgileri",
};

export default async function MukellefDetayPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <CustomerDetailClient customerId={id} />;
}
```

### Adım 2: Detay Client Component Oluştur — `[id]/client.tsx`

- [ ] `src/app/(dashboard)/dashboard/mukellefler/[id]/client.tsx` oluştur
- [ ] Mevcut `customer-detail-panel.tsx`'nin tüm içeriğini buraya taşı
- [ ] Değişiklikler:
  - `onClose` prop kaldır → Yerine "← Mükelleflere Dön" butonu (`router.push('/dashboard/mukellefler')` veya `router.back()`)
  - `onCustomerUpdate` prop kaldır (artık liste ayrı sayfada, SWR/revalidation ile çözülecek)
  - Layout tam sayfa olacak: Header üstte, tablar altta, tam genişlik
  - Profil formu: `sm:grid-cols-2` → tam ekranda rahat 2 sütun
  - `ScrollArea` yerine sayfa scroll kullanılabilir
  - Şube ekleme butonu tab bar'ın yanından dışarı çıkabilir (tam ekranda daha iyi konumlandırma)

**Header Yapısı:**
```
┌──────────────────────────────────────────────────────┐
│ ← Mükelleflere Dön   |  🏢 Mükellef Ünvanı  [Aktif] │
├──────────────────────────────────────────────────────┤
│  [Profil]  [Şifreler]  [Şubeler]      [+ Şube Ekle] │
├──────────────────────────────────────────────────────┤
│  Tab içeriği — tam genişlik                          │
└──────────────────────────────────────────────────────┘
```

- [ ] Mevcut state'ler korunacak: `activeTab`, `loading`, `saving`, `customer`, `credentials`, `branches`, vb.
- [ ] Mevcut fonksiyonlar korunacak: `fetchCustomer`, `fetchBranches`, `fetchCredentials`, `onSubmit`, `handleAddBranch`, `handleDeleteBranch`, `handleSaveBranch`, vb.
- [ ] Mevcut dialog'lar korunacak: Branch Add, First Branch Confirmation, Branch Delete Confirmation
- [ ] Profil formu Zod schema'sı aynı kalacak

### Adım 3: Liste Sayfasını Güncelle — `client.tsx`

- [ ] Split-panel container kaldır: `<div className="flex flex-1 overflow-hidden">` → Sadece liste
- [ ] Sol panel genişlik sınırı kaldır: `w-[60%]` → `w-full`
- [ ] Sağ panel tamamen kaldır (desktop detay paneli)
- [ ] Mobil Dialog modal kaldır
- [ ] `selectedCustomerId` state kaldır
- [ ] `isDesktop` / `useMediaQuery` kaldır (artık gerek yok)
- [ ] `handleRowClick` → `router.push(`/dashboard/mukellefler/${customerId}`)` olarak değiştir
- [ ] `useRouter` import et (`next/navigation`)
- [ ] `CustomerDetailPanel` import kaldır
- [ ] `EmptyState` import kaldır
- [ ] `Dialog`, `DialogContent` import kaldır (mobil modal kaldırılıyor)
- [ ] Satır tıklama highlight'ı (`isSelected ? "bg-primary/10..."`) kaldır (artık seçili kavramı yok)
- [ ] `handleDelete` ve `handleDeleteAll`'daki `selectedCustomerId` referansları kaldır
- [ ] Alt bilgi bar korunsun (seçili sayısı, toplam mükellef)
- [ ] Bulk actions bar korunsun
- [ ] WebSocket listener korunsun
- [ ] GİB sync butonu korunsun
- [ ] Toolbar aynen korunsun

### Adım 4: Temizlik

- [ ] `components/customer-detail-panel.tsx` silinebilir (içerik taşındı)
- [ ] `components/empty-state.tsx` silinebilir (split panel yok)
- [ ] `columns.tsx`'teki yorum "Split-view için optimize edilmiş" güncelle

## Teknik Notlar

### Korunması Gereken Fonksiyonalite

1. **Profil formu:** Tüm alanlar (unvan, kisaltma, vknTckn, vergiKimlikNo, tcKimlikNo, vergiDairesi, sirketTipi, email, telefon1, telefon2, adres, yetkiliKisi, notes, siraNo, sozlesmeNo, sozlesmeTarihi) + Zod validation + form.handleSubmit
2. **Şifre yönetimi:** Lazy load, toggle visibility, copy to clipboard, 3 alan (gibKodu, gibParola, gibSifre)
3. **Şube CRUD:** Ekleme (dialog + "Kaydet ve Yeni Ekle"), düzenleme (inline edit), silme (confirm dialog), ilk şube SGK kopyalama onayı
4. **WebSocket:** `gib:mukellef-import-complete` ve `gib:mukellef-import-error` listener'ları (listede kalacak)
5. **Bulk actions:** Toplu silme, toplu durum değiştirme (aktif/pasif), tümünü silme
6. **Satır düzenleme:** SiraNo inline edit (listede kalacak)
7. **Import:** GİB sync, CSV import, import results dialog

### Dikkat Edilecek Edge Case'ler

- Detay sayfasında mükellef silinmişse veya erişim yoksa → "Müşteri bulunamadı" state'i zaten mevcut (`customer-detail-panel.tsx:320-329`)
- Detay sayfasından listeye dönüldüğünde liste güncel olmalı → SWR veya basit fetch (mevcut `fetchCustomers` pattern'i yeterli, sayfa mount'ta çalışıyor)
- Tab değişimlerinde lazy loading korunmalı (credentials ve branches sadece ilgili tab'a geçildiğinde fetch edilir)

### Performans

- `useRouter` kullanımı client-side navigation sağlar (sayfa yeniden yüklenmez)
- Detay sayfası kendi `fetchCustomer` çağrısını yapacak (mevcut pattern)
- Liste sayfasına dönüşte `fetchCustomers` yeniden çalışacak (günceli alır)

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| `[id]` dynamic route | Next.js standard, URL paylaşılabilir, browser back/forward çalışır | Query param (`?id=xxx`) — URL daha kirli |
| `router.push` ile navigasyon | Client-side, hızlı, tam sayfa yenileme yok | `<Link>` — tablo satırına Link sarma zor |
| `customer-detail-panel.tsx` taşıma (silme) | Kod tekrarını önler, tek kaynak | İkisini birden tutma — bakım yükü |
| `empty-state.tsx` silme | Split panel yok, artık anlamsız | Listede göster — ama zaten tablo boşken mesaj var |
| Tab yapısı Radix Tabs ile | Zaten kullanılıyor, genişleyebilir, ekstra soyutlama gereksiz | Config-driven tabs — YAGNI |
