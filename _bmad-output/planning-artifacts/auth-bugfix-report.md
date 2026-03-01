# Auth Sistemi Self-Review Bug Raporu

**Tarih:** 2026-02-09
**Kapsam:** Tüm auth dosyaları — Server Actions, Callback, Middleware, UI Formları
**Durum:** TAMAMLANDI (10/10 bug düzeltildi)

---

## KRİTİK (Uygulama bozuk / Güvenlik açığı)

### B1. `registerAction` — Mevcut kullanıcı tespiti eksik

**Dosya:** `src/lib/actions/auth-supabase.ts` satır 50-68
**Sorun:** Supabase'de "Email Confirmation" aktifken, `signUp()` mevcut bir kullanıcıyı çağırdığında hata VERMEZ. `user` objesi döner ama `identities` dizisi boştur. Kod bunu kontrol etmiyor. Zaten kayıtlı bir kullanıcı için yeni tenant+profil oluşturulmaya çalışılır.

**Düzeltme:** `authData.user` döndükten sonra identities kontrolü ekle:
```typescript
if (!authData.user) {
  return { error: 'Kullanıcı oluşturulamadı' };
}

// ✅ EKLE: Mevcut kullanıcı kontrolü (email confirmation aktifken signUp hata vermez)
if (authData.user.identities?.length === 0) {
  return { error: 'Bu email adresi zaten kullanılıyor' };
}
```

---

### B2. Middleware redirect'leri Supabase cookie'lerini kaybediyor

**Dosya:** `src/middleware.ts` satır 111-146
**Sorun:** Tüm `NextResponse.redirect()` çağrıları doğrudan dönüyor. `getSession()` çağrısı token refresh tetikleyebilir ve yeni cookie'ler `supabaseResponse`'a yazılır, ama redirect response bunları içermez. Session refresh cookie'leri kaybolur → kullanıcı beklenmedik şekilde logout olur.

**Düzeltme:** Her redirect'te cookie'leri kopyala. Helper fonksiyon oluştur:
```typescript
function redirectWithCookies(url: URL, supabaseResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  redirectResponse.cookies.setAll(supabaseResponse.cookies.getAll());
  return redirectResponse;
}
```
Tüm redirect'leri bu fonksiyonla değiştir. `supabaseResponse` değişkeninin redirect bloklarından önce tanımlandığından emin ol (zaten tanımlı — satır 71).

**Etkilenen satırlar:** 113, 120, 130, 140 — toplam 4 redirect.

---

### B3. Verify-email sayfası kayıt sonrası erişilemez

**Dosya:** `src/components/auth/register-form.tsx` satır 72 + `src/middleware.ts` satır 136-143
**Sorun:** Supabase "Email Confirmation" aktifken `signUp()` session DÖNDÜRMEZ (user döner ama session null). Kayıt sonrası `router.push("/auth/verify-email")` çalışır ama middleware oturum olmadığı için `/login`'e yönlendirir. Kullanıcı doğrulama sayfasını asla göremez.

**Düzeltme — 2 seçenek (biri seçilmeli):**

**Seçenek A (Önerilen):** `/auth/verify-email` sayfasını oturumsuz erişilebilir yap. Middleware'deki koruma listesinden çıkar:
```typescript
// middleware.ts — satır 138'i değiştir:
if (pathname === "/auth/set-password" || pathname === "/auth/reset-password") {
  // verify-email artık oturumsuz erişilebilir
```
Ayrıca `verify-email-card.tsx`'teki "Tekrar Gönder" butonunu oturumsuz kullanıcılar için gizle veya email adresi parametresi ile çalıştır.

**Seçenek B:** Kayıt sonrası ayrı sayfaya yönlendirme YAPMA, register form içinde başarı mesajı göster. `router.push` yerine form state kullan.

---

### B4. Rate limiting Server Action'lara uygulanmıyor

**Dosya:** `src/middleware.ts` satır 27
**Sorun:** Rate limiting sadece `pathname.startsWith("/api")` koşulunda çalışır. `loginAction`, `registerAction`, `resetPasswordAction` Server Action olarak çağrılır — bunlar sayfa URL'sine POST yapar, `/api` ile başlamaz. Auth brute-force koruması devre dışı.

**Düzeltme:** Middleware'de rate limiting koşulunu genişlet:
```typescript
// Mevcut:
if (pathname.startsWith("/api") && isRateLimitEnabled()) {

// Düzeltme: Auth sayfalarına da uygula (Server Action POST'ları için)
const shouldRateLimit = pathname.startsWith("/api") ||
  pathname === "/login" ||
  pathname === "/register" ||
  pathname.startsWith("/auth/");

if (shouldRateLimit && isRateLimitEnabled()) {
```

**Not:** Alternatif olarak Server Action'ların içinde (auth-supabase.ts) rate limiting yapılabilir ama bu Upstash Redis bağımlılığını Server Action'lara taşır.

