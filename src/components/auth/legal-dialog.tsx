"use client";

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// --- İçerikler ---

function KVKKContent() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-2">1. Veri Sorumlusu</h2>
        <p className="text-sm text-muted-foreground">
          SMMM Asistan platformu olarak, 6698 sayılı Kişisel Verilerin Korunması
          Kanunu (&quot;KVKK&quot;) kapsamında veri sorumlusu sıfatıyla kişisel
          verilerinizi işlemekteyiz.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">2. İşlenen Kişisel Veriler</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Kimlik bilgileri (ad, soyad)</li>
          <li>İletişim bilgileri (e-posta adresi)</li>
          <li>Hesap bilgileri (şifre - şifrelenmiş olarak saklanır)</li>
          <li>Ofis/işletme bilgileri</li>
          <li>Platform kullanım verileri (oturum bilgileri, erişim kayıtları)</li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">3. Kişisel Verilerin İşlenme Amaçları</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Hesap oluşturma ve kimlik doğrulama</li>
          <li>Platform hizmetlerinin sunulması</li>
          <li>Mali müşavirlik süreçlerinin dijital ortamda yönetilmesi</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          <li>Platform güvenliğinin sağlanması</li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">4. Kişisel Verilerin Aktarılması</h2>
        <p className="text-sm text-muted-foreground">
          Kişisel verileriniz, yasal zorunluluklar dışında üçüncü kişilerle
          paylaşılmamaktadır. Platform altyapı hizmetleri için kullanılan servis
          sağlayıcılarla gerekli güvenlik önlemleri alınarak veri paylaşımı
          yapılabilmektedir.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">5. Veri Saklama Süresi</h2>
        <p className="text-sm text-muted-foreground">
          Kişisel verileriniz, hesabınız aktif olduğu sürece ve yasal saklama
          yükümlülükleri kapsamında muhafaza edilmektedir. Hesap silinmesi
          durumunda verileriniz yasal sürelerin sonunda imha edilecektir.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">6. Veri Güvenliği</h2>
        <p className="text-sm text-muted-foreground">
          Kişisel verileriniz AES-256-GCM şifreleme standardıyla korunmakta,
          SSL/TLS protokolleriyle aktarılmakta ve güvenli sunucularda
          saklanmaktadır.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">7. Haklarınız</h2>
        <p className="text-sm text-muted-foreground mb-2">
          KVKK&apos;nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
          <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme</li>
          <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
          <li>Eksik veya yanlış işlenmiş olması halinde düzeltilmesini isteme</li>
          <li>KVKK&apos;da öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme</li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">8. İletişim</h2>
        <p className="text-sm text-muted-foreground">
          KVKK kapsamındaki haklarınızı kullanmak için platform üzerindeki
          iletişim kanallarından bize ulaşabilirsiniz.
        </p>
      </section>
      <p className="text-xs text-muted-foreground pt-2">Son güncelleme: Şubat 2026</p>
    </div>
  );
}

function KullanimKosullariContent() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-2">1. Genel Hükümler</h2>
        <p className="text-sm text-muted-foreground">
          İşbu Kullanım Koşulları, SMMM Asistan platformunu işleten şirket ile
          Platforma kayıt olarak hesap oluşturan gerçek veya tüzel kişi arasında
          yürürlüğe girer.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">2. Hizmet Tanımı</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Platform, mali müşavirlik ofislerinin iş süreçlerini dijitalleştirmek
          amacıyla aşağıdaki hizmetleri sunar:
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Mükellef kayıt ve bilgi yönetimi</li>
          <li>Beyanname dönem takibi ve durum izleme</li>
          <li>GİB portalından beyanname PDF indirme</li>
          <li>Dosya yönetimi ve depolama</li>
          <li>GİB/SGK şifre yönetimi (şifreli saklama)</li>
          <li>Hatırlatıcı ve görev takip sistemi</li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">3. Hesap ve Güvenlik</h2>
        <p className="text-sm text-muted-foreground">
          Kullanıcı, hesap bilgilerinin gizliliğinden ve hesabı üzerinden
          gerçekleştirilen tüm işlemlerden sorumludur. Her hesap izole bir çalışma
          alanı (Tenant) içinde çalışır ve veritabanı seviyesinde satır bazlı
          güvenlik uygulanır.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">4. Kullanım Kuralları</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Aşağıdaki eylemler kesinlikle yasaktır:
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Platform API&apos;lerini aşırı yüklemek</li>
          <li>Yazılımı tersine mühendislik yapmak</li>
          <li>Başka kullanıcıların hesaplarına yetkisiz erişim</li>
          <li>Platformu yasa dışı faaliyetler için kullanmak</li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">5. Veri Sahipliği</h2>
        <p className="text-sm text-muted-foreground">
          Kullanıcının Platforma girdiği tüm veriler Kullanıcıya aittir. Platform
          bu verileri yalnızca hizmet sunumu amacıyla işler ve üçüncü taraflarla
          paylaşmaz. Hassas kimlik bilgileri AES-256-GCM şifreleme ile korunur.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">6. Sorumluluk Sınırlandırması</h2>
        <p className="text-sm text-muted-foreground">
          Platform hizmetlerini &quot;olduğu gibi&quot; sunar. GİB, SGK ve diğer
          kamu portallarındaki değişikliklerden dolayı sorumluluk kabul etmez.
          Azami sorumluluk, son 12 ay içinde ödenen toplam hizmet bedeliyle
          sınırlıdır.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">7. Fesih</h2>
        <p className="text-sm text-muted-foreground">
          Kullanıcı dilediği zaman hesabını kapatabilir. Hesap kapatıldıktan sonra
          veriler 30 gün süreyle erişilebilir tutulur, ardından kalıcı olarak
          silinir.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">8. Uyuşmazlık Çözümü</h2>
        <p className="text-sm text-muted-foreground">
          Bu Sözleşme Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda
          öncelikle arabuluculuk yoluna başvurulur. İstanbul Mahkemeleri ve İcra
          Daireleri yetkilidir.
        </p>
      </section>
      <p className="text-xs text-muted-foreground pt-2">Son güncelleme: Şubat 2026</p>
    </div>
  );
}

