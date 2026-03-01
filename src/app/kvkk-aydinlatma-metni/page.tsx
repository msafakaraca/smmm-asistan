import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function KVKKPage() {
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

        <h1 className="text-3xl font-bold mb-8">
          KVKK Aydınlatma Metni
        </h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">
              1. Veri Sorumlusu
            </h2>
            <p className="text-muted-foreground">
              SMMM Asistan platformu olarak, 6698 sayılı Kişisel Verilerin
              Korunması Kanunu (&quot;KVKK&quot;) kapsamında veri sorumlusu
              sıfatıyla kişisel verilerinizi işlemekteyiz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              2. İşlenen Kişisel Veriler
            </h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Kimlik bilgileri (ad, soyad)</li>
              <li>İletişim bilgileri (e-posta adresi)</li>
              <li>
                Hesap bilgileri (şifre - şifrelenmiş olarak saklanır)
              </li>
              <li>Ofis/işletme bilgileri</li>
              <li>
                Platform kullanım verileri (oturum bilgileri, erişim
                kayıtları)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              3. Kişisel Verilerin İşlenme Amaçları
            </h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Hesap oluşturma ve kimlik doğrulama</li>
              <li>Platform hizmetlerinin sunulması</li>
              <li>
                Mali müşavirlik süreçlerinin dijital ortamda yönetilmesi
              </li>
              <li>Yasal yükümlülüklerin yerine getirilmesi</li>
              <li>Platform güvenliğinin sağlanması</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              4. Kişisel Verilerin Aktarılması
            </h2>
            <p className="text-muted-foreground">
              Kişisel verileriniz, yasal zorunluluklar dışında üçüncü
              kişilerle paylaşılmamaktadır. Platform altyapı hizmetleri için
              kullanılan servis sağlayıcılarla (hosting, veritabanı) gerekli
              güvenlik önlemleri alınarak veri paylaşımı yapılabilmektedir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              5. Veri Saklama Süresi
            </h2>
            <p className="text-muted-foreground">
              Kişisel verileriniz, hesabınız aktif olduğu sürece ve yasal
              saklama yükümlülükleri kapsamında muhafaza edilmektedir. Hesap
              silinmesi durumunda verileriniz yasal sürelerin sonunda
              imha edilecektir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              6. Veri Güvenliği
            </h2>
            <p className="text-muted-foreground">
              Kişisel verileriniz AES-256-GCM şifreleme standardıyla
              korunmakta, SSL/TLS protokolleriyle aktarılmakta ve güvenli
              sunucularda saklanmaktadır.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              7. Haklarınız
            </h2>
            <p className="text-muted-foreground mb-2">
              KVKK&apos;nın 11. maddesi uyarınca aşağıdaki haklara
              sahipsiniz:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>
                Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme
              </li>
              <li>
                İşlenme amacını ve bunların amacına uygun kullanılıp
                kullanılmadığını öğrenme
              </li>
              <li>
                Eksik veya yanlış işlenmiş olması halinde düzeltilmesini
                isteme
              </li>
              <li>
                KVKK&apos;da öngörülen şartlar çerçevesinde silinmesini
                veya yok edilmesini isteme
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. İletişim</h2>
            <p className="text-muted-foreground">
              KVKK kapsamındaki haklarınızı kullanmak için platform
              üzerindeki iletişim kanallarından bize ulaşabilirsiniz.
            </p>
          </section>
        </div>

        <p className="text-sm text-muted-foreground mt-12">
          Son güncelleme: Şubat 2026
        </p>
      </div>
    </div>
  );
}
