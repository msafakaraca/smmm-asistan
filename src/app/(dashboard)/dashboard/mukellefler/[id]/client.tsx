"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Eye, EyeOff, Copy, Check, Hash, Building2, Loader2, Plus, Trash2, Pencil, GitBranch, Shield, Landmark, GraduationCap, KeyRound } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

const profileSchema = z.object({
    unvan: z.string().min(2, "Ünvan en az 2 karakter olmalıdır"),
    kisaltma: z.string().optional(),
    vknTckn: z.string().min(10).max(11),
    vergiKimlikNo: z.string().optional(),
    tcKimlikNo: z.string().optional(),
    vergiDairesi: z.string().optional(),
    sirketTipi: z.string().min(1, "Şirket tipi seçiniz"),
    email: z.string().email().optional().or(z.literal("")),
    telefon1: z.string().optional(),
    telefon2: z.string().optional(),
    adres: z.string().optional(),
    yetkiliKisi: z.string().optional(),
    notes: z.string().optional(),
    siraNo: z.string().optional(),
    sozlesmeNo: z.string().optional(),
    sozlesmeTarihi: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

interface CustomerDetailClientProps {
    customerId: string
}

export function CustomerDetailClient({ customerId }: CustomerDetailClientProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = React.useState<string>("profile")
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [customer, setCustomer] = React.useState<any>(null)

    // Şifre state'leri
    const [credentials, setCredentials] = React.useState<any>(null)
    const [loadingCredentials, setLoadingCredentials] = React.useState(false)
    const [showPasswords, setShowPasswords] = React.useState<Record<string, boolean>>({})
    const [copied, setCopied] = React.useState<string | null>(null)

    // Şube state'leri
    const [branches, setBranches] = React.useState<Array<{ id: string; branchName: string; sgk: any }>>([])
    const [loadingBranches, setLoadingBranches] = React.useState(false)
    const [branchDialogOpen, setBranchDialogOpen] = React.useState(false)
    const [newBranchName, setNewBranchName] = React.useState("")
    const [addingBranch, setAddingBranch] = React.useState(false)
    const [addedBranches, setAddedBranches] = React.useState<Array<{ id: string; branchName: string }>>([])
    const [editingBranchId, setEditingBranchId] = React.useState<string | null>(null)
    const [branchFormData, setBranchFormData] = React.useState<Record<string, string>>({})
    const [savingBranch, setSavingBranch] = React.useState(false)
    const [deleteBranchId, setDeleteBranchId] = React.useState<string | null>(null)
    const [confirmFirstBranch, setConfirmFirstBranch] = React.useState(false)

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema) as any,
        defaultValues: {
            unvan: "",
            kisaltma: "",
            vknTckn: "",
            vergiKimlikNo: "",
            tcKimlikNo: "",
            vergiDairesi: "",
            sirketTipi: "sahis",
            email: "",
            telefon1: "",
            telefon2: "",
            adres: "",
            yetkiliKisi: "",
            notes: "",
            siraNo: "",
            sozlesmeNo: "",
            sozlesmeTarihi: "",
        },
    })

    React.useEffect(() => {
        fetchCustomer()
    }, [customerId])

    React.useEffect(() => {
        if (activeTab === "branches" && branches.length === 0) {
            fetchBranches()
        }
    }, [activeTab])

    const fetchCustomer = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/customers/${customerId}`)
            if (!res.ok) throw new Error("Müşteri bulunamadı")
            const data = await res.json()
            setCustomer(data)
            form.reset({
                unvan: data.unvan || "",
                kisaltma: data.kisaltma || "",
                vknTckn: data.vknTckn || "",
                vergiKimlikNo: data.vergiKimlikNo || "",
                tcKimlikNo: data.tcKimlikNo || "",
                vergiDairesi: data.vergiDairesi || "",
                sirketTipi: data.sirketTipi || "sahis",
                email: data.email || "",
                telefon1: data.telefon1 || "",
                telefon2: data.telefon2 || "",
                adres: data.adres || "",
                yetkiliKisi: data.yetkiliKisi || "",
                notes: data.notes || "",
                siraNo: data.siraNo || "",
                sozlesmeNo: data.sozlesmeNo || "",
                sozlesmeTarihi: data.sozlesmeTarihi || "",
            })
        } catch {
            toast.error("Müşteri bilgileri yüklenemedi")
        } finally {
            setLoading(false)
        }
    }

    const fetchBranches = async () => {
        setLoadingBranches(true)
        try {
            const res = await fetch(`/api/customers/${customerId}/branches`)
            if (!res.ok) throw new Error("Şubeler alınamadı")
            const data = await res.json()
            setBranches(data)
        } catch {
            toast.error("Şubeler yüklenemedi")
        } finally {
            setLoadingBranches(false)
        }
    }

    const handleAddBranch = async () => {
        const trimmedName = newBranchName.trim()
        if (!trimmedName) return

        if (branches.length === 0 && !confirmFirstBranch) {
            const hasExistingSgk = customer?.sgkKullaniciAdi || customer?.sgkIsyeriKodu || customer?.sgkSistemSifresi || customer?.sgkIsyeriSifresi
            if (hasExistingSgk) {
                setConfirmFirstBranch(true)
                return
            }
        }

        setAddingBranch(true)
        try {
            const isFirst = branches.length === 0
            const res = await fetch(`/api/customers/${customerId}/branches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    branchName: trimmedName,
                    copyFromCustomer: isFirst,
                }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "Şube eklenemedi")
                return
            }
            const data = await res.json()
            setAddedBranches(prev => [...prev, { id: data.id, branchName: trimmedName }])
            setNewBranchName("")
            setConfirmFirstBranch(false)
            toast.success(`"${trimmedName}" şubesi eklendi`)
            fetchBranches()
        } catch {
            toast.error("Şube eklenirken hata oluştu")
        } finally {
            setAddingBranch(false)
        }
    }

    const handleDeleteBranch = async (branchId: string) => {
        try {
            const res = await fetch(`/api/customers/${customerId}/branches?branchId=${branchId}`, {
                method: "DELETE",
            })
            if (!res.ok) throw new Error()
            toast.success("Şube silindi")
            setBranches(prev => prev.filter(b => b.id !== branchId))
            setDeleteBranchId(null)
        } catch {
            toast.error("Şube silinemedi")
        }
    }

    const handleSaveBranch = async (branchId: string) => {
        setSavingBranch(true)
        try {
            const res = await fetch(`/api/customers/${customerId}/branches`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    branchId,
                    sgkKullaniciAdi: branchFormData[`${branchId}_kullaniciAdi`] || "",
                    sgkIsyeriKodu: branchFormData[`${branchId}_isyeriKodu`] || "",
                    sgkSistemSifresi: branchFormData[`${branchId}_sistemSifresi`] || "",
                    sgkIsyeriSifresi: branchFormData[`${branchId}_isyeriSifresi`] || "",
                }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "Güncelleme başarısız")
                return
            }
            toast.success("Şube bilgileri güncellendi")
            setEditingBranchId(null)
            fetchBranches()
        } catch {
            toast.error("Güncelleme sırasında hata oluştu")
        } finally {
            setSavingBranch(false)
        }
    }

    const startEditBranch = (branch: any) => {
        setEditingBranchId(branch.id)
        setBranchFormData({
            [`${branch.id}_kullaniciAdi`]: branch.sgk?.kullaniciAdi || "",
            [`${branch.id}_isyeriKodu`]: branch.sgk?.isyeriKodu || "",
            [`${branch.id}_sistemSifresi`]: branch.sgk?.sistemSifresi || "",
            [`${branch.id}_isyeriSifresi`]: branch.sgk?.isyeriSifresi || "",
        })
    }

    const fetchCredentials = async () => {
        setLoadingCredentials(true)
        try {
            const res = await fetch(`/api/customers/${customerId}/credentials`)
            if (!res.ok) throw new Error("Şifreler alınamadı")
            const data = await res.json()
            setCredentials(data)
        } catch {
            toast.error("Şifreler yüklenemedi")
        } finally {
            setLoadingCredentials(false)
        }
    }

    const onSubmit = async (values: ProfileFormValues) => {
        setSaving(true)
        try {
            const res = await fetch(`/api/customers/${customerId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })
            if (!res.ok) throw new Error("Kayıt başarısız")
            toast.success("Bilgiler güncellendi")
            fetchCustomer()
        } catch {
            toast.error("Güncelleme sırasında hata oluştu")
        } finally {
            setSaving(false)
        }
    }

    const togglePassword = (field: string) => {
        setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }))
    }

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text)
        setCopied(field)
        setTimeout(() => setCopied(null), 2000)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Yükleniyor...</p>
                </div>
            </div>
        )
    }

    if (!customer) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="font-semibold">Müşteri bulunamadı</h3>
                    <p className="text-sm text-muted-foreground mb-4">Bu mükellef silinmiş veya erişim izniniz yok.</p>
                    <Button variant="outline" onClick={() => router.push("/dashboard/mukellefler")}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Mükelleflere Dön
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] -m-4 xl:-m-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                {/* Header + Tabs birleşik */}
                <div className="border-b px-4 py-2 shrink-0 bg-background">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/mukellefler")} className="shrink-0 h-8">
                                <ArrowLeft className="h-4 w-4 mr-1.5" />
                                Geri
                            </Button>
                            <div className="h-5 w-px bg-border shrink-0" />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-semibold truncate text-sm">{customer.unvan}</h2>
                                    <Badge variant={customer.status === "passive" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 shrink-0">
                                        {customer.status === "passive" ? "Pasif" : "Aktif"}
                                    </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">VKN: {customer.vknTckn}</span>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs shrink-0"
                            onClick={() => {
                                setAddedBranches([])
                                setNewBranchName("")
                                setBranchDialogOpen(true)
                            }}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Şube Ekle
                        </Button>
                    </div>
                    <TabsList className="h-9 gap-1 bg-transparent p-0">
                        <TabsTrigger
                            value="profile"
                            className="rounded-md px-3 py-1.5 text-xs font-medium data-[state=inactive]:text-muted-foreground data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                        >
                            Profil
                        </TabsTrigger>
                        <TabsTrigger
                            value="passwords"
                            className="rounded-md px-3 py-1.5 text-xs font-medium data-[state=inactive]:text-muted-foreground data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                        >
                            Şifreler
                        </TabsTrigger>
                        <TabsTrigger
                            value="branches"
                            className="rounded-md px-3 py-1.5 text-xs font-medium data-[state=inactive]:text-muted-foreground data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                        >
                            Şubeler
                            {branches.length > 0 && (
                                <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                                    {branches.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-auto">
                    {/* Profil Tab */}
                    <TabsContent value="profile" className="m-0 p-4 xl:p-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                <div className="grid gap-x-4 gap-y-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    <FormField control={form.control} name="unvan" render={({ field }) => (
                                        <FormItem className="sm:col-span-2 lg:col-span-3">
                                            <FormLabel className="text-xs">Ticari Ünvan</FormLabel>
                                            <FormControl><Input {...field} className="h-9" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="kisaltma" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Kısa İsim</FormLabel>
                                            <FormControl><Input {...field} className="h-9" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="sirketTipi" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Şirket Tipi</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="sahis">Şahıs</SelectItem>
                                                    <SelectItem value="basit_usul">Basit Usul</SelectItem>
                                                    <SelectItem value="firma">Firma</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="vergiDairesi" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Vergi Dairesi</FormLabel>
                                            <FormControl><Input {...field} className="h-9" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="vergiKimlikNo" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Vergi Kimlik No</FormLabel>
                                            <FormControl><Input {...field} maxLength={10} placeholder="10 haneli VKN" className="h-9" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="tcKimlikNo" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">T.C. Kimlik No</FormLabel>
                                            <FormControl><Input {...field} maxLength={11} placeholder="11 haneli TC" className="h-9" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">E-posta</FormLabel>
                                            <FormControl><Input type="email" {...field} className="h-9" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="telefon1" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Telefon</FormLabel>
                                            <FormControl><Input {...field} className="h-9" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="telefon2" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Telefon 2</FormLabel>
                                            <FormControl><Input {...field} className="h-9" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="yetkiliKisi" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Yetkili Kişi</FormLabel>
                                            <FormControl><Input {...field} className="h-9" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="adres" render={({ field }) => (
                                        <FormItem className="sm:col-span-2 lg:col-span-3">
                                            <FormLabel className="text-xs">Adres</FormLabel>
                                            <FormControl><Input {...field} className="h-9" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="notes" render={({ field }) => (
                                        <FormItem className="sm:col-span-2 lg:col-span-3">
                                            <FormLabel className="text-xs">Notlar</FormLabel>
                                            <FormControl><Input {...field} className="h-9" /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                {/* Sözleşme Bilgileri */}
                                <div className="border-t pt-4 mt-4">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                        Sözleşme & Türmob Bilgileri
                                    </h4>
                                    <div className="grid gap-x-4 gap-y-3 grid-cols-1 sm:grid-cols-3">
                                        <FormField control={form.control} name="siraNo" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs flex items-center gap-1">
                                                    <Hash className="h-3 w-3" />
                                                    Sıra No
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="1, 2, 3..." className="h-9" />
                                                </FormControl>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="sozlesmeNo" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Sözleşme No</FormLabel>
                                                <FormControl><Input {...field} className="h-9" /></FormControl>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="sozlesmeTarihi" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Sözleşme Tarihi</FormLabel>
                                                <FormControl><Input {...field} className="h-9" /></FormControl>
                                            </FormItem>
                                        )} />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button type="submit" disabled={saving} size="sm">
                                        {saving ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="mr-2 h-4 w-4" />
                                        )}
                                        {saving ? "Kaydediliyor..." : "Kaydet"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </TabsContent>

                    {/* Şifreler Tab */}
                    <TabsContent value="passwords" className="m-0 p-4 xl:p-6">
                        {!credentials ? (
                            <div className="text-center py-12">
                                <p className="text-sm text-muted-foreground mb-3">
                                    Şifreleri görüntülemek için butona tıklayın.
                                </p>
                                <Button onClick={fetchCredentials} disabled={loadingCredentials} size="sm">
                                    {loadingCredentials ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Yükleniyor...
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="mr-2 h-4 w-4" />
                                            Şifreleri Göster
                                        </>
                                    )}
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
                                {[
                                    {
                                        title: "GİB Şifreleri",
                                        icon: Landmark,
                                        fields: [
                                            { key: "gibKodu", label: "Kullanıcı Kodu" },
                                            { key: "gibParola", label: "Parola" },
                                            { key: "gibSifre", label: "Şifre" },
                                        ],
                                    },
                                    {
                                        title: "SGK Şifreleri",
                                        icon: Shield,
                                        fields: [
                                            { key: "sgkKullaniciAdi", label: "Kullanıcı Adı" },
                                            { key: "sgkIsyeriKodu", label: "İşyeri Kodu" },
                                            { key: "sgkSistemSifresi", label: "Sistem Şifresi" },
                                            { key: "sgkIsyeriSifresi", label: "İşyeri Şifresi" },
                                        ],
                                    },
                                    {
                                        title: "TÜRMOB Şifreleri",
                                        icon: GraduationCap,
                                        fields: [
                                            { key: "turmobKullaniciAdi", label: "Kullanıcı Adı" },
                                            { key: "turmobSifre", label: "Şifre" },
                                        ],
                                    },
                                    {
                                        title: "E-Devlet Şifreleri",
                                        icon: KeyRound,
                                        fields: [
                                            { key: "edevletTckn", label: "T.C. Kimlik No" },
                                            { key: "edevletSifre", label: "Şifre" },
                                        ],
                                    },
                                ].map((section) => (
                                    <div key={section.title} className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/10 p-4">
                                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200/60 dark:border-blue-800/40">
                                            <section.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300">{section.title}</h3>
                                        </div>
                                        <div className="space-y-2.5">
                                            {section.fields.map(({ key, label }) => (
                                                <div key={key}>
                                                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                                                    <div className="flex mt-0.5 gap-1">
                                                        <Input type={showPasswords[key] ? "text" : "password"} value={credentials[key] || ""} readOnly className="flex-1 h-9 font-mono text-sm bg-white dark:bg-background" />
                                                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => togglePassword(key)}>
                                                            {showPasswords[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => copyToClipboard(credentials[key] || "", key)}>
                                                            {copied === key ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Şubeler Tab */}
                    <TabsContent value="branches" className="m-0 p-4 xl:p-6">
                        {loadingBranches ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : branches.length === 0 ? (
                            <div className="text-center py-12">
                                <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                                <h3 className="font-semibold mb-1">Henüz şube eklenmemiş</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    SGK şubelerini ekleyerek her şube için ayrı credential yönetimi yapabilirsiniz.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setAddedBranches([])
                                        setNewBranchName("")
                                        setBranchDialogOpen(true)
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Şube Ekle
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {branches.map((branch) => (
                                    <div key={branch.id}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <GitBranch className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm font-medium">{branch.branchName}</span>
                                                {branch.sgk?.hasKullaniciAdi && branch.sgk?.hasIsyeriKodu && branch.sgk?.hasSistemSifresi && branch.sgk?.hasIsyeriSifresi ? (
                                                    <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">Tamam</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">Eksik</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {editingBranchId === branch.id ? (
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        disabled={savingBranch}
                                                        onClick={() => handleSaveBranch(branch.id)}
                                                    >
                                                        {savingBranch ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                                                        Kaydet
                                                    </Button>
                                                ) : (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditBranch(branch)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                    onClick={() => setDeleteBranchId(branch.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid gap-x-4 gap-y-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                                            {[
                                                { key: "kullaniciAdi", label: "Kullanıcı Adı" },
                                                { key: "isyeriKodu", label: "İşyeri Kodu" },
                                                { key: "sistemSifresi", label: "Sistem Şifresi" },
                                                { key: "isyeriSifresi", label: "İşyeri Şifresi" },
                                            ].map(({ key, label }) => (
                                                <div key={key}>
                                                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                                                    <div className="flex mt-0.5 gap-1">
                                                        <Input
                                                            type={showPasswords[`${branch.id}_${key}`] ? "text" : "password"}
                                                            value={editingBranchId === branch.id
                                                                ? (branchFormData[`${branch.id}_${key}`] ?? "")
                                                                : (branch.sgk?.[key] || "")}
                                                            readOnly={editingBranchId !== branch.id}
                                                            onChange={(e) => editingBranchId === branch.id && setBranchFormData(prev => ({
                                                                ...prev,
                                                                [`${branch.id}_${key}`]: e.target.value
                                                            }))}
                                                            className="flex-1 h-9 font-mono text-xs"
                                                            placeholder={editingBranchId === branch.id ? label : "—"}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9"
                                                            onClick={() => togglePassword(`${branch.id}_${key}`)}
                                                        >
                                                            {showPasswords[`${branch.id}_${key}`] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="border-b mt-4" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </div>
            </Tabs>

            {/* Şube Ekle Dialog */}
            <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Şube Ekle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Şube adı"
                                value={newBranchName}
                                onChange={(e) => setNewBranchName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddBranch()}
                                className="flex-1"
                                autoFocus
                            />
                            <Button
                                onClick={handleAddBranch}
                                disabled={!newBranchName.trim() || addingBranch}
                                size="sm"
                            >
                                {addingBranch ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-1" />
                                        Kaydet ve Yeni Ekle
                                    </>
                                )}
                            </Button>
                        </div>
                        {addedBranches.length > 0 && (
                            <div className="border rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-2">Eklenen şubeler:</p>
                                <div className="space-y-1.5">
                                    {addedBranches.map((b) => (
                                        <div key={b.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2.5 py-1.5">
                                            <div className="flex items-center gap-2">
                                                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>{b.branchName}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>
                            Kapat
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* İlk Şube Onay Dialog */}
            <AlertDialog open={confirmFirstBranch} onOpenChange={setConfirmFirstBranch}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>SGK Bilgileri Taşınacak</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu müşterinin mevcut SGK bilgileri ilk şubeye kopyalanacak ve ana müşteri üzerindeki SGK alanları temizlenecektir.
                            Bundan sonra SGK bilgileri sadece şubeler üzerinden yönetilecektir.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleAddBranch}>
                            Devam Et
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Şube Silme Onay */}
            <AlertDialog open={!!deleteBranchId} onOpenChange={(open) => !open && setDeleteBranchId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Şubeyi Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu şubeyi silmek istediğinize emin misiniz? Şubeye ait tüm SGK bilgileri kalıcı olarak silinecektir.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteBranchId && handleDeleteBranch(deleteBranchId)}
                        >
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
