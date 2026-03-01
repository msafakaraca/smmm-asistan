# Dashboard Analytics - BMAD Analiz Raporu

**Tarih:** 2026-01-29
**Analiz Tipi:** Feature Discovery & Planning
**Epic:** E11-S6

---

## 1. Mevcut Durum Analizi

### Şu An Ne Var?

**Dosya:** `src/components/dashboard/dashboard-content.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  Hoş Geldin, [Kullanıcı Adı]                           │
│  [Tenant Adı]                                           │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Müşteri  │ │ Bekleyen │ │ Gönder.  │ │ Abonelik │   │
│  │    0     │ │    0     │ │    0     │ │  Deneme  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│  Hızlı Erişim:                                          │
│  [Takip Çizelgesi] [Beyanname Kontrol] [AI Asistan]     │
└─────────────────────────────────────────────────────────┘
```

### Sorunlar

| Sorun | Etki |
|-------|------|
| Tüm değerler sabit "0" | Kullanıcı hiçbir bilgi görmüyor |
| Grafik/chart yok | Görsel analiz yapılamıyor |
| Trend verisi yok | Gelişim takip edilemiyor |
| Dönem seçimi yok | Sadece anlık veri |
| Detaya inme yok | Tıklayınca bir şey olmuyor |

---

## 2. Veri Kaynakları (Mevcut API'ler)

### Kullanılabilir Veriler

| Veri | API Endpoint | Tablo |
|------|--------------|-------|
| Müşteri sayıları | `/api/customers` | `customers` |
| Beyanname durumları | `/api/beyanname-takip` | `beyanname_takip` |
| Görev istatistikleri | `/api/tasks/stats` | `tasks` |
| Şifre durumları | `/api/sifreler/summary` | `customers` |
| Gönderim logları | `/api/bulk-send/status` | `bulk_send_logs` |
| SGK kontrol | `/api/sgk-kontrol` | `sgk_kontrol` |
| KDV kontrol | `/api/kdv-kontrol` | `kdv_kontrol` |

### Eksik API'ler (Oluşturulması Gereken)

```
/api/dashboard/stats      → Tüm özet metrikler
/api/dashboard/trends     → Aylık trend verileri
/api/dashboard/alerts     → Kritik uyarılar
```

---

## 3. Önerilen Dashboard Tasarımı

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                    [Dönem: Ocak 2026 ▼]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ 📊 Müşteri  │ │ 📋 Beyanname│ │ ✅ Görevler │ │ 📧 İletişim │       │
│  │    127      │ │    89/127   │ │   45 Açık   │ │  234 Mail   │       │
│  │   +5 bu ay  │ │   %70 tamamı│ │  12 Gecikmiş│ │  %94 Başarı │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────┐  ┌─────────────────────────────────┐│
│  │   Beyanname Durumu (Pasta)    │  │   Aylık Trend (Çizgi Grafik)   ││
│  │                               │  │                                 ││
│  │      ████ Verildi: 89         │  │    100┤    ╭──────╮             ││
│  │      ░░░░ Bekliyor: 25        │  │     80┤───╯      ╰───          ││
│  │      ▓▓▓▓ Verilmeyecek: 13    │  │     60┤                        ││
│  │                               │  │       └──────────────────────  ││
│  │                               │  │        Eki  Kas  Ara  Oca      ││
│  └───────────────────────────────┘  └─────────────────────────────────┘│
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────┐  ┌─────────────────────────────────┐│
│  │   Müşteri Dağılımı (Bar)      │  │   Kritik Uyarılar 🔔            ││
│  │                               │  │                                 ││
│  │   Firma    ████████████ 78    │  │   ⚠️ 12 müşterinin GİB şifresi  ││
│  │   Şahıs    ██████████ 42      │  │      eksik                      ││
│  │   B.Usul   ████ 7             │  │   ⚠️ 5 beyanname son gün!       ││
│  │                               │  │   ⚠️ 3 görev gecikmiş           ││
│  └───────────────────────────────┘  └─────────────────────────────────┘│
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │   Son Aktiviteler                                                  │ │
│  │                                                                    │ │
│  │   🕐 10:30  KDV beyannamesi verildi - ABC Ltd.                    │ │
│  │   🕐 10:15  Yeni müşteri eklendi - XYZ A.Ş.                       │ │
│  │   🕐 09:45  SGK bildirimi tamamlandı - 5 müşteri                  │ │
│  │   🕐 09:00  Toplu mail gönderildi - 45 alıcı                      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Dashboard Widget'ları (Detaylı)

