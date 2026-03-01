---
title: 'Dashboard Takip Çizelgesi Özet Paneli'
slug: 'dashboard-takip-panel'
created: '2026-01-29'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Next.js 15
  - React 19
  - TailwindCSS 4
  - Prisma 6.19
  - TypeScript 5.7
files_to_modify:
  - src/types/dashboard.ts
  - src/app/api/dashboard/takip-stats/route.ts
  - src/components/dashboard/charts/takip-progress-panel.tsx
  - src/components/dashboard/charts/charts-section.tsx
code_patterns:
  - Card bileşeni kullanımı (CustomerBarChart referans)
  - Period-based API fetching (declaration-status-panel pattern)
  - getUserWithProfile() auth guard
  - tenantId multi-tenant filtering
  - SONDUR value extraction (dual format)
test_patterns:
  - Manuel test: Dashboard görünümü
  - API test: curl ile endpoint testi
---

# Tech-Spec: Dashboard Takip Çizelgesi Özet Paneli

**Created:** 2026-01-29
**Status:** Review

## Overview

### Problem Statement

Dashboard'da Takip Çizelgesi modülünün özet durumu görünmüyor. Kullanıcılar aylık işlemlerin ne kadarının tamamlandığını görmek için ayrı sayfaya gitmek zorunda kalıyor.

### Solution

Dashboard'daki ChartsSection'a (4. kolon) yeni bir "Takip Çizelgesi" paneli ekle. Bu panel:
- Toplam mükellef sayısını gösterecek
- Tamamlanan (SONDUR=true) mükellefleri gösterecek
- 7/51 formatında ilerleme göstergesi
- Progress bar ile görsel gösterim
- Dönem seçici ile senkron çalışacak

### Scope

**In Scope:**
- Yeni TakipProgressPanel bileşeni
- Yeni /api/dashboard/takip-stats API endpoint
- ChartsSection'a entegrasyon (4. kolon)
- Period (yıl/ay) bazlı filtreleme
- Progress bar görselleştirmesi
- "Tümünü Gör" linki (/dashboard/takip)

**Out of Scope:**
- Takip çizelgesi ana sayfasında değişiklik
- Yeni veritabanı tablosu/sütunu
- Detaylı mükellef listesi gösterimi

---

## Context for Development

### Codebase Patterns

1. **Dashboard Panel Pattern** (`src/components/dashboard/charts/customer-bar-chart.tsx`):
   ```tsx
   <Card className="p-4">
     <div className="flex items-center justify-between mb-3">
       <div className="flex items-center gap-2">
         <Icon className="h-4 w-4 text-muted-foreground" />
         <span className="text-sm font-medium">Başlık</span>
       </div>
       <Link href="..." className="text-xs text-primary hover:underline">
         Tümünü Gör
       </Link>
     </div>
     {/* İçerik */}
   </Card>
   ```

2. **Period-Based Fetch Pattern** (`src/components/dashboard/charts/declaration-status-panel.tsx:76-106`):
   ```tsx
   const fetchData = useCallback(async () => {
     const params = new URLSearchParams();
     if (period) {
       params.set("year", String(period.year));
       params.set("month", String(period.month));
     }
     const res = await fetch(`/api/dashboard/takip-stats?${params}`);
     const result = await res.json();
     setData(result);
   }, [period]);

   useEffect(() => {
     fetchData();
   }, [period?.year, period?.month]);
   ```

3. **API Auth Pattern** (`src/app/api/dashboard/stats/route.ts:12-17`):
   ```typescript
   const user = await getUserWithProfile();
   if (!user) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   const tenantId = user.tenantId;
   ```

4. **SONDUR Value Extraction** (`src/components/takip/takip-satir.tsx:114`):
   ```typescript
   // İki format desteklenmeli:
   // Eski: degerler["SONDUR"] = true (boolean)
   // Yeni: degerler["SONDUR"] = { value: true, modifiedBy, modifiedAt }

   function extractSonDurValue(data: unknown): boolean {
     if (typeof data === 'boolean') return data;
     if (typeof data === 'object' && data !== null && 'value' in data) {
       return (data as { value: unknown }).value === true;
     }
     return false;
   }
   ```