function GizlilikPolitikasiContent() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-2">1. Veri Sorumlusu</h2>
        <p className="text-sm text-muted-foreground">
          SMMM-AI uygulaması olarak, 6698 sayılı Kişisel Verilerin Korunması
          Kanunu kapsamında veri sorumlusu sıfatıyla kişisel verilerinizi
          işlemekteyiz.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">2. Toplanan Kişisel Veriler</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Kimlik bilgileri (ad, soyad, unvan)</li>
          <li>İletişim bilgileri (e-posta, telefon, adres)</li>
          <li>Vergi bilgileri (VKN/TCKN, vergi dairesi)</li>
          <li>GİB ve SGK portal erişim bilgileri (şifrelenmiş olarak)</li>
          <li>Beyanname ve mali dökümanlar</li>
          <li>Kullanım logları ve IP adresleri</li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">3. Verilerin İşlenme Amaçları</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Mali müşavirlik hizmetlerinin sunulması</li>
          <li>Beyanname takibi ve otomasyonu</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          <li>Hizmet kalitesinin iyileştirilmesi</li>
          <li>Güvenlik ve dolandırıcılık önleme</li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">4. Verilerin Saklanması ve Güvenliği</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>AES-256-GCM şifreleme (hassas veriler için)</li>
          <li>SSL/TLS ile güvenli iletişim</li>
          <li>Çok kiracılı (multi-tenant) veri izolasyonu</li>
          <li>Erişim kontrolü ve yetkilendirme</li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">5. Veri Saklama Süresi</h2>
        <p className="text-sm text-muted-foreground">
          Mali belgeler için yasal saklama süresi 10 yıldır. Hizmet ilişkisi sona
          erdikten sonra, yasal zorunluluklar dışındaki veriler silinir veya anonim
          hale getirilir.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">6. KVKK Kapsamındaki Haklarınız</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme</li>
          <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
          <li>KVKK&apos;nın 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme</li>
        </ul>
      </section>
      <p className="text-xs text-muted-foreground pt-2">
        Son güncelleme: Şubat 2026
      </p>
    </div>
  );
}

function CerezPolitikasiContent() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-2">1. Çerez Nedir?</h2>
        <p className="text-sm text-muted-foreground">
          Çerezler, web sitelerinin tarayıcınızda depoladığı küçük metin
          dosyalarıdır. Oturum yönetimi, tercih hatırlama ve kullanıcı deneyimini
          iyileştirme amacıyla kullanılırlar.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">2. Kullanılan Çerezler</h2>
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium mb-1">Zorunlu Çerezler</h3>
            <p className="text-sm text-muted-foreground">
              Oturum yönetimi ve kimlik doğrulama için gereklidir. Bu çerezler
              olmadan platforma giriş yapılamaz.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-1">Supabase Auth Çerezleri</h3>
            <p className="text-sm text-muted-foreground">
              Kullanıcı oturumunu güvenli bir şekilde yönetmek için Supabase
              tarafından kullanılır. JWT token ve oturum bilgilerini içerir.
            </p>
          </div>
        </div>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">3. Çerez Yönetimi</h2>
        <p className="text-sm text-muted-foreground">
          Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilir veya
          silebilirsiniz. Ancak zorunlu çerezlerin devre dışı bırakılması
          platformun düzgün çalışmasını engelleyebilir.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-2">4. Üçüncü Taraf Çerezleri</h2>
        <p className="text-sm text-muted-foreground">
          Google OAuth ile giriş yapılması durumunda Google tarafından çerezler
          kullanılabilir. Bu çerezler Google&apos;ın gizlilik politikasına
          tabidir.
        </p>
      </section>
      <p className="text-xs text-muted-foreground pt-2">Son güncelleme: Şubat 2026</p>
    </div>
  );
}

// --- Ana Bileşen ---

type LegalType = "kvkk" | "kullanim-kosullari" | "gizlilik-politikasi" | "cerez-politikasi";

const LEGAL_CONFIG: Record<LegalType, { title: string; content: () => ReactNode }> = {
  kvkk: { title: "KVKK Aydınlatma Metni", content: KVKKContent },
  "kullanim-kosullari": { title: "Kullanım Koşulları", content: KullanimKosullariContent },
  "gizlilik-politikasi": { title: "Gizlilik Politikası", content: GizlilikPolitikasiContent },
  "cerez-politikasi": { title: "Çerez Politikası", content: CerezPolitikasiContent },
};

interface LegalDialogProps {
  type: LegalType;
  children: ReactNode;
}

export function LegalDialog({ type, children }: LegalDialogProps) {
  const config = LEGAL_CONFIG[type];
  const Content = config.content;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{config.title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-2 scrollbar-thin">
          <Content />
        </div>
      </DialogContent>
    </Dialog>
  );
}
