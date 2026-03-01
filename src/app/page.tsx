import Link from "next/link";
import { ArrowRight, Shield, Users, Zap, BarChart3, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <header className="border-b">
                <div className="container flex items-center justify-between h-16">
                    <Link href="/" className="text-xl font-bold text-primary">
                        SMMM Asistan
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link href="/login">
                            <Button variant="ghost" size="sm">Giriş Yap</Button>
                        </Link>
                        <Link href="/register">
                            <Button size="sm">Ücretsiz Başla</Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="py-16 md:py-24 border-b">
                <div className="container">
                    <div className="max-w-3xl">
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                            Mali Müşavirlik Ofisinizi
                            <span className="block text-primary">Dijital Çağa Taşıyın</span>
                        </h1>
                        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
                            Beyanname takibi, müşteri yönetimi, GİB entegrasyonu ve AI destekli muhasebe asistanı ile
                            ofisinizin verimliliğini artırın.
                        </p>
                        <div className="mt-10 flex flex-wrap gap-4">
                            <Link href="/register">
                                <Button size="lg">
                                    Ücretsiz Deneyin
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="/login">
                                <Button variant="outline" size="lg">
                                    Giriş Yap
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 bg-muted/30">
                <div className="container">
                    <h2 className="text-2xl font-bold text-center mb-12">Öne Çıkan Özellikler</h2>
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        <FeatureCard
                            icon={<BarChart3 className="h-6 w-6" />}
                            title="Beyanname Takibi"
                            description="KDV, Muhtasar, SGK ve tüm beyannameleri tek ekrandan takip edin."
                        />
                        <FeatureCard
                            icon={<Zap className="h-6 w-6" />}
                            title="GİB Entegrasyonu"
                            description="Otomatik beyanname çekimi ile manuel işlemlere son verin."
                        />
                        <FeatureCard
                            icon={<Users className="h-6 w-6" />}
                            title="Müşteri Yönetimi"
                            description="Tüm müşterilerinizi organize edin, takip çizelgesi oluşturun."
                        />
                        <FeatureCard
                            icon={<Mail className="h-6 w-6" />}
                            title="Mail Gönderim Merkezi"
                            description="Tahakkuk ve evrakları tek tıkla müşterilerinize gönderin."
                        />
                        <FeatureCard
                            icon={<Lock className="h-6 w-6" />}
                            title="Şifre Yönetimi"
                            description="Müşteri şifrelerini güvenli şekilde saklayın ve yönetin."
                        />
                        <FeatureCard
                            icon={<Shield className="h-6 w-6" />}
                            title="AI Muhasebe Asistanı"
                            description="Vergi mevzuatı konusunda anında cevaplar alın."
                        />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 border-t">
                <div className="container">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-8 rounded-lg border bg-muted/30">
                        <div>
                            <h3 className="text-xl font-semibold">Hemen Başlayın</h3>
                            <p className="text-muted-foreground mt-1">14 gün ücretsiz deneme, kredi kartı gerekmez.</p>
                        </div>
                        <Link href="/register">
                            <Button size="lg">
                                Ücretsiz Hesap Oluştur
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-8 mt-auto">
                <div className="container">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                        <p>© 2024 SMMM Asistan. Tüm hakları saklıdır.</p>
                        <div className="flex gap-6">
                            <Link href="/terms" className="hover:text-foreground transition-colors">Kullanım Koşulları</Link>
                            <Link href="/privacy" className="hover:text-foreground transition-colors">Gizlilik Politikası</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-6 rounded-lg border bg-card">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                {icon}
            </div>
            <h3 className="font-semibold mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
}