### 4.1 Özet Kartları (Summary Cards)

| Kart | Gösterilen Veri | Kaynak |
|------|-----------------|--------|
| **Toplam Müşteri** | Aktif müşteri sayısı + bu ay eklenen | `customers` |
| **Beyanname Durumu** | Verilen/Toplam + Tamamlanma % | `beyanname_takip` |
| **Açık Görevler** | Bekleyen + Gecikmiş görev sayısı | `tasks` |
| **İletişim** | Bu ay gönderilen + Başarı oranı | `bulk_send_logs` |

### 4.2 Grafikler

| Grafik | Tip | Veri |
|--------|-----|------|
| **Beyanname Durumu** | Pasta (Pie) | verildi, bekliyor, verilmeyecek |
| **Aylık Trend** | Çizgi (Line) | Son 6 ayın beyanname tamamlanma oranı |
| **Müşteri Dağılımı** | Bar (Horizontal) | Firma, Şahıs, Basit Usul |
| **Görev Öncelikleri** | Donut | Düşük, Orta, Yüksek |

### 4.3 Kritik Uyarılar

| Uyarı Tipi | Koşul | Öncelik |
|------------|-------|---------|
| Eksik GİB Şifresi | `gibSifre IS NULL` | 🟡 Orta |
| Son Gün Beyanname | Beyanname tarihi ≤ 3 gün | 🔴 Yüksek |
| Gecikmiş Görev | `dueDate < NOW()` | 🔴 Yüksek |
| Eksik SGK Bildirimi | SGK status = 'bos' | 🟡 Orta |

### 4.4 Aktivite Akışı

```typescript
interface Activity {
  timestamp: Date;
  type: 'beyanname' | 'customer' | 'task' | 'mail' | 'sgk';
  action: string;
  details: string;
  userId: string;
}
```

Kaynak: `audit_logs` tablosu

---

## 5. Teknik Gereksinimler

### 5.1 Yeni Paketler

```bash
npm install recharts
# veya
npm install @tremor/react  # Hazır dashboard componentleri
```

**Neden Recharts?**
- React için optimize
- Hafif (< 50KB)
- TypeScript desteği
- Responsive
- Accessibility

### 5.2 Yeni API Endpoint'leri

**`/api/dashboard/stats`**
```typescript
interface DashboardStats {
  customers: {
    total: number;
    byType: { firma: number; sahis: number; basitUsul: number };
    newThisMonth: number;
  };
  beyanname: {
    total: number;
    verildi: number;
    bekliyor: number;
    verilmeyecek: number;
    completionRate: number;
  };
  tasks: {
    open: number;
    overdue: number;
    completedThisMonth: number;
  };
  communication: {
    emailsSent: number;
    successRate: number;
    whatsappSent: number;
  };
}
```

**`/api/dashboard/trends`**
```typescript
interface TrendData {
  month: string;
  beyannameTamamlanan: number;
  yeniMusteri: number;
  gorevTamamlanan: number;
}

// Son 6 ayın verisi
```

**`/api/dashboard/alerts`**
```typescript
interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  count: number;
  link: string;
}
```

### 5.3 Component Yapısı

```
src/components/dashboard/
├── dashboard-content.tsx      (mevcut, güncellenecek)
├── stats-card.tsx             (yeni)
├── charts/
│   ├── beyanname-pie-chart.tsx
│   ├── trend-line-chart.tsx
│   ├── customer-bar-chart.tsx
│   └── task-donut-chart.tsx
├── alerts-panel.tsx           (yeni)
├── activity-feed.tsx          (yeni)
└── period-selector.tsx        (yeni)
```

