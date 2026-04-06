# SMMM-AI Sunucu Maliyet Raporu

**Tarih:** 2026-04-06
**Durum:** VPS satın alındı, Supabase self-host geçişi planlanıyor

---

## Karar Özeti

Supabase Cloud (Frankfurt, Almanya) yerine Türkiye'de self-hosted Supabase'e geçiş kararı alındı.

### Geçiş Gerekçeleri

| # | Gerekçe | Detay |
|---|---------|-------|
| 1 | **KVKK Uyumluluğu** | TC kimlik, e-Devlet/GİB/SGK şifreleri yurtdışında saklanması KVKK m.9 ihlali riski taşıyor. İhlal cezası: 272.380 TL – 13.620.402 TL |
| 2 | **Müşteri Güveni** | "Verileriniz Türkiye'de şifreli saklanır" mesajı mali müşavirler için güven verici |
| 3 | **Maliyet Avantajı** | Aylık ~590 TL tasarruf (%65 düşüş) |
| 4 | **Performans** | Frankfurt → Türkiye: 30-80ms, Türkiye → Türkiye: 5-15ms |

---

## Maliyet Karşılaştırması

### Supabase Cloud Pro (Eski Plan)

| Kalem | Aylık Maliyet (TL) |
|-------|-------------------|
| Supabase Pro Plan (25$/ay) | ~900 TL |
| Ek kullanım (storage, bandwidth) | Değişken |
| **Toplam** | **~900+ TL/ay** |

### Self-Hosted Supabase — Türkiye VPS (Yeni Plan)

| Kalem | Aylık Maliyet (TL) |
|-------|-------------------|
| Premium Server 7 (DataCasa) | 259,99 TL |
| KDV (%20) | 52,00 TL |
| Weekly Backup (ücretsiz) | 0 TL |
| Supabase yazılımı (açık kaynak) | 0 TL |
| SSL (Let's Encrypt) | 0 TL |
| **Toplam** | **311,99 TL/ay** |

### Tasarruf

| Metrik | Değer |
|--------|-------|
| Aylık tasarruf | ~588 TL |
| Yıllık tasarruf | ~7.056 TL |
| Tasarruf oranı | ~%65 |

---

## Satın Alınan Sunucu Detayları

| Özellik | Değer |
|---------|-------|
| **Sağlayıcı** | DataCasa |
| **Paket** | Premium Server 7 |
| **CPU** | Intel Xeon E5 2698-99 V4 — 4 Core |
| **RAM** | 6 GB DDR4 |
| **Disk** | 100 GB NVMe SSD |
| **Bant Genişliği** | Unlimited Traffic (100 Mbps port) |
| **Konum** | Türkiye |
| **OS** | Ubuntu 22.04 LTS |
| **Uptime SLA** | %99.99 |
| **Depolama** | Dell EMC Unity 300 All-Flash NVMe |
| **Yedekleme** | Haftalık (ücretsiz) |
| **Kurulum** | Ücretsiz |

---

## Seçilmeyen Eklentiler

| Eklenti | Fiyat | Neden Seçilmedi |
|---------|-------|----------------|
| cPanel/Plesk/DirectAdmin | 446-535 TL/ay | SSH + Docker ile yönetim yeterli |
| Ek Port Hızı (300/500 Mbps) | 75-125$/ay | 100 Mbps yeterli |
| 24-Hour Backup | 200 TL/ay | pg_dump otomasyonu kurulacak |
| FTP Backup Area | 81-976 TL/ay | Şu an gerek yok |
| DDoS Protection | 48,62 TL/ay | Cloudflare ücretsiz kullanılacak |
| Ek IP/CPU/RAM/Disk | 3-50 TL/ay | Paketteki yeterli |
| Server Optimization | 3.000-5.000 TL | cPanel yok, geçersiz |
| Lisanslar | 89-669 TL/ay | Hiçbiri gerekli değil |

---

## Kurulacak Altyapı (Ücretsiz)

| Bileşen | Açıklama |
|---------|----------|
| Docker + Docker Compose | Container yönetimi |
| Supabase Self-Hosted | PostgreSQL, GoTrue, PostgREST, Storage, Realtime |
| Let's Encrypt SSL | Otomatik yenilenen HTTPS sertifikası |
| UFW Firewall | Sunucu güvenliği |
| pg_dump Cron | Günlük veritabanı yedekleme |
| Uptime Kuma | Sunucu izleme (monitoring) |
| Cloudflare | DNS + DDoS koruması (ücretsiz plan) |

---

## Ölçekleme Planı

| Kullanıcı Sayısı | Gerekli Aksiyon |
|------------------|----------------|
| 1-50 | Mevcut paket yeterli (Server 7) |
| 50-200 | Server 9'a yükselt (8 GB RAM, 319,99 TL) |
| 200-500 | Server 10'a yükselt (10 GB RAM, 349,99 TL) |
| 500+ | Dedicated server veya ikinci VPS |

---

*Son güncelleme: 2026-04-06*