---

## YÜKSEK

### B5. Callback route'ta Open Redirect riski

**Dosya:** `src/app/auth/callback/route.ts` satır 9, 65
**Sorun:** `next` parametresi doğrulanmadan kullanılıyor. `?next=//evil.com` → `origin//evil.com` oluşur.

**Düzeltme:**
```typescript
const next = searchParams.get('next') || '/dashboard';

// ✅ EKLE: Open redirect koruması
const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

// Son satırda safeNext kullan:
return NextResponse.redirect(`${origin}${safeNext}`);
```

---

### B6. Reset password sonrası gereksiz login redirect

**Dosya:** `src/components/auth/reset-password-form.tsx` satır 55
**Sorun:** Kullanıcı şifre sıfırlama callback'inden geldiğinde zaten aktif bir oturumu var. `router.push("/login")` → middleware session görür → `/dashboard`'a yönlendirir. Gereksiz çift redirect.

**Düzeltme:**
```typescript
// Mevcut:
router.push("/login");

// Düzeltme:
router.push("/dashboard");
router.refresh();
```

---

### B7. `generateSlug` boş string üretebilir

**Dosya:** `src/lib/actions/auth-supabase.ts` satır 14-29
**Sorun:** Ofis adı sadece özel karakterlerden oluşursa (ör. "***") slug boş string olur. DB unique constraint hatası.

**Düzeltme:** Fonksiyon sonuna fallback ekle:
```typescript
function generateSlug(name: string): string {
  // ... mevcut kod ...
  const slug = name
    .split('')
    .map((char) => turkishMap[char] || char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  // Boş slug koruması
  return slug || `ofis-${Date.now().toString(36)}`;
}
```

---

## ORTA

### B8. `updatePasswordAction` sunucu tarafı şifre validasyonu yok

**Dosya:** `src/lib/actions/auth-supabase.ts` satır 283-296
**Sorun:** Server Action doğrudan çağrılabilir. Client-side min 8 validasyonu var ama sunucu tarafında yok.

**Düzeltme:**
```typescript
export async function updatePasswordAction(newPassword: string): Promise<AuthResult> {
  if (!newPassword || newPassword.length < 8) {
    return { error: 'Şifre en az 8 karakter olmalıdır' };
  }
  // ... mevcut kod
}
```

Aynı durum `resetPasswordAction`'daki email parametresi için de geçerli — basit email format kontrolü eklenebilir.

---

### B9. `completeOAuthRegistration` çift tıklama koruması yok

**Dosya:** `src/lib/actions/auth-supabase.ts` satır 177-260
**Sorun:** Hızlı çift tıklamada iki tenant oluşturulabilir. `user_profiles` PK constraint ikincisini engeller ama ilk tenant yetim kalır.

**Düzeltme:** Tenant oluşturmadan önce profil kontrolü ekle:
```typescript
// ✅ EKLE: Zaten profil varsa tekrar oluşturma
const { data: existingProfile } = await adminClient
  .from('user_profiles')
  .select('id')
  .eq('id', user.id)
  .single();

if (existingProfile) {
  return { success: true }; // Zaten tamamlanmış
}
```

---

### B10. OAuth butonunda `prompt: "consent"` her seferinde onay zorluyor

**Dosya:** `src/components/auth/oauth-button.tsx` satır 22-27
**Sorun:** Login modunda bile Google her seferinde onay ekranı gösterir. Returning kullanıcılar için kötü UX.

**Düzeltme:** `mode` prop'una göre queryParams'ı ayarla:
```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: mode === "register"
      ? { access_type: "offline", prompt: "consent" }
      : {},
  },
});
```

---

## DÜZELTME ÖNCELİK SIRASI

1. **B2** — Middleware cookie kaybı (tüm auth akışını etkiler)
2. **B3** — Verify-email erişim sorunu (kayıt akışını kırar)
3. **B1** — Mevcut kullanıcı tespiti (güvenlik)
4. **B4** — Rate limiting (güvenlik)
5. **B5** — Open redirect (güvenlik)
6. **B7** — Boş slug (edge case crash)
7. **B6** — Reset password redirect (UX)
8. **B9** — Çift tıklama koruması (data integrity)
9. **B8** — Sunucu validasyonu (defense in depth)
10. **B10** — OAuth prompt (UX)

---

## ETKİLENEN DOSYALAR

| Dosya | Bug'lar |
|-------|---------|
| `src/middleware.ts` | B2, B3, B4 |
| `src/lib/actions/auth-supabase.ts` | B1, B7, B8, B9 |
| `src/app/auth/callback/route.ts` | B5 |
| `src/components/auth/reset-password-form.tsx` | B6 |
| `src/components/auth/oauth-button.tsx` | B10 |
| `src/components/auth/verify-email-card.tsx` | B3 (dolaylı) |
