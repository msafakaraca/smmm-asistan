# SMMM-AI Dokümantasyon İndeksi

> **Proje:** smmm-asistan
> **Son Güncelleme:** 2026-01-29
> **Durum:** Aktif Geliştirme

---

## 📚 Dokümantasyon Haritası

### Genel Bakış
- **[Proje Genel Bakışı](./project-overview.md)** - Proje özeti, teknoloji yığını, hızlı başlangıç

### Mimari
- **[Ana Web Mimarisi](./architecture-main.md)** - Next.js uygulaması katman yapısı
- **[Electron Bot Mimarisi](./architecture-electron-bot.md)** - Masaüstü bot mimarisi *(planlanıyor)*

### Veri
- **[Veri Modelleri](./data-models.md)** - Prisma şeması, model ilişkileri, index stratejisi

### API
- **[API Kontratları](./api-contracts.md)** - Endpoint listesi, request/response formatları *(planlanıyor)*

### UI
- **[Bileşen Envanteri](./component-inventory.md)** - React bileşen kataloğu *(planlanıyor)*

### Geliştirme
- **[Geliştirme Kılavuzu](./development-guide.md)** - Kurulum, komutlar, kod standartları
- **[CLAUDE.md](../CLAUDE.md)** - Claude Code için detaylı rehber

---

## 📋 Hızlı Referans

### Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:generate` | Prisma client oluştur |
| `npm run db:push` | Schema'yı DB'ye gönder |
| `npm run db:studio` | Prisma Studio |

### Önemli Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `prisma/schema.prisma` | Veritabanı şeması |
| `server.ts` | WebSocket server |
| `src/middleware.ts` | Auth middleware |
| `src/lib/supabase/auth.ts` | Auth helpers |
| `src/lib/crypto.ts` | Şifreleme |
| `src/lib/db.ts` | Prisma client |

### Dizin Yapısı

```
smmm_asistan/
├── prisma/              # DB şeması
├── server.ts            # WS server
├── src/
│   ├── app/             # Next.js App Router
│   │   ├── (auth)/      # Login/Register
│   │   ├── (dashboard)/ # Protected pages
│   │   └── api/         # API routes
│   ├── components/      # React bileşenleri
│   │   ├── ui/          # Radix primitives
│   │   └── [feature]/   # Feature modules
│   └── lib/             # Utilities
├── electron-bot/        # Desktop bot
└── docs/                # Dokümantasyon
```

---

## 🔗 Harici Kaynaklar

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Supabase Docs](https://supabase.com/docs)
- [TanStack Table](https://tanstack.com/table)
- [Radix UI](https://www.radix-ui.com/docs)

---

## 📊 Proje İstatistikleri

| Metrik | Değer |
|--------|-------|
| Prisma Modelleri | 30+ |
| API Endpoint'leri | 100+ |
| React Bileşenleri | 100+ |
| Teknoloji Stack | Next.js 15, React 19, TypeScript 5.7 |

---

## 🗂️ Eski/Arşiv Dokümantasyon

> ⚠️ Aşağıdaki dosyalar güncel değil:

| Dosya | Durum |
|-------|-------|
| `SMMM_AI_Project_Report.md` | ESKİ - MongoDB/Vite sürümü |

---

> **SMMM-AI** - Mali Müşavirler için Akıllı Otomasyon Platformu
