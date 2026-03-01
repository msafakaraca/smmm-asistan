"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icon } from "@iconify/react"
import { toast } from "@/components/ui/sonner"

export function GibSettingsCard() {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [gibCode, setGibCode] = useState("")
    const [gibPassword, setGibPassword] = useState("")
    const [gibParola, setGibParola] = useState("")
    const [captchaKey, setCaptchaKey] = useState("")

    // Orijinal değerler (dirty state için)
    const originalValues = useRef({ gibCode: "", gibPassword: "", gibParola: "", captchaKey: "" })

    // Şifre görünürlük toggle
    const [showPassword, setShowPassword] = useState(false)
    const [showParola, setShowParola] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/settings/gib")
            if (res.ok) {
                const data = await res.json()
                setGibCode(data.gibCode || "")
                setGibPassword(data.gibPassword || "")
                setGibParola(data.gibParola || "")
                setCaptchaKey(data.captchaKey || "")

                // Orijinal değerleri kaydet (dirty state için)
                originalValues.current = {
                    gibCode: data.gibCode || "",
                    gibPassword: data.gibPassword || "",
                    gibParola: data.gibParola || "",
                    captchaKey: data.captchaKey || ""
                }
            }
        } catch (error) {
            console.error("Failed to fetch GİB settings:", error)
        } finally {
            setLoading(false)
        }
    }

    // Değişiklik kontrolü
    const isDirty = gibCode !== originalValues.current.gibCode ||
        gibPassword !== originalValues.current.gibPassword ||
        gibParola !== originalValues.current.gibParola ||
        captchaKey !== originalValues.current.captchaKey

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/settings/gib", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gibCode,
                    gibPassword: gibPassword || undefined,
                    gibParola: gibParola || undefined,
                    captchaKey
                })
            })

            const data = await res.json()

            if (res.ok) {
                toast.success(data.message || "GİB ayarları kaydedildi")
                // Orijinal değerleri güncelle
                originalValues.current = { gibCode, gibPassword, gibParola, captchaKey }
            } else {
                toast.error(data.error || "Kaydetme başarısız")
            }
        } catch (error) {
            toast.error("Bağlantı hatası")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Icon icon="solar:shield-bold" className="h-5 w-5" />
                        GİB Giriş Bilgileri
                    </CardTitle>
                    <CardDescription>
                        Gelir İdaresi Başkanlığı giriş bilgileriniz
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8">
                    <Icon icon="solar:refresh-bold" className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Icon icon="solar:shield-bold" className="h-5 w-5" />
                    GİB Giriş Bilgileri
                </CardTitle>
                <CardDescription>
                    GİB e-beyan sisteminden mükellef bilgilerini otomatik çekmek için giriş bilgilerinizi kaydedin
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="gib-code">Kullanıcı Kodu (VKN/TCKN)</Label>
                        <Input
                            id="gib-code"
                            type="text"
                            placeholder="Vergi Kimlik No veya TC Kimlik No"
                            value={gibCode}
                            onChange={(e) => setGibCode(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gib-password">Şifre</Label>
                        <div className="relative">
                            <Input
                                id="gib-password"
                                type={showPassword ? "text" : "password"}
                                placeholder="GİB şifreniz"
                                value={gibPassword}
                                onChange={(e) => setGibPassword(e.target.value)}
                                className="pr-10"
                            />
                            {gibPassword && (
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Icon
                                        icon={showPassword ? "solar:eye-closed-linear" : "solar:eye-linear"}
                                        className="h-4 w-4"
                                    />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gib-parola">Parola (e-Beyan)</Label>
                        <div className="relative">
                            <Input
                                id="gib-parola"
                                type={showParola ? "text" : "password"}
                                placeholder="e-Beyan parolanız"
                                value={gibParola}
                                onChange={(e) => setGibParola(e.target.value)}
                                className="pr-10"
                            />
                            {gibParola && (
                                <button
                                    type="button"
                                    onClick={() => setShowParola(!showParola)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Icon
                                        icon={showParola ? "solar:eye-closed-linear" : "solar:eye-linear"}
                                        className="h-4 w-4"
                                    />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="captcha-key">2Captcha API Key</Label>
                        <Input
                            id="captcha-key"
                            type="text"
                            placeholder="Otomatik CAPTCHA çözme için (opsiyonel)"
                            value={captchaKey}
                            onChange={(e) => setCaptchaKey(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={saving || !gibCode || !isDirty}
                        variant={isDirty ? "default" : "outline"}
                        className="gap-2"
                    >
                        {saving ? (
                            <>
                                <Icon icon="solar:refresh-bold" className="h-4 w-4 animate-spin" />
                                Kaydediliyor...
                            </>
                        ) : (
                            <>
                                <Icon icon="solar:diskette-bold" className="h-4 w-4" />
                                Kaydet
                            </>
                        )}
                    </Button>
                    {!isDirty && (gibPassword || gibParola) && (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                            <Icon icon="solar:check-circle-bold" className="h-4 w-4" />
                            Kaydedildi
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
