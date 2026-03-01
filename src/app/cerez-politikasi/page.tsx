import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CerezPolitikasiPage() {
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

        <h1 className="text-3xl font-bold mb-8">Çerez Politikası</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">
              1. Çerez Nedir?
            </h2>
            <p className="text-muted-foreground">
              Çerezler, web sitelerinin tarayıcınızda depoladığı küçük metin
              dosyalarıdır. Oturum yönetimi, tercih hatırlama ve kullanıcı
              deneyimini iyileştirme amacıyla kullanılırlar.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              2. Kullanılan Çerezler
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">
                  Zorunlu Çerezler
                </h3>
                <p className="text-muted-foreground text-sm">
                  Oturum yönetimi ve kimlik doğrulama için gereklidir. Bu
                  çerezler olmadan platforma giriş yapılamaz.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-1">
                  Supabase Auth Çerezleri
                </h3>
                <p className="text-muted-foreground text-sm">
                  Kullanıcı oturumunu güvenli bir şekilde yönetmek için
                  Supabase tarafından kullanılır. JWT token ve oturum
                  bilgilerini içerir.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              3. Çerez Yönetimi
            </h2>
            <p className="text-muted-foreground">
              Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilir veya
              silebilirsiniz. Ancak zorunlu çerezlerin devre dışı
              bırakılması platformun düzgün çalışmasını engelleyebilir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              4. Üçüncü Taraf Çerezleri
            </h2>
            <p className="text-muted-foreground">
              Google OAuth ile giriş yapılması durumunda Google tarafından
              çerezler kullanılabilir. Bu çerezler Google&apos;ın gizlilik
              politikasına tabidir.
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