### Files to Reference

| File | Purpose | Lines |
| ---- | ------- | ----- |
| `src/components/dashboard/charts/customer-bar-chart.tsx` | Panel yapısı, Card layout | 69-209 |
| `src/components/dashboard/charts/declaration-status-panel.tsx` | Period fetching, progress bar | 68-332 |
| `src/app/api/dashboard/stats/route.ts` | API yapısı, auth guard | 12-249 |
| `src/app/api/takip/satirlar/route.ts` | SONDUR handling | 276-339 |
| `src/types/dashboard.ts` | Dashboard type tanımları | 1-237 |
| `src/components/dashboard/charts/charts-section.tsx` | Grid entegrasyonu | 1-19 |

### Technical Decisions

| Karar | Seçim | Gerekçe |
| ----- | ----- | ------- |
| SONDUR format | Dual support | Backward compatibility |
| Layout | lg:col-span-1 | Grid'in 4. kolonu |
| Progress rengi | Emerald | Mevcut pattern ile uyumlu |
| Empty state | "Veri yok" mesajı | CustomerBarChart pattern |

---

## Implementation Plan

### Tasks

- [x] **Task 1: TakipStats type tanımla**
  - File: `src/types/dashboard.ts`
  - Action: Dosyanın sonuna yeni interface ekle
  - Code:
    ```typescript
    /**
     * Takip çizelgesi istatistikleri
     */
    export interface TakipStats {
      total: number;           // Toplam mükellef (satır) sayısı
      completed: number;       // SONDUR=true olan satır sayısı
      completionRate: number;  // Tamamlanma yüzdesi (0-100)
      period: {
        year: number;
        month: number;
      };
    }
    ```

- [x] **Task 2: Takip stats API endpoint oluştur**
  - File: `src/app/api/dashboard/takip-stats/route.ts` (YENİ DOSYA)
  - Action: Yeni API endpoint oluştur
  - Code:
    ```typescript
    import { NextRequest, NextResponse } from "next/server";
    import { getUserWithProfile } from "@/lib/supabase/auth";
    import { prisma } from "@/lib/db";
    import type { TakipStats } from "@/types/dashboard";

    /**
     * GET /api/dashboard/takip-stats
     * Takip çizelgesi özet istatistiklerini döner
     */
    export async function GET(req: NextRequest) {
      try {
        const user = await getUserWithProfile();
        if (!user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);

        // Mali müşavirlik kuralı: Varsayılan dönem bir önceki ay
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        let defaultMonth = currentMonth - 1;
        let defaultYear = currentYear;
        if (defaultMonth === 0) {
          defaultMonth = 12;
          defaultYear = currentYear - 1;
        }

        const year = parseInt(searchParams.get("year") || String(defaultYear));
        const month = parseInt(searchParams.get("month") || String(defaultMonth));
        const tenantId = user.tenantId;

        // Dönem bazlı takip satırlarını çek
        const satirlar = await prisma.takip_satirlar.findMany({
          where: { tenantId, year, month },
          select: { degerler: true },
        });

        // SONDUR değerini kontrol et (her iki format desteklenmeli)
        let completed = 0;
        for (const satir of satirlar) {
          const degerler = satir.degerler as Record<string, unknown> | null;
          if (degerler && "SONDUR" in degerler) {
            const sondur = degerler["SONDUR"];
            // Eski format: boolean
            if (sondur === true) {
              completed++;
            }
            // Yeni format: { value: boolean, ... }
            else if (
              typeof sondur === "object" &&
              sondur !== null &&
              "value" in (sondur as Record<string, unknown>) &&
              (sondur as Record<string, unknown>).value === true
            ) {
              completed++;
            }
          }
        }

        const total = satirlar.length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const stats: TakipStats = {
          total,
          completed,
          completionRate,
          period: { year, month },
        };

        return NextResponse.json(stats);
      } catch (error) {
        console.error("[Takip Stats API] Error:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }
    ```