---

## 6. Uygulama Fazları

### Faz 1: Temel Dashboard (1 hafta)
- [ ] Recharts kurulumu
- [ ] `/api/dashboard/stats` endpoint
- [ ] Özet kartlarını gerçek veriye bağla
- [ ] Dönem seçici ekle

**Çıktı:** Çalışan temel dashboard

### Faz 2: Grafikler (1 hafta)
- [ ] Beyanname pasta grafiği
- [ ] Müşteri bar grafiği
- [ ] Görev donut grafiği
- [ ] `/api/dashboard/trends` endpoint

**Çıktı:** Görsel dashboard

### Faz 3: Uyarılar & Aktivite (3-5 gün)
- [ ] Kritik uyarılar paneli
- [ ] `/api/dashboard/alerts` endpoint
- [ ] Aktivite akışı (audit_logs'dan)
- [ ] Tıklanabilir kartlar (detaya gitme)

**Çıktı:** Tam fonksiyonel dashboard

---

## 7. Örnek Kod

### Stats Card Component

```typescript
// src/components/dashboard/stats-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <p className={`text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% bu ay
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### Dashboard Stats API

```typescript
// src/app/api/dashboard/stats/route.ts
export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const user = await requireAuth();

    const [
      customerStats,
      beyannameStats,
      taskStats,
      commStats
    ] = await Promise.all([
      // Müşteri istatistikleri
      prisma.customers.groupBy({
        by: ['sirketTipi'],
        where: { tenantId: user.tenantId, status: 'active' },
        _count: true,
      }),

      // Beyanname istatistikleri (bu ay)
      prisma.beyanname_takip.findMany({
        where: {
          tenantId: user.tenantId,
          year: currentYear,
          month: currentMonth,
        },
      }),

      // Görev istatistikleri
      prisma.tasks.groupBy({
        by: ['status'],
        where: { tenantId: user.tenantId },
        _count: true,
      }),

      // İletişim istatistikleri
      prisma.bulk_send_logs.aggregate({
        where: {
          tenantId: user.tenantId,
          createdAt: { gte: startOfMonth },
        },
        _count: true,
        // ... success rate calculation
      }),
    ]);

    return {
      customers: { /* ... */ },
      beyanname: { /* ... */ },
      tasks: { /* ... */ },
      communication: { /* ... */ },
    };
  });
}
```

---

## 8. Maliyet & Effort Analizi

| Faz | Süre | Story Points |
|-----|------|--------------|
| Faz 1: Temel | 5 gün | 8 SP |
| Faz 2: Grafikler | 5 gün | 8 SP |
| Faz 3: Uyarılar | 3 gün | 5 SP |
| **Toplam** | **~2 hafta** | **21 SP** |

### Bağımlılıklar

```
Faz 1 ──► Faz 2 ──► Faz 3
```

Her faz bağımsız deploy edilebilir.

---

## 9. Başarı Metrikleri

| Metrik | Hedef |
|--------|-------|
| Dashboard yüklenme süresi | < 2 saniye |
| API response süresi | < 500ms |
| Kullanıcı etkileşimi | Günlük dashboard ziyareti %80+ |
| Veri doğruluğu | %100 (gerçek veri) |

---

## 10. Sonraki Adımlar

| Seçenek | Açıklama |
|---------|----------|
| **A** | Faz 1'i hemen başlat (Story detaylandır) |
| **B** | Sadece özet kartları düzelt (hızlı kazanım) |
| **C** | Önce Tremor/Recharts araştır |
| **D** | Başka özelliğe geç |

---

## Referanslar

- [Recharts Documentation](https://recharts.org/)
- [Tremor - React Dashboard Components](https://tremor.so/)
- Mevcut dosya: `src/components/dashboard/dashboard-content.tsx`
