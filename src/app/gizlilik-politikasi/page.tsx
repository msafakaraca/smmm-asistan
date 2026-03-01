/**
 * Gizlilik Politikası Sayfası
 * KVKK uyumu için gerekli
 */

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | SMMM-AI",
  description: "SMMM-AI Gizlilik Politikası ve Kişisel Verilerin Korunması",
};

export default function GizlilikPolitikasiPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Gizlilik Politikası
        </h1>

        <div className="prose prose-gray max-w-none">
          <p className="text-sm text-gray-500 mb-6">
            Son güncelleme: {new Date().toLocaleDateString("tr-TR")}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. Veri Sorumlusu
            </h2>
            <p className="text-gray-600">
              SMMM-AI uygulaması olarak, 6698 sayılı Kişisel Verilerin Korunması
              Kanunu (&quot;KVKK&quot;) kapsamında veri sorumlusu sıfatıyla kişisel
              verilerinizi işlemekteyiz.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              2. Toplanan Kişisel Veriler
            </h2>
            <p className="text-gray-600 mb-4">
              Hizmetlerimizi sunabilmek için aşağıdaki kişisel verileri
              toplamaktayız:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>Kimlik bilgileri (ad, soyad, unvan)</li>
              <li>İletişim bilgileri (e-posta, telefon, adres)</li>
              <li>Vergi bilgileri (VKN/TCKN, vergi dairesi)</li>
              <li>GİB ve SGK portal erişim bilgileri (şifrelenmiş olarak)</li>
              <li>Beyanname ve mali dökümanlar</li>
              <li>Kullanım logları ve IP adresleri</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              3. Verilerin İşlenme Amaçları
            </h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>Mali müşavirlik hizmetlerinin sunulması</li>
              <li>Beyanname takibi ve otomasyonu</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi</li>
              <li>Hizmet kalitesinin iyileştirilmesi</li>
              <li>Güvenlik ve dolandırıcılık önleme</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              4. Verilerin Saklanması ve Güvenliği
            </h2>
            <p className="text-gray-600 mb-4">
              Kişisel verileriniz aşağıdaki güvenlik önlemleriyle korunmaktadır:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>AES-256-GCM şifreleme (hassas veriler için)</li>
              <li>SSL/TLS ile güvenli iletişim</li>
              <li>Çok kiracılı (multi-tenant) veri izolasyonu</li>
              <li>Erişim kontrolü ve yetkilendirme</li>
              <li>Düzenli güvenlik denetimleri</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              5. Veri Saklama Süresi
            </h2>
            <p className="text-gray-600">
              Kişisel verileriniz, yasal saklama süreleri ve hizmet gereksinimleri
              doğrultusunda saklanmaktadır. Mali belgeler için yasal saklama
              süresi 10 yıldır. Hizmet ilişkisi sona erdikten sonra, yasal
              zorunluluklar dışındaki veriler silinir veya anonim hale getirilir.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              6. KVKK Kapsamındaki Haklarınız
            </h2>
            <p className="text-gray-600 mb-4">
              KVKK&apos;nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
              <li>KVKK&apos;nın 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme</li>
              <li>Düzeltme/silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme</li>
              <li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
              <li>Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              7. Veri Talebi ve İletişim
            </h2>
            <p className="text-gray-600 mb-4">
              KVKK kapsamındaki haklarınızı kullanmak için:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>Uygulama içi &quot;Ayarlar &gt; Verilerimi İndir&quot; seçeneğini kullanabilirsiniz</li>
              <li>Veri silme talebi için destek ekibimize başvurabilirsiniz</li>
              <li>Yazılı başvurularınızı e-posta ile iletebilirsiniz</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              8. Çerezler (Cookies)
            </h2>
            <p className="text-gray-600">
              Uygulamamız, oturum yönetimi ve güvenlik amacıyla zorunlu çerezler
              kullanmaktadır. Bu çerezler olmadan hizmet sunulamamaktadır.
              Analitik veya pazarlama amaçlı üçüncü taraf çerezleri
              kullanılmamaktadır.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              9. Değişiklikler
            </h2>
            <p className="text-gray-600">
              Bu gizlilik politikası gerektiğinde güncellenebilir. Önemli
              değişiklikler uygulama içi bildirim ile duyurulacaktır.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
