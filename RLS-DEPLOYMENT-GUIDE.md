# RLS Policies Deployment Kılavuzu

## Adım 1: Supabase Dashboard'a Giriş

1. Tarayıcıda şu linki aç:
   ```
   https://supabase.com/dashboard/project/mskkqzpoiiytbgfifiup/sql/new
   ```

2. Supabase hesabınla giriş yap

## Adım 2: SQL Dosyasını Kopyala

1. Aşağıdaki dosyayı aç:
   ```
   supabase/migrations/001_rls_policies.sql
   ```

2. Tüm içeriği kopyala (Ctrl+A, Ctrl+C)

## Adım 3: SQL Editor'de Çalıştır

1. SQL Editor'de yeni bir query aç (yukarıdaki link direkt açar)

2. Kopyaladığın SQL'i yapıştır (Ctrl+V)

3. Sağ üstteki **"Run"** veya **"Execute"** butonuna tıkla

4. Başarılı mesajını bekle

## Adım 4: Doğrulama

Aşağıdaki SQL'i çalıştırarak RLS'in aktif olduğunu kontrol et:

```sql
-- RLS aktif mi kontrol et
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'Customer', 'Document', 'Row', 'Kontrol', 'Mail', 'Password',
    'Reminder', 'BeyannameTakip', 'BeyannameTuru', 'Job',
    'BotSession', 'License', 'Tenant', 'user_profiles'
  )
ORDER BY tablename;
```

Tüm tablolar için `rls_enabled = true` olmalı.

## Adım 5: Policy Sayısını Kontrol Et

```sql
-- Kaç policy oluşturuldu?
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public';
```

Yaklaşık **26-28 policy** görmelisin (12 tablo × 2 policy + tenant/user_profiles policies).

## Beklenen Sonuç

✅ 14 tablo için RLS aktif
✅ ~26 policy oluşturuldu
✅ Helper function `auth.get_user_tenant_id()` hazır
✅ Service role bypass policies mevcut

## Sorun Giderme

### Hata: "already exists"
- Normal, bazı objeler daha önce oluşturulmuş
- Devam edebilirsin

### Hata: "permission denied"
- Supabase service role key ile giriş yaptığından emin ol
- Dashboard'dan manuel çalıştırma her zaman izinli

### Hata: "relation does not exist"
- Önce Prisma migration'ı çalıştırmalısın:
  ```bash
  npx prisma db push
  ```

## Sonraki Adım

RLS başarıyla deploy edildikten sonra:

```bash
# Data migration script'ini oluştur
npm run migrate:data
```

---

**Not**: Bu SQL dosyası güvenlidir, sadece güvenlik politikaları ekler, veri değiştirmez.
