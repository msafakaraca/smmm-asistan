# Story: E11-S16 - Test Altyapısı Kurulumu

**Epic:** E11 - İyileştirmeler
**Sprint:** S1 - Altyapı İyileştirmeleri
**Öncelik:** P1 (Yüksek)
**Story Points:** 13
**Tahmini Süre:** 3-5 gün

---

## Kullanıcı Hikayesi

**Bir** geliştirici olarak,
**İstiyorum ki** proje için test altyapısı kurulu olsun,
**Böylece** kod değişikliklerinin mevcut işlevselliği bozmadığından emin olabilirim.

---

## Kabul Kriterleri

### AC-1: Jest Kurulumu
- [ ] Jest ve ilgili paketler yüklü
- [ ] `jest.config.js` yapılandırılmış
- [ ] TypeScript desteği aktif (`ts-jest`)
- [ ] Path alias'lar çalışıyor (`@/`)

### AC-2: Testing Library Kurulumu
- [ ] `@testing-library/react` yüklü
- [ ] `@testing-library/jest-dom` yüklü
- [ ] Custom render helper oluşturulmuş (providers ile)

### AC-3: Test Script'leri
- [ ] `npm run test` - tüm testleri çalıştırır
- [ ] `npm run test:watch` - watch modunda çalıştırır
- [ ] `npm run test:coverage` - coverage raporu oluşturur

### AC-4: Örnek Testler
- [ ] En az 1 utility function test (`src/lib/utils.ts`)
- [ ] En az 1 API route test (`/api/customers`)
- [ ] En az 1 component test (basit bir UI component)

### AC-5: CI Entegrasyonu (Opsiyonel)
- [ ] GitHub Actions workflow'a test adımı eklenmiş
- [ ] PR'larda testler otomatik çalışıyor

---

## Teknik Detaylar

### Kurulacak Paketler

```bash
npm install -D jest @types/jest ts-jest
npm install -D @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event
npm install -D jest-environment-jsdom
```

### Jest Konfigürasyonu

**`jest.config.js`**
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
}

module.exports = createJestConfig(customJestConfig)
```

**`jest.setup.js`**
```javascript
import '@testing-library/jest-dom'
```

### Package.json Script'leri

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### Dosya Yapısı

```
src/
├── __tests__/
│   ├── lib/
│   │   └── utils.test.ts
│   ├── api/
│   │   └── customers.test.ts
│   └── components/
│       └── Button.test.tsx
├── test-utils/
│   ├── index.tsx          # Custom render
│   └── mocks/
│       ├── prisma.ts      # Prisma mock
│       └── supabase.ts    # Supabase mock
```

### Örnek Test Dosyaları

**`src/__tests__/lib/utils.test.ts`**
```typescript
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names correctly', () => {
    const result = cn('base', 'additional')
    expect(result).toBe('base additional')
  })

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', true && 'visible')
    expect(result).toBe('base visible')
  })

  it('handles undefined values', () => {
    const result = cn('base', undefined, null, 'end')
    expect(result).toBe('base end')
  })
})
```

**`src/__tests__/api/customers.test.ts`**
```typescript
import { GET } from '@/app/api/customers/route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@/lib/supabase/auth', () => ({
  getUserWithProfile: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    customers: {
      findMany: jest.fn(),
    },
  },
}))

import { getUserWithProfile } from '@/lib/supabase/auth'
import { prisma } from '@/lib/db'

describe('GET /api/customers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    (getUserWithProfile as jest.Mock).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/customers')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
  })

  it('returns customers for authenticated user', async () => {
    const mockUser = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'test@example.com',
      role: 'admin',
      permissions: [],
    }

    const mockCustomers = [
      { id: 'c1', unvan: 'Test Firma', vknTckn: '1234567890' },
    ]

    (getUserWithProfile as jest.Mock).mockResolvedValue(mockUser)
    ;(prisma.customers.findMany as jest.Mock).mockResolvedValue(mockCustomers)

    const request = new NextRequest('http://localhost/api/customers')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockCustomers)
    expect(prisma.customers.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
      })
    )
  })
})
```

**`src/test-utils/index.tsx`**
```typescript
import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

// Add providers here as needed
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
```

---

## Uygulama Adımları

### Adım 1: Paket Kurulumu (30 dk)
```bash
npm install -D jest @types/jest ts-jest jest-environment-jsdom
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### Adım 2: Konfigürasyon Dosyaları (30 dk)
1. `jest.config.js` oluştur
2. `jest.setup.js` oluştur
3. `package.json` script'lerini ekle

### Adım 3: Test Utils (1 saat)
1. `src/test-utils/index.tsx` - custom render
2. `src/test-utils/mocks/prisma.ts` - Prisma mock
3. `src/test-utils/mocks/supabase.ts` - Supabase mock

### Adım 4: Utility Testleri (2 saat)
1. `src/__tests__/lib/utils.test.ts`
2. `src/__tests__/lib/crypto.test.ts` (encryption)
3. `src/__tests__/lib/api-response.test.ts`

### Adım 5: API Route Testleri (4 saat)
1. `src/__tests__/api/customers.test.ts`
2. `src/__tests__/api/beyanname-takip.test.ts`
3. `src/__tests__/api/auth.test.ts`

### Adım 6: Component Testleri (2 saat)
1. Basit bir UI component testi
2. Form component testi (opsiyonel)

### Adım 7: CI Entegrasyonu (1 saat)
1. `.github/workflows/test.yml` oluştur veya mevcut workflow'a ekle

---

## Test Edilecek Kritik Fonksiyonlar

| Fonksiyon | Dosya | Öncelik |
|-----------|-------|---------|
| `cn()` | `src/lib/utils.ts` | P1 |
| `encrypt()/decrypt()` | `src/lib/crypto.ts` | P0 |
| `apiHandler()` | `src/lib/api-response.ts` | P1 |
| `fromZodError()` | `src/lib/api-response.ts` | P1 |
| `requireAuth()` | `src/lib/api-response.ts` | P0 |
| `normalizeError()` | `src/lib/api-response.ts` | P1 |

---

## Definition of Done

- [ ] Tüm paketler yüklü ve çalışıyor
- [ ] `npm run test` başarılı çalışıyor
- [ ] En az 10 test yazılmış
- [ ] Coverage raporu oluşuyor
- [ ] Dokümantasyon güncellenmiş (CLAUDE.md'de test komutları)
- [ ] PR review yapılmış

---

## Riskler ve Azaltma

| Risk | Olasılık | Etki | Azaltma |
|------|----------|------|---------|
| Next.js 15 uyumluluk sorunu | Orta | Orta | next/jest kullan |
| Mock'ların karmaşıklaşması | Düşük | Düşük | Basit mock'larla başla |
| ESM/CJS uyumsuzluk | Orta | Orta | jest.config'de transform ayarla |

---

## Bağımlılıklar

- Yok (bağımsız story)

---

## Referanslar

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Next.js Testing](https://nextjs.org/docs/app/building-your-application/testing/jest)

---

## Notlar

- İlk aşamada sadece kritik utility ve API testlerine odaklan
- Component testleri daha sonra genişletilebilir
- E2E testler ayrı bir story'de (Playwright ile)

---

**Story Owner:** -
**Reviewer:** -
**Sprint:** S1
**Oluşturulma:** 2026-01-29
