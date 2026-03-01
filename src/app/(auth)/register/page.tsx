import Link from "next/link";
import { Building2, Star } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";
import { LegalDialog } from "@/components/auth/legal-dialog";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";

const AVATARS = [
    { initials: "AY", bg: "bg-blue-600" },
    { initials: "MK", bg: "bg-emerald-600" },
    { initials: "SÖ", bg: "bg-violet-600" },
    { initials: "FD", bg: "bg-amber-600" },
];

export default function RegisterPage() {
    return (
        <div className="relative h-screen overflow-hidden">
            {/* Tam ekran arka plan görseli */}
            <div
                className="fixed inset-0 bg-cover bg-center"
                style={{
                    backgroundImage:
                        "url('https://images.unsplash.com/photo-1762319007311-31597c44aad8?auto=format&fit=crop&w=3840&q=80')",
                }}
            />
            <div className="fixed inset-0 bg-gradient-to-t from-black/50 via-black/20 to-black/30" />

            {/* İçerik */}
            <div className="relative z-10 h-screen flex flex-col overflow-hidden">
                {/* Üst: Marka */}
                <div className="flex items-center gap-2 px-6 lg:px-8 pt-4 lg:pt-6">
                    <Building2 className="h-5 w-5 text-white/90" />
                    <span className="font-medium text-lg text-white/90">
                        SMMM Asistan
                    </span>
                </div>

                {/* Orta: Başlık + Form */}
                <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
                    {/* Ana başlık */}
                    <div className="text-center mb-4">
                        <h1 className="text-3xl lg:text-4xl font-semibold text-white leading-tight">
                            Türkiye&apos;nin SMMM&apos;leri için
                            <br />
                            Dijital Dönüşüm
                        </h1>
                        <p className="text-base lg:text-lg text-white/80 mt-3">
                            Otomasyon, hız ve güven.
                        </p>
                    </div>

                    {/* Register Card */}
                    <Card className="w-full max-w-lg border-2 max-h-[70vh] overflow-y-auto">
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-2xl font-bold tracking-tight">
                                Hesap Oluştur
                            </CardTitle>
                            <CardDescription>
                                14 gün ücretsiz deneme ile başlayın
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RegisterForm />
                        </CardContent>
                        <CardFooter className="flex flex-col items-center gap-3">
                            <div className="text-sm text-muted-foreground">
                                Zaten hesabınız var mı?{" "}
                                <Link
                                    href="/login"
                                    className="text-primary hover:underline font-medium"
                                >
                                    Giriş yapın
                                </Link>
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                                <LegalDialog type="gizlilik-politikasi">
                                    <button type="button" className="hover:underline">
                                        Gizlilik Politikası
                                    </button>
                                </LegalDialog>
                                <span>|</span>
                                <LegalDialog type="cerez-politikasi">
                                    <button type="button" className="hover:underline">
                                        Çerez Politikası
                                    </button>
                                </LegalDialog>
                            </div>
                        </CardFooter>
                    </Card>
                </div>

                {/* Alt: Sosyal kanıt */}
                <div className="px-6 lg:px-8 pb-4 lg:pb-6">
                    <div className="border-t border-white/[0.06] pt-6 flex items-end justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    {AVATARS.map((avatar) => (
                                        <div
                                            key={avatar.initials}
                                            className={`h-9 w-9 rounded-full ${avatar.bg} border-2 border-white/80 flex items-center justify-center`}
                                        >
                                            <span className="text-xs font-semibold text-white">
                                                {avatar.initials}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="h-9 w-9 rounded-full bg-white border-2 border-white/80 flex items-center justify-center">
                                        <span className="text-xs font-bold text-[oklch(0.45_0.2_250)]">
                                            +100
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-0.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                            key={i}
                                            className="h-4 w-4 fill-yellow-400 text-yellow-400"
                                        />
                                    ))}
                                </div>
                            </div>
                            <p className="text-sm font-medium text-white/90">
                                100+ Mali Müşavir tarafından kullanılıyor
                            </p>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 text-xs text-white/60">
                            <span>AES-256 Şifreleme</span>
                            <span className="text-white/30">·</span>
                            <span>KVKK Uyumlu</span>
                            <span className="text-white/30">·</span>
                            <span>7/24 Destek</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
