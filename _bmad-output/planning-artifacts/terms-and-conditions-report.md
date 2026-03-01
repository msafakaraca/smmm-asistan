# SMMM-AI Terms & Conditions - BMAD Party Mode Tartışma Raporu

**Tarih:** Şubat 2026
**Konu:** SMMM-AI platformu için Kullanım Koşulları (Terms and Conditions) belgesinde nelerin yer alması gerektiği
**Katılımcılar:** John (PM), Winston (Architect), Mary (Analyst), Murat (QA), Amelia (Dev), Sally (UX), Bob (SM), Paige (Tech Writer), BMad Master

---

## KRİTİK MADDELER (Mutlaka olmalı)

| # | Madde | Neden Kritik | Sorumlu Perspektif |
|---|-------|-------------|-------------------|
| 1 | **GİB/SGK Credential Sorumluluk** | Kullanıcı mükellef şifrelerini kendi rızasıyla girer, platform şifreleyerek saklar ama yetkili kullanım kullanıcının sorumluluğunda | John, Winston |
| 2 | **Platform ≠ Mali Müşavirlik Hizmeti** | Platform araçtır, meslek icra etmez. TÜRMOB mevzuatı açısından zorunlu | Mary, John |
| 3 | **Veri İzolasyonu Taahhüdü** | Multi-tenant yapıda tenant'lar arası veri sızıntısı olmayacağı | Winston, Murat |
| 4 | **Sorumluluk Sınırlandırması** | GİB portal değişikliği, Supabase kesintisi vb. dış etkenler | Winston, Murat |
| 5 | **Veri Sahipliği + Export Hakkı** | Mükellef verileri kullanıcıya ait, hesap kapatılırsa export hakkı | Mary, John |
| 6 | **Ücretlendirme Koşulları** | Trial/ücretli plan, fiyat değişikliği bildirimi | John |
| 7 | **Yasak Kullanımlar** | API scraping, reverse engineering, bot manipülasyonu | Amelia, Murat |
| 8 | **KVKK ile Tutarlılık** | Mevcut KVKK aydınlatma metni ile çelişmemeli | Mary, Paige |

## SEKTÖRE ÖZEL MADDELER

| # | Madde | Açıklama |
|---|-------|---------|
| 1 | Mesleki sorumluluk sınırı | Platform vergi beyannamesi VERMEZ, sadece takip eder |
| 2 | Meslek sırrı koruması | Tenant bazlı izolasyon = meslek sırrı korunur |
| 3 | Mükellef credential yetki zinciri | Kullanıcı, mükellefinden aldığı yetki ile şifre girer |
| 4 | Mevzuat değişikliği riski | GİB/SGK portal değişikliklerine "makul sürede" uyum |
| 5 | Beyanname doğruluk garantisi yok | İndirilen PDF'lerin doğruluğu GİB'e ait |

## TEKNİK MADDELER

| # | Madde | Detay |
|---|-------|-------|
| 1 | API rate limit'ler | Auth: 5/dk, Genel: 100/dk, Bot: 10/dk |
| 2 | Depolama limitleri | Plan bazlı storage sınırları |
| 3 | Şifreleme standardı | AES-256-GCM (credential'lar için) |
| 4 | Veri lokasyonu | Supabase sunucuları (yurtdışı transferi KVKK md.9) |
| 5 | Uptime hedefi | %99.5 hedef (garanti değil, SLA yok) |

## HUKUK MADDELERI

| # | Madde | Detay |
|---|-------|-------|
| 1 | Uygulanacak hukuk | Türk Hukuku |
| 2 | Yetkili mahkeme | [Belirlenecek] İl Mahkemeleri |
| 3 | Arabuluculuk | Ticari uyuşmazlıklarda zorunlu arabuluculuk |
| 4 | Bölünebilirlik | Bir maddenin geçersizliği diğerlerini etkilemez |
| 5 | Mücbir sebepler | Doğal afet, savaş, devlet müdahalesi, altyapı kesintisi |

## UX / UYGULAMA ÖNERİLERİ

- Register formuna ayrı T&C checkbox'ı ekle
- `/kullanim-kosullari` rotasında yayınla (mevcut KVKK/Çerez pattern'ı ile tutarlı)
- T&C güncellemelerinde email + platform içi bildirim
- Her bölüm başında 1 cümlelik TL;DR özet
- Sade, anlaşılır Türkçe — hukuki jargondan kaçın

## BELGE YAPISI ÖNERİSİ (Paige - Tech Writer)

```
1. GENEL HÜKÜMLER (Taraflar, Tanımlar, Kapsam)
2. HİZMET TANIMI (Sunulan/Sunulmayan Hizmetler, GİB/SGK Entegrasyonu, Bot)
3. HESAP VE GÜVENLİK (Oluşturma, Güvenlik, Multi-Tenant, Credentials, Şifreleme)
4. KULLANIM KURALLARI (Kabul Edilebilir, Yasaklar, API/Depolama Limitleri)
5. VERİ SAHİPLİĞİ VE GİZLİLİK (Mülkiyet, Mükellef Verileri, Meslek Sırrı, Export, KVKK)
6. ÜCRETLENDİRME (Planlar, Ödeme, Fiyat Değişikliği, İade)
7. FİKRİ MÜLKİYET (Platform Hakları, Kullanıcı İçeriği)
8. SORUMLULUK SINIRLANDIRMASI (As-Is, Dış Etkenler, Üçüncü Taraf, Azami Limit, Mücbir Sebepler)
9. HİZMET SÜREKLİLİĞİ (Bakım, Uptime, Yedekleme)
10. FESİH (Kullanıcı/Platform Tarafından, Fesih Sonrası)
11. DEĞİŞİKLİKLER (Güncelleme, Bildirim, Devam = Kabul)
12. UYUŞMAZLIK ÇÖZÜMÜ (Hukuk, Mahkeme, Arabuluculuk)
13. SON HÜKÜMLER (Bölünebilirlik, Feragat, Bütünlük, Yürürlük)
```
