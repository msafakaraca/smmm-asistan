import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function KullanimKosullariPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link
          href="/register"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Kayıt sayfasına dön
        </Link>

        <h1 className="text-3xl font-bold mb-2">Kullanım Koşulları</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Son güncelleme: Şubat 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* 1. GENEL HÜKÜMLER */}
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Genel Hükümler</h2>

            <h3 className="text-lg font-medium mb-2">1.1 Taraflar</h3>
            <p className="text-muted-foreground">
              İşbu Kullanım Koşulları (&quot;Sözleşme&quot;), SMMM Asistan
              platformunu (&quot;Platform&quot;) işleten şirket ile Platforma
              kayıt olarak hesap oluşturan gerçek veya tüzel kişi
              (&quot;Kullanıcı&quot;) arasında, Kullanıcının kayıt işlemini
              tamamlaması ile birlikte yürürlüğe girer.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">1.2 Tanımlar</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                <strong>Platform:</strong> SMMM Asistan web uygulaması, API
                hizmetleri ve Electron masaüstü uygulaması dahil tüm yazılım
                bileşenleri.
              </li>
              <li>
                <strong>Kullanıcı:</strong> Platforma kayıt olarak hesap
                oluşturan serbest muhasebeci mali müşavir (SMMM) veya
                yetkilendirdiği kişi.
              </li>
              <li>
                <strong>Tenant:</strong> Kullanıcının Platformda oluşturduğu,
                kendisine ve ekibine özel izole çalışma alanı (ofis).
              </li>
              <li>
                <strong>Mükellef:</strong> Kullanıcının Platform üzerinde
                bilgilerini yönettiği müşterileri.
              </li>
              <li>
                <strong>GİB:</strong> T.C. Gelir İdaresi Başkanlığı.
              </li>
              <li>
                <strong>Bot:</strong> GİB ve diğer kamu portallarına
                Kullanıcının sağladığı kimlik bilgileriyle erişim sağlayan
                otomatik yazılım aracı.
              </li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">1.3 Kapsam</h3>
            <p className="text-muted-foreground">
              Bu Sözleşme, Platformun tüm özelliklerinin kullanımını kapsar.
              Kullanıcı, Platforma kayıt olarak bu Sözleşmeyi, KVKK Aydınlatma
              Metnini ve Çerez Politikasını kabul etmiş sayılır.
            </p>
          </section>

          {/* 2. HİZMET TANIMI */}
          <section>
            <h2 className="text-xl font-semibold mb-3">2. Hizmet Tanımı</h2>

            <h3 className="text-lg font-medium mb-2">
              2.1 Sunulan Hizmetler
            </h3>
            <p className="text-muted-foreground mb-2">
              Platform, mali müşavirlik ofislerinin iş süreçlerini
              dijitalleştirmek amacıyla aşağıdaki hizmetleri sunar:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Mükellef (müşteri) kayıt ve bilgi yönetimi</li>
              <li>Beyanname dönem takibi ve durum izleme</li>
              <li>
                GİB portalından beyanname PDF indirme (Bot aracılığıyla)
              </li>
              <li>Dosya yönetimi ve depolama</li>
              <li>GİB/SGK şifre yönetimi (şifreli saklama)</li>
              <li>Hatırlatıcı ve görev takip sistemi</li>
              <li>Takip çizelgesi ve raporlama</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">
              2.2 Platformun Sağlamadığı Hizmetler
            </h3>
            <p className="text-muted-foreground mb-2">
              Platform bir <strong>yazılım aracıdır</strong>; aşağıdaki
              hizmetleri sağlamaz ve bu alanlarda sorumluluk kabul etmez:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                Mali müşavirlik, muhasebe veya vergi danışmanlığı hizmeti
              </li>
              <li>Beyanname hazırlama, düzenleme veya verme işlemi</li>
              <li>Vergisel veya hukuki tavsiye</li>
              <li>GİB, SGK veya diğer kamu kurumları adına işlem yapma</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Platform, 3568 sayılı Serbest Muhasebeci Mali Müşavirlik ve Yeminli
              Mali Müşavirlik Kanunu kapsamında meslek icra etmemekte olup
              TÜRMOB mevzuatı çerçevesinde herhangi bir mesleki sorumluluk
              üstlenmemektedir.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              2.3 GİB/SGK Portal Entegrasyonu
            </h3>
            <p className="text-muted-foreground">
              Bot hizmeti, GİB ve SGK portallarına Kullanıcının sağladığı
              kimlik bilgileriyle erişim sağlar. Bu portallar üçüncü taraf kamu
              kurumlarına ait olup Platformun kontrolünde değildir. Portal
              arayüzü, erişim politikası veya teknik altyapısındaki
              değişiklikler Bot hizmetinin geçici veya kalıcı olarak
              kesintiye uğramasına neden olabilir. Platform bu kesintilerden
              dolayı sorumluluk kabul etmez.
            </p>
          </section>

          {/* 3. HESAP VE GÜVENLİK */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              3. Hesap ve Güvenlik
            </h2>

            <h3 className="text-lg font-medium mb-2">
              3.1 Hesap Oluşturma
            </h3>
            <p className="text-muted-foreground">
              Kullanıcı, geçerli bir e-posta adresi ve güçlü bir şifre ile
              hesap oluşturur. E-posta doğrulaması tamamlanmadan Platform
              hizmetlerine erişim sağlanamaz. Google OAuth ile de giriş
              yapılabilir.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              3.2 Hesap Güvenliği
            </h3>
            <p className="text-muted-foreground">
              Kullanıcı, hesap bilgilerinin gizliliğinden ve hesabı üzerinden
              gerçekleştirilen tüm işlemlerden sorumludur. Şifresini üçüncü
              kişilerle paylaşmamalı, yetkisiz erişim şüphesinde derhal
              Platforma bildirmelidir.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              3.3 Çok Kiracılı (Multi-Tenant) Yapı
            </h3>
            <p className="text-muted-foreground">
              Her Kullanıcı hesabı izole bir Tenant (çalışma alanı) içinde
              çalışır. Tenant içindeki tüm veriler (mükellef bilgileri,
              beyanname takipleri, dosyalar, şifreler) diğer Tenant&apos;lardan
              tamamen ayrıdır. Platform, veritabanı seviyesinde satır bazlı
              güvenlik (Row Level Security) uygulayarak Tenant&apos;lar arası
              veri izolasyonunu garanti eder.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              3.4 GİB/SGK Kimlik Bilgileri Yönetimi
            </h3>
            <p className="text-muted-foreground mb-2">
              Kullanıcı, mükelleflerine ait GİB kullanıcı kodu, şifre ve
              parola gibi kimlik bilgilerini Platforma kendi iradesiyle
              girer. Bu bilgiler AES-256-GCM endüstri standardı şifreleme
              ile korunarak saklanır.
            </p>
            <p className="text-muted-foreground">
              <strong>Kullanıcı, şu hususları kabul ve taahhüt eder:</strong>
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                Mükelleflerinden gerekli yetki ve onayı aldığını
              </li>
              <li>
                Kimlik bilgilerinin doğruluğundan kendisinin sorumlu olduğunu
              </li>
              <li>
                Bu bilgilerin yetkisiz kullanımından Platformun sorumlu
                tutulamayacağını
              </li>
              <li>
                Mükellef ile olan yetkilendirme ilişkisinin kendi
                sorumluluğunda olduğunu
              </li>
            </ul>
          </section>

          {/* 4. KULLANIM KURALLARI */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              4. Kullanım Kuralları
            </h2>

            <h3 className="text-lg font-medium mb-2">
              4.1 Kabul Edilebilir Kullanım
            </h3>
            <p className="text-muted-foreground">
              Platform yalnızca mali müşavirlik ofislerinin meşru iş süreçleri
              kapsamında kullanılabilir. Kullanıcı, yürürlükteki tüm yasalara
              ve meslek kurallarına uygun şekilde Platformu kullanmayı kabul
              eder.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              4.2 Yasak Kullanımlar
            </h3>
            <p className="text-muted-foreground mb-2">
              Aşağıdaki eylemler kesinlikle yasaktır:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                Platform API&apos;lerini otomatik araçlarla aşırı yüklemek
                (scraping, flooding)
              </li>
              <li>
                Platform yazılımını tersine mühendislik, decompile veya
                kaynak kod çıkarma girişiminde bulunmak
              </li>
              <li>
                Bot mekanizmasını manipüle etmek veya amacı dışında kullanmak
              </li>
              <li>
                Başka bir Kullanıcının hesabına veya Tenant&apos;ına yetkisiz
                erişim sağlamak veya denemek
              </li>
              <li>
                Platformu yasa dışı faaliyetler için kullanmak
              </li>
              <li>
                Sahte veya yanıltıcı bilgilerle hesap oluşturmak
              </li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">
              4.3 Kullanım Sınırları
            </h3>
            <p className="text-muted-foreground mb-2">
              Platform, hizmet kalitesini korumak amacıyla aşağıdaki kullanım
              sınırlarını uygular:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                API istek limitleri (dakika bazlı, işlem türüne göre değişir)
              </li>
              <li>Dosya depolama kapasitesi (plana göre değişir)</li>
              <li>Mükellef sayısı limiti (plana göre değişir)</li>
              <li>Bot işlem sıklığı limitleri</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Sınırların aşılması durumunda ilgili işlem geçici olarak
              engellenir. Sürekli ihlal durumunda hesap askıya alınabilir.
            </p>
          </section>

          {/* 5. VERİ SAHİPLİĞİ VE GİZLİLİK */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              5. Veri Sahipliği ve Gizlilik
            </h2>

            <h3 className="text-lg font-medium mb-2">
              5.1 Kullanıcı Verilerinin Mülkiyeti
            </h3>
            <p className="text-muted-foreground">
              Kullanıcının Platforma girdiği tüm veriler (mükellef bilgileri,
              beyanname takipleri, dosyalar, notlar) Kullanıcıya aittir.
              Platform bu verileri yalnızca hizmet sunumu amacıyla işler ve
              üçüncü taraflarla paylaşmaz.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              5.2 Mükellef Verilerinin Korunması
            </h3>
            <p className="text-muted-foreground">
              Platform, mükellef verilerini (VKN/TCKN, unvan, vergi dairesi,
              iletişim bilgileri vb.) şifreli veritabanında saklar. Hassas
              kimlik bilgileri (GİB şifreleri vb.) AES-256-GCM şifreleme
              ile ek koruma altındadır.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              5.3 Meslek Sırrı
            </h3>
            <p className="text-muted-foreground">
              Platform, mali müşavirlik meslek sırrının korunmasına azami özen
              gösterir. Tenant bazlı veri izolasyonu, bir mali müşavirin
              müşteri bilgilerinin başka bir mali müşavir tarafından
              görülmesini teknik olarak engeller.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              5.4 Veri Taşınabilirliği
            </h3>
            <p className="text-muted-foreground">
              Kullanıcı, hesabı aktifken veya fesih sürecinde verilerinin
              dışa aktarımını (export) talep etme hakkına sahiptir. Platform,
              makul süre içinde yaygın formatlarda (CSV, JSON, PDF) veri
              aktarımı sağlar.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              5.5 Kişisel Verilerin Korunması
            </h3>
            <p className="text-muted-foreground">
              Kişisel verilerin işlenmesine ilişkin detaylı bilgi{" "}
              <Link
                href="/kvkk-aydinlatma-metni"
                className="text-primary hover:underline"
              >
                KVKK Aydınlatma Metni
              </Link>
              &apos;nde yer almaktadır. Çerez kullanımına ilişkin bilgi{" "}
              <Link
                href="/cerez-politikasi"
                className="text-primary hover:underline"
              >
                Çerez Politikası
              </Link>
              &apos;nda açıklanmıştır.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              5.6 Veri Lokasyonu
            </h3>
            <p className="text-muted-foreground">
              Platform verileri, bulut altyapı sağlayıcılarının sunucularında
              barındırılmaktadır. Hizmet sağlayıcıların sunucuları yurt
              dışında bulunabilir. Bu durum, 6698 sayılı KVKK&apos;nın 9.
              maddesi kapsamında yurt dışına veri aktarımı niteliği taşıyabilir.
              Kullanıcı, Platforma kayıt olarak bu aktarıma açık rıza
              göstermiş sayılır.
            </p>
          </section>

          {/* 6. ÜCRETLENDİRME */}
          <section>
            <h2 className="text-xl font-semibold mb-3">6. Ücretlendirme</h2>

            <h3 className="text-lg font-medium mb-2">6.1 Plan Türleri</h3>
            <p className="text-muted-foreground">
              Platform, deneme (trial) ve ücretli plan seçenekleri sunar.
              Deneme süresi sonunda Kullanıcı ücretli plana geçiş yapmadığı
              takdirde Platform erişimi kısıtlanır; ancak mevcut veriler
              silinmez.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              6.2 Ödeme Koşulları
            </h3>
            <p className="text-muted-foreground">
              Ücretli plan bedelleri, seçilen plan türüne göre aylık veya
              yıllık olarak tahsil edilir. Ödeme, Platform üzerinde belirtilen
              yöntemlerle yapılır. Vadesinde ödenmeyen bedeller için yasal
              gecikme faizi uygulanabilir.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              6.3 Fiyat Değişikliği
            </h3>
            <p className="text-muted-foreground">
              Platform, plan ücretlerinde değişiklik yapma hakkını saklı tutar.
              Fiyat değişiklikleri, yürürlük tarihinden en az 30 (otuz) gün
              önce e-posta ve/veya Platform içi bildirim yoluyla Kullanıcıya
              duyurulur. Mevcut ödeme döneminin sonuna kadar eski fiyat
              geçerli kalır.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              6.4 İade Politikası
            </h3>
            <p className="text-muted-foreground">
              Yıllık plan ödemelerinde, satın alma tarihinden itibaren 14
              (on dört) gün içinde cayma hakkı kullanılabilir. Aylık planlarda
              iade yapılmaz; mevcut dönem sonuna kadar hizmet devam eder.
            </p>
          </section>

          {/* 7. FİKRİ MÜLKİYET */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              7. Fikri Mülkiyet Hakları
            </h2>

            <h3 className="text-lg font-medium mb-2">
              7.1 Platform Hakları
            </h3>
            <p className="text-muted-foreground">
              Platform yazılımı, tasarımı, logosu, içeriği ve tüm fikri
              mülkiyet hakları Platform işletmecisine aittir. Kullanıcıya
              yalnızca bu Sözleşme kapsamında, süre ve kapsam ile sınırlı,
              devredilemez bir kullanım lisansı verilir.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              7.2 Kullanıcı İçeriği
            </h3>
            <p className="text-muted-foreground">
              Kullanıcının Platforma yüklediği dosyalar, belgeler ve girdiği
              veriler üzerindeki tüm haklar Kullanıcıya aittir. Platform,
              bu içerikleri yalnızca hizmet sunmak amacıyla işler.
            </p>
          </section>

          {/* 8. SORUMLULUK SINIRLANDIRMASI */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              8. Sorumluluk Sınırlandırması
            </h2>

            <h3 className="text-lg font-medium mb-2">
              8.1 Hizmetin Sunumu
            </h3>
            <p className="text-muted-foreground">
              Platform, hizmetlerini &quot;olduğu gibi&quot; (as-is) ve
              &quot;mevcut haliyle&quot; (as-available) sunar. Platformun
              kesintisiz, hatasız veya tamamen güvenli olacağına dair açık
              veya zımni hiçbir garanti verilmez.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              8.2 Üçüncü Taraf Portal Değişiklikleri
            </h3>
            <p className="text-muted-foreground">
              GİB, SGK ve diğer kamu portalları Platform&apos;un kontrolünde
              değildir. Bu portallardaki arayüz değişiklikleri, erişim
              kısıtlamaları, captcha uygulamaları veya teknik sorunlar
              nedeniyle Bot hizmetinin aksamasından Platform sorumlu tutulamaz.
              Platform, bu değişikliklere makul süre içinde uyum sağlamak için
              çaba gösterir.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              8.3 Üçüncü Taraf Hizmet Sağlayıcılar
            </h3>
            <p className="text-muted-foreground">
              Platform, altyapı hizmetleri için üçüncü taraf sağlayıcılar
              (veritabanı, dosya depolama, e-posta gönderimi vb.)
              kullanmaktadır. Bu sağlayıcılardan kaynaklanan kesinti veya
              veri kaybından Platform&apos;un sorumluluğu, endüstri standardı
              güvenlik önlemlerini almış olması kaydıyla sınırlıdır.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              8.4 Azami Sorumluluk Limiti
            </h3>
            <p className="text-muted-foreground">
              Platform&apos;un herhangi bir nedenle doğabilecek toplam
              sorumluluğu, Kullanıcının son 12 (on iki) ay içinde ödediği
              toplam hizmet bedelini aşamaz. Dolaylı zararlar, kar kaybı,
              veri kaybı veya iş kesintisinden doğan zararlar bu
              sorumluluğun kapsamı dışındadır.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              8.5 Mücbir Sebepler
            </h3>
            <p className="text-muted-foreground">
              Doğal afetler, savaş, terör, salgın hastalık, devlet
              müdahalesi, yasal düzenleme değişiklikleri, altyapı kesintileri,
              siber saldırılar ve benzeri öngörülemeyen ve önlenemeyen
              durumlar mücbir sebep sayılır. Mücbir sebep süresince
              Platform&apos;un yükümlülükleri askıya alınır.
            </p>
          </section>

          {/* 9. HİZMET SÜREKLİLİĞİ */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              9. Hizmet Sürekliliği
            </h2>

            <h3 className="text-lg font-medium mb-2">
              9.1 Planlı Bakım
            </h3>
            <p className="text-muted-foreground">
              Platform, bakım ve güncelleme çalışmaları için hizmeti geçici
              olarak durdurabilir. Planlı bakım çalışmaları mümkün olduğunca
              önceden bildirilir ve mesai saatleri dışında gerçekleştirilir.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              9.2 Erişilebilirlik Hedefi
            </h3>
            <p className="text-muted-foreground">
              Platform, yıllık bazda %99,5 erişilebilirlik hedeflemektedir.
              Bu bir garanti veya SLA taahhüdü değildir. Planlı bakım
              süreleri bu hesaplamaya dahil değildir.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              9.3 Veri Yedekleme
            </h3>
            <p className="text-muted-foreground">
              Platform, verileri düzenli aralıklarla yedekler. Ancak
              Kullanıcının kendi verilerini periyodik olarak dışa
              aktararak yedeklemesi tavsiye edilir.
            </p>
          </section>

          {/* 10. FESİH */}
          <section>
            <h2 className="text-xl font-semibold mb-3">10. Fesih</h2>

            <h3 className="text-lg font-medium mb-2">
              10.1 Kullanıcı Tarafından Fesih
            </h3>
            <p className="text-muted-foreground">
              Kullanıcı, dilediği zaman hesabını kapatarak bu Sözleşmeyi
              feshedebilir. Fesih öncesinde veri dışa aktarımı talep
              edilebilir. Ücretli plan dönemi içinde yapılan fesihlerde
              kalan süreye ait ücret iade edilmez.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              10.2 Platform Tarafından Fesih
            </h3>
            <p className="text-muted-foreground mb-2">
              Platform, aşağıdaki durumlarda hesabı askıya alabilir veya
              feshedebilir:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Kullanım Koşullarının ihlali</li>
              <li>Yasak kullanım tespit edilmesi</li>
              <li>Ödeme yükümlülüklerinin yerine getirilmemesi</li>
              <li>Yasal zorunluluklar</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Acil güvenlik durumları hariç, Platform fesih kararını en az
              15 (on beş) gün önceden Kullanıcıya bildirir ve veri dışa
              aktarımı için makul süre tanır.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              10.3 Fesih Sonrası Veri İşleme
            </h3>
            <p className="text-muted-foreground">
              Hesap kapatıldıktan sonra Kullanıcı verileri 30 (otuz) gün
              süreyle erişilebilir durumda tutulur (dışa aktarım için). Bu
              sürenin ardından veriler, yasal saklama yükümlülükleri saklı
              kalmak kaydıyla kalıcı olarak silinir.
            </p>
          </section>

          {/* 11. DEĞİŞİKLİKLER */}
          <section>
            <h2 className="text-xl font-semibold mb-3">11. Değişiklikler</h2>

            <h3 className="text-lg font-medium mb-2">
              11.1 Koşulların Güncellenmesi
            </h3>
            <p className="text-muted-foreground">
              Platform, bu Kullanım Koşullarını önceden bildirmek kaydıyla
              güncelleme hakkını saklı tutar. Önemli değişiklikler en az
              30 (otuz) gün önceden bildirilir.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              11.2 Bildirim Yöntemi
            </h3>
            <p className="text-muted-foreground">
              Değişiklikler; kayıtlı e-posta adresi, Platform içi bildirim
              veya Platform ana sayfasında duyuru yoluyla bildirilir.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              11.3 Devam Eden Kullanım
            </h3>
            <p className="text-muted-foreground">
              Değişikliklerin bildirilmesinden sonra Platformu kullanmaya
              devam eden Kullanıcı, güncellenmiş Koşulları kabul etmiş
              sayılır. Değişiklikleri kabul etmeyen Kullanıcı, hesabını
              kapatma hakkına sahiptir.
            </p>
          </section>

          {/* 12. UYUŞMAZLIK ÇÖZÜMÜ */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              12. Uyuşmazlık Çözümü
            </h2>

            <h3 className="text-lg font-medium mb-2">
              12.1 Uygulanacak Hukuk
            </h3>
            <p className="text-muted-foreground">
              Bu Sözleşme, Türkiye Cumhuriyeti hukukuna tabi olup Türk
              hukukuna göre yorumlanır.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              12.2 Arabuluculuk
            </h3>
            <p className="text-muted-foreground">
              Taraflar, bu Sözleşmeden doğabilecek uyuşmazlıkların
              çözümünde öncelikle arabuluculuk yoluna başvurur.
              6325 sayılı Hukuk Uyuşmazlıklarında Arabuluculuk Kanunu
              hükümleri uygulanır.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              12.3 Yetkili Mahkeme
            </h3>
            <p className="text-muted-foreground">
              Arabuluculuk sürecinden sonuç alınamaması halinde İstanbul
              Mahkemeleri ve İcra Daireleri yetkilidir.
            </p>
          </section>

          {/* 13. SON HÜKÜMLER */}
          <section>
            <h2 className="text-xl font-semibold mb-3">13. Son Hükümler</h2>

            <h3 className="text-lg font-medium mb-2">
              13.1 Bölünebilirlik
            </h3>
            <p className="text-muted-foreground">
              Bu Sözleşmenin herhangi bir maddesinin geçersiz veya
              uygulanamaz bulunması, diğer maddelerin geçerliliğini
              etkilemez.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">13.2 Feragat</h3>
            <p className="text-muted-foreground">
              Platform&apos;un bu Sözleşmeden doğan herhangi bir hakkını
              kullanmaması veya gecikmeli kullanması, söz konusu haktan
              feragat ettiği anlamına gelmez.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              13.3 Sözleşmenin Bütünlüğü
            </h3>
            <p className="text-muted-foreground">
              Bu Sözleşme, KVKK Aydınlatma Metni ve Çerez Politikası ile
              birlikte taraflar arasındaki anlaşmanın tamamını oluşturur.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">
              13.4 Yürürlük
            </h3>
            <p className="text-muted-foreground">
              Bu Sözleşme, Kullanıcının Platforma kayıt olması ile
              yürürlüğe girer ve hesap kapatılıncaya veya Sözleşme
              feshedilinceye kadar geçerli kalır.
            </p>
          </section>

          {/* İLETİŞİM */}
          <section>
            <h2 className="text-xl font-semibold mb-3">14. İletişim</h2>
            <p className="text-muted-foreground">
              Bu Kullanım Koşulları hakkında sorularınız için Platform
              üzerindeki iletişim kanallarından bize ulaşabilirsiniz.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t">
          <p className="text-sm text-muted-foreground">
            Son güncelleme: Şubat 2026
          </p>
          <div className="flex gap-4 mt-2">
            <Link
              href="/kvkk-aydinlatma-metni"
              className="text-sm text-primary hover:underline"
            >
              KVKK Aydınlatma Metni
            </Link>
            <Link
              href="/cerez-politikasi"
              className="text-sm text-primary hover:underline"
            >
              Çerez Politikası
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