- [x] **Task 3: TakipProgressPanel bileşeni oluştur**
  - File: `src/components/dashboard/charts/takip-progress-panel.tsx` (YENİ DOSYA)
  - Action: Yeni React bileşeni oluştur
  - Code:
    ```tsx
    "use client";

    import { useState, useEffect, useCallback } from "react";
    import Link from "next/link";
    import { Card } from "@/components/ui/card";
    import { Skeleton } from "@/components/ui/skeleton";
    import { Badge } from "@/components/ui/badge";
    import { ClipboardList, CheckCircle } from "lucide-react";
    import type { TakipStats } from "@/types/dashboard";

    interface TakipProgressPanelProps {
      period?: { year: number; month: number };
    }

    const monthNames = [
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
    ];

    export function TakipProgressPanel({ period }: TakipProgressPanelProps) {
      const [data, setData] = useState<TakipStats | null>(null);
      const [loading, setLoading] = useState(true);

      const fetchData = useCallback(async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams();
          if (period) {
            params.set("year", String(period.year));
            params.set("month", String(period.month));
          }

          const res = await fetch(`/api/dashboard/takip-stats?${params}`);
          if (!res.ok) throw new Error("Veri yüklenemedi");

          const result: TakipStats = await res.json();
          setData(result);
        } catch (error) {
          console.error("Error fetching takip stats:", error);
        } finally {
          setLoading(false);
        }
      }, [period]);

      useEffect(() => {
        fetchData();
      }, [period?.year, period?.month, fetchData]);

      const periodLabel = data?.period
        ? `${monthNames[data.period.month - 1]} ${data.period.year}`
        : period
        ? `${monthNames[period.month - 1]} ${period.year}`
        : "";

      // Loading state
      if (loading) {
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Takip Çizelgesi</span>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          </Card>
        );
      }

      // Empty state
      if (!data || data.total === 0) {
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Takip Çizelgesi</span>
              {periodLabel && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {periodLabel}
                </Badge>
              )}
            </div>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Bu dönem için veri yok</p>
            </div>
          </Card>
        );
      }

      const linkHref = `/dashboard/takip${
        data.period ? `?year=${data.period.year}&month=${data.period.month}` : ""
      }`;

      return (
        <Card className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Takip Çizelgesi</span>
            </div>
            <Link
              href={linkHref}
              className="text-xs text-primary hover:underline"
            >
              Tümünü Gör
            </Link>
          </div>

          {/* Period Badge */}
          {periodLabel && (
            <Badge variant="secondary" className="mb-3 text-xs">
              {periodLabel}
            </Badge>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <span className="text-2xl font-bold">
                {data.completed}/{data.total}
              </span>
            </div>
            <span className="text-lg font-semibold text-emerald-600">
              %{data.completionRate}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tamamlanan</span>
              <span>{data.completed} mükellef</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${data.completionRate}%` }}
              />
            </div>
          </div>
        </Card>
      );
    }
    ```

- [x] **Task 4: ChartsSection'a TakipProgressPanel ekle**
  - File: `src/components/dashboard/charts/charts-section.tsx`
  - Action: TakipProgressPanel'i import et ve grid'e ekle
  - Code:
    ```tsx
    "use client";

    import { DeclarationStatusPanel } from "./declaration-status-panel";
    import { CustomerBarChart } from "./customer-bar-chart";
    import { TakipProgressPanel } from "./takip-progress-panel";
    import type { DashboardStats } from "@/types/dashboard";

    interface ChartsSectionProps {
      stats: DashboardStats | null;
      loading?: boolean;
    }

    export function ChartsSection({ stats, loading = false }: ChartsSectionProps) {
      return (
        <>
          <DeclarationStatusPanel period={stats?.period} />
          <CustomerBarChart stats={stats?.customers || null} loading={loading} />
          <TakipProgressPanel period={stats?.period} />
        </>
      );
    }
    ```

---

## Acceptance Criteria

- [ ] **AC1: API doğru veri döndürür**
  - Given: Kullanıcı giriş yapmış ve tenant'a ait takip verileri var
  - When: `GET /api/dashboard/takip-stats?year=2026&month=1` çağrılır
  - Then: `{ total: N, completed: M, completionRate: X, period: { year: 2026, month: 1 } }` formatında JSON döner

- [ ] **AC2: Panel dashboard'da görüntülenir**
  - Given: Dashboard sayfası yüklendi
  - When: Kullanıcı ChartsSection alanına bakar
  - Then: "Takip Çizelgesi" başlıklı panel 4. kolonda görünür

- [ ] **AC3: Progress göstergesi doğru**
  - Given: 51 toplam mükellef, 7 tamamlanmış (SONDUR=true)
  - When: Panel render olur
  - Then: "7/51" göstergesi, "%14" yüzde ve progress bar görünür

- [ ] **AC4: Dönem değişikliği çalışır**
  - Given: Panel görüntüleniyor
  - When: PeriodSelector'dan farklı ay seçilir
  - Then: Panel yeni dönemin takip verilerini gösterir

- [ ] **AC5: Link doğru yönlendirir**
  - Given: Panel görüntüleniyor, dönem Ocak 2026
  - When: "Tümünü Gör" linkine tıklanır
  - Then: `/dashboard/takip?year=2026&month=1` sayfasına yönlendirilir

- [ ] **AC6: Boş dönem durumu**
  - Given: Seçili dönemde takip verisi yok
  - When: Panel render olur
  - Then: "Bu dönem için veri yok" mesajı görünür

- [ ] **AC7: SONDUR backward compatibility**
  - Given: Bazı satırlarda eski format (boolean), bazılarında yeni format (object)
  - When: API verileri hesaplar
  - Then: Her iki format da doğru sayılır

---

## Additional Context

### Dependencies

- **Mevcut:** `lucide-react`, `@/components/ui/card`, `@/components/ui/skeleton`, `@/components/ui/badge`
- **Yeni bağımlılık:** Yok

### Testing Strategy

1. **API Test (curl):**
   ```bash
   curl -H "Cookie: ..." "http://localhost:3000/api/dashboard/takip-stats?year=2026&month=1"
   ```

2. **Manuel Test:**
   - Dashboard'a git
   - 4. kolonda "Takip Çizelgesi" panelini kontrol et
   - Progress bar ve sayıları doğrula
   - Dönem değiştir, verinin güncellendiğini kontrol et
   - "Tümünü Gör" linkine tıkla, doğru sayfaya gittiğini kontrol et

3. **Edge Cases:**
   - Boş dönem (hiç satır yok)
   - SONDUR kolonu hiç eklenmemiş tenant
   - Tüm satırlar tamamlanmış (%100)

### Notes

- SONDUR sütunu varsayılan kolonlarda yok, tenant tarafından eklenebilir
- SONDUR yoksa `completed = 0` olarak dönmeli
- Period varsayılanı: Bir önceki ay (mali müşavirlik kuralı)
- Grid layout `lg:grid-cols-4`: DeclarationStatusPanel (2) + CustomerBarChart (1) + TakipProgressPanel (1) = 4

---

## Review Notes

- Adversarial review completed
- Findings: 10 total, 5 fixed (Real), 5 skipped (Noise/Undecided)
- Resolution approach: auto-fix
- Fixed issues:
  - F1: Türkçe karakter düzeltmesi (monthNames)
  - F2: Türkçe karakter düzeltmesi (UI metinleri)
  - F3: Error state eklendi
  - F4: useEffect dependency düzeltildi
  - F6: Aria accessibility eklendi (progressbar)
