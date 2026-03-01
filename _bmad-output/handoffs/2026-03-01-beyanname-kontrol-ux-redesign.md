# Handoff: Beyanname Kontrol Sayfası UX Yeniden Tasarımı

**Tarih:** 2026-03-01 22:00
**Durum:** ✅ UX Design Workflow Tamamlandı (Step 1–14)
**Workflow:** BMAD UX Design (`/bmad-bmm-create-ux-design`)

## Görev Tanımı

> `/dashboard/beyanname-kontrol` sayfasındaki SMMM Asistan Terminal UI kaldırılacak.
> Yerine minimal, sıralı akan bir progress alanı gelecek (beyanname sorgulama sayfasındaki gibi).
> Genel sayfa UI'ı sadeleştirilecek. Mali müşavirler sadelikten hoşlanır.

## KRİTİK KURAL — TÜM BOT AYARLARI KORUNACAK

Kullanıcı açıkça belirtti: **Hiçbir fonksiyonellik kaldırılmayacak, sadece sunum değişecek.**

Korunacak ayarlar:
1. **GİB Giriş Bilgileri** — Kullanıcı kodu, şifre, parola gösterimi
2. **Beyanname Yükleme Tarih Aralığı** — Başlangıç/bitiş tarihi (DatePickerInput)
3. **Mükellef Filtresi** — VKN ve TC Kimlik No ile filtreleme
4. **Beyanname Türü Filtresi** — KDV1, KDV2, MUHSGK vb. checkbox + select
5. **Dönem Filtresi** — Başlangıç/bitiş ay+yıl select'leri
6. **Beyanname İndirme Seçeneği** — İndirme on/off checkbox
7. **Senkronizasyonu Başlat/Durdur** butonları
8. **Bulunan Beyannameler** tablosu
9. **Eşleştirilemeyen Beyannameler** tablosu
10. **Son Taramalar** geçmişi

## Tamamlanan Adımlar

### Step 1 — Initialization
- UX design workspace oluşturuldu
- Tüm ilgili dokümanlar yüklendi ve analiz edildi
- Çıktı dosyası: `_bmad-output/planning-artifacts/ux-design-specification.md`

### Step 2 — Discovery (Project Understanding)
- Mevcut sayfa yapısı analiz edildi (SmmmAsistanPage — split panel + terminal)
- 5 temel sorun tespit edildi (terminal yer kaplıyor, split panel karmaşık, vs.)
- Hedef kullanıcılar tanımlandı (Ahmet 45y ofis sahibi, Ayşe 28y çalışan)
- Beyanname sorgulama sayfası referans UI olarak belirlendi
- 3 tasarım zorluğu ve 3 tasarım fırsatı belirlendi
- Executive Summary dokümana yazıldı

### Step 3–14 — Tamamlanan Adımlar
- Step 3: Core Experience Definition (Party Mode ile geliştirildi)
- Step 4: Desired Emotional Response
- Step 5: UX Pattern Analysis & Inspiration
- Step 6: Design System Foundation
- Step 7: Defining Core Experience
- Step 8: Visual Design Foundation
- Step 9: Design Direction Decision (Wireframes)
- Step 10: User Journey Flows (4 Mermaid diagram)
- Step 11: Component Strategy
- Step 12: UX Consistency Patterns
- Step 13: Responsive Design & Accessibility
- Step 14: Workflow Completion

## Sonraki Adım — Uygulama

UX spec tamamlandı. Sonraki BMAD adımları:
1. `/bmad-bmm-create-architecture` — Mimari (zaten var, güncelleme gerekiyorsa)
2. `/bmad-bmm-create-epics-and-stories` — Epic/Story oluştur
3. `/bmad-bmm-check-implementation-readiness` — Hazırlık kontrolü
4. `/bmad-bmm-sprint-planning` — Sprint planla
5. `/bmad-bmm-create-story` → `/bmad-bmm-dev-story` — Geliştir

## Mevcut Sayfa Bileşenleri (referans)

### Kaldırılacak / Değiştirilecek:
| Bileşen | Dosya | Akıbet |
|---------|-------|--------|
| SmmmAsistanPage | `src/components/beyanname-kontrol/smmm-asistan-page.tsx` | **Tamamen yeniden yazılacak** |
| BotTerminalPanel | `src/components/beyanname-kontrol/bot-terminal-panel.tsx` | **KALDIRILACAK** |
| BotLogPanel | `src/components/beyanname-kontrol/bot-log-panel.tsx` | **Inline progress ile değiştirilecek** |
| Split panel layout | SmmmAsistanPage içinde | **Tek kolon layout ile değiştirilecek** |
| 5 sekme yapısı | SmmmAsistanPage içinde | **Sekmesiz tek akış ile değiştirilecek** |

### Korunacak (yeniden kullanılacak):
| Bileşen | Dosya | Not |
|---------|-------|-----|
| BotControlPanel | `src/components/beyanname-kontrol/bot-control-panel.tsx` | Tüm ayarlar buradan — KORUNACAK |
| useBotConnection | `src/components/kontrol/hooks/use-bot-connection.ts` | Bot bağlantı hook'u — AYNEN KALACAK |
| BotReportModal | `src/components/kontrol/bot-report-modal.tsx` | Rapor dialogu — KALACAK |
| AddCustomerDialog | `src/components/kontrol/dialogs/add-customer-dialog.tsx` | Mükellef ekleme — KALACAK |
| BulunanTab | `src/components/beyanname-kontrol/tabs/bulunan-tab.tsx` | İçeriği tek akışa taşınacak |
| EslesmeyenlerTab | `src/components/beyanname-kontrol/tabs/eslesmeyenler-tab.tsx` | İçeriği tek akışa taşınacak |
| TaramalarTab | `src/components/beyanname-kontrol/tabs/taramalar-tab.tsx` | İçeriği tek akışa taşınacak |

### Referans UI:
| Bileşen | Dosya | Not |
|---------|-------|-----|
| BeyannameClient | `src/components/beyannameler/beyanname-client.tsx` | Progress pattern referansı |

### Context'ler:
| Context | Dosya | Not |
|---------|-------|-----|
| BotLogContext | `src/context/bot-log-context.tsx` | Log verileri için — KORUNACAK |
| TerminalContext | `src/context/terminal-context.tsx` | Kaldırılabilir (terminal ile birlikte) |
| BotResultContext | `src/context/bot-result-context.tsx` | Cross-page persistence — KORUNACAK |

## Tasarım Yönü (Step 2'den)

### Kaldırılacak:
- Mac-style terminal UI (koyu tema, monospace font, trafik ışığı butonları)
- Split-panel layout (2fr/1fr grid)
- 5 sekmeli yapı (Kontrol, Bulunan, Eşleşmeyenler, Taramalar, Ayarlar)

### Eklenecek:
- **Tek kolonlu tek akış layout** (beyanname sorgulama gibi)
- **Minimal inline progress** (ilerleme çubuğu + adım listesi)
- **Progressive disclosure** (gelişmiş filtreler varsayılan kapalı)
- **Collapsible detaylı loglar** (terminal yerine, opsiyonel açılır alan)

## Çıktı Dosyası

`_bmad-output/planning-artifacts/ux-design-specification.md` — Tam UX Design Specification (14 adım tamamlandı)
