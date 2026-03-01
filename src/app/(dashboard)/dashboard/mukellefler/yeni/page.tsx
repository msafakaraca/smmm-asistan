"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, EyeOff, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/sonner"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const formSchema = z.object({
    unvan: z.string().min(2, "Ünvan en az 2 karakter olmalıdır"),
    kisaltma: z.string().optional(),
    vknTckn: z.string().min(10, "VKN/TCKN en az 10 karakter olmalıdır").max(11, "Maksimum 11 karakter"),
    vergiDairesi: z.string().optional(),
    sirketTipi: z.string().min(1, "Şirket tipi seçiniz"),
    email: z.string().email("Geçerli bir email adresi giriniz").optional().or(z.literal('')),
    telefon1: z.string().optional(),
    gibKodu: z.string().optional(),
    gibSifre: z.string().optional(),
    gibParola: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function NewCustomerPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({})

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            unvan: "",
            kisaltma: "",
            vknTckn: "",
            vergiDairesi: "",
            sirketTipi: "sahis",
            email: "",
            telefon1: "",
            gibKodu: "",
            gibSifre: "",
            gibParola: "",
        },
    })

    const togglePassword = (field: string) => {
        setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }))
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true)
        try {
            const response = await fetch("/api/customers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(values),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Bir hata oluştu")
            }

            toast.success("Mükellef başarıyla oluşturuldu")
            router.push("/dashboard/mukellefler")
            router.refresh()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto py-10 max-w-4xl">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/dashboard/mukellefler">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Yeni Mükellef</h2>
                    <p className="text-muted-foreground">
                        Sisteme yeni bir mükellef kaydı oluşturun.
                    </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                    {/* Kimlik Bilgileri */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Kimlik Bilgileri</CardTitle>
                            <CardDescription>Mükellefin temel ticari bilgileri.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="unvan"
                                render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>Ticari Ünvan</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Tam ticari ünvanı giriniz..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="kisaltma"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kısa İsim (Opsiyonel)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Örn: Ahmet Yılmaz" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="sirketTipi"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Şirket Tipi</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seçiniz" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="sahis">Şahıs İşletmesi</SelectItem>
                                                <SelectItem value="limited">Limited Şirket</SelectItem>
                                                <SelectItem value="anonim">Anonim Şirket</SelectItem>
                                                <SelectItem value="basit_usul">Basit Usul</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="vknTckn"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>VKN / TCKN</FormLabel>
                                        <FormControl>
                                            <Input placeholder="1122334455" maxLength={11} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="vergiDairesi"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vergi Dairesi</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Vergi dairesi adı..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* İletişim Bilgileri */}
                    <Card>
                        <CardHeader>
                            <CardTitle>İletişim Bilgileri</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>E-posta Adresi</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="ornek@domain.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="telefon1"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cep Telefonu</FormLabel>
                                        <FormControl>
                                            <Input placeholder="0555 123 45 67" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* GİB Şifreleri */}
                    <Card className="border-orange-200 bg-orange-50/20 dark:bg-orange-950/10">
                        <CardHeader>
                            <CardTitle className="text-orange-700 dark:text-orange-400">GİB Şifreleri</CardTitle>
                            <CardDescription>
                                Bu şifreler veritabanında şifrelenerek saklanır. Sadece bot işlemleri sırasında kullanılır.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-3">
                            <FormField
                                control={form.control}
                                name="gibKodu"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kullanıcı Kodu</FormLabel>
                                        <FormControl>
                                            <Input placeholder="GİB Kullanıcı Kodu" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="gibParola"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>GİB Parola</FormLabel>
                                        <div className="relative">
                                            <FormControl>
                                                <Input
                                                    type={showPassword["gibParola"] ? "text" : "password"}
                                                    placeholder="••••••"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                onClick={() => togglePassword("gibParola")}
                                            >
                                                {showPassword["gibParola"] ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="gibSifre"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>GİB Şifre</FormLabel>
                                        <div className="relative">
                                            <FormControl>
                                                <Input
                                                    type={showPassword["gibSifre"] ? "text" : "password"}
                                                    placeholder="••••••"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                onClick={() => togglePassword("gibSifre")}
                                            >
                                                {showPassword["gibSifre"] ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Link href="/dashboard/mukellefler">
                            <Button type="button" variant="outline">İptal</Button>
                        </Link>
                        <Button type="submit" disabled={loading}>
                            {loading && <Save className="mr-2 h-4 w-4 animate-spin" />}
                            {!loading && <Save className="mr-2 h-4 w-4" />}
                            Kaydet
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
