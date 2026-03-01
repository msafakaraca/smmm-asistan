"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icon } from "@iconify/react"
import { toast } from "@/components/ui/sonner"

export function TurmobSettingsCard() {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    // Orijinal değerler (dirty state için)
    const originalValues = useRef({ username: "", password: "" })

    // Şifre görünürlük toggle
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/settings/turmob")
            if (res.ok) {
                const data = await res.json()
                setUsername(data.username || "")
                setPassword(data.password || "")

                // Orijinal değerleri kaydet
                originalValues.current = {
                    username: data.username || "",
                    password: data.password || ""
                }
            }
        } catch (error) {
            console.error("Failed to fetch TÜRMOB settings:", error)
        } finally {
            setLoading(false)
        }
    }

    // Değişiklik kontrolü
    const isDirty = username !== originalValues.current.username ||
        password !== originalValues.current.password

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/settings/turmob", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    password: password || undefined
                })
            })

            const data = await res.json()

            if (res.ok) {
                toast.success(data.message || "TÜRMOB ayarları kaydedildi")
                // Orijinal değerleri güncelle
                originalValues.current = { username, password }
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
                        <Icon icon="solar:global-bold" className="h-5 w-5" />
                        TÜRMOB E-Birlik Ayarları
                    </CardTitle>
                    <CardDescription>
                        TÜRMOB E-Birlik sistemi giriş bilgileriniz
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
                    <Icon icon="solar:global-bold" className="h-5 w-5" />
                    TÜRMOB E-Birlik Ayarları
                </CardTitle>
                <CardDescription>
                    TÜRMOB E-Birlik sisteminden mükellef bilgilerini otomatik çekmek için giriş bilgilerinizi kaydedin
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="turmob-username">Kullanıcı Adı</Label>
                        <Input
                            id="turmob-username"
                            type="text"
                            placeholder="TÜRMOB kullanıcı adınız"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="turmob-password">Şifre</Label>
                        <div className="relative">
                            <Input
                                id="turmob-password"
                                type={showPassword ? "text" : "password"}
                                placeholder="TÜRMOB şifreniz"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pr-10"
                            />
                            {password && (
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
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={saving || !username || !isDirty}
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
                    {!isDirty && password && (
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
